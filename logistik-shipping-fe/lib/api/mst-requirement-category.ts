import { apiFetch, apiPath } from "../api-client";

export interface ControlSpec {
  id: number;
  newId: string;
  mstReqCategoryId: string;
  fieldCode: string;
  fieldLabel: string;
  fieldType: string;
  valueNumeric: number | null;
  valueText: string | null;
  sequenceNo: number;
}

export interface MstRequirementCategory {
  id: number;
  newId: string;
  categoryName: string;
  slug: string;
  createdBy: string;
  createdDate: string;
  controlSpecs: ControlSpec[];
}

export interface ApiResponse<T> {
  message: string;
  statusCode: number;
  isError: boolean;
  data: T;
}

export async function listMstRequirementCategories(token?: string): Promise<MstRequirementCategory[]> {
  const res = await apiFetch<ApiResponse<MstRequirementCategory[]>>(apiPath("/MstRequirementCategory"), {
    token,
  });
  return res.data;
}
