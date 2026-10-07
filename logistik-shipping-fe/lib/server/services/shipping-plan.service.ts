import {
  HttpError,
  currentActor,
  optNumber,
  optString,
  requireDate,
  requireEnum,
  requireGuid,
  requireString,
} from "@/lib/server/http";
import { freightCost, roadDistanceKm } from "@/lib/freight";
import { mstLocationRepository, type MstLocationInput } from "@/lib/server/repositories/mst-location.repository";
import { mstCarrierRepository, mstDriverRepository } from "@/lib/server/repositories/mst-logistics.repository";
import {
  shippingPlanRepository,
  type ShippingPlanHeaderInput,
  type ShippingPlanItemRow,
  type ShippingPlanRow,
  type ShippingPlanStatus,
} from "@/lib/server/repositories/shipping-plan.repository";

const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
const HANDLING = ["COLD_CHAIN", "FRAGILE", "HAZARDOUS"] as const;
const LOCATION_TYPES = ["WAREHOUSE", "CUSTOMER"] as const;

function locationInput(body: Record<string, unknown>): MstLocationInput {
  return {
    code: requireString(body.code, "code").toUpperCase(),
    name: requireString(body.name, "name"),
    type: requireEnum(body.type, LOCATION_TYPES, "type"),
    address: optString(body.address),
    city: optString(body.city),
    province: optString(body.province),
    contactName: optString(body.contactName),
    contactPhone: optString(body.contactPhone),
    latitude: optCoordinate(body.latitude, -90, 90, "latitude"),
    longitude: optCoordinate(body.longitude, -180, 180, "longitude"),
    isActive: body.isActive !== false,
  };
}

function optCoordinate(value: unknown, min: number, max: number, label: string) {
  const n = optNumber(value, label);
  if (n !== null && (n < min || n > max)) throw new HttpError(400, `${label} must be between ${min} and ${max}.`);
  return n;
}

/** Unique-violation on code -> 409 instead of a generic 500. */
function mapDuplicate(err: unknown): never {
  if (typeof err === "object" && err !== null && (err as { code?: string }).code === "23505") {
    throw new HttpError(409, "Location code already exists.");
  }
  throw err;
}

export const mstLocationService = {
  getAll: () => mstLocationRepository.getAll(),
  getLov: () => mstLocationRepository.getLov(),

  async create(body: Record<string, unknown>) {
    const by = await currentActor();
    return mstLocationRepository.create({ ...locationInput(body), createdBy: by }).catch(mapDuplicate);
  },

  async update(newId: string, body: Record<string, unknown>) {
    requireGuid(newId, "location id");
    const by = await currentActor();
    const row = await mstLocationRepository.update(newId, { ...locationInput(body), updatedBy: by }).catch(mapDuplicate);
    if (!row) throw new HttpError(404, "Location not found.");
    return row;
  },
};

function headerInput(body: Record<string, unknown>): ShippingPlanHeaderInput {
  const input: ShippingPlanHeaderInput = {
    originLocationNewId: requireGuid(requireString(body.originLocationNewId, "origin"), "origin"),
    destinationLocationNewId: requireGuid(requireString(body.destinationLocationNewId, "destination"), "destination"),
    requestedDeliveryDate: requireDate(body.requestedDeliveryDate, "requestedDeliveryDate"),
    plannedShipDate: requireDate(body.plannedShipDate, "plannedShipDate"),
    priority: requireEnum(body.priority ?? "NORMAL", PRIORITIES, "priority"),
    specialHandling: body.specialHandling ? requireEnum(body.specialHandling, HANDLING, "specialHandling") : null,
    notes: optString(body.notes),
  };
  if (input.originLocationNewId.toLowerCase() === input.destinationLocationNewId.toLowerCase()) {
    throw new HttpError(400, "Origin and destination must be different.");
  }
  if (input.requestedDeliveryDate < input.plannedShipDate) {
    throw new HttpError(400, "Requested delivery date cannot be before the planned ship date.");
  }
  return input;
}

/** FK / check violations from bad ids become 400 instead of 500. */
function mapReference(err: unknown): never {
  const code = typeof err === "object" && err !== null ? (err as { code?: string }).code : undefined;
  if (code === "23503") throw new HttpError(400, "Unknown location, vehicle or item.");
  throw err;
}

