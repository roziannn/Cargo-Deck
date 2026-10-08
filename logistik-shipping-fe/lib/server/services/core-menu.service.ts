import { activeLabel, auditCreate, auditUpdate, writeAudit, yesNo, type AuditField } from "@/lib/server/audit";
import { coreRoleRepository } from "@/lib/server/repositories/core-role.repository";
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
    if (a.functionNewId) funcAccess.set(key(a.functionNewId), a.isActiveBtn);
    else menuAccess.set(key(a.menuNewId), a.isActive);
  }

  const funcsByMenu = new Map<string, FunctionDto[]>();
  for (const f of functions) {
    const list = funcsByMenu.get(key(f.menuNewId)) ?? [];
    list.push({
      newId: f.newId,
      name: f.name,
      path: f.path ?? "",
      isActive: access ? f.isActive && (funcAccess.get(key(f.newId)) ?? false) : f.isActive,
    });
    funcsByMenu.set(key(f.menuNewId), list);
  }

  const nodes = new Map<string, MenuDto>();
  for (const m of menus) {
    nodes.set(key(m.newId), {
      id: m.id,
      newId: m.newId,
      name: m.name,
      parentId: m.parentId,
      seq: m.seq,
      icon: m.icon ?? "",
      path: m.path ?? "",
      isVisible: m.isVisible,
      isActive: access ? m.isActive && (menuAccess.get(key(m.newId)) ?? false) : m.isActive,
      isDevelopment: m.isDevelopment,
      createdBy: m.createdBy,
      createdDate: m.createdDate,
      updatedBy: m.updatedBy,
      updatedDate: m.updatedDate,
      functionBtn: funcsByMenu.get(key(m.newId)) ?? [],
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

const MENU_FIELDS: AuditField[] = [
  { key: "name", label: "Nama" },
  { key: "seq", label: "Urutan" },
  { key: "icon", label: "Ikon" },
  { key: "path", label: "Path" },
  { key: "isVisible", label: "Tampil", format: yesNo("Ya", "Tidak") },
  { key: "isActive", label: "Status", format: activeLabel },
  { key: "isDevelopment", label: "Dalam pengembangan", format: yesNo("Ya", "Tidak") },
];

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

  async create(body: Record<string, unknown>) {
    const input = parseMenuInput(body);
    const created = await coreMenuRepository.createMenu({ ...input, createdBy: requireString(body.createdBy, "createdBy") });
    await auditCreate({ module: "Menu", entityType: "Menu", ref: input.name, detail: input.path ? `path ${input.path}` : undefined });
    return created;
  },

  async update(newId: string, body: Record<string, unknown>) {
    requireGuid(newId, "menu id");
    const input = parseMenuInput(body);
    if (input.parentId && key(input.parentId) === key(newId)) throw new HttpError(400, "A menu cannot be its own parent.");
    const before = (await coreMenuRepository.getMenus()).find((m) => key(m.newId) === key(newId));
    const ok = await coreMenuRepository.updateMenu(newId, { ...input, updatedBy: requireString(body.updatedBy, "updatedBy") });
    if (!ok || !before) throw new HttpError(404, "Menu not found.");
    await auditUpdate({ module: "Menu", entityType: "Menu", ref: before.name, before, after: input, fields: MENU_FIELDS });
  },

  async createComponent(body: Record<string, unknown>) {
    const name = requireString(body.name, "name");
    const menuNewId = requireGuid(requireString(body.menuNewId, "menuNewId"), "menuNewId");
    const created = await coreMenuRepository.createFunction({
      name,
      menuNewId,
      path: optString(body.path),
      isActive: body.isActiveBtn !== false,
      createdBy: requireString(body.createdBy, "createdBy"),
    });
    const menu = (await coreMenuRepository.getMenus()).find((m) => key(m.newId) === key(menuNewId));
    await auditCreate({ module: "Menu", entityType: "Komponen tombol", ref: name, detail: menu ? `pada menu ${menu.name}` : undefined });
    return created;
  },

  async setMenuAccess(roleNewId: string, menuNewId: string, body: Record<string, unknown>) {
    requireGuid(roleNewId, "role id");
    requireGuid(menuNewId, "menu id");
    if (!(await coreMenuRepository.menuExists(menuNewId))) throw new HttpError(404, "Menu not found.");
    const [role, menus, current] = await Promise.all([coreRoleRepository.getByNewId(roleNewId), coreMenuRepository.getMenus(), coreMenuRepository.getRoleMenus(roleNewId)]);
    const was = current.find((r) => key(r.menuNewId) === key(menuNewId) && r.functionNewId === null)?.isActive ?? false;
    await coreMenuRepository.setMenuAccess(roleNewId, menuNewId, body.isActive === true);
    if (was !== (body.isActive === true)) {
      const menu = menus.find((m) => key(m.newId) === key(menuNewId));
      await writeAudit({
        module: "Hak Akses",
        action: "ACCESS_CHANGE",
        entityType: "Menu",
        ref: menu?.name,
        note: `${body.isActive === true ? "Mengaktifkan" : "Menonaktifkan"} akses menu '${menu?.name ?? menuNewId}' untuk role '${role?.name ?? roleNewId}'`,
      });
    }
  },

  async setFunctionAccess(roleNewId: string, functionNewId: string, body: Record<string, unknown>) {
    requireGuid(roleNewId, "role id");
    requireGuid(functionNewId, "function id");
    const menuNewId = await coreMenuRepository.getFunctionMenuId(functionNewId);
    if (!menuNewId) throw new HttpError(404, "Function not found.");
    const [role, functions, current] = await Promise.all([coreRoleRepository.getByNewId(roleNewId), coreMenuRepository.getFunctions(), coreMenuRepository.getRoleMenus(roleNewId)]);
    const was = current.find((r) => r.functionNewId !== null && key(r.functionNewId) === key(functionNewId))?.isActiveBtn ?? false;
    await coreMenuRepository.setFunctionAccess(roleNewId, menuNewId, functionNewId, body.isActive === true);
    if (was !== (body.isActive === true)) {
      const fn = functions.find((x) => key(x.newId) === key(functionNewId));
      await writeAudit({
        module: "Hak Akses",
        action: "ACCESS_CHANGE",
        entityType: "Komponen tombol",
        ref: fn?.name,
        note: `${body.isActive === true ? "Mengaktifkan" : "Menonaktifkan"} tombol '${fn?.name ?? functionNewId}' untuk role '${role?.name ?? roleNewId}'`,
      });
    }
  },
};
