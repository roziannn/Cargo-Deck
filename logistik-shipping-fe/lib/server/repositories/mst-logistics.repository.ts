import { query } from "@/lib/server/db";

export type MstCarrierRow = {
  id: number;
  newId: string;
  code: string;
  name: string;
  type: "OWN" | "3PL";
  contactName: string | null;
  contactPhone: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdDate: Date;
  updatedBy: string | null;
  updatedDate: Date | null;
};

export type MstCarrierInput = {
  code: string;
  name: string;
  type: "OWN" | "3PL";
  contactName: string | null;
  contactPhone: string | null;
  isActive: boolean;
};

export type MstDriverRow = {
  id: number;
  newId: string;
  code: string;
  name: string;
  phone: string | null;
  licenseNo: string | null;
  licenseExpiry: string | null;
  carrierNewId: string | null;
  carrierName: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdDate: Date;
  updatedBy: string | null;
  updatedDate: Date | null;
};

export type MstDriverInput = {
  code: string;
  name: string;
  phone: string | null;
  licenseNo: string | null;
  licenseExpiry: string | null;
  carrierNewId: string | null;
  isActive: boolean;
};

const DRIVER_SELECT = `
  SELECT d.id, d.new_id, d.code, d.name, d.phone, d.license_no,
         to_char(d.license_expiry, 'YYYY-MM-DD') AS license_expiry,
         d.carrier_new_id, c.name AS carrier_name, d.is_active,
         d.created_by, d.created_date, d.updated_by, d.updated_date
  FROM mst_driver d LEFT JOIN mst_carrier c ON c.new_id = d.carrier_new_id`;

export const mstCarrierRepository = {
  getAll: () => query<MstCarrierRow>("SELECT * FROM mst_carrier ORDER BY type, name"),

  getLov: () =>
    query<{ value: string; label: string; type: string }>(
      "SELECT new_id AS value, name AS label, type FROM mst_carrier WHERE is_active = true ORDER BY type, name",
    ),

  async getByNewId(newId: string) {
    const rows = await query<MstCarrierRow>("SELECT * FROM mst_carrier WHERE new_id = @newId", { newId });
    return rows[0] ?? null;
  },

  async create(input: MstCarrierInput & { createdBy: string }) {
    const rows = await query<MstCarrierRow>(
      `INSERT INTO mst_carrier (code, name, type, contact_name, contact_phone, is_active, created_by)
       VALUES (@code, @name, @type, @contactName, @contactPhone, @isActive, @createdBy) RETURNING *`,
      input,
    );
    return rows[0];
  },

  async update(newId: string, input: MstCarrierInput & { updatedBy: string }) {
    const rows = await query<MstCarrierRow>(
      `UPDATE mst_carrier
       SET code = @code, name = @name, type = @type, contact_name = @contactName, contact_phone = @contactPhone,
           is_active = @isActive, updated_by = @updatedBy, updated_date = now()
       WHERE new_id = @newId RETURNING *`,
      { ...input, newId },
    );
    return rows[0] ?? null;
  },
};

export const mstDriverRepository = {
  getAll: () => query<MstDriverRow>(`${DRIVER_SELECT} ORDER BY d.name`),

  getLov: () =>
    query<{ value: string; label: string; carrierNewId: string | null; licenseExpiry: string | null }>(
      `SELECT new_id AS value, code || ' - ' || name AS label, carrier_new_id,
              to_char(license_expiry, 'YYYY-MM-DD') AS license_expiry
       FROM mst_driver WHERE is_active = true ORDER BY name`,
    ),

  async getByNewId(newId: string) {
    const rows = await query<MstDriverRow>(`${DRIVER_SELECT} WHERE d.new_id = @newId`, { newId });
    return rows[0] ?? null;
  },

  async create(input: MstDriverInput & { createdBy: string }) {
    const rows = await query<{ newId: string }>(
      `INSERT INTO mst_driver (code, name, phone, license_no, license_expiry, carrier_new_id, is_active, created_by)
       VALUES (@code, @name, @phone, @licenseNo, @licenseExpiry, @carrierNewId, @isActive, @createdBy) RETURNING new_id`,
      input,
    );
    return (await this.getByNewId(rows[0].newId)) as MstDriverRow;
  },

  async update(newId: string, input: MstDriverInput & { updatedBy: string }) {
    const rows = await query<{ newId: string }>(
      `UPDATE mst_driver
       SET code = @code, name = @name, phone = @phone, license_no = @licenseNo, license_expiry = @licenseExpiry,
           carrier_new_id = @carrierNewId, is_active = @isActive, updated_by = @updatedBy, updated_date = now()
       WHERE new_id = @newId RETURNING new_id`,
      { ...input, newId },
    );
    return rows[0] ? await this.getByNewId(newId) : null;
  },
};
