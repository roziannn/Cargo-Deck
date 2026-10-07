import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/server/auth";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requireGuid(value: string, label = "id") {
  if (!GUID_RE.test(value)) throw new HttpError(400, `Invalid ${label}.`);
  return value;
}

export function requireString(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) throw new HttpError(400, `${label} is required.`);
  return value.trim();
}

export function optString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function optGuid(value: unknown, label: string) {
  const s = optString(value);
  return s ? requireGuid(s, label) : null;
}

export function optInt(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "Invalid JSON body.");
  return body as Record<string, unknown>;
}

/** The authenticated user of the current request (name used for audit columns). */
export async function currentActor() {
  const header = (await headers()).get("authorization") ?? "";
  const token = header.match(/^Bearer\s+(.+)$/i)?.[1];
  const payload = token ? verifyToken(token) : null;
  if (!payload) throw new HttpError(401, "Unauthorized");
  return payload.name || payload.preferred_username;
}

/**
 * Wraps a route handler: requires a valid `Authorization: Bearer <token>` (unless `isPublic`),
 * maps HttpError to its status and anything else to 500.
 */
export async function handle(fn: () => Promise<NextResponse | Response>, options: { isPublic?: boolean } = {}) {
  try {
    if (!options.isPublic) {
      const header = (await headers()).get("authorization") ?? "";
      const token = header.match(/^Bearer\s+(.+)$/i)?.[1];
      if (!token || !verifyToken(token)) throw new HttpError(401, "Unauthorized");
    }
    return await fn();
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ message: err.message }, { status: err.status });
    console.error(err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export const noContent = () => new NextResponse(null, { status: 204 });

/** Optional numeric field: empty -> null, non-numeric -> 400. */
export function optNumber(value: unknown, label: string) {
  if (value === null || value === undefined || (typeof value === "string" && !value.trim())) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new HttpError(400, `${label} must be a number.`);
  return n;
}

export function requireDate(value: unknown, label: string) {
  const s = requireString(value, label);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) throw new HttpError(400, `${label} must be a date (YYYY-MM-DD).`);
  return s;
}

export function requireEnum<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) throw new HttpError(400, `${label} must be one of: ${allowed.join(", ")}.`);
  return value as T;
}
