import { apiFetch, apiPath } from "@/lib/api-client";

type JsonRecord = Record<string, unknown>;

export type CoreNotificationItem = {
  key: string;
  id: number;
  title: string;
  message: string;
  createdDate: string;
  isRead: boolean;
  redirectUrl: string | null;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickString(source: JsonRecord, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return fallback;
}

function pickNumber(source: JsonRecord, keys: string[], fallback = 0) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return fallback;
}

function pickBool(source: JsonRecord, keys: string[], fallback = false) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
      const v = value.trim().toLowerCase();
      if (["true", "1", "yes", "y"].includes(v)) return true;
      if (["false", "0", "no", "n"].includes(v)) return false;
    }
  }
  return fallback;
}

function unwrapArray(input: unknown): unknown[] {
  if (Array.isArray(input)) return input;
  if (!isRecord(input)) return [];

  const candidates = [input.data, input.result, input.items, input.results, input.Data, input.Result, input.Items, input.Results];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function mapNotification(item: unknown): CoreNotificationItem | null {
  if (!isRecord(item)) return null;

  const id = pickNumber(item, ["id", "Id"], 0);
  const createdDate = pickString(item, ["createdDate", "CreatedDate", "createdAt", "CreatedAt", "dateTime", "DateTime"], "-");
  const title = pickString(item, ["title", "Title", "activity", "Activity", "subject", "Subject"], "-");
  const message = pickString(item, ["message", "Message", "note", "Note", "remarks", "Remarks", "body", "Body"], "-");
  const redirectUrl = pickString(item, ["redirectUrl", "RedirectUrl", "url", "Url", "link", "Link"], "") || null;
  const isRead = pickBool(item, ["isRead", "IsRead", "read", "Read", "isSeen", "IsSeen"], false);

  const key = pickString(item, ["newId", "NewId", "newID", "NewID"], "") || `${id}-${createdDate}-${title}`;
  return { key, id, title, message, createdDate, isRead, redirectUrl };
}

export async function listCoreNotifications(args: { compcode: string; userPrincipleName: string }, token?: string) {
  const usp = new URLSearchParams();
  usp.set("UserPrincipleName", args.userPrincipleName.trim());
  const suffix = `?${usp.toString()}`;

  const res = await apiFetch<unknown>(apiPath(`CoreNotification/${encodeURIComponent(args.compcode)}${suffix}`), {
    method: "GET",
    token,
    cache: "no-store",
  });

  return unwrapArray(res).map(mapNotification).filter((x): x is CoreNotificationItem => Boolean(x));
}
