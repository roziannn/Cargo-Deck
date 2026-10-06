import { NextResponse } from "next/server";

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

/** Wraps a route handler: maps HttpError to its status and anything else to 500. */
export async function handle(fn: () => Promise<NextResponse | Response>) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ message: err.message }, { status: err.status });
    console.error(err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export const noContent = () => new NextResponse(null, { status: 204 });
