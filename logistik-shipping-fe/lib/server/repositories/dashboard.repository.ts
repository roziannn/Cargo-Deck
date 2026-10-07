import { query } from "@/lib/server/db";

export type Bucket = "day" | "week";

export type KpiRow = {
  plans: number;
  cancelled: number;
  shipped: number;
  completed: number;
  withIncident: number;
  weightKg: number;
  freightCost: number;
  avgUtilization: number | null;
};

export type StatusCountRow = { status: string; count: number };
export type TrendRow = { bucket: string; plans: number; weightKg: number; cost: number };
export type DestinationRow = { name: string; plans: number; weightKg: number; cost: number };
export type CarrierRow = { name: string; plans: number; cost: number; incidents: number };
export type VehicleTypeRow = { type: string; plans: number; avgUtilization: number | null };
export type IncidentTypeRow = { type: string; total: number; open: number };

export type SnapshotRow = {
  inTransit: number;
  waitingApproval: number;
  waitingBooking: number;
  pastEta: number;
  openIncidents: number;
  overdueIncidents: number;
  openClaimAmount: number;
};

export type PlanSummaryRow = {
  newId: string;
  planNo: string;
  status: string;
  originName: string;
  destinationName: string;
  carrierName: string | null;
  plannedShipDate: string;
  etaDate: string | null;
  totalUnits: number;
  weightKg: number;
  cost: number | null;
};

/**
 * The period is the last `days` days ending today, by planned ship date. `offset` shifts it back,
 * so offset = days gives the period right before it. Cancelled plans are left out of volume figures.
 */
const IN_PERIOD = `p.planned_ship_date BETWEEN (CURRENT_DATE - @offset::int) - (@days::int - 1) AND CURRENT_DATE - @offset::int`;
const SHIPPED = `p.status IN ('DISPATCHED', 'COMPLETED')`;

