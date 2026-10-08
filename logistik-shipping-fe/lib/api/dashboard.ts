import { apiFetch, apiPath } from "@/lib/api-client";

export type DashboardRange = 7 | 30 | 90 | 365;

export type Kpi = { value: number | null; change?: number | null };

export type StatusGroup = { key: string; label: string; statuses: string[]; count: number };
export type TrendPoint = { bucket: string; plans: number; weightKg: number; cost: number };
export type DestinationStat = { name: string; plans: number; weightKg: number; cost: number };
export type CarrierStat = { name: string; plans: number; cost: number; incidents: number };
export type VehicleTypeStat = { type: string; plans: number; avgUtilization: number | null };
export type IncidentTypeStat = { type: string; total: number; open: number };
export type DashboardAlert = { key: string; level: "critical" | "warning" | "info"; title: string; count: number; href: string };

export type DashboardPlan = {
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

export type DashboardData = {
  range: DashboardRange;
  /** One trend point per day (periods up to 31 days) or per week. */
  bucket: "day" | "week";
  /** Days the period reaches past today because of plans scheduled ahead. */
  horizon: number;
  /** Date of the trend point that contains today. */
  todayBucket: string | null;
  kpis: {
    plans: Kpi;
    inTransit: Kpi;
    freightCost: Kpi;
    weightKg: Kpi;
    avgUtilization: Kpi;
    incidentFree: Kpi & { shipped: number };
    cancelled: Kpi;
    openClaimAmount: Kpi;
  };
  statusGroups: StatusGroup[];
  trend: TrendPoint[];
  destinations: DestinationStat[];
  carriers: CarrierStat[];
  vehicleTypes: VehicleTypeStat[];
  incidentTypes: IncidentTypeStat[];
  alerts: DashboardAlert[];
  upcoming: DashboardPlan[];
  recent: DashboardPlan[];
};

export const getDashboard = (range: DashboardRange, token?: string) =>
  apiFetch<DashboardData>(apiPath(`Dashboard?range=${range}`), { method: "GET", token, cache: "no-store" });
