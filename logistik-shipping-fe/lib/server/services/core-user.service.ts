import { activeLabel, auditCreate, auditUpdate, writeAudit, type AuditField } from "@/lib/server/audit";
import { HttpError, currentActor, currentUser, optString, requireString } from "@/lib/server/http";
import { coreUserRepository, type CoreUserInput } from "@/lib/server/repositories/core-user.repository";

const USERNAME_RE = /^[a-zA-Z0-9._-]{3,50}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

function userInput(body: Record<string, unknown>): CoreUserInput {
  const username = requireString(body.username, "username");
  const email = requireString(body.email, "email");
  if (!USERNAME_RE.test(username)) throw new HttpError(400, "Username must be 3-50 characters: letters, numbers, dot, dash or underscore.");
  if (!EMAIL_RE.test(email)) throw new HttpError(400, "Email is not valid.");
  return {
    username,
    email,
    name: requireString(body.name, "name"),
    site: optString(body.site),
    isActive: body.isActive !== false,
  };
}

function checkPassword(password: string) {
  if (password.length < MIN_PASSWORD) throw new HttpError(400, `Password must be at least ${MIN_PASSWORD} characters.`);
  return password;
}

/** Unique violation on username / email -> 409 instead of a generic 500. */
function mapDuplicate(err: unknown): never {
  if (typeof err === "object" && err !== null && (err as { code?: string }).code === "23505") {
    throw new HttpError(409, "Username or email is already used by another user.");
  }
  throw err;
}

const USER_FIELDS: AuditField[] = [
  { key: "username", label: "Username" },
  { key: "email", label: "Email" },
  { key: "name", label: "Nama" },
  { key: "site", label: "Site" },
  { key: "isActive", label: "Status", format: activeLabel },
];

export const coreUserService = {
  getAll: () => coreUserRepository.getAll(),

  async create(body: Record<string, unknown>) {
    const input = userInput(body);
    const password = checkPassword(typeof body.password === "string" ? body.password : "");
    const by = await currentActor();
    const row = await coreUserRepository.create({ ...input, password, createdBy: by }).catch(mapDuplicate);
    await auditCreate({ module: "User", entityType: "User", ref: row.name, detail: `username ${row.username}, ${row.email}` });
    return row;
  },

  async update(id: number, body: Record<string, unknown>) {
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Invalid user id.");
    const existing = await coreUserRepository.getById(id);
    if (!existing) throw new HttpError(404, "User not found.");

    const input = userInput(body);
    const password = typeof body.password === "string" && body.password !== "" ? checkPassword(body.password) : null;

    const me = await currentUser();
    if (!input.isActive && existing.username.toLowerCase() === me.sub.toLowerCase()) {
      throw new HttpError(400, "You cannot deactivate your own account.");
    }

    const by = me.name || me.preferred_username;
    const row = await coreUserRepository.update(id, existing.email, { ...input, password, updatedBy: by }).catch(mapDuplicate);
    if (!row) throw new HttpError(404, "User not found.");
    await auditUpdate({ module: "User", entityType: "User", ref: existing.name, before: existing, after: row, fields: USER_FIELDS });
    // the password itself is never written anywhere, only the fact that it changed
    if (password) await writeAudit({ module: "User", action: "PASSWORD_CHANGE", entityType: "User", ref: existing.name, note: `Mengganti password user '${existing.name}'` });
    return row;
  },
};
