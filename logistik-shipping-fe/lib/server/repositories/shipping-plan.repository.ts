import type { PoolClient } from "pg";
import { execute, query, withTransaction } from "@/lib/server/db";

export type ShippingPlanStatus = "DRAFT" | "PLANNED" | "APPROVED" | "BOOKED" | "DISPATCHED" | "CANCELLED";

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
  // booking + cost (null until the plan is booked)
  carrierNewId: string | null;
  carrierName: string | null;
  driverNewId: string | null;
  driverName: string | null;
  plateNo: string | null;
  distanceKm: string | null;
  baseFee: string | null;
  perKmFee: string | null;
  freightCost: string | null;
  loadingFee: string | null;
  otherFee: string | null;
  totalCost: string | null;
  bookingNotes: string | null;
  deliveryNoteNo: string | null;
  dispatchedAt: Date | null;
  // inputs for the cost estimate
  originLatitude: number | null;
  originLongitude: number | null;
  destinationLatitude: number | null;
  destinationLongitude: number | null;
  vehicleBaseFee: string | null;
  vehicleRatePerKm: string | null;
};

export type BookingInput = {
  carrierNewId: string;
  driverNewId: string;
  plateNo: string;
  distanceKm: number;
  baseFee: number;
  perKmFee: number;
  freightCost: number;
  loadingFee: number;
  otherFee: number;
  totalCost: number;
  bookingNotes: string | null;
};

export type DeliveryNoteRow = {
  deliveryNoteNo: string | null;
  dispatchedAt: Date | null;
  originName: string;
  originAddress: string | null;
  originCity: string | null;
  originContact: string | null;
  originPhone: string | null;
  destinationName: string;
  destinationAddress: string | null;
  destinationCity: string | null;
  destinationContact: string | null;
  destinationPhone: string | null;
  vehicleType: string | null;
  vehicleName: string | null;
  carrierName: string | null;
  carrierType: string | null;
  driverName: string | null;
  driverPhone: string | null;
  driverLicenseNo: string | null;
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
         p.created_by, p.created_date, p.updated_by, p.updated_date,
         p.carrier_new_id, ca.name AS carrier_name, p.driver_new_id, dr.name AS driver_name, p.plate_no,
         trim_scale(p.distance_km)::text AS distance_km, p.base_fee::text AS base_fee, p.per_km_fee::text AS per_km_fee,
         p.freight_cost::text AS freight_cost, p.loading_fee::text AS loading_fee, p.other_fee::text AS other_fee,
         p.total_cost::text AS total_cost, p.booking_notes, p.delivery_note_no, p.dispatched_at,
         o.latitude::float8 AS origin_latitude, o.longitude::float8 AS origin_longitude,
         d.latitude::float8 AS destination_latitude, d.longitude::float8 AS destination_longitude,
         v.base_fee::text AS vehicle_base_fee, v.rate_per_km::text AS vehicle_rate_per_km
  FROM shipping_plan p
  JOIN mst_location o ON o.new_id = p.origin_location_new_id
  JOIN mst_location d ON d.new_id = p.destination_location_new_id
  LEFT JOIN mst_vehicle v ON v.new_id = p.vehicle_new_id
  LEFT JOIN mst_carrier ca ON ca.new_id = p.carrier_new_id
  LEFT JOIN mst_driver dr ON dr.new_id = p.driver_new_id`;

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

  /** Stores the booking (carrier, driver, plate, cost snapshot) and moves the plan to BOOKED. */
  saveBooking(newId: string, input: BookingInput, by: string, from: ShippingPlanStatus, note: string) {
    return withTransaction(async (tx) => {
      const rows = await execute(
        `UPDATE shipping_plan
         SET carrier_new_id = @carrierNewId, driver_new_id = @driverNewId, plate_no = @plateNo, distance_km = @distanceKm,
             base_fee = @baseFee, per_km_fee = @perKmFee, freight_cost = @freightCost, loading_fee = @loadingFee,
             other_fee = @otherFee, total_cost = @totalCost, booking_notes = @bookingNotes,
             status = 'BOOKED', updated_by = @by, updated_date = now()
         WHERE new_id = @newId AND status = @from`,
        { ...input, newId, by, from },
        tx,
      );
      if (rows === 0) return false;
      await addHistory(tx, newId, from, "BOOKED", note, by);
      return true;
    });
  },

  /** Issues the delivery note number and marks the plan as dispatched. */
  dispatch(newId: string, by: string) {
    return withTransaction(async (tx) => {
      const rows = await query<{ deliveryNoteNo: string }>(
        `UPDATE shipping_plan
         SET status = 'DISPATCHED', dispatched_at = now(), updated_by = @by, updated_date = now(),
             delivery_note_no = 'SJ-' || to_char(now(), 'YYMM') || '-' || lpad(nextval('delivery_note_no_seq')::text, 4, '0')
         WHERE new_id = @newId AND status = 'BOOKED'
         RETURNING delivery_note_no`,
        { newId, by },
        tx,
      );
      if (rows.length === 0) return null;
      await addHistory(tx, newId, "BOOKED", "DISPATCHED", `Surat jalan ${rows[0].deliveryNoteNo} diterbitkan`, by);
      return rows[0].deliveryNoteNo;
    });
  },

  async getDeliveryNote(newId: string) {
    const rows = await query<DeliveryNoteRow>(
      `SELECT p.delivery_note_no, p.dispatched_at,
              o.name AS origin_name, o.address AS origin_address, o.city AS origin_city,
              o.contact_name AS origin_contact, o.contact_phone AS origin_phone,
              d.name AS destination_name, d.address AS destination_address, d.city AS destination_city,
              d.contact_name AS destination_contact, d.contact_phone AS destination_phone,
              v.type AS vehicle_type, v.name AS vehicle_name,
              ca.name AS carrier_name, ca.type AS carrier_type,
              dr.name AS driver_name, dr.phone AS driver_phone, dr.license_no AS driver_license_no
       FROM shipping_plan p
       JOIN mst_location o ON o.new_id = p.origin_location_new_id
       JOIN mst_location d ON d.new_id = p.destination_location_new_id
       LEFT JOIN mst_vehicle v ON v.new_id = p.vehicle_new_id
       LEFT JOIN mst_carrier ca ON ca.new_id = p.carrier_new_id
       LEFT JOIN mst_driver dr ON dr.new_id = p.driver_new_id
       WHERE p.new_id = @newId`,
      { newId },
    );
    return rows[0] ?? null;
  },
};
