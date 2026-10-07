import { apiFetch, apiPath } from "@/lib/api-client";

export type CarrierType = "OWN" | "3PL";

export type MstCarrierItem = {
  id: number;
  newId: string;
  code: string;
  name: string;
  type: CarrierType;
  contactName: string | null;
  contactPhone: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdDate: string;
};

export type MstCarrierPayload = {
  code: string;
  name: string;
  type: CarrierType;
  contactName?: string;
  contactPhone?: string;
  isActive: boolean;
};

export type CarrierLovItem = { value: string; label: string; type: CarrierType };

export type MstDriverItem = {
  id: number;
  newId: string;
  code: string;
  name: string;
  phone: string | null;
  licenseNo: string | null;
  licenseExpiry: string | null;
  carrierNewId: string | null;
  carrierName: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdDate: string;
};

export type MstDriverPayload = {
  code: string;
  name: string;
  phone?: string;
  licenseNo?: string;
  licenseExpiry?: string;
  carrierNewId?: string | null;
  isActive: boolean;
};

export type DriverLovItem = { value: string; label: string; carrierNewId: string | null; licenseExpiry: string | null };

const json = (payload: unknown) => JSON.stringify(payload);

export const listMstCarriers = (token?: string) => apiFetch<MstCarrierItem[]>(apiPath("MstCarrier"), { method: "GET", token, cache: "no-store" });
export const createMstCarrier = (payload: MstCarrierPayload, token?: string) =>
  apiFetch<MstCarrierItem>(apiPath("MstCarrier"), { method: "POST", body: json(payload), token });
export const updateMstCarrier = (newId: string, payload: MstCarrierPayload, token?: string) =>
  apiFetch<MstCarrierItem>(apiPath(`MstCarrier/${encodeURIComponent(newId)}`), { method: "PUT", body: json(payload), token });
export const listCarrierLov = (token?: string) => apiFetch<CarrierLovItem[]>(apiPath("MstCarrier/lov-carrier"), { method: "GET", token, cache: "no-store" });

export const listMstDrivers = (token?: string) => apiFetch<MstDriverItem[]>(apiPath("MstDriver"), { method: "GET", token, cache: "no-store" });
export const createMstDriver = (payload: MstDriverPayload, token?: string) =>
  apiFetch<MstDriverItem>(apiPath("MstDriver"), { method: "POST", body: json(payload), token });
export const updateMstDriver = (newId: string, payload: MstDriverPayload, token?: string) =>
  apiFetch<MstDriverItem>(apiPath(`MstDriver/${encodeURIComponent(newId)}`), { method: "PUT", body: json(payload), token });
export const listDriverLov = (token?: string) => apiFetch<DriverLovItem[]>(apiPath("MstDriver/lov-driver"), { method: "GET", token, cache: "no-store" });
