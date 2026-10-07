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
    isActive: body.isActive !== false,
  };
}

export const mstVehicleService = {
  getAll: () => mstVehicleRepository.getAll(),
  getLov: () => mstVehicleRepository.getLov(),

  async getByNewId(newId: string) {
    const row = await mstVehicleRepository.getByNewId(requireGuid(newId, "vehicle id"));
    if (!row) throw new HttpError(404, "Vehicle not found.");
    return row;
  },

  create: (body: Record<string, unknown>) => mstVehicleRepository.create({ ...vehicleInput(body), createdBy: actor(body) }),

  async update(newId: string, body: Record<string, unknown>) {
    const row = await mstVehicleRepository.update(requireGuid(newId, "vehicle id"), { ...vehicleInput(body), updatedBy: actor(body) });
    if (!row) throw new HttpError(404, "Vehicle not found.");
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

export const mstCubstoolService = {
  getAll: () => mstCubstoolRepository.getAll(),
  getLov: () => mstCubstoolRepository.getLov(),

  create: (body: Record<string, unknown>) => mstCubstoolRepository.create({ ...cubstoolInput(body), createdBy: actor(body) }),

  async update(newId: string, body: Record<string, unknown>) {
    const row = await mstCubstoolRepository.update(requireGuid(newId, "cubstool id"), { ...cubstoolInput(body), updatedBy: actor(body) });
    if (!row) throw new HttpError(404, "Cubstool not found.");
    return row;
  },
};
