"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApexOptions } from "apexcharts";
import { AlertOctagon, AlertTriangle, ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Info, RefreshCw, Search, X } from "lucide-react";
import { Toaster, toast } from "react-hot-toast";

import { Chart, baseOptions, useChartTheme } from "@/components/dashboard/chart";
import { PlanStatusBadge } from "@/components/shipping-plan-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getStoredAuthToken } from "@/lib/api/auth";
import { getDashboard, type DashboardAlert, type DashboardData, type DashboardPlan, type DashboardRange } from "@/lib/api/dashboard";
import { INCIDENT_TYPE_LABEL, type IncidentType } from "@/lib/api/shipping-incident";
import { formatPlanDate, formatRupiah, type ShippingPlanStatus } from "@/lib/api/shipping-plan";
import { cn } from "@/lib/utils";

const RANGES: { value: DashboardRange; label: string }[] = [
  { value: 7, label: "7 hari" },
  { value: 30, label: "30 hari" },
  { value: 90, label: "90 hari" },
  { value: 365, label: "1 tahun" },
];

type Metric = "plans" | "weightKg" | "cost";
const METRICS: { key: Metric; label: string; series: string }[] = [
  { key: "plans", label: "Jumlah plan", series: "Plan" },
  { key: "weightKg", label: "Berat", series: "Berat (kg)" },
  { key: "cost", label: "Biaya angkut", series: "Biaya angkut" },
];

const nf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

/** Rp 1,1 M / Rp 630 jt / Rp 85.000, short enough for a tile and an axis. */
function compactRupiah(n: number) {
  if (n >= 1e9) return `Rp ${nf.format(n / 1e9)} M`;
  if (n >= 1e6) return `Rp ${nf.format(Math.round(n / 1e5) / 10)} jt`;
  return formatRupiah(n);
}

const formatMetric = (metric: Metric, n: number) => (metric === "cost" ? compactRupiah(n) : metric === "weightKg" ? `${nf.format(n)} kg` : nf.format(n));

function bucketLabel(bucket: string, unit: "day" | "week") {
  const [y, m, d] = bucket.split("-").map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
  return unit === "week" ? `Mgg ${label}` : label;
}

