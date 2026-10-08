"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet, FileText, Search } from "lucide-react";
import { Toaster, toast } from "react-hot-toast";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getStoredAuthToken } from "@/lib/api/auth";
import {
  auditActivityLabel,
  exportAuditTrail,
  formatAuditDate,
  formatAuditTime,
  getAuditFacets,
  listAuditTrail,
  timeZoneLabel,
  type AuditFacets,
  type AuditPage,
} from "@/lib/api/audit-trail";
import { downloadAuditPdf, downloadAuditXlsx } from "@/lib/audit-report";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

const TIME_ZONE = "Asia/Jakarta"; // keep in line with APP_TIME_ZONE on the server
const PAGE_SIZE = 15;
const MAX_REPORT_DAYS = 92;
const DAY_MS = 86_400_000;

const isoDay = (offset = 0) => new Date(Date.now() + offset * DAY_MS).toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
const daysBetween = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / DAY_MS + 1;

const ACTIVITY_STYLE: Record<string, string> = {
  LOGIN_SUCCESS: "border-emerald-200 bg-emerald-100 text-emerald-700",
  LOGIN_FAILED: "border-red-200 bg-red-100 text-red-700",
  LOGOUT: "border-slate-200 bg-slate-100 text-slate-600",
  CREATE: "border-blue-200 bg-blue-100 text-blue-700",
  UPDATE: "border-amber-200 bg-amber-100 text-amber-700",
  STATUS_CHANGE: "border-violet-200 bg-violet-100 text-violet-700",
  ACCESS_CHANGE: "border-orange-200 bg-orange-100 text-orange-700",
  PASSWORD_CHANGE: "border-rose-200 bg-rose-100 text-rose-700",
  DOWNLOAD: "border-teal-200 bg-teal-100 text-teal-700",
};

