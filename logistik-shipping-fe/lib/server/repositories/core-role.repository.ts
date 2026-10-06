import { execute, query } from "@/lib/server/db";

export type CoreRoleRow = {
  id: number;
  newId: string;
  name: string;
  isActive: boolean;
  createdBy: string | null;
  createdDate: Date;
  updatedBy: string | null;
  updatedDate: Date | null;
};

export const coreRoleRepository = {
  getAll: () => query<CoreRoleRow>("SELECT * FROM core_role ORDER BY name"),

  async getByNewId(newId: string) {
    const rows = await query<CoreRoleRow>("SELECT * FROM core_role WHERE new_id = @newId", { newId });
    return rows[0] ?? null;
  },

  async create(input: { name: string; isActive: boolean; createdBy: string }) {
    const rows = await query<CoreRoleRow>(
      `INSERT INTO core_role (name, is_active, created_by) VALUES (@name, @isActive, @createdBy) RETURNING *`,
      input,
    );
    return rows[0];
  },

  async update(newId: string, input: { name: string; isActive: boolean; updatedBy: string }) {
    const rows = await execute(
      `UPDATE core_role SET name = @name, is_active = @isActive, updated_by = @updatedBy, updated_date = now()
       WHERE new_id = @newId`,
      { ...input, newId },
    );
    return rows > 0;
  },
};
