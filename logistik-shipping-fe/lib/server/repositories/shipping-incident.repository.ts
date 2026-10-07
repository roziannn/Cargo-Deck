import { execute, query } from "@/lib/server/db";

export const INCIDENT_TYPES = ["DELAY", "ACCIDENT", "DAMAGED", "SHORTAGE", "TEMPERATURE", "RETURN", "OTHER"] as const;
export const INCIDENT_STATUSES = ["OPEN", "IN_PROGRESS", "CLAIM_FILED", "RESOLVED", "REJECTED"] as const;
/** Statuses that still hold the plan back from completing. */
export const OPEN_INCIDENT_STATUSES = ["OPEN", "IN_PROGRESS", "CLAIM_FILED"];

export type IncidentType = (typeof INCIDENT_TYPES)[number];
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export type IncidentRow = {
  id: number;
  newId: string;
  incidentNo: string;
  planNewId: string;
  planNo: string;
  planStatus: string;
  originName: string;
  destinationName: string;
  carrierName: string | null;
  type: IncidentType;
  status: IncidentStatus;
  occurredDate: string;
  description: string;
  targetDate: string | null;
  solution: string | null;
  claimAmount: string | null;
  claimParty: string | null;
  resolvedAt: Date | null;
  createdBy: string | null;
  createdDate: Date;
  updatedBy: string | null;
  updatedDate: Date | null;
};

export type IncidentCreateInput = {
  planNewId: string;
  type: IncidentType;
  occurredDate: string;
  description: string;
  targetDate: string | null;
  claimAmount: number | null;
  claimParty: string | null;
};

export type IncidentUpdateInput = {
  status: IncidentStatus;
  targetDate: string | null;
  solution: string | null;
  claimAmount: number | null;
  claimParty: string | null;
};

const SELECT = `
  SELECT i.id, i.new_id, i.incident_no, i.plan_new_id, p.plan_no, p.status AS plan_status,
         o.name AS origin_name, d.name AS destination_name, ca.name AS carrier_name,
         i.type, i.status, to_char(i.occurred_date, 'YYYY-MM-DD') AS occurred_date, i.description,
         to_char(i.target_date, 'YYYY-MM-DD') AS target_date, i.solution,
         i.claim_amount::text AS claim_amount, i.claim_party, i.resolved_at,
         i.created_by, i.created_date, i.updated_by, i.updated_date
  FROM shipping_incident i
  JOIN shipping_plan p ON p.new_id = i.plan_new_id
  JOIN mst_location o ON o.new_id = p.origin_location_new_id
  JOIN mst_location d ON d.new_id = p.destination_location_new_id
  LEFT JOIN mst_carrier ca ON ca.new_id = p.carrier_new_id`;

export const shippingIncidentRepository = {
  getAll: () => query<IncidentRow>(`${SELECT} ORDER BY i.created_date DESC, i.id DESC`),

  getByPlan: (planNewId: string) => query<IncidentRow>(`${SELECT} WHERE i.plan_new_id = @planNewId ORDER BY i.created_date DESC, i.id DESC`, { planNewId }),

  async getByNewId(newId: string) {
    const rows = await query<IncidentRow>(`${SELECT} WHERE i.new_id = @newId`, { newId });
    return rows[0] ?? null;
  },

  async create(input: IncidentCreateInput, by: string) {
    const rows = await query<{ newId: string }>(
      `INSERT INTO shipping_incident (incident_no, plan_new_id, type, occurred_date, description, target_date, claim_amount, claim_party, created_by)
       VALUES ('INC-' || to_char(now(), 'YYMM') || '-' || lpad(nextval('incident_no_seq')::text, 4, '0'),
               @planNewId, @type, @occurredDate, @description, @targetDate, @claimAmount, @claimParty, @by)
       RETURNING new_id`,
      { ...input, by },
    );
    return rows[0].newId;
  },

  /** Saves the handling of an incident. `resolved` stamps the closing time. */
  update(newId: string, input: IncidentUpdateInput, by: string) {
    const closed = input.status === "RESOLVED" || input.status === "REJECTED";
    return execute(
      `UPDATE shipping_incident
       SET status = @status, target_date = @targetDate, solution = @solution, claim_amount = @claimAmount, claim_party = @claimParty,
           resolved_at = CASE WHEN @closed THEN COALESCE(resolved_at, now()) ELSE NULL END,
           updated_by = @by, updated_date = now()
       WHERE new_id = @newId`,
      { ...input, newId, closed, by },
    );
  },
};
