import { execute, guid, query, withTransaction } from "@/lib/server/db";

export type CoreRoleClaimRow = {
  Id: number;
  RoleId: string;
  UserPrincipalName: string;
  EmployeeName: string | null;
  IsActive: boolean;
  CreatedBy: string | null;
  CreatedDate: Date;
  UpdatedBy: string | null;
  UpdatedDate: Date | null;
};

const UPSERT = `
  MERGE dbo.CORE_RoleClaim AS t
  USING (SELECT @roleId AS RoleId, @upn AS Upn) AS s
     ON t.RoleId = s.RoleId AND t.UserPrincipalName = s.Upn
  WHEN MATCHED THEN UPDATE SET EmployeeName = COALESCE(@employeeName, t.EmployeeName), IsActive = @isActive,
                               UpdatedBy = @by, UpdatedDate = SYSDATETIME()
  WHEN NOT MATCHED THEN INSERT (RoleId, UserPrincipalName, EmployeeName, IsActive, CreatedBy)
                        VALUES (@roleId, @upn, COALESCE(@employeeName, @upn), @isActive, @by)`;

export const coreRoleClaimRepository = {
  getByRoleId: (roleId: string) =>
    query<CoreRoleClaimRow>(
      "SELECT * FROM dbo.CORE_RoleClaim WHERE RoleId = @roleId AND IsActive = 1 ORDER BY EmployeeName",
      { roleId: guid(roleId) },
    ),

  async add(input: { roleId: string; upn: string; employeeName: string | null; isActive: boolean; by: string }) {
    const rows = await query<CoreRoleClaimRow>(
      `${UPSERT} OUTPUT INSERTED.*;`,
      { ...input, roleId: guid(input.roleId) },
    );
    return rows[0];
  },

  /** Listed UPNs are (re)activated, every other claim of the role is deactivated. */
  replace(roleId: string, upns: string[], isActive: boolean, by: string) {
    return withTransaction(async (tx) => {
      await execute(
        "UPDATE dbo.CORE_RoleClaim SET IsActive = 0, UpdatedBy = @by, UpdatedDate = SYSDATETIME() WHERE RoleId = @roleId",
        { roleId: guid(roleId), by },
        tx,
      );
      for (const upn of upns) {
        await execute(`${UPSERT};`, { roleId: guid(roleId), upn, employeeName: null, isActive, by }, tx);
      }
    });
  },
};
