import { apiFetch, apiPath } from "@/lib/api-client";

type JsonRecord = Record<string, unknown>;

export type DataHrisLovUser = {
  id: string;
  name: string;
  role: string;
  userPrincipalName: string;
  employeeId: string;
  employeeName: string;
  employeeJobLvl: string;
  employeeOrgName: string;
  employeeCompName: string;
  employeeJobTitle: string;
  employeeCluster: string;
  employeeEmail: string;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickString(source: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
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

function mapLovUser(item: unknown): DataHrisLovUser | null {
  if (!isRecord(item)) return null;

  const label = pickString(item, ["label", "Label"]);
  const value = pickString(item, ["value", "Value"]);
  if (value) {
    const parts = value.split("|").map((x) => x.trim()).filter(Boolean);
    const userPrincipalName = parts[0] || pickString(item, ["email", "Email", "userPrincipalName", "UserPrincipalName"]);
    const employeeName = label || parts[1] || pickString(item, ["employeeName", "EmployeeName", "name", "Name"]);
    if (!userPrincipalName || !employeeName) return null;

    const employeeCluster = parts[2] || "-";
    const employeeJobTitle = parts[3] || "-";
    const employeeJobLvl = parts[4] || "-";
    const employeeId = parts[6] || "-";
    const employeeOrgName = parts[7] || "-";
    const employeeCompName = parts[8] || "-";
    const employeeEmail = parts[9] || userPrincipalName;

    return {
      id: userPrincipalName,
      name: employeeName,
      role: employeeCompName,
      userPrincipalName,
      employeeId,
      employeeName,
      employeeJobLvl,
      employeeOrgName,
      employeeCompName,
      employeeJobTitle,
      employeeCluster,
      employeeEmail,
    };
  }

  const id =
    pickString(item, ["newId", "newID", "guid", "id", "employeeId", "employeeID", "nik", "nip"]) ||
    pickString(item, ["email", "username", "userName"]);

  const name =
    pickString(item, ["name", "fullName", "fullname", "displayName"]) ||
    pickString(item, ["employeeName", "employeeFullName"]);

  if (!id || !name) return null;

  const role =
    pickString(item, ["jobTitle", "jobTtlName", "position", "positionName", "role", "roleName"]) ||
    "-";

  return {
    id,
    name,
    role,
    userPrincipalName: id,
    employeeId: pickString(item, ["employeeId", "employeeID", "nik", "nip"]) || "-",
    employeeName: name,
    employeeJobLvl: pickString(item, ["employeeJobLvl", "jobLevel", "jobLvl"]) || "-",
    employeeOrgName: pickString(item, ["employeeOrgName", "orgName", "organization"]) || "-",
    employeeCompName: pickString(item, ["employeeCompName", "compName", "company"]) || "-",
    employeeJobTitle: role,
    employeeCluster: pickString(item, ["employeeCluster", "cluster"]) || "-",
    employeeEmail: pickString(item, ["employeeEmail", "email"]) || id,
  };
}

export async function searchDataHrisNameLov(query: string, token?: string) {
  const q = query.trim();
  if (!q) return [];

  const usp = new URLSearchParams();
  usp.set("search", q);
  usp.set("limit", "20");
  const suffix = `?${usp.toString()}`;

  const res = await apiFetch<unknown>(apiPath(`DataHris/get-name/lov${suffix}`), {
    method: "GET",
    token,
    cache: "no-store",
  });

  return unwrapArray(res).map(mapLovUser).filter((x): x is DataHrisLovUser => Boolean(x));
}

