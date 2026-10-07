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
import { mstLocationRepository, type MstLocationInput } from "@/lib/server/repositories/mst-location.repository";
import {
  shippingPlanRepository,
  type ShippingPlanHeaderInput,
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
    isActive: body.isActive !== false,
  };
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

const EDITABLE: ShippingPlanStatus[] = ["DRAFT", "PLANNED"];

// action -> [allowed from statuses, resulting status]
const TRANSITIONS: Record<string, [ShippingPlanStatus[], ShippingPlanStatus]> = {
  approve: [["PLANNED"], "APPROVED"],
  cancel: [["DRAFT", "PLANNED", "APPROVED"], "CANCELLED"],
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
};
