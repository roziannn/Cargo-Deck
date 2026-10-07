import type { PoolClient } from "pg";
import { execute, query, withTransaction } from "@/lib/server/db";

export type ShippingPlanStatus = "DRAFT" | "PLANNED" | "APPROVED" | "CANCELLED";

export type ShippingPlanRow = {
  id: number;
  newId: string;
  planNo: string;
  status: ShippingPlanStatus;
  originLocationNewId: string;
  originName: string;
  destinationLocationNewId: string;
  destinationName: string;
  requestedDeliveryDate: string;
  plannedShipDate: string;
  priority: string;
  specialHandling: string | null;
  notes: string | null;
  vehicleNewId: string | null;
  vehicleName: string | null;
  vehicleMaxPayload: string | null;
  totalUnits: number;
  totalWeightKg: string;
  utilizationPct: string | null;
  createdBy: string | null;
  createdDate: Date;
  updatedBy: string | null;
  updatedDate: Date | null;
};

export type ShippingPlanItemRow = {
  cubstoolNewId: string;
  itemCode: string;
  itemName: string;
  unitWeightKg: string | null;
  qty: number;
};

export type ShippingPlanHistoryRow = {
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  changedBy: string | null;
  changedDate: Date;
};

export type ShippingPlanHeaderInput = {
  originLocationNewId: string;
  destinationLocationNewId: string;
  requestedDeliveryDate: string;
  plannedShipDate: string;
  priority: string;
  specialHandling: string | null;
  notes: string | null;
};

// dates are returned as YYYY-MM-DD text (no timezone shifting), numerics as text
const SELECT = `
  SELECT p.id, p.new_id, p.plan_no, p.status,
         p.origin_location_new_id, o.name AS origin_name,
         p.destination_location_new_id, d.name AS destination_name,
         to_char(p.requested_delivery_date, 'YYYY-MM-DD') AS requested_delivery_date,
         to_char(p.planned_ship_date, 'YYYY-MM-DD') AS planned_ship_date,
         p.priority, p.special_handling, p.notes,
         p.vehicle_new_id, v.name AS vehicle_name, trim_scale(v.max_payload)::text AS vehicle_max_payload,
         p.total_units, trim_scale(p.total_weight_kg)::text AS total_weight_kg, trim_scale(p.utilization_pct)::text AS utilization_pct,
         p.created_by, p.created_date, p.updated_by, p.updated_date
  FROM shipping_plan p
  JOIN mst_location o ON o.new_id = p.origin_location_new_id
  JOIN mst_location d ON d.new_id = p.destination_location_new_id
  LEFT JOIN mst_vehicle v ON v.new_id = p.vehicle_new_id`;

async function addHistory(tx: PoolClient, planNewId: string, from: string | null, to: string, note: string | null, by: string) {
  await execute(
    `INSERT INTO shipping_plan_history (plan_new_id, from_status, to_status, note, changed_by)
     VALUES (@planNewId, @from, @to, @note, @by)`,
    { planNewId, from, to, note, by },
    tx,
  );
}

