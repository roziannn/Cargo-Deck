import { writeAudit } from "@/lib/server/audit";
import { HttpError, currentUser, optString, requireDate } from "@/lib/server/http";
import { APP_TIME_ZONE, auditTrailRepository, type AuditFilter } from "@/lib/server/repositories/audit-trail.repository";

const DAY_MS = 86_400_000;
/** How far back a report can reach in one go, and the most rows a report holds. */
export const EXPORT_MAX_DAYS = 92;
const EXPORT_MAX_ROWS = 20_000;
const FORMATS = ["pdf", "xlsx"] as const;

const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: APP_TIME_ZONE });
const shiftDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

function filterFrom(params: URLSearchParams, maxDays: number): AuditFilter {
  const to = params.get("to") ? requireDate(params.get("to"), "to") : todayIso();
  const from = params.get("from") ? requireDate(params.get("from"), "from") : shiftDays(to, -6);
  if (from > to) throw new HttpError(400, "Tanggal mulai tidak boleh setelah tanggal akhir.");
  if ((Date.parse(to) - Date.parse(from)) / DAY_MS + 1 > maxDays) throw new HttpError(400, `Rentang tanggal maksimal ${maxDays} hari.`);
  return {
    from,
    to,
    search: optString(params.get("q")),
    module: optString(params.get("module")),
    activity: optString(params.get("activity")),
    username: optString(params.get("user")),
  };
}

export const auditTrailService = {
  async list(params: URLSearchParams) {
    const filter = filterFrom(params, 366);
    const pageSize = Math.min(Math.max(Number(params.get("pageSize")) || 15, 1), 200);
    const page = Math.max(Number(params.get("page")) || 1, 1);
    const { rows, total } = await auditTrailRepository.list(filter, pageSize, (page - 1) * pageSize);
    return { rows, total, page, pageSize, from: filter.from, to: filter.to };
  },

  facets: () => auditTrailRepository.facets(),

  /** Everything in the period for the downloadable report. Downloading is itself written to the audit trail. */
  async export(params: URLSearchParams) {
    const filter = filterFrom(params, EXPORT_MAX_DAYS);
    const format = (params.get("format") ?? "pdf") as (typeof FORMATS)[number];
    if (!FORMATS.includes(format)) throw new HttpError(400, `format must be one of: ${FORMATS.join(", ")}.`);

    const total = await auditTrailRepository.count(filter);
    const rows = await auditTrailRepository.listAll(filter, EXPORT_MAX_ROWS);
    const me = await currentUser();
    await writeAudit({
      module: "Audit Trail",
      action: "DOWNLOAD",
      note: `Mengunduh laporan audit trail (${format === "pdf" ? "PDF" : "Excel"}) periode ${filter.from} sampai ${filter.to}, ${rows.length} aktivitas`,
    });
    return {
      rows,
      total,
      truncated: total > rows.length,
      from: filter.from,
      to: filter.to,
      filters: { module: filter.module, activity: filter.activity, user: filter.username, q: filter.search },
      printedAt: new Date().toISOString(),
      printedBy: me.name || me.preferred_username,
      timeZone: APP_TIME_ZONE,
    };
  },
};
