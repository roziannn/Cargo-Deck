import { apiFetch, apiPath } from "@/lib/api-client";

export type LocationType = "WAREHOUSE" | "CUSTOMER";

export type MstLocationItem = {
  id: number;
  newId: string;
  code: string;
  name: string;
  type: LocationType;
  address: string | null;
  city: string | null;
  province: string | null;
  contactName: string | null;
  contactPhone: string | null;
  latitude: number | null;
  longitude: number | null;
  isActive: boolean;
  createdBy: string | null;
  createdDate: string;
};

export type MstLocationPayload = {
  code: string;
  name: string;
  type: LocationType;
  address?: string;
  city?: string;
  province?: string;
  contactName?: string;
  contactPhone?: string;
  latitude?: number | null;
  longitude?: number | null;
  isActive: boolean;
};

export type LocationLovItem = { value: string; label: string; type: LocationType };

export const listMstLocations = (token?: string) =>
  apiFetch<MstLocationItem[]>(apiPath("MstLocation"), { method: "GET", token, cache: "no-store" });

export const createMstLocation = (payload: MstLocationPayload, token?: string) =>
  apiFetch<MstLocationItem>(apiPath("MstLocation"), { method: "POST", body: JSON.stringify(payload), token });

export const updateMstLocation = (newId: string, payload: MstLocationPayload, token?: string) =>
  apiFetch<MstLocationItem>(apiPath(`MstLocation/${encodeURIComponent(newId)}`), { method: "PUT", body: JSON.stringify(payload), token });

export const listLocationLov = (token?: string) =>
  apiFetch<LocationLovItem[]>(apiPath("MstLocation/lov-location"), { method: "GET", token, cache: "no-store" });