function Card({ title, subtitle, action, className, children }: { title: string; subtitle?: string; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("space-y-3 rounded-lg border bg-background/40 p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Tile({ label, value, change, changeLabel, goodWhenUp, hint }: { label: string; value: string; change?: number | null; changeLabel?: string; goodWhenUp?: boolean; hint?: string }) {
  const up = (change ?? 0) >= 0;
  const tone = goodWhenUp === undefined || change === 0 ? "text-muted-foreground" : up === goodWhenUp ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
  return (
    <div className="rounded-lg border bg-background/40 p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        {change !== undefined && change !== null ? (
          <span className={cn("inline-flex items-center gap-0.5 font-medium", tone)}>
            {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            {Math.abs(change) >= 1000 ? ">999" : nf.format(Math.abs(change))}
            {changeLabel ?? "%"}
          </span>
        ) : null}
        {hint && <span>{hint}</span>}
      </div>
    </div>
  );
}

const ALERT_STYLE: Record<DashboardAlert["level"], { icon: typeof Info; tone: string; label: string }> = {
  critical: { icon: AlertOctagon, tone: "text-red-600 dark:text-red-400", label: "Mendesak" },
  warning: { icon: AlertTriangle, tone: "text-amber-600 dark:text-amber-400", label: "Perhatian" },
  info: { icon: Info, tone: "text-blue-600 dark:text-blue-400", label: "Perlu tindakan" },
};

function EmptyChart({ children }: { children: React.ReactNode }) {
  return <div className="flex h-40 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">{children}</div>;
}

export default function DashboardPage() {
  const theme = useChartTheme();
  const [range, setRange] = useState<DashboardRange>(30);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [metric, setMetric] = useState<Metric>("plans");

  // filters set by clicking the charts; they narrow the plan table
  const [statusKey, setStatusKey] = useState<string | null>(null);
  const [destination, setDestination] = useState<string | null>(null);
  const [carrier, setCarrier] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const rowsPerPage = 8;

  const load = useCallback(async (days: DashboardRange, silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      setData(await getDashboard(days, getStoredAuthToken() ?? undefined));
      setUpdatedAt(new Date());
      setError(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Gagal mengambil data dashboard.";
      if (silent) console.error(message);
      else toast.error(message);
      setError((current) => current ?? message);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const first = window.setTimeout(() => void load(range), 0);
    const timer = window.setInterval(() => void load(range, true), 60_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [range, load]);

  const hasFilter = statusKey !== null || destination !== null || carrier !== null || search !== "";
  const resetFilters = () => {
    setStatusKey(null);
    setDestination(null);
    setCarrier(null);
    setSearch("");
    setPage(1);
  };
  const toggle = <T,>(current: T | null, next: T, set: (value: T | null) => void) => {
    set(current === next ? null : next);
    setPage(1);
  };

  const statusGroup = data?.statusGroups.find((g) => g.key === statusKey) ?? null;
  const filteredPlans = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return (data?.recent ?? []).filter(
      (p: DashboardPlan) =>
        (!statusGroup || statusGroup.statuses.includes(p.status)) &&
        (!destination || p.destinationName === destination) &&
        (!carrier || p.carrierName === carrier) &&
        (!keyword || [p.planNo, p.originName, p.destinationName, p.carrierName ?? ""].some((v) => v.toLowerCase().includes(keyword))),
    );
  }, [data, statusGroup, destination, carrier, search]);
  const totalPages = Math.max(1, Math.ceil(filteredPlans.length / rowsPerPage));
  const pageRows = filteredPlans.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  // ---- chart options ----
  const base = baseOptions(theme);
  const [blue] = theme.series;
  const dim = (selected: boolean, active: boolean) => (active && !selected ? `${blue}55` : blue);

  const trendOptions: ApexOptions | null = data && {
    ...base,
    chart: { ...base.chart, type: "area", zoom: { enabled: false } },
    colors: [blue],
    stroke: { width: 2, curve: "monotoneCubic" },
    fill: { type: "gradient", gradient: { shadeIntensity: 1, opacityFrom: 0.28, opacityTo: 0.02, stops: [0, 95] } },
    markers: { size: 0, hover: { size: 5 }, strokeColors: theme.surface, strokeWidth: 2 },
    xaxis: { ...base.xaxis, categories: data.trend.map((t) => bucketLabel(t.bucket, data.bucket)), tickAmount: Math.min(data.trend.length - 1, 8), tooltip: { enabled: false } },
    yaxis: { ...base.yaxis, min: 0, labels: { style: { colors: theme.muted }, formatter: (v: number) => formatMetric(metric, v) } },
    tooltip: { theme: theme.mode, y: { formatter: (v: number) => formatMetric(metric, v) } },
    legend: { show: false },
  };

  const donutOptions: ApexOptions | null = data && {
    ...base,
    chart: { ...base.chart, type: "donut", events: { dataPointSelection: (_e, _c, cfg) => toggle(statusKey, data.statusGroups[cfg?.dataPointIndex ?? -1]?.key ?? null, setStatusKey) } },
    labels: data.statusGroups.map((g) => g.label),
    colors: data.statusGroups.map((g, i) => (g.key === "cancelled" ? theme.neutral : theme.series[i])),
    fill: { opacity: data.statusGroups.map((g) => (statusKey && statusKey !== g.key ? 0.3 : 1)) },
    stroke: { width: 2, colors: [theme.surface] },
    legend: { show: false },
    plotOptions: {
      pie: {
        donut: {
          size: "68%",
          labels: { show: true, name: { color: theme.text }, value: { color: theme.text, fontSize: "24px", fontWeight: 600 }, total: { show: true, label: "Total plan", color: theme.text, formatter: () => nf.format(data.statusGroups.reduce((s, g) => s + g.count, 0)) } },
        },
      },
    },
    tooltip: { theme: theme.mode, y: { formatter: (v: number) => `${v} plan` } },
  };

  /** Horizontal bar with the selected bar highlighted and the rest dimmed. */
  function barOptions(labels: string[], selected: string | null, onPick: ((label: string) => void) | null, format: (v: number) => string, extra: Partial<ApexOptions> = {}): ApexOptions {
    return {
      ...base,
      chart: { ...base.chart, type: "bar", events: onPick ? { dataPointSelection: (_e, _c, cfg) => onPick(labels[cfg?.dataPointIndex ?? -1]) } : {} },
      colors: [({ dataPointIndex }: { dataPointIndex: number }) => dim(labels[dataPointIndex] === selected, selected !== null)],
      plotOptions: { bar: { horizontal: true, borderRadius: 4, borderRadiusApplication: "end", barHeight: "62%", dataLabels: { position: "top" } } },
      dataLabels: { enabled: true, formatter: (v: number) => format(v), style: { colors: [theme.text], fontWeight: 500 }, offsetX: 6, textAnchor: "start" },
      xaxis: { ...base.xaxis, categories: labels, labels: { show: false } },
      yaxis: { labels: { style: { colors: theme.text }, maxWidth: 150 } },
      grid: { show: false, padding: { right: 56 } },
      legend: { show: false },
      stroke: { width: 2, colors: [theme.surface] },
      ...extra,
    };
  }

  const chartHeight = (rows: number) => Math.max(120, rows * 38 + 20);

  return (
    <div className="min-h-screen space-y-6 p-6 dark:bg-zinc-900">
      <Toaster position="top-center" />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Ringkasan pengiriman darat. Klik grafik untuk menyaring tabel plan di bawah.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Periode">
            {RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => {
                  setRange(r.value);
                  resetFilters();
                }}
                aria-pressed={range === r.value}
                className={cn("rounded px-3 py-1 text-sm transition-colors", range === r.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {r.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="icon" onClick={() => void load(range)} disabled={isRefreshing} aria-label="Muat ulang">
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
          {updatedAt && <span className="text-xs text-muted-foreground">Diperbarui {updatedAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>}
        </div>
      </div>

      {error && !data && (
        <div className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">
          {error}{" "}
          <button className="underline" onClick={() => void load(range)}>
            Coba lagi
          </button>
        </div>
      )}

      {!data && !error && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted/40" />
          ))}
        </div>
      )}

      {data && trendOptions && donutOptions && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Tile label="Plan (tanpa batal)" value={nf.format(data.kpis.plans.value ?? 0)} change={data.kpis.plans.change} hint="vs sebelumnya" />
            <Tile label="Dalam perjalanan" value={nf.format(data.kpis.inTransit.value ?? 0)} hint="saat ini" />
            <Tile label="Biaya angkut" value={compactRupiah(data.kpis.freightCost.value ?? 0)} change={data.kpis.freightCost.change} hint="vs sebelumnya" />
            <Tile label="Utilisasi muatan" value={data.kpis.avgUtilization.value === null ? "-" : `${nf.format(data.kpis.avgUtilization.value)}%`} change={data.kpis.avgUtilization.change} changeLabel=" poin" goodWhenUp hint="rata-rata" />
            <Tile label="Bebas insiden" value={data.kpis.incidentFree.value === null ? "-" : `${nf.format(data.kpis.incidentFree.value)}%`} hint={`dari ${data.kpis.incidentFree.shipped} pengiriman`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card
              className="lg:col-span-2"
              title="Tren pengiriman"
              subtitle={`Per ${data.bucket === "day" ? "hari" : "minggu"}, berdasarkan tanggal berangkat`}
              action={
                <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Metrik">
                  {METRICS.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setMetric(m.key)}
                      aria-pressed={metric === m.key}
                      className={cn("rounded px-2.5 py-1 text-xs transition-colors", metric === m.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              }
            >
              <Chart
                key={`${metric}-${data.range}`}
                type="area"
                height={290}
                options={trendOptions}
                series={[{ name: METRICS.find((m) => m.key === metric)?.series ?? "", data: data.trend.map((t) => t[metric]) }]}
              />
            </Card>

            <Card title="Status plan" subtitle="Klik potongan untuk menyaring tabel">
              {data.statusGroups.every((g) => g.count === 0) ? (
                <EmptyChart>Belum ada plan di periode ini</EmptyChart>
              ) : (
                <>
                  <Chart type="donut" height={210} options={donutOptions} series={data.statusGroups.map((g) => g.count)} />
                  <ul className="space-y-1">
                    {data.statusGroups.map((g, i) => (
                      <li key={g.key}>
                        <button
                          type="button"
                          onClick={() => toggle(statusKey, g.key, setStatusKey)}
                          aria-pressed={statusKey === g.key}
                          className={cn("flex w-full items-center justify-between rounded px-2 py-1 text-sm hover:bg-muted/50", statusKey === g.key && "bg-muted font-medium")}
                        >
                          <span className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: g.key === "cancelled" ? theme.neutral : theme.series[i] }} />
                            {g.label}
                          </span>
                          <span className="tabular-nums">{g.count}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-2">
            <Card title="Perlu tindakan" subtitle="Kondisi saat ini, tidak terpengaruh periode">
              {data.alerts.length === 0 ? (
                <EmptyChart>Tidak ada yang perlu ditindak</EmptyChart>
              ) : (
                <ul className="divide-y rounded-md border">
                  {data.alerts.map((a) => {
                    const style = ALERT_STYLE[a.level];
                    const Icon = style.icon;
                    return (
                      <li key={a.key}>
                        <Link href={a.href} className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted/40">
                          <Icon className={cn("h-4 w-4 shrink-0", style.tone)} aria-label={style.label} />
                          <span className="flex-1">{a.title}</span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums">{a.count}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
              {(data.kpis.openClaimAmount.value ?? 0) > 0 && (
                <p className="text-xs text-muted-foreground">Klaim diajukan, belum selesai: {formatRupiah(data.kpis.openClaimAmount.value)}</p>
              )}
            </Card>

            <Card title="Jadwal berangkat 7 hari ke depan" subtitle="Plan yang sudah disetujui sampai loading">
              {data.upcoming.length === 0 ? (
                <EmptyChart>Tidak ada jadwal keberangkatan</EmptyChart>
              ) : (
                <ul className="divide-y rounded-md border">
                  {data.upcoming.map((p) => (
                    <li key={p.newId}>
                      <Link href={`/shipping/plan/${p.newId}`} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted/40">
                        <div className="w-20 shrink-0 text-xs text-muted-foreground">{formatPlanDate(p.plannedShipDate)}</div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{p.planNo}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {p.originName} → {p.destinationName}
                          </div>
                        </div>
                        <PlanStatusBadge status={p.status as ShippingPlanStatus} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Tujuan teratas" subtitle="Jumlah plan. Klik batang untuk menyaring">
              {data.destinations.length === 0 ? (
                <EmptyChart>Belum ada data</EmptyChart>
              ) : (
                <Chart
                  key={`dest-${destination}`}
                  type="bar"
                  height={chartHeight(data.destinations.length)}
                  options={{
                    ...barOptions(data.destinations.map((d) => d.name), destination, (label) => toggle(destination, label, setDestination), (v) => nf.format(v), {
                      tooltip: { theme: theme.mode, y: { formatter: (v: number) => `${v} plan` } },
                    }),
                  }}
                  series={[{ name: "Plan", data: data.destinations.map((d) => d.plans) }]}
                />
              )}
            </Card>

            <Card title="Carrier" subtitle="Pengiriman berangkat per carrier. Klik batang untuk menyaring">
              {data.carriers.length === 0 ? (
                <EmptyChart>Belum ada pengiriman berangkat</EmptyChart>
              ) : (
                <Chart
                  key={`carrier-${carrier}`}
                  type="bar"
                  height={chartHeight(data.carriers.length)}
                  options={barOptions(data.carriers.map((c) => c.name), carrier, (label) => toggle(carrier, label, setCarrier), (v) => nf.format(v), {
                    tooltip: {
                      theme: theme.mode,
                      y: { formatter: (v: number, opts?: { dataPointIndex: number }) => {
                        const c = data.carriers[opts?.dataPointIndex ?? 0];
                        return `${v} pengiriman · ${compactRupiah(c?.cost ?? 0)} · ${c?.incidents ?? 0} insiden`;
                      } },
                    },
                  })}
                  series={[{ name: "Pengiriman", data: data.carriers.map((c) => c.plans) }]}
                />
              )}
            </Card>

            <Card title="Utilisasi per jenis kendaraan" subtitle="Rata-rata pemakaian ruang muat (%)">
              {data.vehicleTypes.length === 0 ? (
                <EmptyChart>Belum ada data</EmptyChart>
              ) : (
                <Chart
                  type="bar"
                  height={chartHeight(data.vehicleTypes.length)}
                  options={barOptions(data.vehicleTypes.map((v) => v.type), null, null, (v) => `${nf.format(v)}%`, {
                    xaxis: { ...base.xaxis, categories: data.vehicleTypes.map((v) => v.type), labels: { show: false }, max: 100 },
                    tooltip: { theme: theme.mode, y: { formatter: (v: number, opts?: { dataPointIndex: number }) => `${nf.format(v)}% dari ${data.vehicleTypes[opts?.dataPointIndex ?? 0]?.plans ?? 0} plan` } },
                  })}
                  series={[{ name: "Utilisasi", data: data.vehicleTypes.map((v) => Math.round((v.avgUtilization ?? 0) * 10) / 10) }]}
                />
              )}
            </Card>

            <Card title="Insiden per jenis" subtitle="Berdasarkan tanggal kejadian">
              {data.incidentTypes.length === 0 ? (
                <EmptyChart>Tidak ada insiden di periode ini</EmptyChart>
              ) : (
                <Chart
                  type="bar"
                  height={chartHeight(data.incidentTypes.length)}
                  options={barOptions(data.incidentTypes.map((i) => INCIDENT_TYPE_LABEL[i.type as IncidentType] ?? i.type), null, null, (v) => nf.format(v), {
                    tooltip: { theme: theme.mode, y: { formatter: (v: number, opts?: { dataPointIndex: number }) => `${v} insiden, ${data.incidentTypes[opts?.dataPointIndex ?? 0]?.open ?? 0} belum ditutup` } },
                  })}
                  series={[{ name: "Insiden", data: data.incidentTypes.map((i) => i.total) }]}
                />
              )}
            </Card>
          </div>

          <Card title="Plan terbaru" subtitle={data.recent.length >= 300 ? "300 plan terbaru di periode ini" : "Semua plan di periode ini"}>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Cari plan, rute, carrier..."
                  className="px-9"
                />
              </div>
              {[
                statusGroup && { label: `Status: ${statusGroup.label}`, clear: () => setStatusKey(null) },
                destination && { label: `Tujuan: ${destination}`, clear: () => setDestination(null) },
                carrier && { label: `Carrier: ${carrier}`, clear: () => setCarrier(null) },
              ]
                .filter((chip): chip is { label: string; clear: () => void } => Boolean(chip))
                .map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => {
                      chip.clear();
                      setPage(1);
                    }}
                    className="inline-flex items-center gap-1 rounded-full border border-blue-300 bg-blue-50 px-3 py-1 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
                  >
                    {chip.label} <X className="h-3 w-3" />
                  </button>
                ))}
              {hasFilter && (
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  Reset
                </Button>
              )}
            </div>

            <div className="overflow-hidden rounded-lg border">
              <Table containerClassName="rounded-none border-0 bg-transparent">
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan</TableHead>
                    <TableHead>Tujuan</TableHead>
                    <TableHead>Carrier</TableHead>
                    <TableHead>Berangkat</TableHead>
                    <TableHead>ETA</TableHead>
                    <TableHead className="text-right">Biaya</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((p) => (
                    <TableRow key={p.newId}>
                      <TableCell className="font-medium">
                        <Link href={`/shipping/plan/${p.newId}`} className="text-blue-600 hover:underline">
                          {p.planNo}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div>{p.destinationName}</div>
                        <div className="text-xs text-muted-foreground">dari {p.originName}</div>
                      </TableCell>
                      <TableCell>{p.carrierName ?? "-"}</TableCell>
                      <TableCell>{formatPlanDate(p.plannedShipDate)}</TableCell>
                      <TableCell>{formatPlanDate(p.etaDate)}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.cost !== null ? formatRupiah(p.cost) : "-"}</TableCell>
                      <TableCell>
                        <PlanStatusBadge status={p.status as ShippingPlanStatus} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {pageRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                        Tidak ada plan yang cocok
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between border-t px-3 py-2 text-sm text-muted-foreground">
                <span>{filteredPlans.length} plan</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-24 text-center">
                    Page {page} of {totalPages}
                  </span>
                  <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
