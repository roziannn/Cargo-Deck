import { apiFetch, apiPath } from "@/lib/api-client";

type JsonRecord = Record<string, unknown>;

export type CoreApprovalTransactionItem = {
  key: string;
  id: number;
  approvalType: string;
  approverName: string;
  userPrincipalName: string;
  approverJobTitle: string;
  status: string;
  approvalDate: string;
  notes: string;
};

export type CoreApprovalTransactionInboxItem = {
  key: string;
  mstValidationFormId: string;
  sheetNo: string;
  productName: string;
  createdBy: string;
  submittedDate: string;
  approvalDate: string;
  status: string;
  currentApproverJobTitle: string;
};

export type ApproveCoreApprovalTransactionPayload = {
  email: string;
  password: string;
};

export type ReturnCoreApprovalTransactionPayload = {
  email: string;
  password: string;
  note: string;
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

function unwrapArray(input: unknown): unknown[] {
  if (Array.isArray(input)) return input;
  if (!isRecord(input)) return [];

  const candidates = [input.data, input.result, input.items, input.results, input.Data, input.Result, input.Items, input.Results];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
}

function mapApprovalTransactionItem(item: unknown): CoreApprovalTransactionItem | null {
  if (!isRecord(item)) return null;

  const id = pickNumber(item, ["id", "Id"], 0);
  const approvalType =
    pickString(item, ["approvalType", "ApprovalType", "type", "Type", "step", "Step", "actionType", "ActionType"], "-") ||
    "-";
  const approverName =
    pickString(item, ["employeeName", "EmployeeName", "approverName", "ApproverName", "name", "Name"], "-") ||
    "-";
  const userPrincipalName =
    pickString(item, ["userPrincipalName", "UserPrincipalName", "employeeEmail", "EmployeeEmail", "email", "Email", "upn", "UPN"], "") ||
    "";
  const approverJobTitle =
    pickString(item, ["employeeCluster", "EmployeeCluster", "cluster", "Cluster", "employeeJobTitle", "EmployeeJobTitle", "jobTitle", "JobTitle", "jobTtlName", "JobTtlName"], "-") ||
    "-";
  const status =
    pickString(item, ["status", "Status", "approvalStatus", "ApprovalStatus"], "-") ||
    "-";
  const approvalDate =
    pickString(item, ["approvalDate", "ApprovalDate", "actionDate", "ActionDate", "approvedDate", "ApprovedDate", "createdDate", "CreatedDate", "createdAt", "CreatedAt"], "-") ||
    "-";
  const notes =
    pickString(item, ["notes", "Notes", "note", "Note", "remarks", "Remarks", "comment", "Comment"], "-") ||
    "-";

  const key = pickString(item, ["newId", "NewId", "newID", "NewID"], "") || `${id}-${approvalType}-${approverName}-${approvalDate}`;
  return { key, id, approvalType, approverName, userPrincipalName, approverJobTitle, status, approvalDate, notes };
}

function mapApprovalTransactionInboxItem(item: unknown): CoreApprovalTransactionInboxItem | null {
  if (!isRecord(item)) return null;

  const mstValidationFormId =
    pickString(item, ["mstValidationFormId", "mstValidationFormID", "validationFormId", "validationFormID", "newId", "newID", "guid", "id"], "") ||
    "";
  if (!mstValidationFormId) return null;

  const sheetNo = pickString(item, ["sheetNo", "sheetNO", "docNo", "docNumber", "documentNo", "formNo"], "-");
  const productName = pickString(item, ["productName", "ProductName"], "-");
  const createdBy = pickString(item, ["createdBy", "CreatedBy", "submitter", "Submitter", "submittedBy", "SubmittedBy"], "-");
  const submittedDate =
    pickString(item, ["submittedDate", "SubmittedDate", "createdDate", "CreatedDate", "createdAt", "CreatedAt"], "-");
  const approvalDate =
    pickString(item, ["approvalDate", "ApprovalDate", "actionDate", "ActionDate", "approvedDate", "ApprovedDate"], "-") ||
    "-";
  const status = pickString(item, ["status", "Status", "approvalStatus", "ApprovalStatus"], "-");
  const currentApproverJobTitle =
    pickString(item, ["currentApproverCluster", "CurrentApproverCluster", "employeeCluster", "EmployeeCluster", "cluster", "Cluster", "currentApproverJobTitle", "CurrentApproverJobTitle", "approverJobTitle", "ApproverJobTitle", "jobTitle", "JobTitle", "jobTtlName", "JobTtlName"], "-") ||
    "-";

  const key = pickString(item, ["key", "Key", "newId", "NewId", "newID", "NewID"], "") || `${mstValidationFormId}-${submittedDate}-${status}`;
  return { key, mstValidationFormId, sheetNo, productName, createdBy, submittedDate, approvalDate, status, currentApproverJobTitle };
}

export async function listCoreApprovalTransactions(mstValidationFormId: string, token?: string) {
  const res = await apiFetch<unknown>(apiPath(`CoreApprovalTransaction/${encodeURIComponent(mstValidationFormId)}`), {
    method: "GET",
    token,
    cache: "no-store",
  });

  return unwrapArray(res).map(mapApprovalTransactionItem).filter((x): x is CoreApprovalTransactionItem => Boolean(x));
}

export async function listCoreApprovalHistory(mstValidationFormId: string, token?: string) {
  const res = await apiFetch<unknown>(apiPath(`CoreApprovalHistory/${encodeURIComponent(mstValidationFormId)}`), {
    method: "GET",
    token,
    cache: "no-store",
  });

  return unwrapArray(res).map(mapApprovalTransactionItem).filter((x): x is CoreApprovalTransactionItem => Boolean(x));
}

export async function listCoreApprovalTransactionInbox(token?: string) {
  const res = await apiFetch<unknown>(apiPath("CoreApprovalTransaction"), {
    method: "GET",
    token,
    cache: "no-store",
  });

  return unwrapArray(res).map(mapApprovalTransactionInboxItem).filter((x): x is CoreApprovalTransactionInboxItem => Boolean(x));
}

export async function approveCoreApprovalTransaction(mstValidationFormId: string, payload: ApproveCoreApprovalTransactionPayload, token?: string) {
  return apiFetch<unknown>(apiPath(`CoreApprovalTransaction/${encodeURIComponent(mstValidationFormId)}/approve`), {
    method: "POST",
    body: JSON.stringify(payload),
    token,
  });
}

export async function returnCoreApprovalTransaction(mstValidationFormId: string, payload: ReturnCoreApprovalTransactionPayload, token?: string) {
  return apiFetch<unknown>(apiPath(`CoreApprovalTransaction/${encodeURIComponent(mstValidationFormId)}/return`), {
    method: "POST",
    body: JSON.stringify(payload),
    token,
  });
}
