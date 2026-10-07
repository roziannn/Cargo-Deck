import { query } from "@/lib/server/db";

export type MstLocationRow = {
  id: number;
  newId: string;
  code: string;
  name: string;
  type: "WAREHOUSE" | "CUSTOMER";
  address: string | null;
  city: string | null;
  province: string | null;
  contactName: string | null;
  contactPhone: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdDate: Date;
  updatedBy: string | null;
  updatedDate: Date | null;
};

export type MstLocationInput = {
  code: string;
  name: string;
  type: "WAREHOUSE" | "CUSTOMER";
  address: string | null;
  city: string | null;
  province: string | null;
  contactName: string | null;
  contactPhone: string | null;
  isActive: boolean;
};

export const mstLocationRepository = {
  getAll: () => query<MstLocationRow>("SELECT * FROM mst_location ORDER BY type, name"),

  getLov: () =>
    query<{ value: string; label: string; type: string }>(
      "SELECT new_id AS value, code || ' - ' || name AS label, type FROM mst_location WHERE is_active = true ORDER BY name",
    ),

  async create(input: MstLocationInput & { createdBy: string }) {
    const rows = await query<MstLocationRow>(
      `INSERT INTO mst_location (code, name, type, address, city, province, contact_name, contact_phone, is_active, created_by)
       VALUES (@code, @name, @type, @address, @city, @province, @contactName, @contactPhone, @isActive, @createdBy)
       RETURNING *`,
      input,
    );
    return rows[0];
  },

  async update(newId: string, input: MstLocationInput & { updatedBy: string }) {
    const rows = await query<MstLocationRow>(
      `UPDATE mst_location
       SET code = @code, name = @name, type = @type, address = @address, city = @city, province = @province,
           contact_name = @contactName, contact_phone = @contactPhone, is_active = @isActive,
           updated_by = @updatedBy, updated_date = now()
       WHERE new_id = @newId
       RETURNING *`,
      { ...input, newId },
    );
    return rows[0] ?? null;
  },
};
