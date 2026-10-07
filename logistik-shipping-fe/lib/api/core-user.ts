import { apiFetch, apiPath } from "@/lib/api-client";

export type CoreUserItem = {
  id: number;
  username: string;
  email: string;
  name: string;
  site: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdDate: string;
  updatedBy: string | null;
  updatedDate: string | null;
};

export type CoreUserPayload = {
  username: string;
  email: string;
  name: string;
  site?: string;
  isActive: boolean;
  /** Required when creating; when editing, leave empty to keep the current password. */
  password?: string;
};

export const listCoreUsers = (token?: string) => apiFetch<CoreUserItem[]>(apiPath("CoreUser"), { method: "GET", token, cache: "no-store" });

export const createCoreUser = (payload: CoreUserPayload, token?: string) =>
  apiFetch<CoreUserItem>(apiPath("CoreUser"), { method: "POST", body: JSON.stringify(payload), token });

export const updateCoreUser = (id: number, payload: CoreUserPayload, token?: string) =>
  apiFetch<CoreUserItem>(apiPath(`CoreUser/${id}`), { method: "PUT", body: JSON.stringify(payload), token });
