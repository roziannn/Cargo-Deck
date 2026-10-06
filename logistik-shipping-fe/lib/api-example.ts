import { apiFetch } from "@/lib/api-client";

export type ProductDto = {
  id: number;
  itemCode: string;
  productName: string;
  line: string;
  isActive: boolean;
  createdBy: string;
  createdDate: string;
};

export async function listProducts() {
  return apiFetch<ProductDto[]>("/api/products", { method: "GET" });
}

export async function createProduct(input: Omit<ProductDto, "id" | "createdBy" | "createdDate">) {
  return apiFetch<ProductDto>("/api/products", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

