import { apiFetch, apiPath } from "@/lib/api-client";

type JsonRecord = Record<string, unknown>;

export type CreateCoreMenuPayload = {
  name: string;
  parentId?: string | null;
  seq?: number | null;
  icon?: string | null;
  path?: string | null;
  isVisible: boolean;
  isActive: boolean;
  isDevelopment: boolean;
  createdBy: string;
};

export type UpdateCoreMenuPayload = {
  name: string;
  parentId?: string | null;
  seq?: number | null;
  icon?: string | null;
  path?: string | null;
  isVisible: boolean;
  isActive: boolean;
  isDevelopment: boolean;
  updatedBy: string;
};

export type CreateCoreMenuComponentPayload = {
  name: string;
  menuNewId: string;
  path?: string | null;
  createdBy: string;
  isActiveBtn: boolean;
};

export type CoreMenuItem = {
  id: number;
  newId: string;
  name: string;
  parentId: string | null;
  seq: number | null;
  icon: string;
  path: string;
  isVisible: boolean;
  isActive: boolean;
  isDevelopment: boolean;
  createdBy: string;
  createdDate: string;
  updatedBy: string;
  updatedDate: string;
  functionBtn: CoreMenuFunctionItem[];
  subMenu: CoreMenuItem[];
};

export type CoreMenuFunctionItem = {
  newId: string;
  name: string;
  path: string;
  isActive: boolean;
};

export type UpdateRoleMenuAccessPayload = {
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

function looksLikeMenuItem(value: unknown): value is JsonRecord {
  if (!isRecord(value)) return false;
  return "name" in value || "Name" in value || "path" in value || "Path" in value || "subMenu" in value || "SubMenu" in value;
}

function unwrapArray(input: unknown): unknown[] {
  if (Array.isArray(input)) return input;
  if (!isRecord(input)) return [];

  const candidates = [
    input.data,
    input.result,
    input.items,
    input.results,
    input.menu,
    input.menus,
    input.list,
    input.subMenu,
    input.Data,
    input.Result,
    input.Items,
    input.Results,
    input.Menu,
    input.Menus,
    input.List,
    input.SubMenu,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  for (const candidate of candidates) {
    const nested = unwrapArray(candidate);
    if (nested.length > 0) return nested;
  }

  if (looksLikeMenuItem(input)) {
    return [input];
  }

  return [];
}

function mapCoreMenuItem(item: unknown): CoreMenuItem | null {
  if (!isRecord(item)) return null;

  const functionBtn = Array.isArray(item.functionBtn)
    ? item.functionBtn.map(mapCoreMenuFunctionItem).filter((x): x is CoreMenuFunctionItem => Boolean(x))
    : [];
  const subMenu = Array.isArray(item.subMenu)
    ? item.subMenu.map(mapCoreMenuItem).filter((x): x is CoreMenuItem => Boolean(x))
    : [];

  return {
    id: pickNumber(item, ["id", "Id"], 0),
    newId: pickString(item, ["newId", "NewId", "newID", "NewID"], ""),
    name: pickString(item, ["name", "Name"], "-"),
    parentId: pickString(item, ["parentId", "ParentId", "parentID", "ParentID"], "") || null,
    seq: pickNumber(item, ["seq", "Seq"], 0),
    icon: pickString(item, ["icon", "Icon"], ""),
    path: pickString(item, ["path", "Path"], ""),
    isVisible: pickBool(item, ["isVisible", "IsVisible"], false),
    isActive: pickBool(item, ["isActive", "IsActive"], false),
    isDevelopment: pickBool(item, ["isDevelopment", "IsDevelopment"], false),
    createdBy: pickString(item, ["createdBy", "CreatedBy"], "-"),
    createdDate: pickString(item, ["createdDate", "CreatedDate", "createdAt", "CreatedAt"], "-"),
    updatedBy: pickString(item, ["updatedBy", "UpdatedBy"], "-"),
    updatedDate: pickString(item, ["updatedDate", "UpdatedDate", "updatedAt", "UpdatedAt"], "-"),
    functionBtn,
    subMenu,
  };
}

function mapCoreMenuFunctionItem(item: unknown): CoreMenuFunctionItem | null {
  if (!isRecord(item)) return null;

  return {
    newId: pickString(item, ["newId", "NewId", "newID", "NewID", "functionNewId", "FunctionNewId"], ""),
    name: pickString(item, ["name", "Name"], "-"),
    path: pickString(item, ["path", "Path"], ""),
    isActive: pickBool(item, ["isActive", "IsActive", "isActiveBtn", "IsActiveBtn"], false),
  };
}

export async function listCoreMenusMaster(token?: string) {
  const res = await apiFetch<unknown>(apiPath("CoreMenu/MasterMenu"), {
    method: "GET",
    token,
    cache: "no-store",
  });

  return unwrapArray(res).map(mapCoreMenuItem).filter((x): x is CoreMenuItem => Boolean(x));
}

export async function listCoreMenusByRoleId(roleId: string, token?: string) {
  const res = await apiFetch<unknown>(apiPath(`CoreMenu/${encodeURIComponent(roleId)}`), {
    method: "GET",
    token,
    cache: "no-store",
  });

  return unwrapArray(res).map(mapCoreMenuItem).filter((x): x is CoreMenuItem => Boolean(x));
}

export async function listCoreMenusSidebar(userPrincipalName: string, token?: string) {
  const res = await apiFetch<unknown>(apiPath(`CoreMenu/Sidebar/${encodeURIComponent(userPrincipalName)}`), {
    method: "GET",
    token,
    cache: "no-store",
  });

  return unwrapArray(res).map(mapCoreMenuItem).filter((x): x is CoreMenuItem => Boolean(x));
}

export async function createCoreMenu(payload: CreateCoreMenuPayload, token?: string) {
  return apiFetch<unknown>(apiPath("CoreMenu"), {
    method: "POST",
    body: JSON.stringify(payload),
    token,
  });
}

export async function updateCoreMenu(newId: string, payload: UpdateCoreMenuPayload, token?: string) {
  return apiFetch<unknown>(apiPath(`CoreMenu/${encodeURIComponent(newId)}`), {
    method: "PUT",
    body: JSON.stringify(payload),
    token,
  });
}

export async function createCoreMenuComponent(payload: CreateCoreMenuComponentPayload, token?: string) {
  return apiFetch<unknown>(apiPath("CoreMenu/menu-component/create"), {
    method: "POST",
    body: JSON.stringify(payload),
    token,
  });
}

export async function updateRoleMenuAccess(roleNewId: string, menuNewId: string, payload: UpdateRoleMenuAccessPayload, token?: string) {
  return apiFetch<unknown>(apiPath(`CoreMenu/role/${encodeURIComponent(roleNewId)}/menu/${encodeURIComponent(menuNewId)}`), {
    method: "PUT",
    body: JSON.stringify(payload),
    token,
  });
}

export async function updateRoleMenuFunctionAccess(roleNewId: string, functionNewId: string, payload: UpdateRoleMenuAccessPayload, token?: string) {
  return apiFetch<unknown>(apiPath(`CoreMenu/role/${encodeURIComponent(roleNewId)}/function/${encodeURIComponent(functionNewId)}`), {
    method: "PUT",
    body: JSON.stringify(payload),
    token,
  });
}
