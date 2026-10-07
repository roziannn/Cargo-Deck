import { apiFetch, apiPath } from "@/lib/api-client";

export type IncidentType = "DELAY" | "ACCIDENT" | "DAMAGED" | "SHORTAGE" | "TEMPERATURE" | "RETURN" | "OTHER";
export type IncidentStatus = "OPEN" | "IN_PROGRESS" | "CLAIM_FILED" | "RESOLVED" | "REJECTED";

export const INCIDENT_TYPE_LABEL: Record<IncidentType, string> = {
  DELAY: "Terlambat",
  ACCIDENT: "Kecelakaan",
  DAMAGED: "Barang rusak",
  SHORTAGE: "Barang kurang",
  TEMPERATURE: "Suhu keluar batas",
  RETURN: "Retur",
  OTHER: "Lainnya",
};

export const INCIDENT_STATUS_LABEL: Record<IncidentStatus, string> = {
  OPEN: "Baru",
  IN_PROGRESS: "Diproses",
  CLAIM_FILED: "Klaim diajukan",
  RESOLVED: "Selesai",
  REJECTED: "Ditolak",
};

export const isIncidentOpen = (status: IncidentStatus) => status === "OPEN" || status === "IN_PROGRESS" || status === "CLAIM_FILED";

export type ShippingIncident = {
  id: number;
  newId: string;
  incidentNo: string;
  planNewId: string;
  planNo: string;
  planStatus: string;
  originName: string;
  destinationName: string;
  carrierName: string | null;
  type: IncidentType;
  status: IncidentStatus;
  occurredDate: string; // YYYY-MM-DD
  description: string;
  /** Estimated date the incident is handled. */
  targetDate: string | null;
  solution: string | null;
  claimAmount: string | null;
  claimParty: string | null;
  resolvedAt: string | null;
  createdBy: string | null;
  createdDate: string;
  updatedBy: string | null;
  updatedDate: string | null;
};

export type IncidentCreatePayload = {
  planNewId: string;
  type: IncidentType;
  occurredDate: string;
  description: string;
  targetDate?: string;
};

export type IncidentUpdatePayload = {
  status: IncidentStatus;
  targetDate?: string;
  solution?: string;
  claimAmount?: number;
  claimParty?: string;
};

const path = (newId: string) => apiPath(`ShippingIncident/${encodeURIComponent(newId)}`);

export const listShippingIncidents = (token?: string) =>
  apiFetch<ShippingIncident[]>(apiPath("ShippingIncident"), { method: "GET", token, cache: "no-store" });

export const createShippingIncident = (payload: IncidentCreatePayload, token?: string) =>
  apiFetch<ShippingIncident>(apiPath("ShippingIncident"), { method: "POST", body: JSON.stringify(payload), token });

export const updateShippingIncident = (newId: string, payload: IncidentUpdatePayload, token?: string) =>
  apiFetch<ShippingIncident>(path(newId), { method: "PUT", body: JSON.stringify(payload), token });
