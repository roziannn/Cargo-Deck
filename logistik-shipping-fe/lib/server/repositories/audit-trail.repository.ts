import { query } from "@/lib/server/db";

export type AuditChange = { field: string; label: string; from: string; to: string };

export type AuditRow = {
  id: number;
  createdDate: Date;
  username: string | null;
  actorName: string | null;
  actorRole: string | null;
  module: string;
  activity: string;
  entityType: string | null;
  entityRef: string | null;
  note: string;
  changes: AuditChange[] | null;
};

export type AuditInsert = {
  username: string | null;
  actorName: string | null;
  actorRole: string | null;
  module: string;
  activity: string;
  entityType: string | null;
  entityRef: string | null;
  note: string;
  changes: AuditChange[] | null;
};

export type AuditFilter = { from: string; to: string; search: string | null; module: string | null; activity: string | null; username: string | null };

/** Dates are read in the application time zone, so "1 Oct to 7 Oct" means those days locally, not in UTC. */
export const APP_TIME_ZONE = process.env.APP_TIME_ZONE || "Asia/Jakarta";

const COLUMNS = `id, created_date, username, actor_name, actor_role, module, activity, entity_type, entity_ref, note, changes`;

function where(filter: AuditFilter) {
  return {
    sql: `WHERE created_date >= (@from::date)::timestamp AT TIME ZONE @tz
            AND created_date < ((@to::date) + 1)::timestamp AT TIME ZONE @tz
            AND (@module::text IS NULL OR module = @module)
            AND (@activity::text IS NULL OR activity = @activity)
            AND (@username::text IS NULL OR lower(username) = lower(@username))
            AND (@search::text IS NULL OR actor_name ILIKE '%' || @search || '%' OR username ILIKE '%' || @search || '%'
                 OR note ILIKE '%' || @search || '%' OR entity_ref ILIKE '%' || @search || '%')`,
    params: { ...filter, tz: APP_TIME_ZONE },
  };
}

export const auditTrailRepository = {
  async insert(entry: AuditInsert) {
    await query(
      `INSERT INTO core_audit_trail (username, actor_name, actor_role, module, activity, entity_type, entity_ref, note, changes)
       VALUES (@username, @actorName, @actorRole, @module, @activity, @entityType, @entityRef, @note, @changes::jsonb)`,
      { ...entry, changes: entry.changes ? JSON.stringify(entry.changes) : null },
    );
  },

  /** Roles of a user, by the e-mail used in the role claims; empty when the user has none. */
  async rolesOf(email: string) {
    const rows = await query<{ roles: string | null }>(
      `SELECT string_agg(r.name, ', ' ORDER BY r.name) AS roles
       FROM core_role_claim c JOIN core_role r ON r.new_id = c.role_id
       WHERE lower(c.user_principal_name) = lower(@email) AND c.is_active = true AND r.is_active = true`,
      { email },
    );
    return rows[0]?.roles ?? null;
  },

  async list(filter: AuditFilter, limit: number, offset: number) {
    const w = where(filter);
    const [rows, count] = await Promise.all([
      query<AuditRow>(`SELECT ${COLUMNS} FROM core_audit_trail ${w.sql} ORDER BY created_date DESC, id DESC LIMIT @limit OFFSET @offset`, { ...w.params, limit, offset }),
      query<{ total: number }>(`SELECT COUNT(*)::int AS total FROM core_audit_trail ${w.sql}`, w.params),
    ]);
    return { rows, total: count[0].total };
  },

  /** Every matching row, oldest first, for the downloadable report. */
  async listAll(filter: AuditFilter, limit: number) {
    const w = where(filter);
    return query<AuditRow>(`SELECT ${COLUMNS} FROM core_audit_trail ${w.sql} ORDER BY created_date ASC, id ASC LIMIT @limit`, { ...w.params, limit });
  },

  async count(filter: AuditFilter) {
    const w = where(filter);
    const rows = await query<{ total: number }>(`SELECT COUNT(*)::int AS total FROM core_audit_trail ${w.sql}`, w.params);
    return rows[0].total;
  },

  async facets() {
    const [modules, activities, users] = await Promise.all([
      query<{ value: string }>(`SELECT DISTINCT module AS value FROM core_audit_trail ORDER BY 1`),
      query<{ value: string }>(`SELECT DISTINCT activity AS value FROM core_audit_trail ORDER BY 1`),
      query<{ username: string; name: string | null }>(
        `SELECT username, MAX(actor_name) AS name FROM core_audit_trail WHERE username IS NOT NULL GROUP BY username ORDER BY 2, 1`,
      ),
    ]);
    return { modules: modules.map((m) => m.value), activities: activities.map((a) => a.value), users };
  },
};