async function getPlanOrThrow(newId: string) {
  const plan = await shippingPlanRepository.getByNewId(requireGuid(newId, "plan id"));
  if (!plan) throw new HttpError(404, "Shipping plan not found.");
  return plan;
}

const PLATE_RE = /^[A-Z]{1,2} ?\d{1,4} ?[A-Z]{0,3}$/;

/** Optional non-negative whole-rupiah amount; empty means 0. */
function money(value: unknown, label: string) {
  const n = optNumber(value, label);
  if (n === null) return 0;
  if (n < 0 || !Number.isInteger(n)) throw new HttpError(400, `${label} must be a whole number of rupiah, 0 or more.`);
  return n;
}

export type FreightEstimate = {
  distanceKm: number | null;
  distanceSource: "coordinates" | "manual" | null;
  baseFee: number | null;
  perKmFee: number | null;
  freightCost: number | null;
  loadingFee: number;
  otherFee: number;
  totalCost: number | null;
  /** Why no estimate could be made (null when complete). */
  missing: string | null;
};

function computeEstimate(
  plan: ShippingPlanRow,
  overrides: { distanceKm?: number | null; loadingFee?: number; otherFee?: number },
): FreightEstimate {
  const loadingFee = overrides.loadingFee ?? 0;
  const otherFee = overrides.otherFee ?? 0;
  const empty = { distanceKm: null, distanceSource: null, baseFee: null, perKmFee: null, freightCost: null, loadingFee, otherFee, totalCost: null };

  if (!plan.vehicleNewId) return { ...empty, missing: "Plan belum punya kendaraan. Simpan load simulation dulu." };

  const baseFee = plan.vehicleBaseFee !== null ? Number(plan.vehicleBaseFee) : null;
  const perKmFee = plan.vehicleRatePerKm !== null ? Number(plan.vehicleRatePerKm) : null;
  if (baseFee === null || perKmFee === null) return { ...empty, missing: "Tarif kendaraan belum diisi di Master Vehicle (base fee dan rate per km)." };

  let distanceKm: number | null = null;
  let distanceSource: FreightEstimate["distanceSource"] = null;
  if (overrides.distanceKm && overrides.distanceKm > 0) {
    distanceKm = overrides.distanceKm;
    distanceSource = "manual";
  } else if (
    plan.originLatitude !== null && plan.originLongitude !== null &&
    plan.destinationLatitude !== null && plan.destinationLongitude !== null
  ) {
    distanceKm = roadDistanceKm(plan.originLatitude, plan.originLongitude, plan.destinationLatitude, plan.destinationLongitude);
    distanceSource = "coordinates";
  }
  if (distanceKm === null) {
    return { ...empty, baseFee, perKmFee, missing: "Jarak belum bisa dihitung (lokasi belum punya koordinat). Isi jarak manual." };
  }

  const freight = freightCost(distanceKm, baseFee, perKmFee);
  return { distanceKm, distanceSource, baseFee, perKmFee, freightCost: freight, loadingFee, otherFee, totalCost: freight + loadingFee + otherFee, missing: null };
}

export type LoadingReadiness = {
  /** True when the plan may be dispatched. */
  complete: boolean;
  /** What still blocks dispatch. */
  missing: string[];
  /** Things worth a second look that do not block dispatch. */
  warnings: string[];
  loadedWeightKg: number;
  netWeightKg: number | null;
};

