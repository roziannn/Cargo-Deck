import { headers } from "next/headers";
import { verifyToken } from "@/lib/server/auth";
import { auditTrailRepository, type AuditChange } from "@/lib/server/repositories/audit-trail.repository";

export type { AuditChange };

export type AuditAction =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "CREATE"
  | "UPDATE"
  | "STATUS_CHANGE"
  | "ACCESS_CHANGE"
  | "PASSWORD_CHANGE"
  | "DOWNLOAD";

export type AuditActor = { username: string | null; name: string | null; email?: string | null };

export type AuditEntry = {
  module: string;
  action: AuditAction;
  /** What the record is, e.g. "Vehicle". Together with `ref` it names the record in the note. */
  entityType?: string;
  /** Human-readable reference, e.g. a plan number or a vehicle name. */
  ref?: string;
  note: string;
  changes?: AuditChange[];
  /** Leave out to use the user of the current request. */
  actor?: AuditActor;
};

export type AuditField = {
  key: string;
  label: string;
  /** Turns the raw value into text, e.g. true -> "Aktif". */
  format?: (value: unknown) => string;
};

/** The user behind the current request, or null when there is none (for example during login). */
async function requestActor(): Promise<AuditActor | null> {
  try {
    const header = (await headers()).get("authorization") ?? "";
    const token = header.match(/^Bearer\s+(.+)$/i)?.[1];
    const payload = token ? verifyToken(token) : null;
    return payload ? { username: payload.preferred_username, name: payload.name, email: payload.email } : null;
  } catch {
    return null;
  }
}

/**
 * Writes one audit entry. An audit failure is logged and swallowed: it must never break the action that was just done.
 */
export async function writeAudit(entry: AuditEntry) {
  try {
    const actor = entry.actor ?? (await requestActor());
    const role = actor?.email ? await auditTrailRepository.rolesOf(actor.email).catch(() => null) : null;
    await auditTrailRepository.insert({
      username: actor?.username ?? null,
      actorName: actor?.name ?? actor?.username ?? null,
      actorRole: role,
      module: entry.module,
      activity: entry.action,
      entityType: entry.entityType ?? null,
      entityRef: entry.ref ?? null,
      note: entry.note,
      changes: entry.changes && entry.changes.length > 0 ? entry.changes : null,
    });
  } catch (error) {
    console.error("Audit trail could not be written:", error);
  }
}

// ---------- describing changes ----------

const EMPTY = "(kosong)";

/** Same value in a different spelling (2.50 and "2.5", null and "") counts as no change. */
function comparable(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return String(value);
  const text = String(value).trim();
  if (text !== "" && /^-?\d+(\.\d+)?$/.test(text)) return String(Number(text));
  return text;
}

function display(value: unknown, field: AuditField) {
  if (field.format) return field.format(value);
  const text = comparable(value);
  return text === "" ? EMPTY : text;
}

export const yesNo = (active: string, inactive: string) => (value: unknown) => (value === true ? active : value === false ? inactive : EMPTY);
export const activeLabel = yesNo("Aktif", "Nonaktif");

/** Field-by-field differences between two versions of a record; empty when nothing really changed. */
export function diffFields(before: Record<string, unknown>, after: Record<string, unknown>, fields: AuditField[]): AuditChange[] {
  const changes: AuditChange[] = [];
  for (const field of fields) {
    const from = before[field.key];
    const to = after[field.key];
    if (comparable(from) === comparable(to)) continue;
    changes.push({ field: field.key, label: field.label, from: display(from, field), to: display(to, field) });
  }
  return changes;
}

const quote = (text: string) => (text === EMPTY ? text : `'${text}'`);

/** "Nama dari 'Box A' menjadi 'Box A1'; Berat dari 2 menjadi 3" */
export function describeChanges(changes: AuditChange[]) {
  return changes.map((c) => `${c.label} dari ${quote(c.from)} menjadi ${quote(c.to)}`).join("; ");
}

/**
 * Records an edit, naming exactly what changed. When nothing changed no entry is written at all.
 */
export async function auditUpdate(options: {
  module: string;
  entityType: string;
  ref: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  fields: AuditField[];
  action?: AuditAction;
  /** Words before the record, default "Mengubah". */
  verb?: string;
}) {
  const changes = diffFields(options.before, options.after, options.fields);
  if (changes.length === 0) return;
  await writeAudit({
    module: options.module,
    action: options.action ?? "UPDATE",
    entityType: options.entityType,
    ref: options.ref,
    note: `${options.verb ?? "Mengubah"} ${options.entityType} ${quote(options.ref)}: ${describeChanges(changes)}`,
    changes,
  });
}

export function auditCreate(options: { module: string; entityType: string; ref: string; detail?: string }) {
  return writeAudit({
    module: options.module,
    action: "CREATE",
    entityType: options.entityType,
    ref: options.ref,
    note: `Menambah ${options.entityType} ${quote(options.ref)}${options.detail ? ` (${options.detail})` : ""}`,
  });
}

/** Everyday formatting for rupiah amounts and dates in notes. */
export const rupiah = (value: unknown) => {
  const n = Number(value);
  return value === null || value === undefined || value === "" || !Number.isFinite(n) ? EMPTY : `Rp ${n.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
};
