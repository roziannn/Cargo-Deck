import { apiFetch, apiPath } from "@/lib/api-client";

type JsonRecord = Record<string, unknown>;

export type MstValidationFormDetailPayload = {
  no: number;
  proses: string;
  description: string;
  type: string;
  kategori: string;
  syarat: string;
  scale: string;
  values: Record<string, string>;
};

export type MstValidationFormPayload = {
  productId: string;
  productName: string;
  itemCode: string;
  stage: "S2" | "S3";
  status: "Draft" | "Pending Approval" | "Publish" | "Obsolete";
  details: MstValidationFormDetailPayload[];
  createdBy?: string;
  updatedBy?: string;
};

export type MstValidationFormListItem = {
  id: string;
  guid?: string;
  sheetNo: string;
  productName: string;
  itemCode: string;
  status: string;
  createdBy: string;
  createdDate: string;
  publishDate: string;
};

export type MstValidationControlSpecItem = {
  id: number;
  newId: string;
  groupId?: string;
  mstValidationFormId: string;
  processName: string;
  specName: string;
  type: string;
  mstReqCategoryId: string;
  mstReqControlSpecId?: string;
  fieldCode: string;
  fieldLabel: string;
  fieldType: string;
  sequenceNo: number;
  valueNumeric: number | null;
  valueText: string | null;
  scale: string | null;
  createdBy: string;
  createdDate: string;
};

export type Stage2ValidationFormDetail = {
  id: number;
  newId: string;
  sheetNo: string;
  productName: string;
  itemCode: string;
  status: string;
  stage: string;
  version: number | null;
  controlSpecs: MstValidationControlSpecItem[];
  createdBy: string;
  createdDate: string;
  updatedBy: string | null;
  updatedDate: string | null;
};

export type Stage3ValidationFormDetail = Stage2ValidationFormDetail;
export type ValidationFormDetail = Stage2ValidationFormDetail;
export type ValidationFormKey = "form-stage-2" | "form-stage-3";

export type SubmitStage2ValidationFormPayload = {
  approvers: {
    userPrincipalName: string;
    employeeId: string;
    employeeName: string;
    employeeJobLvl: string;
    employeeOrgName: string;
    employeeCompName: string;
    employeeJobTitle: string;
    employeeCluster: string;
    employeeEmail: string;
  }[];
  submittedBy: string;
  redirectUrl: string;
};

export type SubmitStage3ValidationFormPayload = SubmitStage2ValidationFormPayload;

export type ApproveStage2ValidationFormPayload = {
  email: string;
  password: string;
};

export type ApproveStage3ValidationFormPayload = ApproveStage2ValidationFormPayload;

export type ReturnStage2ValidationFormPayload = {
  username: string;
  password: string;
  notes: string;
};

export type ReturnStage3ValidationFormPayload = ReturnStage2ValidationFormPayload;

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
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return fallback;
}

