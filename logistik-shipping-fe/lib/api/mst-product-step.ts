import { apiFetch, apiPath } from "@/lib/api-client";

type JsonRecord = Record<string, unknown>;

export type MstProductStepItem = {
  id: number;
  newId: string;
  productId: string;
  name: string;
  createdBy: string;
  createdDate: string;
  updatedBy: string;
  updatedDate: string;
};

export type MstProductStepPayload = {
  productId: string;
  name: string;
  createdBy?: string;
  updatedBy?: string;
};

export type DeleteMstProductStepPayload = {
  newId: string;
  updatedBy?: string;
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

function mapProductStep(item: unknown): MstProductStepItem | null {
  if (!isRecord(item)) return null;

  return {
    id: pickNumber(item, ["id"]),
    newId: pickString(item, ["newId", "newID", "guid", "value"]),
    productId: pickString(item, ["productId", "productID"]),
    name: pickString(item, ["name", "stepName", "productStepName", "processName", "process", "step", "label"]),
    createdBy: pickString(item, ["createdBy", "createBy"], "-"),
    createdDate: pickString(item, ["createdDate", "createdAt"], "-"),
    updatedBy: pickString(item, ["updatedBy", "updateBy"], "-"),
    updatedDate: pickString(item, ["updatedDate", "updatedAt"], "-"),
  };
}

export async function listMstProductSteps(token?: string) {
  const res = await apiFetch<unknown>(apiPath("MstProductStep"), {
    method: "GET",
    token,
  });

  return unwrapArray(res).map(mapProductStep).filter((item): item is MstProductStepItem => Boolean(item));
}

export async function listMstProductStepsByProduct(productId: string, token?: string) {
  const res = await apiFetch<unknown>(apiPath(`MstProductStep/by-product/${encodeURIComponent(productId)}`), {
    method: "GET",
    token,
    cache: "no-store",
  });

  return unwrapArray(res).map(mapProductStep).filter((item): item is MstProductStepItem => Boolean(item));
}

export async function createMstProductStep(payload: MstProductStepPayload, token?: string) {
  const res = await apiFetch<unknown>(apiPath("MstProductStep"), {
    method: "POST",
    body: JSON.stringify(payload),
    token,
  });

  return mapProductStep(res);
}

export async function deleteMstProductStep(payload: DeleteMstProductStepPayload, token?: string) {
  return apiFetch<unknown>(apiPath("MstProductStep"), {
    method: "DELETE",
    body: JSON.stringify(payload),
    token,
  });
}
