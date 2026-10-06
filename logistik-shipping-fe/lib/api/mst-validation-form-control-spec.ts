import { apiFetch, apiPath } from "@/lib/api-client";

export type MstValidationFormControlSpecPayload = {
  mstValidationFormId: string;
  groupId?: string;
  processName: string;
  specName: string;
  type: string;
  mstReqCategoryId: string;
  mstReqControlSpecId: string;
  fieldCode: string;
  fieldLabel: string;
  fieldType: string;
  sequenceNo: number;
  valueNumeric?: number | null;
  valueText?: string | null;
  scale: string;
  createdBy: string;
};

export async function createMstValidationFormControlSpec(payload: MstValidationFormControlSpecPayload, token?: string) {
  return apiFetch<unknown>(apiPath("MstValidationForm/control-spec"), {
    method: "POST",
    body: JSON.stringify(payload),
    token,
  });
}

export async function createMstValidationFormControlSpecs(payloads: MstValidationFormControlSpecPayload[], token?: string) {
  for (const payload of payloads) {
    await createMstValidationFormControlSpec(payload, token);
  }
}

export async function updateMstValidationFormControlSpec(newId: string, payload: Partial<MstValidationFormControlSpecPayload>, token?: string) {
  return apiFetch<unknown>(apiPath(`MstValidationForm/control-spec/${encodeURIComponent(newId)}`), {
    method: "PUT",
    body: JSON.stringify(payload),
    token,
  });
}

export async function updateMstValidationFormControlSpecByGroup(args: { groupId: string; mstReqControlSpecId: string; payload: MstValidationFormControlSpecPayload }, token?: string) {
  return apiFetch<unknown>(apiPath(`MstValidationForm/control-spec/${encodeURIComponent(args.groupId)}/${encodeURIComponent(args.mstReqControlSpecId)}`), {
    method: "PUT",
    body: JSON.stringify(args.payload),
    token,
  });
}

export async function deleteMstValidationFormControlSpec(newId: string, token?: string) {
  return apiFetch<unknown>(apiPath(`MstValidationForm/control-spec/${encodeURIComponent(newId)}`), {
    method: "DELETE",
    token,
  });
}

export async function deleteMstValidationFormControlSpecGroup(args: { groupId: string; mstReqCategoryId: string }, token?: string) {
  return apiFetch<unknown>(apiPath(`MstValidationForm/control-spec/${encodeURIComponent(args.groupId)}/${encodeURIComponent(args.mstReqCategoryId)}`), {
    method: "DELETE",
    token,
  });
}

export async function deleteMstValidationFormControlSpecByGroupId(groupId: string, token?: string) {
  return apiFetch<unknown>(apiPath(`MstValidationForm/form-stage-2/control-spec/${encodeURIComponent(groupId)}`), {
    method: "DELETE",
    token,
  });
}

export async function deleteMstValidationFormStage3ControlSpecByGroupId(groupId: string, token?: string) {
  return apiFetch<unknown>(apiPath(`MstValidationForm/form-stage-3/control-spec/${encodeURIComponent(groupId)}`), {
    method: "DELETE",
    token,
  });
}
