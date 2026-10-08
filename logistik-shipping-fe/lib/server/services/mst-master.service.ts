import { activeLabel, auditCreate, auditUpdate, rupiah, type AuditField } from "@/lib/server/audit";
import { HttpError, optNumber, optString, requireGuid, requireString } from "@/lib/server/http";
import { mstCubstoolRepository } from "@/lib/server/repositories/mst-cubstool.repository";
import { mstVehicleRepository } from "@/lib/server/repositories/mst-vehicle.repository";

/** The FE sends the acting user as `createdBy` on both create and edit. */
const actor = (body: Record<string, unknown>) => requireString(body.createdBy ?? body.updatedBy, "createdBy");

function vehicleInput(body: Record<string, unknown>) {
  return {
    name: requireString(body.name, "name"),
    type: optString(body.type),
    climate: optString(body.climate),
    cbm: optNumber(body.cbm, "cbm"),
    dimensionsL: optNumber(body.dimensions_L_m ?? body.dimensionsL, "dimensions L"),
    dimensionsW: optNumber(body.dimensions_W_m ?? body.dimensionsW, "dimensions W"),
    floorArea: optNumber(body.floorArea_m2 ?? body.floorArea, "floor area"),
    maxHeight: optNumber(body.maxHeight_m ?? body.maxHeight, "max height"),
    maxPayload: optNumber(body.maxPayload_kg ?? body.maxPayload, "max payload"),
    baseFee: optNumber(body.baseFee, "base fee"),
    ratePerKm: optNumber(body.ratePerKm, "rate per km"),
    isActive: body.isActive !== false,
  };
}

const VEHICLE_FIELDS: AuditField[] = [
  { key: "name", label: "Nama" },
  { key: "type", label: "Jenis" },
  { key: "climate", label: "Pendingin" },
  { key: "cbm", label: "Volume (CBM)" },
  { key: "dimensionsL", label: "Panjang (m)" },
  { key: "dimensionsW", label: "Lebar (m)" },
  { key: "floorArea", label: "Luas lantai (m2)" },
  { key: "maxHeight", label: "Tinggi maks (m)" },
  { key: "maxPayload", label: "Muatan maks (kg)" },
  { key: "baseFee", label: "Biaya dasar", format: rupiah },
  { key: "ratePerKm", label: "Tarif per km", format: rupiah },
  { key: "isActive", label: "Status", format: activeLabel },
];

export const mstVehicleService = {
  getAll: () => mstVehicleRepository.getAll(),
  getLov: () => mstVehicleRepository.getLov(),

  async getByNewId(newId: string) {
    const row = await mstVehicleRepository.getByNewId(requireGuid(newId, "vehicle id"));
    if (!row) throw new HttpError(404, "Vehicle not found.");
    return row;
  },

  async create(body: Record<string, unknown>) {
    const row = await mstVehicleRepository.create({ ...vehicleInput(body), createdBy: actor(body) });
    await auditCreate({ module: "Master Vehicle", entityType: "Vehicle", ref: row.name, detail: [row.type, row.maxPayload ? `muatan maks ${row.maxPayload} kg` : null].filter(Boolean).join(", ") || undefined });
    return row;
  },

  async update(newId: string, body: Record<string, unknown>) {
    const id = requireGuid(newId, "vehicle id");
    const before = await mstVehicleRepository.getByNewId(id);
    const row = await mstVehicleRepository.update(id, { ...vehicleInput(body), updatedBy: actor(body) });
    if (!row || !before) throw new HttpError(404, "Vehicle not found.");
    await auditUpdate({ module: "Master Vehicle", entityType: "Vehicle", ref: before.name, before, after: row, fields: VEHICLE_FIELDS });
    return row;
  },
};

function cubstoolInput(body: Record<string, unknown>) {
  return {
    name: requireString(body.name, "name"),
    itemCode: requireString(body.itemCode, "itemCode"),
    length: optNumber(body.length, "length"),
    width: optNumber(body.width, "width"),
    height: optNumber(body.height, "height"),
    weight: optNumber(body.weight, "weight"),
    color: optString(body.color),
    isActive: body.isActive !== false,
  };
}

const CUBSTOOL_FIELDS: AuditField[] = [
  { key: "name", label: "Nama" },
  { key: "itemCode", label: "Kode item" },
  { key: "length", label: "Panjang" },
  { key: "width", label: "Lebar" },
  { key: "height", label: "Tinggi" },
  { key: "weight", label: "Berat" },
  { key: "color", label: "Warna" },
  { key: "isActive", label: "Status", format: activeLabel },
];

export const mstCubstoolService = {
  getAll: () => mstCubstoolRepository.getAll(),
  getLov: () => mstCubstoolRepository.getLov(),

  async create(body: Record<string, unknown>) {
    const row = await mstCubstoolRepository.create({ ...cubstoolInput(body), createdBy: actor(body) });
    await auditCreate({ module: "Master Cubstool", entityType: "Cubstool", ref: row.name, detail: `kode ${row.itemCode}` });
    return row;
  },

  async update(newId: string, body: Record<string, unknown>) {
    const id = requireGuid(newId, "cubstool id");
    const before = await mstCubstoolRepository.getByNewId(id);
    const row = await mstCubstoolRepository.update(id, { ...cubstoolInput(body), updatedBy: actor(body) });
    if (!row || !before) throw new HttpError(404, "Cubstool not found.");
    await auditUpdate({ module: "Master Cubstool", entityType: "Cubstool", ref: before.name, before, after: row, fields: CUBSTOOL_FIELDS });
    return row;
  },
};
