import { HttpError } from "@/lib/server/http";
import { shippingPlanRepository } from "@/lib/server/repositories/shipping-plan.repository";
import { dashboardRepository, type Bucket } from "@/lib/server/repositories/dashboard.repository";

export const DASHBOARD_RANGES = [7, 30, 90, 365] as const;
export type DashboardRange = (typeof DASHBOARD_RANGES)[number];

/** Change against the period right before, in percent; null when there is nothing to compare with. */
function change(current: number, previous: number) {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

const pct = (part: number, whole: number) => (whole === 0 ? null : Math.round((part / whole) * 1000) / 10);
const round1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

/** Plan statuses folded into the five groups the status chart shows. */
const GROUPS: { key: string; label: string; statuses: string[] }[] = [
  { key: "planning", label: "Perencanaan", statuses: ["DRAFT", "PLANNED", "APPROVED"] },
  { key: "preparing", label: "Persiapan", statuses: ["BOOKED", "PICKING", "LOADING"] },
  { key: "transit", label: "Dalam perjalanan", statuses: ["DISPATCHED"] },
  { key: "completed", label: "Selesai", statuses: ["COMPLETED"] },
  { key: "cancelled", label: "Dibatalkan", statuses: ["CANCELLED"] },
];

export const dashboardService = {
  async get(rawRange: unknown) {
    const days = Number(rawRange ?? 30);
    if (!DASHBOARD_RANGES.includes(days as DashboardRange)) throw new HttpError(400, `range must be one of: ${DASHBOARD_RANGES.join(", ")}.`);

    // plans past their ETA + grace days complete first, so the figures match the plan pages
    await shippingPlanRepository.autoComplete();

    // the period reaches into the future when plans are scheduled ahead; up to 31 days in total one point per day, beyond that one per week
    const horizon = await dashboardRepository.horizon(days);
    const bucket: Bucket = days + horizon <= 31 ? "day" : "week";

    const [current, pastOnly, previous, statusRows, trend, destinations, carriers, vehicleTypes, incidentTypes, snapshot, upcoming, recent] = await Promise.all([
      dashboardRepository.kpi(days, 0, true),
      dashboardRepository.kpi(days, 0),
      dashboardRepository.kpi(days, days),
      dashboardRepository.statusCounts(days),
      dashboardRepository.trend(days, bucket, horizon),
      dashboardRepository.destinations(days),
      dashboardRepository.carriers(days),
      dashboardRepository.vehicleTypes(days),
      dashboardRepository.incidentTypes(days),
      dashboardRepository.snapshot(),
      dashboardRepository.upcoming(),
      dashboardRepository.recent(days),
    ]);

    const byStatus = new Map(statusRows.map((r) => [r.status, r.count]));
    const statusGroups = GROUPS.map((g) => ({
      key: g.key,
      label: g.label,
      statuses: g.statuses,
      count: g.statuses.reduce((sum, s) => sum + (byStatus.get(s) ?? 0), 0),
    }));

    const alerts = [
      { key: "overdue-incidents", level: "critical", title: "Insiden melewati estimasi selesai", count: snapshot.overdueIncidents, href: "/shipping/incident" },
      { key: "past-eta", level: "critical", title: "Pengiriman lewat ETA, belum diterima", count: snapshot.pastEta, href: "/shipping/plan?status=DISPATCHED" },
      { key: "open-incidents", level: "warning", title: "Insiden belum ditutup", count: snapshot.openIncidents, href: "/shipping/incident" },
      { key: "waiting-approval", level: "info", title: "Plan menunggu approval", count: snapshot.waitingApproval, href: "/shipping/plan?status=PLANNED" },
      { key: "waiting-booking", level: "info", title: "Plan disetujui, belum di-booking", count: snapshot.waitingBooking, href: "/shipping/plan?status=APPROVED" },
    ].filter((a) => a.count > 0);

    return {
      range: days,
      bucket,
      /** Days the period reaches past today because of plans scheduled ahead. */
      horizon,
      /** Label of the trend point that contains today. */
      todayBucket: [...trend].reverse().find((t) => t.bucket <= snapshot.today)?.bucket ?? null,
      kpis: {
        plans: { value: current.plans, change: change(pastOnly.plans, previous.plans) },
        inTransit: { value: snapshot.inTransit },
        freightCost: { value: current.freightCost, change: change(pastOnly.freightCost, previous.freightCost) },
        weightKg: { value: current.weightKg, change: change(pastOnly.weightKg, previous.weightKg) },
        avgUtilization: { value: round1(current.avgUtilization), change: pastOnly.avgUtilization !== null && previous.avgUtilization !== null ? round1(pastOnly.avgUtilization - previous.avgUtilization) : null },
        incidentFree: { value: pct(current.shipped - current.withIncident, current.shipped), shipped: current.shipped },
        cancelled: { value: current.cancelled },
        openClaimAmount: { value: snapshot.openClaimAmount },
      },
      statusGroups,
      trend,
      destinations,
      carriers,
      vehicleTypes,
      incidentTypes,
      alerts,
      upcoming,
      recent,
    };
  },
};
