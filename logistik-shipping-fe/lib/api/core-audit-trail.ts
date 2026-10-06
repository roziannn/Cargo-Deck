import { apiFetch, apiPath } from "@/lib/api-client";

type JsonRecord = Record<string, unknown>;

export type CoreAuditTrailItem = {
  key: string;
  id: number;
  user: string;
  jobTitle: string;
  activity: string;
  note: string;
  dateTime: string;
};

export type CreateCoreAuditTrailPayload = {
  compcode: string;
  activity: string;
  note: string;
  source?: string;
  parameter?: string;
  valueOld?: string;
  valueNew?: string;
  createdBy?: string;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickString(source: JsonRecord, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return fallback;
}

function pickNumber(source: JsonRecord, keys: string[], fallback = 0) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return fallback;
}

function unwrapAuditTrailResponse(input: unknown): unknown[] {
  if (Array.isArray(input)) return input;
  if (!isRecord(input)) return [];

  const candidates = [
    input.data,
    input.result,
    input.items,
    input.results,
    input.Data,
    input.Result,
    input.Items,
    input.Results,
    input.item1,
    input.Item1,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
}

function mapAuditTrailItem(item: unknown): CoreAuditTrailItem | null {
  if (!isRecord(item)) return null;

  const noteParts = [
    pickString(item, ["note", "Note"]),
    pickString(item, ["parameter", "Parameter"]),
    pickString(item, ["valueOld", "ValueOld"]) && `Old: ${pickString(item, ["valueOld", "ValueOld"])}`,
    pickString(item, ["valueNew", "ValueNew"]) && `New: ${pickString(item, ["valueNew", "ValueNew"])}`,
    pickString(item, ["source", "Source"]) && `Source: ${pickString(item, ["source", "Source"])}`,
  ]
    .filter((part) => typeof part === "string" && part.trim().length > 0)
    .map((part) => part!.trim());
  const activity = pickString(item, ["activity", "Activity", "action", "Action"], "-");
  const dateTime = pickString(item, ["createdDate", "CreatedDate", "createdAt", "CreatedAt"]);
  const user = pickString(item, ["name", "Name", "username", "Username", "user", "User", "userName", "UserName", "createdBy", "CreatedBy"], "-");

  return {
    key: pickString(item, ["newId", "NewId", "newID", "NewID"], `${pickNumber(item, ["id", "Id"])}-${dateTime}-${activity}-${user}`),
    id: pickNumber(item, ["id", "Id"]),
    user,
    jobTitle: pickString(item, ["jobTtlName", "JobTtlName", "jobTitle", "JobTitle", "role", "Role", "roleName", "RoleName"], "-"),
    activity,
    note: noteParts.length > 0 ? noteParts.join(" | ") : pickString(item, ["remarks", "Remarks"], "-"),
    dateTime,
  };
}

export async function listCoreAuditTrail(compcode: string, token?: string) {
  const res = await apiFetch<unknown>(apiPath(`CoreAuditTrail/${compcode}`), {
    method: "GET",
    token,
    cache: "no-store",
  });

  return unwrapAuditTrailResponse(res).map(mapAuditTrailItem).filter((item): item is CoreAuditTrailItem => Boolean(item));
}

export async function createCoreAuditTrail(payload: CreateCoreAuditTrailPayload, token?: string) {
  return apiFetch<unknown>(apiPath("CoreAuditTrail"), {
    method: "POST",
    body: JSON.stringify(payload),
    token,
  });
}