export const dashboardRepository = {
  async kpi(days: number, offset: number) {
    const rows = await query<KpiRow>(
      `SELECT COUNT(*) FILTER (WHERE p.status <> 'CANCELLED')::int AS plans,
              COUNT(*) FILTER (WHERE p.status = 'CANCELLED')::int AS cancelled,
              COUNT(*) FILTER (WHERE ${SHIPPED})::int AS shipped,
              COUNT(*) FILTER (WHERE p.status = 'COMPLETED')::int AS completed,
              COUNT(*) FILTER (WHERE ${SHIPPED} AND EXISTS (SELECT 1 FROM shipping_incident i WHERE i.plan_new_id = p.new_id))::int AS with_incident,
              COALESCE(SUM(p.total_weight_kg) FILTER (WHERE p.status <> 'CANCELLED'), 0)::float8 AS weight_kg,
              COALESCE(SUM(p.total_cost) FILTER (WHERE ${SHIPPED}), 0)::float8 AS freight_cost,
              AVG(p.utilization_pct) FILTER (WHERE p.status <> 'CANCELLED')::float8 AS avg_utilization
       FROM shipping_plan p WHERE ${IN_PERIOD}`,
      { days, offset },
    );
    return rows[0];
  },

  statusCounts: (days: number) =>
    query<StatusCountRow>(`SELECT p.status, COUNT(*)::int AS count FROM shipping_plan p WHERE ${IN_PERIOD} GROUP BY p.status`, { days, offset: 0 }),

  /** One row per day (or week) of the period, empty buckets included. */
  trend: (days: number, bucket: Bucket) => {
    const trunc = (col: string) => (bucket === "week" ? `date_trunc('week', ${col})::date` : col);
    const step = bucket === "week" ? "interval '7 days'" : "interval '1 day'";
    return query<TrendRow>(
      `SELECT to_char(b.bucket, 'YYYY-MM-DD') AS bucket,
              COUNT(p.id)::int AS plans,
              COALESCE(SUM(p.total_weight_kg), 0)::float8 AS weight_kg,
              COALESCE(SUM(p.total_cost) FILTER (WHERE ${SHIPPED}), 0)::float8 AS cost
       FROM (SELECT gs::date AS bucket
             FROM generate_series(${trunc("(CURRENT_DATE - (@days::int - 1))")}::timestamp, CURRENT_DATE::timestamp, ${step}) gs) b
       LEFT JOIN shipping_plan p
              ON p.status <> 'CANCELLED' AND ${IN_PERIOD} AND ${trunc("p.planned_ship_date")} = b.bucket
       GROUP BY b.bucket ORDER BY b.bucket`,
      { days, offset: 0 },
    );
  },

  destinations: (days: number) =>
    query<DestinationRow>(
      `SELECT d.name, COUNT(*)::int AS plans, COALESCE(SUM(p.total_weight_kg), 0)::float8 AS weight_kg,
              COALESCE(SUM(p.total_cost) FILTER (WHERE ${SHIPPED}), 0)::float8 AS cost
       FROM shipping_plan p JOIN mst_location d ON d.new_id = p.destination_location_new_id
       WHERE p.status <> 'CANCELLED' AND ${IN_PERIOD}
       GROUP BY d.name ORDER BY plans DESC, d.name LIMIT 6`,
      { days, offset: 0 },
    ),

  carriers: (days: number) =>
    query<CarrierRow>(
      `SELECT c.name, COUNT(*)::int AS plans, COALESCE(SUM(p.total_cost), 0)::float8 AS cost,
              (SELECT COUNT(*) FROM shipping_incident i JOIN shipping_plan q ON q.new_id = i.plan_new_id
               WHERE q.carrier_new_id = c.new_id AND q.status IN ('DISPATCHED', 'COMPLETED')
                 AND q.planned_ship_date BETWEEN CURRENT_DATE - (@days::int - 1) AND CURRENT_DATE)::int AS incidents
       FROM shipping_plan p JOIN mst_carrier c ON c.new_id = p.carrier_new_id
       WHERE ${SHIPPED} AND ${IN_PERIOD}
       GROUP BY c.new_id, c.name ORDER BY plans DESC, c.name LIMIT 6`,
      { days, offset: 0 },
    ),

  vehicleTypes: (days: number) =>
    query<VehicleTypeRow>(
      `SELECT v.type, COUNT(*)::int AS plans, AVG(p.utilization_pct)::float8 AS avg_utilization
       FROM shipping_plan p JOIN mst_vehicle v ON v.new_id = p.vehicle_new_id
       WHERE p.status <> 'CANCELLED' AND ${IN_PERIOD}
       GROUP BY v.type ORDER BY plans DESC, v.type LIMIT 8`,
      { days, offset: 0 },
    ),

  incidentTypes: (days: number) =>
    query<IncidentTypeRow>(
      `SELECT i.type, COUNT(*)::int AS total, COUNT(*) FILTER (WHERE i.status IN ('OPEN', 'IN_PROGRESS', 'CLAIM_FILED'))::int AS open
       FROM shipping_incident i
       WHERE i.occurred_date BETWEEN CURRENT_DATE - (@days::int - 1) AND CURRENT_DATE
       GROUP BY i.type ORDER BY total DESC`,
      { days },
    ),

  /** Things that are true right now, whatever the selected period. */
  async snapshot() {
    const rows = await query<SnapshotRow>(
      `SELECT (SELECT COUNT(*) FROM shipping_plan WHERE status = 'DISPATCHED')::int AS in_transit,
              (SELECT COUNT(*) FROM shipping_plan WHERE status = 'PLANNED')::int AS waiting_approval,
              (SELECT COUNT(*) FROM shipping_plan WHERE status = 'APPROVED')::int AS waiting_booking,
              (SELECT COUNT(*) FROM shipping_plan WHERE status = 'DISPATCHED' AND eta_date < CURRENT_DATE)::int AS past_eta,
              (SELECT COUNT(*) FROM shipping_incident WHERE status IN ('OPEN', 'IN_PROGRESS', 'CLAIM_FILED'))::int AS open_incidents,
              (SELECT COUNT(*) FROM shipping_incident WHERE status IN ('OPEN', 'IN_PROGRESS', 'CLAIM_FILED') AND target_date < CURRENT_DATE)::int AS overdue_incidents,
              (SELECT COALESCE(SUM(claim_amount), 0) FROM shipping_incident WHERE status IN ('CLAIM_FILED'))::float8 AS open_claim_amount`,
    );
    return rows[0];
  },

  /** Approved or in-preparation plans that leave in the next 7 days. */
  upcoming: () =>
    query<PlanSummaryRow>(
      `${PLAN_SELECT}
       WHERE p.status IN ('APPROVED', 'BOOKED', 'PICKING', 'LOADING') AND p.planned_ship_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
       ORDER BY p.planned_ship_date, p.id LIMIT 8`,
    ),

  recent: (days: number) =>
    query<PlanSummaryRow>(`${PLAN_SELECT} WHERE ${IN_PERIOD} ORDER BY p.planned_ship_date DESC, p.id DESC LIMIT 300`, { days, offset: 0 }),
};

const PLAN_SELECT = `
  SELECT p.new_id, p.plan_no, p.status, o.name AS origin_name, d.name AS destination_name, c.name AS carrier_name,
         to_char(p.planned_ship_date, 'YYYY-MM-DD') AS planned_ship_date, to_char(p.eta_date, 'YYYY-MM-DD') AS eta_date,
         p.total_units, p.total_weight_kg::float8 AS weight_kg, p.total_cost::float8 AS cost
  FROM shipping_plan p
  JOIN mst_location o ON o.new_id = p.origin_location_new_id
  JOIN mst_location d ON d.new_id = p.destination_location_new_id
  LEFT JOIN mst_carrier c ON c.new_id = p.carrier_new_id`;