export const shippingPlanRepository = {
  getAll: () => query<ShippingPlanRow>(`${SELECT} ORDER BY p.created_date DESC, p.id DESC`),

  async getByNewId(newId: string) {
    const rows = await query<ShippingPlanRow>(`${SELECT} WHERE p.new_id = @newId`, { newId });
    return rows[0] ?? null;
  },

  getItems: (planNewId: string) =>
    query<ShippingPlanItemRow>(
      `SELECT cubstool_new_id, item_code, item_name, trim_scale(unit_weight_kg)::text AS unit_weight_kg, qty
       FROM shipping_plan_item WHERE plan_new_id = @planNewId ORDER BY id`,
      { planNewId },
    ),

  getHistory: (planNewId: string) =>
    query<ShippingPlanHistoryRow>(
      `SELECT from_status, to_status, note, changed_by, changed_date
       FROM shipping_plan_history WHERE plan_new_id = @planNewId ORDER BY changed_date, id`,
      { planNewId },
    ),

  create(input: ShippingPlanHeaderInput, by: string) {
    return withTransaction(async (tx) => {
      const rows = await query<{ newId: string }>(
        `INSERT INTO shipping_plan (plan_no, origin_location_new_id, destination_location_new_id, requested_delivery_date,
                                    planned_ship_date, priority, special_handling, notes, created_by)
         VALUES ('SP-' || to_char(now(), 'YYMM') || '-' || lpad(nextval('shipping_plan_no_seq')::text, 4, '0'),
                 @originLocationNewId, @destinationLocationNewId, @requestedDeliveryDate, @plannedShipDate,
                 @priority, @specialHandling, @notes, @by)
         RETURNING new_id`,
        { ...input, by },
        tx,
      );
      const newId = rows[0].newId;
      await addHistory(tx, newId, null, "DRAFT", "Plan created", by);
      return newId;
    });
  },

  async updateHeader(newId: string, input: ShippingPlanHeaderInput, by: string) {
    const rows = await execute(
      `UPDATE shipping_plan
       SET origin_location_new_id = @originLocationNewId, destination_location_new_id = @destinationLocationNewId,
           requested_delivery_date = @requestedDeliveryDate, planned_ship_date = @plannedShipDate,
           priority = @priority, special_handling = @specialHandling, notes = @notes,
           updated_by = @by, updated_date = now()
       WHERE new_id = @newId`,
      { ...input, newId, by },
    );
    return rows > 0;
  },

  /** Replaces the items + vehicle of a plan with a saved load simulation and moves it to PLANNED. */
  saveLoad(
    newId: string,
    load: { vehicleNewId: string; utilizationPct: number; items: { cubstoolNewId: string; qty: number }[] },
    by: string,
    fromStatus: ShippingPlanStatus,
  ) {
    return withTransaction(async (tx) => {
      await execute("DELETE FROM shipping_plan_item WHERE plan_new_id = @newId", { newId }, tx);
      for (const item of load.items) {
        await execute(
          `INSERT INTO shipping_plan_item (plan_new_id, cubstool_new_id, item_code, item_name, unit_weight_kg, qty)
           SELECT @newId, c.new_id, c.item_code, c.name, c.weight, @qty FROM mst_cubstool c WHERE c.new_id = @cubstoolNewId`,
          { newId, cubstoolNewId: item.cubstoolNewId, qty: item.qty },
          tx,
        );
      }
      await execute(
        `UPDATE shipping_plan p
         SET vehicle_new_id = @vehicleNewId, utilization_pct = @utilizationPct, status = 'PLANNED',
             total_units = COALESCE((SELECT SUM(qty) FROM shipping_plan_item WHERE plan_new_id = p.new_id), 0),
             total_weight_kg = COALESCE((SELECT SUM(qty * COALESCE(unit_weight_kg, 0)) FROM shipping_plan_item WHERE plan_new_id = p.new_id), 0),
             updated_by = @by, updated_date = now()
         WHERE p.new_id = @newId`,
        { newId, vehicleNewId: load.vehicleNewId, utilizationPct: load.utilizationPct, by },
        tx,
      );
      await addHistory(tx, newId, fromStatus, "PLANNED", `Load simulation saved (${load.items.length} item types)`, by);
    });
  },

  changeStatus(newId: string, from: ShippingPlanStatus, to: ShippingPlanStatus, note: string | null, by: string) {
    return withTransaction(async (tx) => {
      // status in the WHERE makes concurrent transitions safe: the second one updates 0 rows
      const rows = await execute(
        "UPDATE shipping_plan SET status = @to, updated_by = @by, updated_date = now() WHERE new_id = @newId AND status = @from",
        { newId, from, to, by },
        tx,
      );
      if (rows === 0) return false;
      await addHistory(tx, newId, from, to, note, by);
      return true;
    });
  },
};
