import { apiFetch, apiPath } from "@/lib/api-client";
import type { ShippingIncident } from "@/lib/api/shipping-incident";

export type ShippingPlanStatus = "DRAFT" | "PLANNED" | "APPROVED" | "BOOKED" | "PICKING" | "LOADING" | "DISPATCHED" | "COMPLETED" | "CANCELLED";
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
  // booking and cost (null until booked); amounts are whole rupiah as strings
  carrierNewId: string | null;
  carrierName: string | null;
  driverNewId: string | null;
  driverName: string | null;
  plateNo: string | null;
  distanceKm: string | null;
  baseFee: string | null;
  perKmFee: string | null;
  freightCost: string | null;
  loadingFee: string | null;
  otherFee: string | null;
  totalCost: string | null;
  bookingNotes: string | null;
  deliveryNoteNo: string | null;
  dispatchedAt: string | null;
  /** Estimated arrival (YYYY-MM-DD) and the grace days after it before the plan completes by itself. */
  etaDate: string | null;
  graceDays: number;
  deliveredAt: string | null;
  receivedBy: string | null;
  receiveNotes: string | null;
  // picking, loading checklist, seal and weighbridge
  pickingNotes: string | null;
  chkVehiclePapers: boolean;
  chkVehicleClean: boolean;
  chkVehicleCondition: boolean;
  chkDriverReady: boolean;
  chkCargoSecured: boolean;
  loadingTempC: number | null;
  sealNo: string | null;
  grossWeightKg: string | null;
  tareWeightKg: string | null;
  loadingNotes: string | null;
};

export type ShippingPlanItem = {
  cubstoolNewId: string;
  itemCode: string;
  itemName: string;
  unitWeightKg: string | null;
  /** Planned quantity. */
  qty: number;
  /** Quantity picked in the warehouse (null until picking is recorded). */
  pickedQty: number | null;
  /** Quantity really loaded on the truck (null until loading is recorded). */
  loadedQty: number | null;
};

export type LoadingReadiness = {
  /** True when the plan may be dispatched. */
  complete: boolean;
  /** What still blocks dispatch. */
  missing: string[];
  /** Things worth a second look that do not block dispatch. */
  warnings: string[];
  loadedWeightKg: number;
  netWeightKg: number | null;
};

export type ShippingPlanHistory = {
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  changedBy: string | null;
  changedDate: string;
};

export type ShippingPlanDetail = ShippingPlan & {
  items: ShippingPlanItem[];
  history: ShippingPlanHistory[];
  readiness: LoadingReadiness;
  incidents: ShippingIncident[];
  /** ETA proposed at dispatch, from the booked distance. */
  suggestedEtaDate: string;
  /** False once the plan is completed for longer than the reporting window. */
  canReportIncident: boolean;
};

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

export type FreightEstimate = {
  distanceKm: number | null;
  distanceSource: "coordinates" | "manual" | null;
  baseFee: number | null;
  perKmFee: number | null;
  freightCost: number | null;
  loadingFee: number;
  otherFee: number;
  totalCost: number | null;
  /** Why no estimate could be made (null when complete). */
  missing: string | null;
};

export type BookingPayload = {
  carrierNewId: string;
  driverNewId: string;
  plateNo: string;
  /** Leave out to use the distance estimated from the locations' coordinates. */
  distanceKm?: number;
  loadingFee: number;
  otherFee: number;
  bookingNotes?: string;
};

export type DeliveryNote = {
  planNo: string;
  status: ShippingPlanStatus;
  /** True while the plan is only booked: the note has no number yet. */
  preview: boolean;
  plan: ShippingPlan;
  items: ShippingPlanItem[];
  note: {
    deliveryNoteNo: string | null;
    dispatchedAt: string | null;
    originName: string;
    originAddress: string | null;
    originCity: string | null;
    originContact: string | null;
    originPhone: string | null;
    destinationName: string;
    destinationAddress: string | null;
    destinationCity: string | null;
    destinationContact: string | null;
    destinationPhone: string | null;
    vehicleType: string | null;
    vehicleName: string | null;
    carrierName: string | null;
    carrierType: string | null;
    driverName: string | null;
    driverPhone: string | null;
    driverLicenseNo: string | null;
  };
};

export function getShippingPlanEstimate(newId: string, params: { distanceKm?: number; loadingFee?: number; otherFee?: number }, token?: string) {
  const query = new URLSearchParams();
  if (params.distanceKm) query.set("distanceKm", String(params.distanceKm));
  if (params.loadingFee) query.set("loadingFee", String(params.loadingFee));
  if (params.otherFee) query.set("otherFee", String(params.otherFee));
  const suffix = query.toString() ? `?${query}` : "";
  return apiFetch<FreightEstimate>(apiPath(`ShippingPlan/${encodeURIComponent(newId)}/estimate${suffix}`), { method: "GET", token, cache: "no-store" });
}

export const saveShippingPlanBooking = (newId: string, payload: BookingPayload, token?: string) =>
  apiFetch<ShippingPlanDetail>(path(newId, "/booking"), { method: "PUT", body: JSON.stringify(payload), token });

export const startShippingPlanPicking = (newId: string, token?: string) =>
  apiFetch<ShippingPlanDetail>(path(newId, "/start-picking"), { method: "POST", token });

export const saveShippingPlanPicking = (
  newId: string,
  payload: { items: { cubstoolNewId: string; pickedQty: number }[]; notes?: string; complete: boolean },
  token?: string,
) => apiFetch<ShippingPlanDetail>(path(newId, "/picking"), { method: "PUT", body: JSON.stringify(payload), token });

export type LoadingPayload = {
  items: { cubstoolNewId: string; loadedQty: number }[];
  checklist: { vehiclePapers: boolean; vehicleClean: boolean; vehicleCondition: boolean; driverReady: boolean; cargoSecured: boolean };
  loadingTempC?: number;
  sealNo?: string;
  grossWeightKg?: number;
  tareWeightKg?: number;
  notes?: string;
};

export const saveShippingPlanLoading = (newId: string, payload: LoadingPayload, token?: string) =>
  apiFetch<ShippingPlanDetail>(path(newId, "/loading"), { method: "PUT", body: JSON.stringify(payload), token });

export type EtaPayload = { etaDate: string; graceDays: number };

export const dispatchShippingPlan = (newId: string, payload: EtaPayload, token?: string) =>
  apiFetch<ShippingPlanDetail>(path(newId, "/dispatch"), { method: "POST", body: JSON.stringify(payload), token });

export const updateShippingPlanEta = (newId: string, payload: EtaPayload, token?: string) =>
  apiFetch<ShippingPlanDetail>(path(newId, "/eta"), { method: "PUT", body: JSON.stringify(payload), token });

export const receiveShippingPlan = (newId: string, payload: { receivedBy: string; notes?: string }, token?: string) =>
  apiFetch<ShippingPlanDetail>(path(newId, "/receive"), { method: "POST", body: JSON.stringify(payload), token });

export const getDeliveryNote = (newId: string, token?: string) =>
  apiFetch<DeliveryNote>(path(newId, "/delivery-note"), { method: "GET", token, cache: "no-store" });

const rupiahFormat = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

export function formatRupiah(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  return Number.isFinite(n) ? rupiahFormat.format(n) : "-";
}
