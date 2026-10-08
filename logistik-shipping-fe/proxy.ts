import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifyToken } from "@/lib/server/auth";
import { canCallApi, canOpenPage, getAccess } from "@/lib/server/permissions";

/**
 * Guards every page and API call before it reaches the app: no valid login means the login page (or 401 for the API),
 * and a login without access to the menu behind the page or API means the "no access" page (or 403).
 * What a user may open comes from the roles and menu access that are ticked in Settings > Role.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");

  if (pathname === "/login" || pathname === "/api/v1/Auth/login-sso") return NextResponse.next();

  const bearer = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const token = isApi ? (bearer ?? req.cookies.get(SESSION_COOKIE)?.value) : req.cookies.get(SESSION_COOKIE)?.value;
  const user = token ? verifyToken(token) : null;

  if (!user) {
    if (isApi) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const login = new URL("/login", req.url);
    if (pathname !== "/") login.searchParams.set("next", pathname);
    const res = NextResponse.redirect(login);
    if (req.cookies.get(SESSION_COOKIE)) res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  const access = await getAccess(user.email);

  if (isApi) {
    const segments = pathname.replace(/^\/api\/v1\//, "").split("/").filter(Boolean);
    if (!canCallApi(access, req.method, segments)) {
      return NextResponse.json({ message: "Anda tidak memiliki akses ke fitur ini. Hubungi administrator untuk meminta akses." }, { status: 403 });
    }
    return NextResponse.next();
  }

  if (pathname === "/") return NextResponse.redirect(new URL(access.paths[0] ?? "/forbidden", req.url));
  if (!canOpenPage(access, pathname)) return NextResponse.redirect(new URL("/forbidden", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|avatars|.*\\.(?:png|jpe?g|svg|gif|webp|ico|css|js|map|txt)$).*)"],
};
