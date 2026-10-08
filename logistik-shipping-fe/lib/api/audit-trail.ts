import { apiFetch, apiPath } from "@/lib/api-client";
import { localeTag } from "@/lib/i18n/locale";

export type AuditActivity = "LOGIN_SUCCESS" | "LOGIN_FAILED" | "LOGOUT" | "CREATE" | "UPDATE" | "STATUS_CHANGE" | "ACCESS_CHANGE" | "PASSWORD_CHANGE" | "DOWNLOAD";

export const AUDIT_ACTIVITY_LABEL: Record<AuditActivity, string> = {
  LOGIN_SUCCESS: "Login Success",
  LOGIN_FAILED: "Login Failed",
  LOGOUT: "Logout",
  CREATE: "Create",
  UPDATE: "Update",
  STATUS_CHANGE: "Status Change",
  ACCESS_CHANGE: "Access Change",
  PASSWORD_CHANGE: "Password Change",
  DOWNLOAD: "Download Report",
};

export const auditActivityLabel = (activity: string) => AUDIT_ACTIVITY_LABEL[activity as AuditActivity] ?? activity;

export type AuditChange = { field: string; label: string; from: string; to: string };

export type AuditEntry = {
  id: number;
  createdDate: string;
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

export type AuditFilters = { from: string; to: string; q?: string; module?: string; activity?: string; user?: string };

export type AuditPage = { rows: AuditEntry[]; total: number; page: number; pageSize: number; from: string; to: string };

export type AuditFacets = { modules: string[]; activities: string[]; users: { username: string; name: string | null }[] };

export type AuditExport = {
  rows: AuditEntry[];
  total: number;
  truncated: boolean;
  from: string;
  to: string;
  filters: { module: string | null; activity: string | null; user: string | null; q: string | null };
  printedAt: string;
  printedBy: string;
  timeZone: string;
};

function queryString(filters: Partial<AuditFilters> & { page?: number; pageSize?: number; format?: string }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  return params.toString();
}

export const listAuditTrail = (filters: AuditFilters & { page: number; pageSize: number }, token?: string) =>
  apiFetch<AuditPage>(apiPath(`AuditTrail?${queryString(filters)}`), { method: "GET", token, cache: "no-store" });

export const getAuditFacets = (token?: string) => apiFetch<AuditFacets>(apiPath("AuditTrail/filters"), { method: "GET", token, cache: "no-store" });

/** Everything in a period for the report; the server records the download in the audit trail. */
export const exportAuditTrail = (filters: AuditFilters & { format: "pdf" | "xlsx" }, token?: string) =>
  apiFetch<AuditExport>(apiPath(`AuditTrail/export?${queryString(filters)}`), { method: "GET", token, cache: "no-store" });

/** Tanggal "08 Okt 2026" and jam "09.32.15", in the application time zone. */
export function formatAuditDate(iso: string, timeZone: string) {
  return new Date(iso).toLocaleDateString(localeTag(), { day: "2-digit", month: "short", year: "numeric", timeZone });
}

export function formatAuditTime(iso: string, timeZone: string) {
  return new Date(iso).toLocaleTimeString(localeTag(), { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone });
}

const ZONE_LABEL: Record<string, string> = { "Asia/Jakarta": "WIB", "Asia/Makassar": "WITA", "Asia/Jayapura": "WIT" };
export const timeZoneLabel = (timeZone: string) => ZONE_LABEL[timeZone] ?? timeZone;