function loadingReadiness(plan: ShippingPlanRow, items: ShippingPlanItemRow[]): LoadingReadiness {
  const missing: string[] = [];
  const warnings: string[] = [];

  const loadedUnits = items.reduce((sum, item) => sum + (item.loadedQty ?? 0), 0);
  const loadedWeightKg = items.reduce((sum, item) => sum + (item.loadedQty ?? 0) * Number(item.unitWeightKg ?? 0), 0);
  if (items.some((item) => item.loadedQty === null)) missing.push("Jumlah yang dimuat belum diisi untuk semua barang.");
  else if (loadedUnits === 0) missing.push("Tidak ada barang yang dimuat.");

  const checks: [boolean, string][] = [
    [plan.chkVehiclePapers, "KIR dan STNK kendaraan"],
    [plan.chkVehicleClean, "Kebersihan bak"],
    [plan.chkVehicleCondition, "Kondisi kendaraan"],
    [plan.chkDriverReady, "Kesiapan driver"],
    [plan.chkCargoSecured, "Muatan sudah diikat / diamankan"],
  ];
  const unchecked = checks.filter(([ok]) => !ok).map(([, label]) => label);
  if (unchecked.length > 0) missing.push(`Checklist belum lengkap: ${unchecked.join(", ")}.`);

  if (plan.specialHandling === "COLD_CHAIN" && plan.loadingTempC === null) missing.push("Suhu bak saat muat belum dicatat (cold chain).");
  if (!plan.sealNo) missing.push("Nomor segel belum diisi.");

  const gross = plan.grossWeightKg !== null ? Number(plan.grossWeightKg) : null;
  const tare = plan.tareWeightKg !== null ? Number(plan.tareWeightKg) : null;
  let netWeightKg: number | null = null;
  if (gross === null || tare === null) {
    missing.push("Hasil timbang (berat kosong dan berat isi) belum diisi.");
  } else {
    netWeightKg = Math.round((gross - tare) * 100) / 100;
    const payload = plan.vehicleMaxPayload !== null ? Number(plan.vehicleMaxPayload) : null;
    if (payload !== null && netWeightKg > payload) {
      missing.push(`Berat muatan hasil timbang ${netWeightKg} kg melebihi max payload kendaraan ${payload} kg.`);
    }
    if (loadedWeightKg > 0 && Math.abs(netWeightKg - loadedWeightKg) / loadedWeightKg > 0.15) {
      warnings.push(`Berat hasil timbang (${netWeightKg} kg) berbeda lebih dari 15% dari berat muatan di sistem (${Math.round(loadedWeightKg * 10) / 10} kg).`);
    }
  }

  const short = items.filter((item) => item.loadedQty !== null && item.loadedQty < item.qty);
  if (short.length > 0) warnings.push(`${short.length} barang dimuat kurang dari rencana. Surat jalan memakai jumlah yang benar-benar dimuat.`);

  return { complete: missing.length === 0, missing, warnings, loadedWeightKg: Math.round(loadedWeightKg * 10) / 10, netWeightKg };
}

/** Integer in [0, max], or a 400 naming the item. */
function qtyInRange(value: unknown, max: number, label: string) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > max) throw new HttpError(400, `${label}: jumlah harus bilangan bulat antara 0 dan ${max}.`);
  return n;
}

/** Matches the submitted quantities to the plan's items, one entry per item. */
function matchItems(items: ShippingPlanItemRow[], raw: unknown, field: "pickedQty" | "loadedQty", limit: (item: ShippingPlanItemRow) => number) {
  const list = Array.isArray(raw) ? raw : [];
  const byId = new Map<string, Record<string, unknown>>();
  for (const entry of list) {
    const e = (typeof entry === "object" && entry !== null ? entry : {}) as Record<string, unknown>;
    byId.set(String(e.cubstoolNewId ?? "").toLowerCase(), e);
  }
  return items.map((item) => {
    const entry = byId.get(item.cubstoolNewId.toLowerCase());
    if (!entry) throw new HttpError(400, `${item.itemName}: jumlah belum diisi.`);
    return { cubstoolNewId: item.cubstoolNewId, qty: qtyInRange(entry[field], limit(item), item.itemName) };
  });
}

const EDITABLE: ShippingPlanStatus[] = ["DRAFT", "PLANNED"];

// action -> [allowed from statuses, resulting status]
const TRANSITIONS: Record<string, [ShippingPlanStatus[], ShippingPlanStatus]> = {
  approve: [["PLANNED"], "APPROVED"],
  cancel: [["DRAFT", "PLANNED", "APPROVED", "BOOKED", "PICKING", "LOADING"], "CANCELLED"],
};