function pickNullableNumber(source: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
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

function unwrapObject(input: unknown): JsonRecord | null {
  if (isRecord(input)) return input;
  return null;
}

function mapValidationFormListItem(item: unknown): MstValidationFormListItem | null {
  if (!isRecord(item)) return null;

  const guid = pickString(item, ["newId", "newID", "guid", "validationFormId"]);
  const stringId = pickString(item, ["newId", "newID", "guid", "id", "validationFormId"]);
  const numericId = pickNumber(item, ["id"], 0);

  return {
    id: stringId || String(numericId),
    guid: guid || undefined,
    sheetNo: pickString(item, ["sheetNo", "sheetNO", "docNo", "docNumber", "documentNo", "formNo"], "-"),
    productName: pickString(item, ["productName"], "-"),
    itemCode: pickString(item, ["itemCode"], "-"),
    status: pickString(item, ["status"], "-"),
    createdBy: pickString(item, ["createdBy", "createBy"], "-"),
    createdDate: pickString(item, ["createdDate", "createdAt"], "-"),
    publishDate: pickString(item, ["publishDate", "publishedDate", "publishedAt"], "-"),
  };
}

function mapValidationControlSpecItem(item: unknown): MstValidationControlSpecItem | null {
  if (!isRecord(item)) return null;

  const numericId = pickNumber(item, ["id"], 0);
  const stringId = pickString(item, ["newId", "newID", "guid", "id"], "");

  return {
    id: numericId,
    newId: stringId,
    groupId: pickString(item, ["groupId", "groupID"], "") || undefined,
    mstValidationFormId: pickString(item, ["mstValidationFormId", "mstValidationFormID", "validationFormId"], ""),
    processName: pickString(item, ["processName"], "-"),
    specName: pickString(item, ["specName", "descriptionName"], "-"),
    type: pickString(item, ["type"], "-"),
    mstReqCategoryId: pickString(item, ["mstReqCategoryId", "mstReqCategoryID"], ""),
    mstReqControlSpecId: pickString(item, ["mstReqControlSpecId", "mstReqControlSpecID", "mstReqControlSpecNewId", "mstReqControlSpecNewID"], "") || undefined,
    fieldCode: pickString(item, ["fieldCode"], ""),
    fieldLabel: pickString(item, ["fieldLabel"], ""),
    fieldType: pickString(item, ["fieldType"], ""),
    sequenceNo: pickNumber(item, ["sequenceNo"], 0),
    valueNumeric: pickNullableNumber(item, ["valueNumeric"]),
    valueText: pickString(item, ["valueText"], "") || null,
    scale: pickString(item, ["scale"], "") || null,
    createdBy: pickString(item, ["createdBy", "createBy"], "-"),
    createdDate: pickString(item, ["createdDate", "createdAt"], "-"),
  };
}

function mapStage2ValidationFormDetail(item: unknown): Stage2ValidationFormDetail | null {
  if (!isRecord(item)) return null;

  const controlSpecs =
    unwrapArray(item.controlSpecs)
      .map(mapValidationControlSpecItem)
      .filter((x): x is MstValidationControlSpecItem => Boolean(x)) ?? [];

  return {
    id: pickNumber(item, ["id"], 0),
    newId: pickString(item, ["newId", "newID", "guid", "id"], ""),
    sheetNo: pickString(item, ["sheetNo", "sheetNO", "docNo", "documentNo", "formNo"], "-"),
    productName: pickString(item, ["productName"], "-"),
    itemCode: pickString(item, ["itemCode"], "-"),
    status: pickString(item, ["status"], "-"),
    stage: pickString(item, ["stage"], "-"),
    version: pickNullableNumber(item, ["version"]),
    controlSpecs,
    createdBy: pickString(item, ["createdBy", "createBy"], "-"),
    createdDate: pickString(item, ["createdDate", "createdAt"], "-"),
    updatedBy: pickString(item, ["updatedBy", "updateBy"], "") || null,
    updatedDate: pickString(item, ["updatedDate", "updatedAt"], "") || null,
  };
}

function normalizeValidationFormPath(form: string) {
  return form.trim().replace(/^\/+|\/+$/g, "");
}

function normalizeValidationFormKey(form: string): ValidationFormKey {
  const normalized = normalizeValidationFormPath(form).toLowerCase();
  if (normalized === "form-stage-2" || normalized === "s2" || normalized === "stage-2" || normalized === "stage2") {
    return "form-stage-2";
  }
  if (normalized === "form-stage-3" || normalized === "s3" || normalized === "stage-3" || normalized === "stage3") {
    return "form-stage-3";
  }
  throw new Error(`Unknown validation form "${form}".`);
}

function buildValidationFormCandidates(form?: string): ValidationFormKey[] {
  if (form?.trim()) {
    return [normalizeValidationFormKey(form)];
  }
  return ["form-stage-2", "form-stage-3"];
}

export function getValidationFormKeyFromStage(stage: string | null | undefined): ValidationFormKey | null {
  const normalized = (stage || "").trim().toLowerCase();
  if (normalized === "2" || normalized === "s2" || normalized === "stage 2" || normalized === "stage-2") {
    return "form-stage-2";
  }
  if (normalized === "3" || normalized === "s3" || normalized === "stage 3" || normalized === "stage-3") {
    return "form-stage-3";
  }
  return null;
}

async function resolveValidationForm<T>(resolver: (form: ValidationFormKey) => Promise<T>, form?: string) {
  const candidates = buildValidationFormCandidates(form);
  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      return await resolver(candidate);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Validation form not found.");
}

export async function createMstValidationForm(payload: MstValidationFormPayload | Record<string, unknown>, token?: string) {
  return apiFetch<unknown>(apiPath("MstValidationForm"), {
    method: "POST",
    body: JSON.stringify(payload),
    token,
  });
}

export function extractMstValidationFormId(response: unknown): string | null {
  if (!isRecord(response)) return null;

  const direct = pickString(response, ["newId", "newID", "guid", "id", "validationFormId", "mstValidationFormId"]);
  if (direct) return direct;

  const candidates = [response.data, response.result, response.Data, response.Result];
  for (const candidate of candidates) {
    if (!isRecord(candidate)) continue;
    const nested = pickString(candidate, ["newId", "newID", "guid", "id", "validationFormId", "mstValidationFormId"]);
    if (nested) return nested;
  }

  return null;
}

async function getValidationFormDetailByForm(form: string, newId: string, token?: string) {
  const res = await apiFetch<unknown>(apiPath(`MstValidationForm/${normalizeValidationFormPath(form)}/${encodeURIComponent(newId)}`), {
    method: "GET",
    token,
    cache: "no-store",
  });

  const record = unwrapObject(res);
  if (!record) return null;

  const dataObj = unwrapObject(record.data) ?? unwrapObject(record.result) ?? unwrapObject(record.Data) ?? unwrapObject(record.Result) ?? null;
  if (dataObj) return mapStage2ValidationFormDetail(dataObj);

  return mapStage2ValidationFormDetail(record);
}

export async function getStage2ValidationFormDetail(newId: string, token?: string) {
  return getValidationFormDetailByForm("form-stage-2", newId, token);
}

export async function getStage3ValidationFormDetail(newId: string, token?: string) {
  return getValidationFormDetailByForm("form-stage-3", newId, token);
}

export async function getValidationFormDetail(newId: string, token?: string, form?: string) {
  return resolveValidationForm((candidate) => getValidationFormDetailByForm(candidate, newId, token), form);
}

async function submitValidationFormByForm(form: string, newId: string, payload: SubmitStage2ValidationFormPayload, token?: string) {
  return apiFetch<unknown>(apiPath(`MstValidationForm/${normalizeValidationFormPath(form)}/${encodeURIComponent(newId)}/submit`), {
    method: "POST",
    body: JSON.stringify(payload),
    token,
  });
}

export async function submitStage2ValidationForm(newId: string, payload: SubmitStage2ValidationFormPayload, token?: string) {
  return submitValidationFormByForm("form-stage-2", newId, payload, token);
}

export async function submitStage3ValidationForm(newId: string, payload: SubmitStage3ValidationFormPayload, token?: string) {
  return submitValidationFormByForm("form-stage-3", newId, payload, token);
}

async function approveValidationFormByForm(form: string, newId: string, payload: ApproveStage2ValidationFormPayload, token?: string) {
  return apiFetch<unknown>(apiPath(`MstValidationForm/${normalizeValidationFormPath(form)}/${encodeURIComponent(newId)}/approve`), {
    method: "PUT",
    body: JSON.stringify(payload),
    token,
  });
}

export async function approveStage2ValidationForm(newId: string, payload: ApproveStage2ValidationFormPayload, token?: string) {
  return approveValidationFormByForm("form-stage-2", newId, payload, token);
}

export async function approveStage3ValidationForm(newId: string, payload: ApproveStage3ValidationFormPayload, token?: string) {
  return approveValidationFormByForm("form-stage-3", newId, payload, token);
}

export async function approveValidationForm(newId: string, payload: ApproveStage2ValidationFormPayload, token?: string, form?: string) {
  return resolveValidationForm((candidate) => approveValidationFormByForm(candidate, newId, payload, token), form);
}

async function returnValidationFormByForm(form: string, newId: string, payload: ReturnStage2ValidationFormPayload, token?: string) {
  return apiFetch<unknown>(apiPath(`MstValidationForm/${normalizeValidationFormPath(form)}/${encodeURIComponent(newId)}/return`), {
    method: "PUT",
    body: JSON.stringify(payload),
    token,
  });
}

export async function returnStage2ValidationForm(newId: string, payload: ReturnStage2ValidationFormPayload, token?: string) {
  return returnValidationFormByForm("form-stage-2", newId, payload, token);
}

export async function returnStage3ValidationForm(newId: string, payload: ReturnStage3ValidationFormPayload, token?: string) {
  return returnValidationFormByForm("form-stage-3", newId, payload, token);
}

export async function returnValidationForm(newId: string, payload: ReturnStage2ValidationFormPayload, token?: string, form?: string) {
  return resolveValidationForm((candidate) => returnValidationFormByForm(candidate, newId, payload, token), form);
}

async function getValidationFormControlSpecsByForm(form: string, newId: string, token?: string) {
  const res = await apiFetch<unknown>(apiPath(`MstValidationForm/${normalizeValidationFormPath(form)}/${encodeURIComponent(newId)}`), {
    method: "GET",
    token,
    cache: "no-store",
  });

  const array = unwrapArray(res);
  if (array.length > 0) {
    return array.map(mapValidationControlSpecItem).filter((item): item is MstValidationControlSpecItem => Boolean(item));
  }

  const record = unwrapObject(res);
  if (!record) return [];

  // If response is shaped like { data: { controlSpecs: [...] } }
  const dataObj = unwrapObject(record.data);
  if (dataObj) {
    const dataNestedCandidates = [dataObj.controlSpecs, dataObj.details, dataObj.items, dataObj.results, dataObj.ControlSpecs];
    for (const candidate of dataNestedCandidates) {
      const nestedArray = unwrapArray(candidate);
      if (nestedArray.length > 0) {
        return nestedArray.map(mapValidationControlSpecItem).filter((item): item is MstValidationControlSpecItem => Boolean(item));
      }
    }
  }

  const nestedCandidates = [
    record.data,
    record.result,
    record.Data,
    record.Result,
    record.controlSpecs,
    record.details,
    record.Controls,
    record.Items,
  ];
  for (const candidate of nestedCandidates) {
    const nestedArray = unwrapArray(candidate);
    if (nestedArray.length > 0) {
      return nestedArray.map(mapValidationControlSpecItem).filter((item): item is MstValidationControlSpecItem => Boolean(item));
    }
  }

  const single = mapValidationControlSpecItem(res);
  return single ? [single] : [];
}

export async function getStage2ValidationFormControlSpecs(newId: string, token?: string) {
  return getValidationFormControlSpecsByForm("form-stage-2", newId, token);
}

export async function getStage3ValidationFormControlSpecs(newId: string, token?: string) {
  return getValidationFormControlSpecsByForm("form-stage-3", newId, token);
}

async function listValidationFormsByForm(form: string, token?: string) {
  const res = await apiFetch<unknown>(apiPath(`MstValidationForm/${normalizeValidationFormPath(form)}`), {
    method: "GET",
    token,
    cache: "no-store",
  });

  return unwrapArray(res)
    .map(mapValidationFormListItem)
    .filter((item): item is MstValidationFormListItem => Boolean(item && item.id));
}

export async function listStage2ValidationForms(token?: string) {
  return listValidationFormsByForm("form-stage-2", token);
}

export async function listStage3ValidationForms(token?: string) {
  return listValidationFormsByForm("form-stage-3", token);
}
