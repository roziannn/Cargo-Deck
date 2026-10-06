import { execute, query } from "@/lib/server/db";

export type CoreMenuRow = {
  id: number;
  newId: string;
  name: string;
  parentId: string | null;
  seq: number | null;
  icon: string | null;
  path: string | null;
  isDevelopment: boolean;
  isVisible: boolean;
  isActive: boolean;
  createdDate: Date;
  createdBy: string | null;
  updatedDate: Date | null;
  updatedBy: string | null;
};

export type CoreMenuFunctionRow = {
  id: number;
  newId: string;
  name: string;
  menuNewId: string;
  path: string | null;
  isActive: boolean;
};

export type CoreRoleMenuRow = {
  menuNewId: string;
  functionNewId: string | null;
  isActive: boolean;
  isActiveBtn: boolean;
};

export type MenuInput = {
  name: string;
  parentId: string | null;
  seq: number | null;
  icon: string | null;
  path: string | null;
  isVisible: boolean;
  isActive: boolean;
  isDevelopment: boolean;
};

export const coreMenuRepository = {
  getMenus: () => query<CoreMenuRow>("SELECT * FROM core_menu ORDER BY COALESCE(seq, 2147483647), name"),

  getFunctions: () =>
    query<CoreMenuFunctionRow>("SELECT id, new_id, name, menu_new_id, path, is_active FROM core_menu_function ORDER BY id"),

  getRoleMenus: (roleNewId: string) =>
    query<CoreRoleMenuRow>(
      "SELECT menu_new_id, function_new_id, is_active, is_active_btn FROM core_role_menu WHERE role_new_id = @roleNewId",
      { roleNewId },
    ),

  getRoleMenusByUser: (upn: string) =>
    query<CoreRoleMenuRow>(
      `SELECT rm.menu_new_id, rm.function_new_id,
              bool_or(rm.is_active)     AS is_active,
              bool_or(rm.is_active_btn) AS is_active_btn
       FROM core_role_claim rc
       JOIN core_role r       ON r.new_id = rc.role_id AND r.is_active = true
       JOIN core_role_menu rm ON rm.role_new_id = rc.role_id
       WHERE rc.user_principal_name = @upn AND rc.is_active = true
       GROUP BY rm.menu_new_id, rm.function_new_id`,
      { upn },
    ),

  async createMenu(input: MenuInput & { createdBy: string }) {
    const rows = await query<CoreMenuRow>(
      `INSERT INTO core_menu (name, parent_id, seq, icon, path, is_visible, is_active, is_development, created_by)
       VALUES (@name, @parentId, @seq, @icon, @path, @isVisible, @isActive, @isDevelopment, @createdBy)
       RETURNING *`,
      input,
    );
    return rows[0];
  },

  async updateMenu(newId: string, input: MenuInput & { updatedBy: string }) {
    const rows = await execute(
      `UPDATE core_menu
       SET name = @name, parent_id = @parentId, seq = @seq, icon = @icon, path = @path,
           is_visible = @isVisible, is_active = @isActive, is_development = @isDevelopment,
           updated_by = @updatedBy, updated_date = now()
       WHERE new_id = @newId`,
      { ...input, newId },
    );
    return rows > 0;
  },

  async createFunction(input: { name: string; menuNewId: string; path: string | null; isActive: boolean; createdBy: string }) {
    const rows = await query<CoreMenuFunctionRow>(
      `INSERT INTO core_menu_function (name, menu_new_id, path, is_active, created_by)
       VALUES (@name, @menuNewId, @path, @isActive, @createdBy)
       RETURNING id, new_id, name, menu_new_id, path, is_active`,
      input,
    );
    return rows[0];
  },

  async menuExists(newId: string) {
    return (await query("SELECT 1 FROM core_menu WHERE new_id = @newId", { newId })).length > 0;
  },

  async getFunctionMenuId(functionNewId: string) {
    const rows = await query<{ menuNewId: string }>(
      "SELECT menu_new_id FROM core_menu_function WHERE new_id = @functionNewId",
      { functionNewId },
    );
    return rows[0]?.menuNewId ?? null;
  },

  async setMenuAccess(roleNewId: string, menuNewId: string, isActive: boolean) {
    await execute(
      `INSERT INTO core_role_menu (role_new_id, menu_new_id, function_new_id, is_active, is_active_btn)
       VALUES (@roleNewId, @menuNewId, NULL, @isActive, false)
       ON CONFLICT (role_new_id, menu_new_id) WHERE function_new_id IS NULL
       DO UPDATE SET is_active = @isActive, updated_date = now()`,
      { roleNewId, menuNewId, isActive },
    );
  },

  async setFunctionAccess(roleNewId: string, menuNewId: string, functionNewId: string, isActive: boolean) {
    await execute(
      `INSERT INTO core_role_menu (role_new_id, menu_new_id, function_new_id, is_active, is_active_btn)
       VALUES (@roleNewId, @menuNewId, @functionNewId, false, @isActive)
       ON CONFLICT (role_new_id, menu_new_id, function_new_id) WHERE function_new_id IS NOT NULL
       DO UPDATE SET is_active_btn = @isActive, updated_date = now()`,
      { roleNewId, menuNewId, functionNewId, isActive },
    );
  },
};
