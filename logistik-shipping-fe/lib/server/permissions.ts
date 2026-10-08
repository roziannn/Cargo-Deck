import { pageAllowed } from "@/lib/access";
import { query } from "@/lib/server/db";

/** Name of the role that may open everything, so the system can never lock everybody out. */
export const ADMIN_ROLE = "Administrator";

export type Access = {
  isAdmin: boolean;
  /** Menu paths the user may open, in menu order (the first one is the home page). */
  paths: string[];
};

const TTL_MS = 15_000;
// on globalThis because the proxy and the route handlers are bundled separately but run in one process
const globalForAccess = globalThis as unknown as { __accessCache?: Map<string, { at: number; value: Access }> };
const cache = (globalForAccess.__accessCache ??= new Map());

/** Forget cached access, e.g. after a role or its menu access was changed. */
export function clearAccessCache() {
  cache.clear();
}

/** What a user may open, from the roles they belong to. Cached for a few seconds because every request asks for it. */
export async function getAccess(email: string): Promise<Access> {
  const key = email.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const roles = `SELECT r.new_id, r.name FROM core_role_claim c JOIN core_role r ON r.new_id = c.role_id
                 WHERE lower(c.user_principal_name) = lower(@email) AND c.is_active = true AND r.is_active = true`;
  const [admin, menus] = await Promise.all([
    query<{ isAdmin: boolean }>(`WITH my_roles AS (${roles}) SELECT EXISTS (SELECT 1 FROM my_roles WHERE name = @adminRole) AS is_admin`, { email, adminRole: ADMIN_ROLE }),
    query<{ path: string }>(
      `WITH my_roles AS (${roles})
       SELECT m.path
       FROM core_menu m LEFT JOIN core_menu p ON p.new_id = m.parent_id
       WHERE m.is_active = true AND COALESCE(m.path, '') <> ''
         AND (EXISTS (SELECT 1 FROM my_roles WHERE name = @adminRole)
              OR EXISTS (SELECT 1 FROM core_role_menu rm JOIN my_roles mr ON mr.new_id = rm.role_new_id
                         WHERE rm.menu_new_id = m.new_id AND rm.function_new_id IS NULL AND rm.is_active = true))
       ORDER BY COALESCE(p.seq, m.seq) NULLS LAST, m.seq NULLS LAST, m.name`,
      { email, adminRole: ADMIN_ROLE },
    ),
  ]);

  const value: Access = { isAdmin: admin[0]?.isAdmin === true, paths: menus.map((m) => m.path) };
  cache.set(key, { at: Date.now(), value });
  return value;
}

// ---------- pages ----------

export const canOpenPage = (access: Access, pathname: string) => pageAllowed(access.paths, pathname, access.isAdmin);

// ---------- API ----------

/**
 * Which menus unlock which API group. The first entry is the owner; the others only unlock reading, because
 * other screens need that data (the load simulator reads vehicles and products, the incident form lists plans).
 */
const API_RULES: { prefix: string; owner: string[]; read?: string[] }[] = [
  { prefix: "Dashboard", owner: ["/dashboard"] },
  { prefix: "ShippingPlan", owner: ["/shipping/plan"], read: ["/shipping/incident"] },
  { prefix: "ShippingIncident", owner: ["/shipping/incident"] },
  { prefix: "AuditTrail", owner: ["/audit-trail"] },
  { prefix: "MstVehicle", owner: ["/master/vehicle"], read: ["/shipping/plan"] },
  { prefix: "MstCubstool", owner: ["/master/cubstool"], read: ["/shipping/plan"] },
  { prefix: "MstLocation", owner: ["/master/location"], read: ["/shipping/plan"] },
  { prefix: "MstCarrier", owner: ["/master/carrier"], read: ["/shipping/plan", "/master/driver"] },
  { prefix: "MstDriver", owner: ["/master/driver"], read: ["/shipping/plan"] },
  { prefix: "CoreUser", owner: ["/settings/user"], read: ["/settings/role"] },
  { prefix: "CoreRole", owner: ["/settings/role"], read: ["/settings/user"] },
  { prefix: "CoreRoleClaim", owner: ["/settings/role"] },
  { prefix: "DataHris", owner: ["/settings/role", "/settings/user"] },
  { prefix: "CoreMenu", owner: ["/settings/menu", "/settings/role"] },
];

/** API calls that only need a valid login: the user's own menu, lookups for dropdowns, session endpoints. */
function isOpenApi(segments: string[]) {
  const [group, second] = segments;
  if (group === "Auth") return true;
  if (group === "CoreMenu" && second === "Sidebar") return true;
  return typeof second === "string" && second.startsWith("lov-");
}

/** Whether the user may call `METHOD /api/v1/<segments>`. Anything not listed is denied. */
export function canCallApi(access: Access, method: string, segments: string[]) {
  if (isOpenApi(segments)) return true;
  if (access.isAdmin) return true;
  const rule = API_RULES.find((r) => r.prefix === segments[0]);
  if (!rule) return false;
  const reading = method === "GET" || method === "HEAD";
  const menus = reading ? [...rule.owner, ...(rule.read ?? [])] : rule.owner;
  return menus.some((menu) => access.paths.includes(menu));
}
