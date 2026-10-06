import { apiFetch, apiPath } from "@/lib/api-client";

type JsonRecord = Record<string, unknown>;

export type CoreRoleItem = {
  id: number;
  newId: string;
  name: string;
  isActive: boolean;
  createdBy: string;
  createdDate: string;
  updatedBy: string;
  updatedDate: string;
};

export type CreateCoreRolePayload = {
  name: string;
  isActive: boolean;
  createdBy: string;
};

export type UpdateCoreRolePayload = {
  name: string;
  isActive: boolean;
  updatedBy: string;
};

export type AddCoreRoleClaimPayload = {
  roleId: string;
  userPrincipalName: string;
  employeeName: string;
  isActive: boolean;
  createdBy: string;
};

export type CoreRoleClaimItem = {
  id: number;
  roleId: string;
  userPrincipalName: string;
  employeeName: string;
  isActive: boolean;
  createdBy: string;
  createdDate: string;
  updatedBy: string;
  updatedDate: string;
};

export type UpdateCoreRoleClaimPayload = {
  roleId: string;
  roleName: string;
  userPrincipalNames: string[];
  updatedBy: string;
  isActive: boolean;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickString(source: JsonRecord, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return fallback;
}

function cleanPipeString(value: string) {
  return value.replace(/\|+$/g, "").trim();
}

function pickNumber(source: JsonRecord, keys: string[], fallback = 0) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return fallback;
}

function pickBool(source: JsonRecord, keys: string[], fallback = false) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes", "y"].includes(normalized)) return true;
      if (["false", "0", "no", "n"].includes(normalized)) return false;
    }
  }
  return fallback;
}

function unwrapArray(input: unknown): unknown[] {
  if (Array.isArray(input)) return input;
  if (!isRecord(input)) return [];

  const candidates = [input.data, input.result, input.items, input.results, input.Data, input.Result, input.Items, input.Results];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function unwrapRoleClaimList(input: unknown): unknown[] {
  if (Array.isArray(input)) return input;
  if (!isRecord(input)) return [];

  const directListUser = input.listUser;
  if (Array.isArray(directListUser)) return directListUser;
  if (typeof directListUser === "string" && directListUser.trim()) {
    return directListUser
      .split("|")
      .map((value) => cleanPipeString(value))
      .filter(Boolean);
  }

  const nestedData = input.data;
  if (isRecord(nestedData)) {
    const nestedListUser = nestedData.listUser;
    if (Array.isArray(nestedListUser)) return nestedListUser;
    if (typeof nestedListUser === "string" && nestedListUser.trim()) {
      return nestedListUser
        .split("|")
        .map((value) => cleanPipeString(value))
        .filter(Boolean);
    }
  }

  return unwrapArray(input);
}

function mapCoreRoleItem(item: unknown): CoreRoleItem | null {
  if (!isRecord(item)) return null;

  return {
    id: pickNumber(item, ["id", "Id"], 0),
    newId: pickString(item, ["newId", "NewId", "newID", "NewID"], ""),
    name: pickString(item, ["name", "Name"], "-"),
    isActive: pickBool(item, ["isActive", "IsActive"], false),
    createdBy: pickString(item, ["createdBy", "CreatedBy"], "-"),
    createdDate: pickString(item, ["createdDate", "CreatedDate", "createdAt", "CreatedAt"], "-"),
    updatedBy: pickString(item, ["updatedBy", "UpdatedBy"], "-"),
    updatedDate: pickString(item, ["updatedDate", "UpdatedDate", "updatedAt", "UpdatedAt"], "-"),
  };
}

function mapCoreRoleClaimItem(item: unknown): CoreRoleClaimItem | null {
  if (typeof item === "string" && item.trim()) {
    const parts = item
      .split("|")
      .map((value) => cleanPipeString(value))
      .filter(Boolean);
    const userPrincipalName = parts[0] || "";
    const employeeName = parts[1] || userPrincipalName;

    if (!userPrincipalName) return null;

    return {
      id: 0,
      roleId: "",
      userPrincipalName,
      employeeName,
      isActive: true,
      createdBy: "-",
      createdDate: "-",
      updatedBy: "-",
      updatedDate: "-",
    };
  }

  if (!isRecord(item)) return null;

  return {
    id: pickNumber(item, ["id", "Id"], 0),
    roleId: pickString(item, ["roleId", "RoleId", "roleID", "RoleID"], ""),
    userPrincipalName: cleanPipeString(pickString(item, ["userPrincipalName", "UserPrincipalName", "upn", "UPN"], "")),
    employeeName: cleanPipeString(pickString(item, ["employeeName", "EmployeeName", "name", "Name"], "-")),
    isActive: pickBool(item, ["isActive", "IsActive"], false),
    createdBy: pickString(item, ["createdBy", "CreatedBy"], "-"),
    createdDate: pickString(item, ["createdDate", "CreatedDate", "createdAt", "CreatedAt"], "-"),
    updatedBy: pickString(item, ["updatedBy", "UpdatedBy"], "-"),
    updatedDate: pickString(item, ["updatedDate", "UpdatedDate", "updatedAt", "UpdatedAt"], "-"),
  };
}

export async function listCoreRoles(token?: string) {
  const res = await apiFetch<unknown>(apiPath("CoreRole"), {
    method: "GET",
    token,
    cache: "no-store",
  });

  return unwrapArray(res).map(mapCoreRoleItem).filter((x): x is CoreRoleItem => Boolean(x));
}

export async function createCoreRole(payload: CreateCoreRolePayload, token?: string) {
  return apiFetch<unknown>(apiPath("CoreRole"), {
    method: "POST",
    body: JSON.stringify(payload),
    token,
  });
}

export async function updateCoreRole(newId: string, payload: UpdateCoreRolePayload, token?: string) {
  return apiFetch<unknown>(apiPath(`CoreRole/${encodeURIComponent(newId)}`), {
    method: "PUT",
    body: JSON.stringify(payload),
    token,
  });
}

export async function addCoreRoleClaim(payload: AddCoreRoleClaimPayload, token?: string) {
  return apiFetch<unknown>(apiPath("CoreRoleClaim/add"), {
    method: "POST",
    body: JSON.stringify(payload),
    token,
  });
}

export async function listCoreRoleClaimsByRoleId(roleId: string, token?: string) {
  const res = await apiFetch<unknown>(apiPath(`CoreRoleClaim/by-roleid/${encodeURIComponent(roleId)}`), {
    method: "GET",
    token,
    cache: "no-store",
  });

  return unwrapRoleClaimList(res).map(mapCoreRoleClaimItem).filter((x): x is CoreRoleClaimItem => Boolean(x));
}

export async function updateCoreRoleClaim(roleId: string, payload: UpdateCoreRoleClaimPayload, token?: string) {
  return apiFetch<unknown>(apiPath(`CoreRoleClaim/update/${encodeURIComponent(roleId)}`), {
    method: "PUT",
    body: JSON.stringify(payload),
    token,
  });
}
