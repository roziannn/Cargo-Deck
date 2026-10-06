import { execute, guid, query } from "@/lib/server/db";

export type CoreRoleRow = {
  Id: number;
  NewId: string;
  Name: string;
  IsActive: boolean;
  CreatedBy: string | null;
  CreatedDate: Date;
  UpdatedBy: string | null;
  UpdatedDate: Date | null;
};

export const coreRoleRepository = {
  getAll: () => query<CoreRoleRow>("SELECT * FROM dbo.CORE_Role ORDER BY Name"),

  async getByNewId(newId: string) {
    const rows = await query<CoreRoleRow>("SELECT * FROM dbo.CORE_Role WHERE NewId = @newId", { newId: guid(newId) });
    return rows[0] ?? null;
  },

  async create(input: { name: string; isActive: boolean; createdBy: string }) {
    const rows = await query<CoreRoleRow>(
      `INSERT INTO dbo.CORE_Role (Name, IsActive, CreatedBy) OUTPUT INSERTED.*
       VALUES (@name, @isActive, @createdBy)`,
      input,
    );
    return rows[0];
  },

  async update(newId: string, input: { name: string; isActive: boolean; updatedBy: string }) {
    const rows = await execute(
      `UPDATE dbo.CORE_Role SET Name = @name, IsActive = @isActive, UpdatedBy = @updatedBy, UpdatedDate = SYSDATETIME()
       WHERE NewId = @newId`,
      { ...input, newId: guid(newId) },
    );
    return rows > 0;
  },
};
