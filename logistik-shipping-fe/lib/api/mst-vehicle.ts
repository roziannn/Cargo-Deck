import { apiFetch, apiPath } from "@/lib/api-client";

type JsonRecord = Record<string, unknown>;

export type MstVehicleItem = {
  id: number;
  newId: string;
  name: string;
  type: string;
  climate: string;
  cbm: string;
  dimensionsL: string;
  dimensionsW: string;
  floorArea: string;
  maxHeight: string;
  maxPayload: string;
  isActive: boolean;
  createdBy: string;
  createdDate: string;
  updatedBy: string;
  updatedDate: string;
};

export type MstVehiclePayload = {
  name: string;
  type?: string;
  climate?: string;
  cbm?: string;
  dimensions_L_m?: string;
  dimensions_W_m?: string;
  floorArea_m2?: string;
  maxHeight_m?: string;
  maxPayload_kg?: string;
  createdBy?: string;
  isActive?: boolean | null;
};

export type UpdateMstVehiclePayload = MstVehiclePayload & {
  isActive: boolean;
};

export type VehicleLovItem = {
  value: string;
  label: string;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickString(source: JsonRecord, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return fallback;
}

function pickNumber(source: JsonRecord, keys: string[], fallback = 0) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return fallback;
}

function pickBoolean(source: JsonRecord, keys: string[], fallback = false) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;

    if (typeof value === "string" && value.trim()) {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true" || normalized === "1") return true;
      if (normalized === "false" || normalized === "0") return false;
    }
  }

  return fallback;
}

function unwrapArray(input: unknown): unknown[] {
  if (Array.isArray(input)) return input;
  if (!isRecord(input)) return [];

  const candidates = [input.data, input.result, input.items, input.results];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;

    if (isRecord(candidate)) {
      const nestedCandidates = [candidate.data, candidate.result, candidate.items, candidate.results];
      for (const nested of nestedCandidates) {
        if (Array.isArray(nested)) return nested;
      }
    }
  }

  return [];
}

function unwrapObject(input: unknown): unknown {
  if (!isRecord(input)) return input;

  const candidates = [input.data, input.result, input.item];
  for (const candidate of candidates) {
    if (candidate !== undefined) return candidate;
  }

  return input;
}

function mapVehicle(item: unknown): MstVehicleItem | null {
  if (!isRecord(item)) return null;

  return {
    id: pickNumber(item, ["id", "Id"]),
    newId: pickString(item, ["newId", "newID", "NewId", "guid", "value"]),
    name: pickString(item, ["name", "Name"]),
    type: pickString(item, ["type", "Type"]),
    climate: pickString(item, ["climate", "Climate"]),
    cbm: pickString(item, ["cbm", "CBM"]),
    dimensionsL: pickString(item, ["dimensionsL", "dimensions_L_m", "DimensionsL", "Dimensions_L_m"]),
    dimensionsW: pickString(item, ["dimensionsW", "dimensions_W_m", "DimensionsW", "Dimensions_W_m"]),
    floorArea: pickString(item, ["floorArea", "floorArea_m2", "FloorArea", "FloorArea_m2"]),
    maxHeight: pickString(item, ["maxHeight", "maxHeight_m", "MaxHeight", "MaxHeight_m"]),
    maxPayload: pickString(item, ["maxPayload", "maxPayload_kg", "MaxPayload"]),
    isActive: pickBoolean(item, ["isActive", "IsActive"], false),
    createdBy: pickString(item, ["createdBy", "createBy", "CreatedBy"], "-"),
    createdDate: pickString(item, ["createdDate", "createdAt", "CreatedDate"], "-"),
    updatedBy: pickString(item, ["updatedBy", "updateBy", "UpdatedBy"], "-"),
    updatedDate: pickString(item, ["updatedDate", "updatedAt", "UpdatedDate"], "-"),
  };
}

function mapVehicleLov(item: unknown): VehicleLovItem | null {
  if (!isRecord(item)) return null;

  const value = pickString(item, ["value", "Value", "newId", "newID", "NewId", "id", "Id"]);
  const label = pickString(item, ["label", "Label", "name", "Name", "text", "Text"], value);

  if (!value) return null;

  return {
    value,
    label: label || value,
  };
}

export async function listMstVehicles(token?: string) {
  const res = await apiFetch<unknown>(apiPath("MstVehicle"), {
    method: "GET",
    token,
    cache: "no-store",
  });

  return unwrapArray(res).map(mapVehicle).filter((item): item is MstVehicleItem => Boolean(item));
}

export async function getMstVehicleById(newId: string, token?: string) {
  const res = await apiFetch<unknown>(apiPath(`MstVehicle/${encodeURIComponent(newId)}`), {
    method: "GET",
    token,
    cache: "no-store",
  });

  return mapVehicle(unwrapObject(res));
}

export async function createMstVehicle(payload: MstVehiclePayload, token?: string) {
  const res = await apiFetch<unknown>(apiPath("MstVehicle"), {
    method: "POST",
    body: JSON.stringify(payload),
    token,
  });

  return mapVehicle(unwrapObject(res));
}

export async function updateMstVehicle(newId: string, payload: UpdateMstVehiclePayload, token?: string) {
  const res = await apiFetch<unknown>(apiPath(`MstVehicle/${encodeURIComponent(newId)}`), {
    method: "PUT",
    body: JSON.stringify(payload),
    token,
  });

  return mapVehicle(unwrapObject(res));
}

export async function listVehicleLov(token?: string) {
  const res = await apiFetch<unknown>(apiPath("MstVehicle/lov-vehicle"), {
    method: "GET",
    token,
    cache: "no-store",
  });

  return unwrapArray(res).map(mapVehicleLov).filter((item): item is VehicleLovItem => Boolean(item));
}
