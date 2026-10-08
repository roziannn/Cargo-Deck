/** Page-access rules that run on both the server and in the browser (no database here). */

/** Pages that belong to a menu without being under its path. */
export const PAGE_ALIASES: [prefix: string, menu: string][] = [
  ["/shipping/container-load", "/shipping/plan"],
  ["/surat-jalan", "/shipping/plan"],
];

/** Pages every signed-in user may open. */
export const OPEN_PAGES = ["/forbidden"];

export const under = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

/** Whether a page opens for someone allowed the given menu paths. */
export function pageAllowed(menuPaths: string[], pathname: string, isAdmin = false) {
  if (OPEN_PAGES.some((p) => under(pathname, p))) return true;
  if (isAdmin) return true;
  const effective = PAGE_ALIASES.find(([prefix]) => under(pathname, prefix))?.[1] ?? pathname;
  return menuPaths.some((menu) => under(effective, menu));
}

/** A same-site path from a `?next=` parameter, or null when it could lead anywhere else. */
export function safeNextPath(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : null;
}
