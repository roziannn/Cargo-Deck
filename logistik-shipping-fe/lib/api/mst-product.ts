import { apiFetch, apiPath } from "@/lib/api-client";

export type MstProductItem = {
  id: number;
  editId: string;
  newId: string;
  itemCode: string;
  productName: string;
  line: string;
  productStep: string;
  isActive: boolean;
  createdBy: string;
  createdDate: string;
};

export type MstProductPayload = {
  itemCode: string;
  productName: string;
  line: string;
  isActive: boolean;
  createdBy?: string;
  updatedBy?: string;
};

type MstProductApiItem = {
  id: number;
  newId: string;
  itemCode: string;
  productName: string;
  line?: string | null;
  productStep?: string | null;
  isActive?: boolean;
  createdBy?: string | null;
  createdDate?: string | null;
};

type MstProductListResponse =
  | MstProductApiItem[]
  | {
      data?: MstProductApiItem[];
      result?: MstProductApiItem[];
      items?: MstProductApiItem[];
      results?: MstProductApiItem[];
    };

function mapProduct(item: MstProductApiItem): MstProductItem {
  return {
    id: item.id,
    editId: item.newId,
    newId: item.newId,
    itemCode: item.itemCode,
    productName: item.productName,
    line: item.line ?? "",
    productStep: item.productStep ?? "-",
    isActive: item.isActive ?? false,
    createdBy: item.createdBy ?? "-",
    createdDate: item.createdDate ?? "-",
  };
}

function unwrapProductList(input: MstProductListResponse): MstProductApiItem[] {
  if (Array.isArray(input)) return input;
  return input.data ?? input.result ?? input.items ?? input.results ?? [];
}

export async function listMstProducts(token?: string) {
  const res = await apiFetch<MstProductListResponse>(apiPath("MstProduct"), {
    method: "GET",
    token,
    cache: "no-store",
  });

  return unwrapProductList(res).map(mapProduct);
}

export async function createMstProduct(payload: MstProductPayload, token?: string) {
  const res = await apiFetch<MstProductApiItem>(apiPath("MstProduct"), {
    method: "POST",
    body: JSON.stringify(payload),
    token,
  });

  return mapProduct(res);
}

export async function updateMstProduct(id: string, payload: MstProductPayload, token?: string) {
  const res = await apiFetch<MstProductApiItem>(apiPath(`MstProduct/${id}`), {
    method: "PUT",
    body: JSON.stringify(payload),
    token,
  });

  return mapProduct(res);
}
