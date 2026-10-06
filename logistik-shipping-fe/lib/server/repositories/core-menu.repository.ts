import { execute, guid, query } from "@/lib/server/db";

export type CoreMenuRow = {
  Id: number;
  NewId: string;
  Name: string;
  ParentId: string | null;
  Seq: number | null;
  Icon: string | null;
  Path: string | null;
  IsDevelopment: boolean;
  IsVisible: boolean;
  IsActive: boolean;
  CreatedDate: Date;
  CreatedBy: string | null;
  UpdatedDate: Date | null;
  UpdatedBy: string | null;
};

export type CoreMenuFunctionRow = {
  Id: number;
  NewId: string;
  Name: string;
  MenuNewId: string;
  Path: string | null;
  IsActive: boolean;
};

export type CoreRoleMenuRow = {
  MenuNewId: string;
  FunctionNewId: string | null;
  IsActive: boolean;
  IsActiveBtn: boolean;
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

const menuParams = ({ parentId, ...rest }: MenuInput) => ({ ...rest, parentId: guid(parentId) });

export const coreMenuRepository = {
  getMenus: () => query<CoreMenuRow>("SELECT * FROM dbo.CORE_Menu ORDER BY ISNULL(Seq, 2147483647), Name"),

  getFunctions: () =>
    query<CoreMenuFunctionRow>("SELECT Id, NewId, Name, MenuNewId, Path, IsActive FROM dbo.CORE_MenuFunction ORDER BY Id"),

  getRoleMenus: (roleNewId: string) =>
    query<CoreRoleMenuRow>(
      "SELECT MenuNewId, FunctionNewId, IsActive, IsActiveBtn FROM dbo.CORE_RoleMenu WHERE RoleNewId = @roleNewId",
      { roleNewId: guid(roleNewId) },
    ),

  getRoleMenusByUser: (upn: string) =>
    query<CoreRoleMenuRow>(
      `SELECT rm.MenuNewId, rm.FunctionNewId,
              CAST(MAX(CAST(rm.IsActive AS INT)) AS BIT)    AS IsActive,
              CAST(MAX(CAST(rm.IsActiveBtn AS INT)) AS BIT) AS IsActiveBtn
       FROM dbo.CORE_RoleClaim rc
       JOIN dbo.CORE_Role r      ON r.NewId = rc.RoleId AND r.IsActive = 1
       JOIN dbo.CORE_RoleMenu rm ON rm.RoleNewId = rc.RoleId
       WHERE rc.UserPrincipalName = @upn AND rc.IsActive = 1
       GROUP BY rm.MenuNewId, rm.FunctionNewId`,
      { upn },
    ),

  async createMenu(input: MenuInput & { createdBy: string }) {
    const rows = await query<CoreMenuRow>(
      `INSERT INTO dbo.CORE_Menu (Name, ParentId, Seq, Icon, Path, IsVisible, IsActive, IsDevelopment, CreatedBy)
       OUTPUT INSERTED.*
       VALUES (@name, @parentId, @seq, @icon, @path, @isVisible, @isActive, @isDevelopment, @createdBy)`,
      { ...menuParams(input), createdBy: input.createdBy },
    );
    return rows[0];
  },

  async updateMenu(newId: string, input: MenuInput & { updatedBy: string }) {
    const rows = await execute(
      `UPDATE dbo.CORE_Menu
       SET Name = @name, ParentId = @parentId, Seq = @seq, Icon = @icon, Path = @path,
           IsVisible = @isVisible, IsActive = @isActive, IsDevelopment = @isDevelopment,
           UpdatedBy = @updatedBy, UpdatedDate = SYSDATETIME()
       WHERE NewId = @newId`,
      { ...menuParams(input), updatedBy: input.updatedBy, newId: guid(newId) },
    );
    return rows > 0;
  },

  async createFunction(input: { name: string; menuNewId: string; path: string | null; isActive: boolean; createdBy: string }) {
    const rows = await query<CoreMenuFunctionRow>(
      `INSERT INTO dbo.CORE_MenuFunction (Name, MenuNewId, Path, IsActive, CreatedBy)
       OUTPUT INSERTED.Id, INSERTED.NewId, INSERTED.Name, INSERTED.MenuNewId, INSERTED.Path, INSERTED.IsActive
       VALUES (@name, @menuNewId, @path, @isActive, @createdBy)`,
      { ...input, menuNewId: guid(input.menuNewId) },
    );
    return rows[0];
  },

  async menuExists(newId: string) {
    return (await query("SELECT 1 AS x FROM dbo.CORE_Menu WHERE NewId = @newId", { newId: guid(newId) })).length > 0;
  },

  async getFunctionMenuId(functionNewId: string) {
    const rows = await query<{ MenuNewId: string }>(
      "SELECT MenuNewId FROM dbo.CORE_MenuFunction WHERE NewId = @functionNewId",
      { functionNewId: guid(functionNewId) },
    );
    return rows[0]?.MenuNewId ?? null;
  },

  async setMenuAccess(roleNewId: string, menuNewId: string, isActive: boolean) {
    await execute(
      `MERGE dbo.CORE_RoleMenu AS t
       USING (SELECT @roleNewId AS R, @menuNewId AS M) AS s
          ON t.RoleNewId = s.R AND t.MenuNewId = s.M AND t.FunctionNewId IS NULL
       WHEN MATCHED THEN UPDATE SET IsActive = @isActive, UpdatedDate = SYSDATETIME()
       WHEN NOT MATCHED THEN INSERT (RoleNewId, MenuNewId, FunctionNewId, IsActive, IsActiveBtn)
                             VALUES (@roleNewId, @menuNewId, NULL, @isActive, 0);`,
      { roleNewId: guid(roleNewId), menuNewId: guid(menuNewId), isActive },
    );
  },

  async setFunctionAccess(roleNewId: string, menuNewId: string, functionNewId: string, isActive: boolean) {
    await execute(
      `MERGE dbo.CORE_RoleMenu AS t
       USING (SELECT @roleNewId AS R, @menuNewId AS M, @functionNewId AS F) AS s
          ON t.RoleNewId = s.R AND t.MenuNewId = s.M AND t.FunctionNewId = s.F
       WHEN MATCHED THEN UPDATE SET IsActiveBtn = @isActive, UpdatedDate = SYSDATETIME()
       WHEN NOT MATCHED THEN INSERT (RoleNewId, MenuNewId, FunctionNewId, IsActive, IsActiveBtn)
                             VALUES (@roleNewId, @menuNewId, @functionNewId, 0, @isActive);`,
      { roleNewId: guid(roleNewId), menuNewId: guid(menuNewId), functionNewId: guid(functionNewId), isActive },
    );
  },
};
