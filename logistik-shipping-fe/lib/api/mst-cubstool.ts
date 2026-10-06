import { apiFetch, apiPath } from "@/lib/api-client";

type JsonRecord = Record<string, unknown>;

export type MstCubstoolItem = {
  id: number;
  newId: string;
  name: string;
  itemCode: string;
  length: string;
  width: string;
  height: string;
  weight: string;
  color: string;
  isActive: boolean;
  createdBy: string;
  createdDate: string;
};

export type MstCubstoolPayload = {
  name: string;
  itemCode: string;
  length: string;
  width: string;
  height: string;
  weight: string;
  color: string;
  createdBy: string;
  isActive?: boolean;
};

export type UpdateMstCubstoolPayload = MstCubstoolPayload & {
  isActive: boolean;
};

export type CubstoolLovItem = {
  value: string;
  label: string;
  weight: number;
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
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "number") {
      return value !== 0;
    }

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
    if (candidate !== undefined) {
      return candidate;
    }
  }

  return input;
}

function mapCubstool(item: unknown): MstCubstoolItem | null {
  if (!isRecord(item)) return null;

  return {
    id: pickNumber(item, ["id"]),
    newId: pickString(item, ["newId", "newID", "guid", "value"]),
    name: pickString(item, ["name", "Name"]),
    itemCode: pickString(item, ["itemCode", "itemcode", "ItemCode"]),
    length: pickString(item, ["length", "Length"]),
    width: pickString(item, ["width", "Width"]),
    height: pickString(item, ["height", "Height"]),
    weight: pickString(item, ["weight", "Weight"]),
    color: pickString(item, ["color", "Color"]),
    isActive: pickBoolean(item, ["isActive", "IsActive"], false),
    createdBy: pickString(item, ["createdBy", "createBy", "CreatedBy"], "-"),
    createdDate: pickString(item, ["createdDate", "createdAt", "CreatedDate"], "-"),
  };
}

// Weight may arrive as a number, a numeric string, or free text like "2 kg"; missing/invalid counts as 0 (lightest).
function parseWeight(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : 0;
  if (typeof value !== "string") return 0;

  const match = value.replace(",", ".").match(/\d+(\.\d+)?/);
  const parsed = match ? Number(match[0]) : 0;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function mapCubstoolLov(item: unknown): CubstoolLovItem | null {
  if (!isRecord(item)) return null;

  const value = pickString(item, ["value", "Value", "newId", "newID", "guid", "id", "Id"]);
  const label = pickString(item, ["label", "Label", "name", "Name", "itemCode", "itemcode", "ItemCode"], value);

  if (!value) return null;

  return {
    value,
    label: label || value,
    weight: parseWeight(item.weight ?? item.Weight),
  };
}

export async function listMstCubstools(token?: string) {
  const res = await apiFetch<unknown>(apiPath("MstCubstool"), {
    method: "GET",
    token,
    cache: "no-store",
  });

  return unwrapArray(res).map(mapCubstool).filter((item): item is MstCubstoolItem => Boolean(item));
}

export async function createMstCubstool(payload: MstCubstoolPayload, token?: string) {
  const res = await apiFetch<unknown>(apiPath("MstCubstool"), {
    method: "POST",
    body: JSON.stringify(payload),
    token,
  });

  return mapCubstool(unwrapObject(res));
}

export async function updateMstCubstool(newId: string, payload: UpdateMstCubstoolPayload, token?: string) {
  const res = await apiFetch<unknown>(apiPath(`MstCubstool/${encodeURIComponent(newId)}`), {
    method: "PUT",
    body: JSON.stringify(payload),
    token,
  });

  return mapCubstool(unwrapObject(res));
}

export async function listCubstoolLov(token?: string) {
  const res = await apiFetch<unknown>(apiPath("MstCubstool/lov-cubstool"), {
    method: "GET",
    token,
    cache: "no-store",
  });

  return unwrapArray(res).map(mapCubstoolLov).filter((item): item is CubstoolLovItem => Boolean(item));
}
