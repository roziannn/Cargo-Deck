import { HttpError, optString, requireGuid, requireString } from "@/lib/server/http";
import { coreRoleRepository } from "@/lib/server/repositories/core-role.repository";
import { coreRoleClaimRepository } from "@/lib/server/repositories/core-role-claim.repository";

export const coreRoleService = {
  getAll: () => coreRoleRepository.getAll(),

  create(body: Record<string, unknown>) {
    return coreRoleRepository.create({
      name: requireString(body.name, "name"),
      isActive: body.isActive !== false,
      createdBy: requireString(body.createdBy, "createdBy"),
    });
  },

  async update(newId: string, body: Record<string, unknown>) {
    requireGuid(newId, "role id");
    const ok = await coreRoleRepository.update(newId, {
      name: requireString(body.name, "name"),
      isActive: body.isActive !== false,
      updatedBy: requireString(body.updatedBy, "updatedBy"),
    });
    if (!ok) throw new HttpError(404, "Role not found.");
  },
};

export const coreRoleClaimService = {
  getByRoleId: (roleId: string) => coreRoleClaimRepository.getByRoleId(requireGuid(roleId, "role id")),

  async add(body: Record<string, unknown>) {
    const roleId = requireGuid(requireString(body.roleId, "roleId"), "roleId");
    if (!(await coreRoleRepository.getByNewId(roleId))) throw new HttpError(404, "Role not found.");
    return coreRoleClaimRepository.add({
      roleId,
      upn: requireString(body.userPrincipalName, "userPrincipalName"),
      employeeName: optString(body.employeeName),
      isActive: body.isActive !== false,
      by: requireString(body.createdBy, "createdBy"),
    });
  },

  async update(roleId: string, body: Record<string, unknown>) {
    requireGuid(roleId, "role id");
    if (!(await coreRoleRepository.getByNewId(roleId))) throw new HttpError(404, "Role not found.");
    const list = Array.isArray(body.userPrincipalNames) ? body.userPrincipalNames : [];
    const upns = [...new Set(list.map((u) => (typeof u === "string" ? u.trim() : "")).filter(Boolean))];
    await coreRoleClaimRepository.replace(roleId, upns, body.isActive !== false, requireString(body.updatedBy, "updatedBy"));
  },
};
