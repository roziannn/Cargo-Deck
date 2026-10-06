export class ApiError extends Error {
  status: number;
  url: string;
  body: unknown;

  constructor(args: { status: number; url: string; message: string; body: unknown }) {
    super(args.message);
    this.name = "ApiError";
    this.status = args.status;
    this.url = args.url;
    this.body = args.body;
  }
}

type ApiFetchOptions = Omit<RequestInit, "headers"> & {
  headers?: Record<string, string>;
  token?: string;
};

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function normalizePath(path: string) {
  if (!path) return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

function getBaseUrl() {
  // Empty = same origin, i.e. the Next.js route handlers under app/api.
  return normalizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL ?? "");
}

function getApiVersion() {
  const raw = process.env.NEXT_PUBLIC_API_VERSION;
  if (!raw) return "1";
  return raw.replace(/^v/i, "");
}

export function apiPath(path: string, version?: string) {
  const v = (version ?? getApiVersion()).replace(/^v/i, "");
  const cleaned = path.replace(/^\/+/, "");
  return `/api/v${v}/${cleaned}`;
}

function getCredentials(): RequestCredentials | undefined {
  const raw = (process.env.NEXT_PUBLIC_API_CREDENTIALS || "").toLowerCase();
  if (raw === "include" || raw === "omit" || raw === "same-origin") return raw as RequestCredentials;
  return undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickErrorMessage(body: unknown) {
  if (typeof body === "string") return body;
  if (isPlainObject(body)) {
    const title = typeof body.title === "string" ? body.title : undefined;
    const detail = typeof body.detail === "string" ? body.detail : undefined;
    const message = typeof body.message === "string" ? body.message : undefined;
    return message ?? title ?? detail ?? "Request failed";
  }
  return "Request failed";
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${normalizePath(path)}`;

  const headers: Record<string, string> = {
    ...(options.headers ?? {}),
  };

  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const body = options.body as unknown;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  if (!isFormData && options.body !== undefined && headers["Content-Type"] === undefined) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: options.credentials ?? getCredentials(),
  });

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json") || contentType.includes("application/problem+json");
  const parsedBody = isJson ? await res.json().catch(() => undefined) : await res.text().catch(() => undefined);

  if (!res.ok) {
    throw new ApiError({
      status: res.status,
      url,
      message: pickErrorMessage(parsedBody),
      body: parsedBody,
    });
  }

  return parsedBody as T;
}
