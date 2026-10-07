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

const EDITABLE: ShippingPlanStatus[] = ["DRAFT", "PLANNED"];

// action -> [allowed from statuses, resulting status]
const TRANSITIONS: Record<string, [ShippingPlanStatus[], ShippingPlanStatus]> = {
  approve: [["PLANNED"], "APPROVED"],
  cancel: [["DRAFT", "PLANNED", "APPROVED", "BOOKED"], "CANCELLED"],
};

export const shippingPlanService = {
  getAll: () => shippingPlanRepository.getAll(),

  async getDetail(newId: string) {
    const plan = await getPlanOrThrow(newId);
    const [items, history] = await Promise.all([
      shippingPlanRepository.getItems(plan.newId),
      shippingPlanRepository.getHistory(plan.newId),
    ]);
    return { ...plan, items, history };
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
    if (plan.status !== "BOOKED") throw new HttpError(409, `Only a booked plan can be dispatched (status is ${plan.status}).`);
    const by = await currentActor();
    const noteNo = await shippingPlanRepository.dispatch(plan.newId, by);
    if (!noteNo) throw new HttpError(409, "The plan status was changed by someone else. Reload and try again.");
    return this.getDetail(plan.newId);
  },

  /** Everything the printed surat jalan needs. A booked plan gives a preview without a number yet. */
  async getDeliveryNote(newId: string) {
    const plan = await getPlanOrThrow(newId);
    if (plan.status !== "BOOKED" && plan.status !== "DISPATCHED") {
      throw new HttpError(409, "A delivery note is available once the plan is booked.");
    }
    const [note, items] = await Promise.all([shippingPlanRepository.getDeliveryNote(plan.newId), shippingPlanRepository.getItems(plan.newId)]);
    if (!note) throw new HttpError(404, "Shipping plan not found.");
    return { planNo: plan.planNo, status: plan.status, preview: plan.status !== "DISPATCHED", plan, note, items };
  },
};
