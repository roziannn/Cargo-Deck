import { query } from "@/lib/server/db";

export type MstCubstoolRow = {
  id: number;
  newId: string;
  name: string;
  itemCode: string;
  length: string | null;
  width: string | null;
  height: string | null;
  weight: string | null;
  color: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdDate: Date;
  updatedBy: string | null;
  updatedDate: Date | null;
};

export type MstCubstoolInput = {
  name: string;
  itemCode: string;
  length: number | null;
  width: number | null;
  height: number | null;
  weight: number | null;
  color: string | null;
  isActive: boolean;
};

const COLUMNS = `id, new_id, name, item_code,
  trim_scale(length)::text AS length, trim_scale(width)::text AS width,
  trim_scale(height)::text AS height, trim_scale(weight)::text AS weight,
  color, is_active, created_by, created_date, updated_by, updated_date`;

export const mstCubstoolRepository = {
  getAll: () => query<MstCubstoolRow>(`SELECT ${COLUMNS} FROM mst_cubstool ORDER BY created_date DESC, id DESC`),

  getLov: () =>
    query<{ value: string; label: string }>("SELECT new_id AS value, name AS label FROM mst_cubstool WHERE is_active = true ORDER BY name"),

  async create(input: MstCubstoolInput & { createdBy: string }) {
    const rows = await query<MstCubstoolRow>(
      `INSERT INTO mst_cubstool (name, item_code, length, width, height, weight, color, is_active, created_by)
       VALUES (@name, @itemCode, @length, @width, @height, @weight, @color, @isActive, @createdBy)
       RETURNING ${COLUMNS}`,
      input,
    );
    return rows[0];
  },

  async update(newId: string, input: MstCubstoolInput & { updatedBy: string }) {
    const rows = await query<MstCubstoolRow>(
      `UPDATE mst_cubstool
       SET name = @name, item_code = @itemCode, length = @length, width = @width, height = @height,
           weight = @weight, color = @color, is_active = @isActive, updated_by = @updatedBy, updated_date = now()
       WHERE new_id = @newId
       RETURNING ${COLUMNS}`,
      { ...input, newId },
    );
    return rows[0] ?? null;
  },
};
