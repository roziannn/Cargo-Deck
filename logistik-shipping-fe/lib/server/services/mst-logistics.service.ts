import { activeLabel, auditCreate, auditUpdate, type AuditField } from "@/lib/server/audit";
import { HttpError, currentActor, optString, requireDate, requireEnum, requireGuid, requireString, optGuid } from "@/lib/server/http";
import {
  mstCarrierRepository,
  mstDriverRepository,
  type MstCarrierInput,
  type MstDriverInput,
} from "@/lib/server/repositories/mst-logistics.repository";

function mapDb(err: unknown): never {
  const code = typeof err === "object" && err !== null ? (err as { code?: string }).code : undefined;
  if (code === "23505") throw new HttpError(409, "Code already exists.");
  if (code === "23503") throw new HttpError(400, "Unknown carrier.");
  throw err;
}

function carrierInput(body: Record<string, unknown>): MstCarrierInput {
  return {
    code: requireString(body.code, "code").toUpperCase(),
    name: requireString(body.name, "name"),
    type: requireEnum(body.type, ["OWN", "3PL"] as const, "type"),
    contactName: optString(body.contactName),
    contactPhone: optString(body.contactPhone),
    isActive: body.isActive !== false,
  };
}

const CARRIER_FIELDS: AuditField[] = [
  { key: "code", label: "Kode" },
  { key: "name", label: "Nama" },
  { key: "type", label: "Tipe" },
  { key: "contactName", label: "Kontak" },
  { key: "contactPhone", label: "Telepon" },
  { key: "isActive", label: "Status", format: activeLabel },
];

const DRIVER_FIELDS: AuditField[] = [
  { key: "code", label: "Kode" },
  { key: "name", label: "Nama" },
  { key: "phone", label: "Telepon" },
  { key: "licenseNo", label: "No. SIM" },
  { key: "licenseExpiry", label: "SIM berlaku sampai" },
  { key: "carrierName", label: "Carrier" },
  { key: "isActive", label: "Status", format: activeLabel },
];

export const mstCarrierService = {
  getAll: () => mstCarrierRepository.getAll(),
  getLov: () => mstCarrierRepository.getLov(),

  async create(body: Record<string, unknown>) {
    const by = await currentActor();
    const row = await mstCarrierRepository.create({ ...carrierInput(body), createdBy: by }).catch(mapDb);
    await auditCreate({ module: "Master Carrier", entityType: "Carrier", ref: row.name, detail: row.type });
    return row;
  },

  async update(newId: string, body: Record<string, unknown>) {
    requireGuid(newId, "carrier id");
    const by = await currentActor();
    const before = await mstCarrierRepository.getByNewId(newId);
    const row = await mstCarrierRepository.update(newId, { ...carrierInput(body), updatedBy: by }).catch(mapDb);
    if (!row || !before) throw new HttpError(404, "Carrier not found.");
    await auditUpdate({ module: "Master Carrier", entityType: "Carrier", ref: before.name, before, after: row, fields: CARRIER_FIELDS });
    return row;
  },
};

function driverInput(body: Record<string, unknown>): MstDriverInput {
  const expiry = optString(body.licenseExpiry);
  return {
    code: requireString(body.code, "code").toUpperCase(),
    name: requireString(body.name, "name"),
    phone: optString(body.phone),
    licenseNo: optString(body.licenseNo),
    licenseExpiry: expiry ? requireDate(expiry, "licenseExpiry") : null,
    carrierNewId: optGuid(body.carrierNewId, "carrierNewId"),
    isActive: body.isActive !== false,
  };
}

export const mstDriverService = {
  getAll: () => mstDriverRepository.getAll(),
  getLov: () => mstDriverRepository.getLov(),

  async create(body: Record<string, unknown>) {
    const by = await currentActor();
    const row = await mstDriverRepository.create({ ...driverInput(body), createdBy: by }).catch(mapDb);
    await auditCreate({ module: "Master Driver", entityType: "Driver", ref: row.name, detail: row.carrierName ? `carrier ${row.carrierName}` : undefined });
    return row;
  },

  async update(newId: string, body: Record<string, unknown>) {
    requireGuid(newId, "driver id");
    const by = await currentActor();
    const before = await mstDriverRepository.getByNewId(newId);
    const row = await mstDriverRepository.update(newId, { ...driverInput(body), updatedBy: by }).catch(mapDb);
    if (!row || !before) throw new HttpError(404, "Driver not found.");
    await auditUpdate({ module: "Master Driver", entityType: "Driver", ref: before.name, before, after: row, fields: DRIVER_FIELDS });
    return row;
  },
};
