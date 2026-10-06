import { execute, query, withTransaction } from "@/lib/server/db";

export type CoreRoleClaimRow = {
  id: number;
  roleId: string;
  userPrincipalName: string;
  employeeName: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdDate: Date;
  updatedBy: string | null;
  updatedDate: Date | null;
};

const UPSERT = `
  INSERT INTO core_role_claim (role_id, user_principal_name, employee_name, is_active, created_by)
  VALUES (@roleId, @upn, COALESCE(@employeeName, @upn), @isActive, @by)
  ON CONFLICT (role_id, user_principal_name) DO UPDATE
     SET employee_name = COALESCE(@employeeName, core_role_claim.employee_name),
         is_active = @isActive, updated_by = @by, updated_date = now()`;

export const coreRoleClaimRepository = {
  getByRoleId: (roleId: string) =>
    query<CoreRoleClaimRow>(
      "SELECT * FROM core_role_claim WHERE role_id = @roleId AND is_active = true ORDER BY employee_name",
      { roleId },
    ),

  async add(input: { roleId: string; upn: string; employeeName: string | null; isActive: boolean; by: string }) {
    const rows = await query<CoreRoleClaimRow>(`${UPSERT} RETURNING *`, input);
    return rows[0];
  },

  /** Listed UPNs are (re)activated, every other claim of the role is deactivated. */
  replace(roleId: string, upns: string[], isActive: boolean, by: string) {
    return withTransaction(async (tx) => {
      await execute(
        "UPDATE core_role_claim SET is_active = false, updated_by = @by, updated_date = now() WHERE role_id = @roleId",
        { roleId, by },
        tx,
      );
      for (const upn of upns) {
        await execute(UPSERT, { roleId, upn, employeeName: null, isActive, by }, tx);
      }
    });
  },
};