export const shippingPlanService = {
  getAll: () => shippingPlanRepository.getAll(),

  async getDetail(newId: string) {
    const plan = await getPlanOrThrow(newId);
    const [items, history] = await Promise.all([
      shippingPlanRepository.getItems(plan.newId),
      shippingPlanRepository.getHistory(plan.newId),
    ]);
    return { ...plan, items, history, readiness: loadingReadiness(plan, items) };
  },

  async create(body: Record<string, unknown>) {
    const by = await currentActor();
    const newId = await shippingPlanRepository.create(headerInput(body), by).catch(mapReference);
    return getPlanOrThrow(newId);
  },

  async updateHeader(newId: string, body: Record<string, unknown>) {
    const plan = await getPlanOrThrow(newId);
    if (!EDITABLE.includes(plan.status)) throw new HttpError(409, `A plan with status ${plan.status} cannot be edited.`);
    const by = await currentActor();
    await shippingPlanRepository.updateHeader(plan.newId, headerInput(body), by).catch(mapReference);
    return getPlanOrThrow(plan.newId);
  },

  async saveLoad(newId: string, body: Record<string, unknown>) {
    const plan = await getPlanOrThrow(newId);
    if (!EDITABLE.includes(plan.status)) throw new HttpError(409, `A plan with status ${plan.status} cannot be changed.`);

    const vehicleNewId = requireGuid(requireString(body.vehicleNewId, "vehicleNewId"), "vehicleNewId");
    const utilizationPct = optNumber(body.utilizationPct, "utilizationPct") ?? 0;
    if (utilizationPct < 0 || utilizationPct > 100) throw new HttpError(400, "utilizationPct must be between 0 and 100.");

    const rawItems = Array.isArray(body.items) ? body.items : [];
    // merge duplicate products (the simulator adds one entry per click)
    const qtyByItem = new Map<string, number>();
    for (const raw of rawItems) {
      const item = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
      const id = requireGuid(requireString(item.cubstoolNewId, "cubstoolNewId"), "cubstoolNewId").toLowerCase();
      const qty = Number(item.qty);
      if (!Number.isInteger(qty) || qty <= 0) throw new HttpError(400, "Item qty must be a positive whole number.");
      qtyByItem.set(id, (qtyByItem.get(id) ?? 0) + qty);
    }
    if (qtyByItem.size === 0) throw new HttpError(400, "Add at least one item.");

    const by = await currentActor();
    await shippingPlanRepository
      .saveLoad(
        plan.newId,
        { vehicleNewId, utilizationPct, items: [...qtyByItem].map(([cubstoolNewId, qty]) => ({ cubstoolNewId, qty })) },
        by,
        plan.status,
      )
      .catch(mapReference);
    return this.getDetail(plan.newId);
  },

  async changeStatus(newId: string, body: Record<string, unknown>) {
    const plan = await getPlanOrThrow(newId);
    const action = requireEnum(body.action, Object.keys(TRANSITIONS) as ["approve", "cancel"], "action");
    const [allowedFrom, to] = TRANSITIONS[action];
    if (!allowedFrom.includes(plan.status)) throw new HttpError(409, `Cannot ${action} a plan with status ${plan.status}.`);
    if (action === "cancel" && !optString(body.note)) throw new HttpError(400, "A reason is required to cancel a plan.");

    const by = await currentActor();
    const ok = await shippingPlanRepository.changeStatus(plan.newId, plan.status, to, optString(body.note), by);
    if (!ok) throw new HttpError(409, "The plan status was changed by someone else. Reload and try again.");
    return this.getDetail(plan.newId);
  },

  /** Cost estimate for a plan; `overrides` lets the booking form preview a manual distance or extra fees. */
  async estimate(newId: string, overrides: { distanceKm?: number | null; loadingFee?: number; otherFee?: number } = {}) {
    return computeEstimate(await getPlanOrThrow(newId), overrides);
  },

  /** Books carrier, driver and plate for an approved plan and fixes the cost snapshot. */
  async saveBooking(newId: string, body: Record<string, unknown>) {
    const plan = await getPlanOrThrow(newId);
    if (plan.status !== "APPROVED" && plan.status !== "BOOKED") {
      throw new HttpError(409, `Booking only applies to approved plans (status is ${plan.status}).`);
    }

    const carrierNewId = requireGuid(requireString(body.carrierNewId, "carrierNewId"), "carrierNewId");
    const driverNewId = requireGuid(requireString(body.driverNewId, "driverNewId"), "driverNewId");
    const [carrier, driver] = await Promise.all([mstCarrierRepository.getByNewId(carrierNewId), mstDriverRepository.getByNewId(driverNewId)]);
    if (!carrier || !carrier.isActive) throw new HttpError(400, "Carrier not found or inactive.");
    if (!driver || !driver.isActive) throw new HttpError(400, "Driver not found or inactive.");
    if (driver.carrierNewId && driver.carrierNewId.toLowerCase() !== carrierNewId.toLowerCase()) {
      throw new HttpError(400, `Driver ${driver.name} belongs to ${driver.carrierName ?? "another carrier"}.`);
    }
    if (driver.licenseExpiry && driver.licenseExpiry < plan.plannedShipDate) {
      throw new HttpError(400, `SIM driver ${driver.name} sudah kadaluarsa pada ${driver.licenseExpiry}, sebelum tanggal kirim.`);
    }

    const plateNo = requireString(body.plateNo, "plateNo").toUpperCase().replace(/\s+/g, " ");
    if (!PLATE_RE.test(plateNo)) throw new HttpError(400, "Plate number is not valid (example: B 1234 XYZ).");

    const est = computeEstimate(plan, {
      distanceKm: optNumber(body.distanceKm, "distanceKm"),
      loadingFee: money(body.loadingFee, "loadingFee"),
      otherFee: money(body.otherFee, "otherFee"),
    });
    if (est.missing) throw new HttpError(400, est.missing);

    const by = await currentActor();
    const ok = await shippingPlanRepository.saveBooking(
      plan.newId,
      {
        carrierNewId,
        driverNewId,
        plateNo,
        distanceKm: est.distanceKm as number,
        baseFee: est.baseFee as number,
        perKmFee: est.perKmFee as number,
        freightCost: est.freightCost as number,
        loadingFee: est.loadingFee,
        otherFee: est.otherFee,
        totalCost: est.totalCost as number,
        bookingNotes: optString(body.bookingNotes),
      },
      by,
      plan.status,
      `${plan.status === "BOOKED" ? "Booking diubah" : "Booking dibuat"}: ${carrier.name}, ${driver.name}, ${plateNo}, total Rp ${est.totalCost?.toLocaleString("id-ID")}`,
    );
    if (!ok) throw new HttpError(409, "The plan status was changed by someone else. Reload and try again.");
    return this.getDetail(plan.newId);
  },

  /** Issues the surat jalan number and sends the truck off. */
  async dispatch(newId: string) {
    const plan = await getPlanOrThrow(newId);
    if (plan.status !== "LOADING") throw new HttpError(409, `Only a plan that is being loaded can be dispatched (status is ${plan.status}).`);
    const readiness = loadingReadiness(plan, await shippingPlanRepository.getItems(plan.newId));
    if (!readiness.complete) throw new HttpError(400, `Loading belum lengkap: ${readiness.missing.join(" ")}`);
    const by = await currentActor();
    const noteNo = await shippingPlanRepository.dispatch(plan.newId, by);
    if (!noteNo) throw new HttpError(409, "The plan status was changed by someone else. Reload and try again.");
    return this.getDetail(plan.newId);
  },

  /** Everything the printed surat jalan needs. A booked plan gives a preview without a number yet. */
  async getDeliveryNote(newId: string) {
    const plan = await getPlanOrThrow(newId);
    if (!["BOOKED", "PICKING", "LOADING", "DISPATCHED"].includes(plan.status)) {
      throw new HttpError(409, "A delivery note is available once the plan is booked.");
    }
    const [note, items] = await Promise.all([shippingPlanRepository.getDeliveryNote(plan.newId), shippingPlanRepository.getItems(plan.newId)]);
    if (!note) throw new HttpError(404, "Shipping plan not found.");
    return { planNo: plan.planNo, status: plan.status, preview: plan.status !== "DISPATCHED", plan, note, items };
  },

  /** BOOKED -> PICKING: the warehouse starts picking and packing. */
  async startPicking(newId: string) {
    const plan = await getPlanOrThrow(newId);
    if (plan.status !== "BOOKED") throw new HttpError(409, `Picking can only start for a booked plan (status is ${plan.status}).`);
    const by = await currentActor();
    const ok = await shippingPlanRepository.changeStatus(plan.newId, "BOOKED", "PICKING", "Picking & packing dimulai", by);
    if (!ok) throw new HttpError(409, "The plan status was changed by someone else. Reload and try again.");
    return this.getDetail(plan.newId);
  },

  /** Records the picked quantities. With `complete` the plan moves on to LOADING. */
  async savePicking(newId: string, body: Record<string, unknown>) {
    const plan = await getPlanOrThrow(newId);
    if (plan.status !== "PICKING") throw new HttpError(409, `Picking is only open while the plan is in PICKING (status is ${plan.status}).`);
    const items = await shippingPlanRepository.getItems(plan.newId);
    const picked = matchItems(items, body.items, "pickedQty", (item) => item.qty);
    const notes = optString(body.notes);
    const complete = body.complete === true;

    const pickedUnits = picked.reduce((sum, i) => sum + i.qty, 0);
    const plannedUnits = items.reduce((sum, i) => sum + i.qty, 0);
    if (complete) {
      if (pickedUnits === 0) throw new HttpError(400, "Tidak ada barang yang di-pick.");
      if (pickedUnits < plannedUnits && !notes) throw new HttpError(400, "Ada selisih picking dari rencana. Isi catatan penyebabnya (stok kurang, rusak, dan sebagainya).");
    }

    const by = await currentActor();
    const ok = await shippingPlanRepository.savePicking(
      plan.newId,
      { items: picked.map((i) => ({ cubstoolNewId: i.cubstoolNewId, pickedQty: i.qty })), notes },
      complete,
      by,
      `Picking & packing selesai: ${pickedUnits} dari ${plannedUnits} karton${notes ? ` (${notes})` : ""}`,
    );
    if (!ok) throw new HttpError(409, "The plan status was changed by someone else. Reload and try again.");
    return this.getDetail(plan.newId);
  },

  /** Records the loading checklist, seal, weighbridge readings and the quantities really loaded (plan stays in LOADING). */
  async saveLoading(newId: string, body: Record<string, unknown>) {
    const plan = await getPlanOrThrow(newId);
    if (plan.status !== "LOADING") throw new HttpError(409, `Loading data can only be saved while the plan is in LOADING (status is ${plan.status}).`);
    const items = await shippingPlanRepository.getItems(plan.newId);
    const loaded = matchItems(items, body.items, "loadedQty", (item) => item.pickedQty ?? item.qty);

    const checklist = (typeof body.checklist === "object" && body.checklist !== null ? body.checklist : {}) as Record<string, unknown>;
    const weight = (value: unknown, label: string) => {
      const n = optNumber(value, label);
      if (n !== null && n < 0) throw new HttpError(400, `${label} tidak boleh negatif.`);
      return n;
    };
    const gross = weight(body.grossWeightKg, "Berat isi");
    const tare = weight(body.tareWeightKg, "Berat kosong");
    if (gross !== null && tare !== null && gross <= tare) throw new HttpError(400, "Berat isi harus lebih besar dari berat kosong.");
    const temp = optNumber(body.loadingTempC, "Suhu");
    if (temp !== null && (temp < -40 || temp > 60)) throw new HttpError(400, "Suhu harus antara -40 dan 60 °C.");
    const sealNo = optString(body.sealNo);
    if (sealNo && sealNo.length > 50) throw new HttpError(400, "Nomor segel terlalu panjang (maksimal 50 karakter).");

    const by = await currentActor();
    const ok = await shippingPlanRepository.saveLoading(
      plan.newId,
      {
        items: loaded.map((i) => ({ cubstoolNewId: i.cubstoolNewId, loadedQty: i.qty })),
        chkVehiclePapers: checklist.vehiclePapers === true,
        chkVehicleClean: checklist.vehicleClean === true,
        chkVehicleCondition: checklist.vehicleCondition === true,
        chkDriverReady: checklist.driverReady === true,
        chkCargoSecured: checklist.cargoSecured === true,
        loadingTempC: temp,
        sealNo,
        grossWeightKg: gross,
        tareWeightKg: tare,
        notes: optString(body.notes),
      },
      by,
    );
    if (!ok) throw new HttpError(409, "The plan status was changed by someone else. Reload and try again.");
    return this.getDetail(plan.newId);
  },
};
