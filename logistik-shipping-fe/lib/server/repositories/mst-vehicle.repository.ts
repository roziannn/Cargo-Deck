import { query } from "@/lib/server/db";

export type MstVehicleRow = {
  id: number;
  newId: string;
  name: string;
  type: string | null;
  climate: string | null;
  cbm: string | null;
  dimensionsL: string | null;
  dimensionsW: string | null;
  floorArea: string | null;
  maxHeight: string | null;
  maxPayload: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdDate: Date;
  updatedBy: string | null;
  updatedDate: Date | null;
};

export type MstVehicleInput = {
  name: string;
  type: string | null;
  climate: string | null;
  cbm: number | null;
  dimensionsL: number | null;
  dimensionsW: number | null;
  floorArea: number | null;
  maxHeight: number | null;
  maxPayload: number | null;
  isActive: boolean;
};

// numeric columns are returned as text without trailing zeros ("10.5"), which is what the FE expects
const COLUMNS = `id, new_id, name, type, climate,
  trim_scale(cbm)::text AS cbm, trim_scale(dimensions_l)::text AS dimensions_l, trim_scale(dimensions_w)::text AS dimensions_w,
  trim_scale(floor_area)::text AS floor_area, trim_scale(max_height)::text AS max_height, trim_scale(max_payload)::text AS max_payload,
  is_active, created_by, created_date, updated_by, updated_date`;

export const mstVehicleRepository = {
  getAll: () => query<MstVehicleRow>(`SELECT ${COLUMNS} FROM mst_vehicle ORDER BY created_date DESC, id DESC`),

  async getByNewId(newId: string) {
    const rows = await query<MstVehicleRow>(`SELECT ${COLUMNS} FROM mst_vehicle WHERE new_id = @newId`, { newId });
    return rows[0] ?? null;
  },

  getLov: () =>
    query<{ value: string; label: string }>("SELECT new_id AS value, name AS label FROM mst_vehicle WHERE is_active = true ORDER BY name"),

  async create(input: MstVehicleInput & { createdBy: string }) {
    const rows = await query<MstVehicleRow>(
      `INSERT INTO mst_vehicle (name, type, climate, cbm, dimensions_l, dimensions_w, floor_area, max_height, max_payload, is_active, created_by)
       VALUES (@name, @type, @climate, @cbm, @dimensionsL, @dimensionsW, @floorArea, @maxHeight, @maxPayload, @isActive, @createdBy)
       RETURNING ${COLUMNS}`,
      input,
    );
    return rows[0];
  },

  async update(newId: string, input: MstVehicleInput & { updatedBy: string }) {
    const rows = await query<MstVehicleRow>(
      `UPDATE mst_vehicle
       SET name = @name, type = @type, climate = @climate, cbm = @cbm, dimensions_l = @dimensionsL,
           dimensions_w = @dimensionsW, floor_area = @floorArea, max_height = @maxHeight, max_payload = @maxPayload, is_active = @isActive,
           updated_by = @updatedBy, updated_date = now()
       WHERE new_id = @newId
       RETURNING ${COLUMNS}`,
      { ...input, newId },
    );
    return rows[0] ?? null;
  },
};
