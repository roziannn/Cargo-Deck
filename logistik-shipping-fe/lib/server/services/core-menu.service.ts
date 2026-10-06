import { HttpError, optGuid, optInt, optString, requireGuid, requireString } from "@/lib/server/http";
import {
  coreMenuRepository,
  type CoreMenuFunctionRow,
  type CoreMenuRow,
  type CoreRoleMenuRow,
  type MenuInput,
} from "@/lib/server/repositories/core-menu.repository";

type FunctionDto = { newId: string; name: string; path: string; isActive: boolean };
type MenuDto = {
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
  createdBy: string | null;
  createdDate: Date;
  updatedBy: string | null;
  updatedDate: Date | null;
  functionBtn: FunctionDto[];
  subMenu: MenuDto[];
};

const key = (id: string | null | undefined) => (id ?? "").toLowerCase();

/**
 * @param access  undefined = master view (flags come from the menu tables); otherwise flags come from RoleMenu.
 * @param onlyGranted  sidebar mode: drop menus that are not granted / active / visible.
 */
function buildTree(menus: CoreMenuRow[], functions: CoreMenuFunctionRow[], access: CoreRoleMenuRow[] | undefined, onlyGranted: boolean) {
  const menuAccess = new Map<string, boolean>();
  const funcAccess = new Map<string, boolean>();
  for (const a of access ?? []) {
    if (a.FunctionNewId) funcAccess.set(key(a.FunctionNewId), a.IsActiveBtn);
    else menuAccess.set(key(a.MenuNewId), a.IsActive);
  }

  const funcsByMenu = new Map<string, FunctionDto[]>();
  for (const f of functions) {
    const list = funcsByMenu.get(key(f.MenuNewId)) ?? [];
    list.push({
      newId: f.NewId,
      name: f.Name,
      path: f.Path ?? "",
      isActive: access ? f.IsActive && (funcAccess.get(key(f.NewId)) ?? false) : f.IsActive,
    });
    funcsByMenu.set(key(f.MenuNewId), list);
  }

  const nodes = new Map<string, MenuDto>();
  for (const m of menus) {
    nodes.set(key(m.NewId), {
      id: m.Id,
      newId: m.NewId,
      name: m.Name,
      parentId: m.ParentId,
      seq: m.Seq,
      icon: m.Icon ?? "",
      path: m.Path ?? "",
      isVisible: m.IsVisible,
      isActive: access ? m.IsActive && (menuAccess.get(key(m.NewId)) ?? false) : m.IsActive,
      isDevelopment: m.IsDevelopment,
      createdBy: m.CreatedBy,
      createdDate: m.CreatedDate,
      updatedBy: m.UpdatedBy,
      updatedDate: m.UpdatedDate,
      functionBtn: funcsByMenu.get(key(m.NewId)) ?? [],
      subMenu: [],
    });
  }

  const roots: MenuDto[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(key(node.parentId)) : undefined;
    (parent ? parent.subMenu : roots).push(node);
  }

  if (!onlyGranted) return roots;

  const prune = (n: MenuDto): boolean => {
    n.subMenu = n.subMenu.filter(prune);
    return n.isVisible && (n.isActive || n.subMenu.length > 0);
  };
  return roots.filter(prune);
}

function parseMenuInput(body: Record<string, unknown>): MenuInput {
  return {
    name: requireString(body.name, "name"),
    parentId: optGuid(body.parentId, "parentId"),
    seq: optInt(body.seq),
    icon: optString(body.icon),
    path: optString(body.path),
    isVisible: body.isVisible !== false,
    isActive: body.isActive !== false,
    isDevelopment: body.isDevelopment === true,
  };
}

export const coreMenuService = {
  async getMaster() {
    const [menus, functions] = await Promise.all([coreMenuRepository.getMenus(), coreMenuRepository.getFunctions()]);
    return buildTree(menus, functions, undefined, false);
  },

  async getByRole(roleNewId: string) {
    requireGuid(roleNewId, "role id");
    const [menus, functions, access] = await Promise.all([
      coreMenuRepository.getMenus(),
      coreMenuRepository.getFunctions(),
      coreMenuRepository.getRoleMenus(roleNewId),
    ]);
    return buildTree(menus, functions, access, false);
  },

  async getSidebar(upn: string) {
    const [menus, functions, access] = await Promise.all([
      coreMenuRepository.getMenus(),
      coreMenuRepository.getFunctions(),
      coreMenuRepository.getRoleMenusByUser(upn),
    ]);
    return buildTree(menus, functions, access, true);
  },

  create(body: Record<string, unknown>) {
    return coreMenuRepository.createMenu({ ...parseMenuInput(body), createdBy: requireString(body.createdBy, "createdBy") });
  },

  async update(newId: string, body: Record<string, unknown>) {
    requireGuid(newId, "menu id");
    const input = parseMenuInput(body);
    if (input.parentId && key(input.parentId) === key(newId)) throw new HttpError(400, "A menu cannot be its own parent.");
    const ok = await coreMenuRepository.updateMenu(newId, { ...input, updatedBy: requireString(body.updatedBy, "updatedBy") });
    if (!ok) throw new HttpError(404, "Menu not found.");
  },

  createComponent(body: Record<string, unknown>) {
    return coreMenuRepository.createFunction({
      name: requireString(body.name, "name"),
      menuNewId: requireGuid(requireString(body.menuNewId, "menuNewId"), "menuNewId"),
      path: optString(body.path),
      isActive: body.isActiveBtn !== false,
      createdBy: requireString(body.createdBy, "createdBy"),
    });
  },

  async setMenuAccess(roleNewId: string, menuNewId: string, body: Record<string, unknown>) {
    requireGuid(roleNewId, "role id");
    requireGuid(menuNewId, "menu id");
    if (!(await coreMenuRepository.menuExists(menuNewId))) throw new HttpError(404, "Menu not found.");
    await coreMenuRepository.setMenuAccess(roleNewId, menuNewId, body.isActive === true);
  },

  async setFunctionAccess(roleNewId: string, functionNewId: string, body: Record<string, unknown>) {
    requireGuid(roleNewId, "role id");
    requireGuid(functionNewId, "function id");
    const menuNewId = await coreMenuRepository.getFunctionMenuId(functionNewId);
    if (!menuNewId) throw new HttpError(404, "Function not found.");
    await coreMenuRepository.setFunctionAccess(roleNewId, menuNewId, functionNewId, body.isActive === true);
  },
};