export default function AuditTrailPage() {
  const { t } = useI18n();
  const [from, setFrom] = useState(() => isoDay(-6));
  const [to, setTo] = useState(() => isoDay());
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [module, setModule] = useState("");
  const [activity, setActivity] = useState("");
  const [user, setUser] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<AuditPage | null>(null);
  const [facets, setFacets] = useState<AuditFacets>({ modules: [], activities: [], users: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [openDownload, setOpenDownload] = useState(false);
  const [dlFrom, setDlFrom] = useState("");
  const [dlTo, setDlTo] = useState("");
  const [dlUseFilters, setDlUseFilters] = useState(true);
  const [downloading, setDownloading] = useState<"pdf" | "xlsx" | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(id);
  }, [search]);

  useEffect(() => {
    getAuditFacets(getStoredAuthToken() ?? undefined)
      .then(setFacets)
      .catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    if (from > to) {
      setLoadError(t("Tanggal mulai tidak boleh setelah tanggal akhir."));
      return;
    }
    setIsLoading(true);
    try {
      setData(await listAuditTrail({ from, to, q: debouncedSearch, module, activity, user, page, pageSize: PAGE_SIZE }, getStoredAuthToken() ?? undefined));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : t("Gagal mengambil audit trail."));
    } finally {
      setIsLoading(false);
    }
  }, [from, to, debouncedSearch, module, activity, user, page, t]);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));
  const hasFilter = module !== "" || activity !== "" || user !== "" || search !== "";
  const withFirstPage = <T,>(set: (value: T) => void) => (value: T) => {
    set(value);
    setPage(1);
  };

  const moduleOptions = useMemo(() => facets.modules.map((m) => ({ value: m, label: m })), [facets.modules]);
  const activityOptions = useMemo(() => facets.activities.map((a) => ({ value: a, label: auditActivityLabel(a, t) })), [facets.activities, t]);
  const userOptions = useMemo(() => facets.users.map((u) => ({ value: u.username, label: u.name ?? u.username, description: u.name ? u.username : undefined })), [facets.users]);

  function openDownloadDialog() {
    setDlFrom(from);
    setDlTo(to);
    setDlUseFilters(hasFilter);
    setOpenDownload(true);
  }

  async function download(format: "pdf" | "xlsx") {
    if (!dlFrom || !dlTo) return void toast.error(t("Pilih tanggal mulai dan tanggal akhir."));
    if (dlFrom > dlTo) return void toast.error(t("Tanggal mulai tidak boleh setelah tanggal akhir."));
    if (daysBetween(dlFrom, dlTo) > MAX_REPORT_DAYS) return void toast.error(t("Rentang tanggal maksimal {days} hari.", { days: MAX_REPORT_DAYS }));

    setDownloading(format);
    try {
      const report = await exportAuditTrail(
        { from: dlFrom, to: dlTo, format, ...(dlUseFilters ? { q: debouncedSearch, module, activity, user } : {}) },
        getStoredAuthToken() ?? undefined,
      );
      if (format === "pdf") await downloadAuditPdf(report, t);
      else await downloadAuditXlsx(report, t);
      toast.success(t("Laporan diunduh ({count} aktivitas).", { count: report.rows.length }));
      setOpenDownload(false);
      void load(); // the download itself is now in the trail
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("Gagal membuat laporan."));
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="min-h-screen space-y-6 p-6 dark:bg-zinc-900">
      <Toaster position="top-center" />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Audit Trail</h1>
          <p className="text-sm text-muted-foreground">{t("Catatan siapa melakukan apa dan kapan di seluruh aplikasi. Perubahan data ditulis spesifik, dan simpan tanpa perubahan tidak dicatat.")}</p>
        </div>
        <Button onClick={openDownloadDialog}>
          <Download className="mr-2 h-4 w-4" /> {t("Download Report")}
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("Dari tanggal")}</Label>
          <Input type="date" value={from} max={to} onChange={(e) => withFirstPage(setFrom)(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("Sampai tanggal")}</Label>
          <Input type="date" value={to} min={from} onChange={(e) => withFirstPage(setTo)(e.target.value)} className="w-40" />
        </div>
        <div className="w-48 space-y-1">
          <Label className="text-xs text-muted-foreground">{t("Pengguna")}</Label>
          <Combobox options={userOptions} value={user} onChange={withFirstPage(setUser)} placeholder={t("Semua pengguna")} searchPlaceholder={t("Cari pengguna...")} clearable />
        </div>
        <div className="w-44 space-y-1">
          <Label className="text-xs text-muted-foreground">{t("Modul")}</Label>
          <Combobox options={moduleOptions} value={module} onChange={withFirstPage(setModule)} placeholder={t("Semua modul")} searchPlaceholder={t("Cari modul...")} clearable />
        </div>
        <div className="w-44 space-y-1">
          <Label className="text-xs text-muted-foreground">{t("Aktivitas")}</Label>
          <Combobox options={activityOptions} value={activity} onChange={withFirstPage(setActivity)} placeholder={t("Semua aktivitas")} searchPlaceholder={t("Cari aktivitas...")} clearable />
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => withFirstPage(setSearch)(e.target.value)} placeholder={t("Cari nama atau catatan...")} className="px-9" />
        </div>
        {hasFilter && (
          <Button
            variant="ghost"
            onClick={() => {
              setModule("");
              setActivity("");
              setUser("");
              setSearch("");
              setPage(1);
            }}
          >
            {t("Reset")}
          </Button>
        )}
      </div>

      {loadError && <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{loadError}</div>}

      <div className="overflow-hidden rounded-lg border bg-background/40">
        <Table containerClassName="rounded-none border-0 bg-transparent">
          <TableHeader>
            <TableRow>
              <TableHead className="w-56">{t("Nama")}</TableHead>
              <TableHead className="w-40">{t("Waktu")}</TableHead>
              <TableHead className="w-40">{t("Aktivitas")}</TableHead>
              <TableHead className="w-44">{t("Modul")}</TableHead>
              <TableHead>{t("Catatan")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.rows ?? []).map((row) => (
              <TableRow key={row.id} className="align-top">
                <TableCell>
                  <div className="font-medium">{row.actorName ?? row.username ?? t("Tidak diketahui")}</div>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                   <div> 
                  {formatAuditDate(row.createdDate, TIME_ZONE)} {formatAuditTime(row.createdDate, TIME_ZONE)}</div>
                 
                </TableCell>
                <TableCell>
                  <Badge className={cn("border font-medium hover:bg-inherit", ACTIVITY_STYLE[row.activity] ?? "border-slate-200 bg-slate-100 text-slate-600")}>{auditActivityLabel(row.activity, t)}</Badge>
                </TableCell>
                <TableCell>{row.module}</TableCell>
                <TableCell className="whitespace-normal leading-relaxed">{row.note}</TableCell>
              </TableRow>
            ))}
            {!isLoading && (data?.rows.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  {t("Tidak ada aktivitas pada periode dan filter ini")}
                </TableCell>
              </TableRow>
            )}
            {isLoading && !data && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  {t("Loading data...")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div className="flex flex-col gap-2 border-t px-3 py-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>{data ? t("{count} aktivitas", { count: data.total }) : ""}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-24 text-center text-foreground">
              {t("Page {page} of {total}", { page, total: totalPages })}
            </span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={openDownload} onOpenChange={setOpenDownload}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Download Report Audit Trail")}</DialogTitle>
            <DialogDescription>
              {t("Pilih periode laporan, maksimal {days} hari. Laporan memuat waktu cetak, siapa yang mencetak, dan nomor halaman.", { days: MAX_REPORT_DAYS })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("Dari tanggal")}</Label>
                <Input type="date" value={dlFrom} max={dlTo || undefined} onChange={(e) => setDlFrom(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("Sampai tanggal")}</Label>
                <Input type="date" value={dlTo} min={dlFrom || undefined} onChange={(e) => setDlTo(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                ["7 hari", 6],
                ["30 hari", 29],
                ["90 hari", 89],
              ].map(([label, back]) => (
                <Button
                  key={label}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDlFrom(isoDay(-(back as number)));
                    setDlTo(isoDay());
                  }}
                >
                  {t("{period} terakhir", { period: t(label as string) })}
                </Button>
              ))}
            </div>
            {hasFilter && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={dlUseFilters} onChange={(e) => setDlUseFilters(e.target.checked)} className="h-4 w-4" />
                {t("Terapkan filter yang sedang aktif (pengguna, modul, aktivitas, pencarian)")}
              </label>
            )}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="outline" onClick={() => setOpenDownload(false)} disabled={downloading !== null}>
              {t("Batal")}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void download("xlsx")} disabled={downloading !== null}>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> {downloading === "xlsx" ? t("Membuat...") : "Excel"}
              </Button>
              <Button onClick={() => void download("pdf")} disabled={downloading !== null}>
                <FileText className="mr-2 h-4 w-4" /> {downloading === "pdf" ? t("Membuat...") : "PDF"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
