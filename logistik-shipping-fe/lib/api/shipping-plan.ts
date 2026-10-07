import { apiFetch, apiPath } from "@/lib/api-client";

export type ShippingPlanStatus = "DRAFT" | "PLANNED" | "APPROVED" | "CANCELLED";
export type ShippingPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type SpecialHandling = "COLD_CHAIN" | "FRAGILE" | "HAZARDOUS";

export type ShippingPlan = {
  id: number;
  newId: string;
  planNo: string;
  status: ShippingPlanStatus;
  originLocationNewId: string;
  originName: string;
  destinationLocationNewId: string;
  destinationName: string;
  requestedDeliveryDate: string; // YYYY-MM-DD
  plannedShipDate: string; // YYYY-MM-DD
  priority: ShippingPriority;
  specialHandling: SpecialHandling | null;
  notes: string | null;
  vehicleNewId: string | null;
  vehicleName: string | null;
  vehicleMaxPayload: string | null;
  totalUnits: number;
  totalWeightKg: string;
  utilizationPct: string | null;
  createdBy: string | null;
  createdDate: string;
  updatedBy: string | null;
  updatedDate: string | null;
};

export type ShippingPlanItem = {
  cubstoolNewId: string;
  itemCode: string;
  itemName: string;
  unitWeightKg: string | null;
  qty: number;
};

export type ShippingPlanHistory = {
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  changedBy: string | null;
  changedDate: string;
};

export type ShippingPlanDetail = ShippingPlan & { items: ShippingPlanItem[]; history: ShippingPlanHistory[] };

export type ShippingPlanHeaderPayload = {
  originLocationNewId: string;
  destinationLocationNewId: string;
  requestedDeliveryDate: string;
  plannedShipDate: string;
  priority: ShippingPriority;
  specialHandling: SpecialHandling | null;
  notes: string;
};

export type ShippingPlanLoadPayload = {
  vehicleNewId: string;
  utilizationPct: number;
  items: { cubstoolNewId: string; qty: number }[];
};

const path = (newId: string, suffix = "") => apiPath(`ShippingPlan/${encodeURIComponent(newId)}${suffix}`);

export const listShippingPlans = (token?: string) =>
  apiFetch<ShippingPlan[]>(apiPath("ShippingPlan"), { method: "GET", token, cache: "no-store" });

export const getShippingPlan = (newId: string, token?: string) =>
  apiFetch<ShippingPlanDetail>(path(newId), { method: "GET", token, cache: "no-store" });

export const createShippingPlan = (payload: ShippingPlanHeaderPayload, token?: string) =>
  apiFetch<ShippingPlan>(apiPath("ShippingPlan"), { method: "POST", body: JSON.stringify(payload), token });

export const updateShippingPlan = (newId: string, payload: ShippingPlanHeaderPayload, token?: string) =>
  apiFetch<ShippingPlan>(path(newId), { method: "PUT", body: JSON.stringify(payload), token });

export const saveShippingPlanLoad = (newId: string, payload: ShippingPlanLoadPayload, token?: string) =>
  apiFetch<ShippingPlanDetail>(path(newId, "/load"), { method: "PUT", body: JSON.stringify(payload), token });

export const changeShippingPlanStatus = (newId: string, action: "approve" | "cancel", note: string | undefined, token?: string) =>
  apiFetch<ShippingPlanDetail>(path(newId, "/status"), { method: "POST", body: JSON.stringify({ action, note }), token });

export function formatPlanDate(value: string | null | undefined) {
  if (!value) return "-";
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return value;
  return new Date(y, m - 1, d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatPlanDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
