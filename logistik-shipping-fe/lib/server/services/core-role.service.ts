import { clearAccessCache } from "@/lib/server/permissions";
import { activeLabel, auditCreate, auditUpdate, writeAudit } from "@/lib/server/audit";
import { HttpError, optString, requireGuid, requireString } from "@/lib/server/http";
import { coreRoleRepository } from "@/lib/server/repositories/core-role.repository";
import { coreRoleClaimRepository } from "@/lib/server/repositories/core-role-claim.repository";

export const coreRoleService = {
  getAll: () => coreRoleRepository.getAll(),

  async create(body: Record<string, unknown>) {
    const row = await coreRoleRepository.create({
      name: requireString(body.name, "name"),
      isActive: body.isActive !== false,
      createdBy: requireString(body.createdBy, "createdBy"),
    });
    await auditCreate({ module: "Role", entityType: "Role", ref: row.name });
    return row;
  },

  async update(newId: string, body: Record<string, unknown>) {
    requireGuid(newId, "role id");
    const before = await coreRoleRepository.getByNewId(newId);
    const ok = await coreRoleRepository.update(newId, {
      name: requireString(body.name, "name"),
      isActive: body.isActive !== false,
      updatedBy: requireString(body.updatedBy, "updatedBy"),
    });
    clearAccessCache();
    if (!ok || !before) throw new HttpError(404, "Role not found.");
    const after = await coreRoleRepository.getByNewId(newId);
    if (after) {
      await auditUpdate({
        module: "Role",
        entityType: "Role",
        ref: before.name,
        before,
        after,
        fields: [
          { key: "name", label: "Nama" },
          { key: "isActive", label: "Status", format: activeLabel },
        ],
      });
    }
  },
};

export const coreRoleClaimService = {
  getByRoleId: (roleId: string) => coreRoleClaimRepository.getByRoleId(requireGuid(roleId, "role id")),

  async add(body: Record<string, unknown>) {
    const roleId = requireGuid(requireString(body.roleId, "roleId"), "roleId");
    const role = await coreRoleRepository.getByNewId(roleId);
    if (!role) throw new HttpError(404, "Role not found.");
    const upn = requireString(body.userPrincipalName, "userPrincipalName");
    const employeeName = optString(body.employeeName);
    clearAccessCache();
    const row = await coreRoleClaimRepository.add({ roleId, upn, employeeName, isActive: body.isActive !== false, by: requireString(body.createdBy, "createdBy") });
    await writeAudit({ module: "Role", action: "ACCESS_CHANGE", entityType: "Role", ref: role.name, note: `Menambahkan anggota ${employeeName ?? upn} (${upn}) ke role '${role.name}'` });
    return row;
  },

  async update(roleId: string, body: Record<string, unknown>) {
    requireGuid(roleId, "role id");
    const role = await coreRoleRepository.getByNewId(roleId);
    if (!role) throw new HttpError(404, "Role not found.");
    const members = await coreRoleClaimRepository.getByRoleId(roleId);
    const list = Array.isArray(body.userPrincipalNames) ? body.userPrincipalNames : [];
    const upns = [...new Set(list.map((u) => (typeof u === "string" ? u.trim() : "")).filter(Boolean))];
    await coreRoleClaimRepository.replace(roleId, upns, body.isActive !== false, requireString(body.updatedBy, "updatedBy"));
    clearAccessCache();

    const nameOf = new Map(members.map((m) => [m.userPrincipalName.toLowerCase(), m.employeeName ?? m.userPrincipalName]));
    const before = new Set(members.map((m) => m.userPrincipalName.toLowerCase()));
    const after = new Set(upns.map((u) => u.toLowerCase()));
    const added = upns.filter((u) => !before.has(u.toLowerCase()));
    const removed = members.filter((m) => !after.has(m.userPrincipalName.toLowerCase())).map((m) => nameOf.get(m.userPrincipalName.toLowerCase()) ?? m.userPrincipalName);
    if (added.length > 0 || removed.length > 0) {
      const parts = [added.length > 0 ? `menambah anggota ${added.join(", ")}` : null, removed.length > 0 ? `menghapus anggota ${removed.join(", ")}` : null].filter(Boolean);
      await writeAudit({ module: "Role", action: "ACCESS_CHANGE", entityType: "Role", ref: role.name, note: `Mengubah anggota role '${role.name}': ${parts.join("; ")}` });
    }
  },
};
