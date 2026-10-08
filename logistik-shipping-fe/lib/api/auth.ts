import { apiFetch, apiPath } from "@/lib/api-client";

export type LoginSsoRequest = {
  username: string;
  password: string;
  site: string;
};

export type LoginSsoResponse = {
  token?: string; // common
  accessToken?: string; // alternative
  jwt?: string; // alternative
  data?: {
    token?: string;
    accessToken?: string;
    jwt?: string;
  };
  result?: {
    token?: string;
    accessToken?: string;
    jwt?: string;
  };
  refreshToken?: string;
  expiresIn?: number;
  user?: unknown;
};

export type AuthUserProfile = {
  name: string;
  email: string;
  username: string;
  avatar: string;
  site?: string;
  nik?: string;
  jobLvlName?: string;
  jobTtlName?: string;
  compName?: string;
};

const TOKEN_STORAGE_KEY = "opv_token";
const REFRESH_TOKEN_STORAGE_KEY = "opv_refresh_token";
const USER_STORAGE_KEY = "opv_user";

type JsonRecord = Record<string, unknown>;

function readStorage(key: string) {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(key) ?? sessionStorage.getItem(key);
}

export async function loginSso(input: LoginSsoRequest, args?: { version?: string; token?: string }) {
  return apiFetch<LoginSsoResponse>(apiPath("Auth/login-sso", args?.version), {
    method: "POST",
    body: JSON.stringify(input),
    token: args?.token,
    // credentials: "include",
  });
}

export function extractTokenFromResponse(res: unknown): string | undefined {
  const r = isJsonRecord(res) ? res : undefined;
  if (!r) return undefined;
  const direct = r.token || r.accessToken || r.jwt;
  if (typeof direct === "string" && direct.length > 0) return direct;
  const data = isJsonRecord(r.data) ? r.data : isJsonRecord(r.result) ? r.result : undefined;
  if (data) {
    const nested = data.token || data.accessToken || data.jwt;
    if (typeof nested === "string" && nested.length > 0) return nested;
  }
  return undefined;
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");

  if (typeof window !== "undefined" && typeof window.atob === "function") {
    return window.atob(padded);
  }

  return "";
}

function decodeJwtPayload(token: string): JsonRecord | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const decoded = decodeBase64Url(parts[1]);
    if (!decoded) return null;
    const parsed = JSON.parse(decoded) as unknown;
    return isJsonRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function pickString(source: JsonRecord | undefined, keys: string[]) {
  if (!source) return undefined;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function normalizeEmail(value: string | undefined, username?: string) {
  const raw = value?.trim() ?? "";
  if (raw.includes("@")) {
    const parts = raw.split("@").filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]}@${parts[1]}`;
    }
    return raw;
  }

  const normalizedUsername = username?.trim() ?? "";
  if (normalizedUsername.includes("@")) {
    const parts = normalizedUsername.split("@").filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]}@${parts[1]}`;
    }
    return normalizedUsername;
  }
  return "";
}

export function extractUserProfile(res: unknown, fallback?: { username?: string; site?: string }): AuthUserProfile {
  const root = isJsonRecord(res) ? res : undefined;
  const rootData = isJsonRecord(root?.data) ? root.data : undefined;
  const rootResult = isJsonRecord(root?.result) ? root.result : undefined;
  const nested = isJsonRecord(root?.user) ? root.user : isJsonRecord(rootData?.user) ? rootData.user : isJsonRecord(rootResult?.user) ? rootResult.user : undefined;

  const username =
    pickString(nested, ["username", "userName", "userid", "userId", "nik"]) ??
    pickString(root, ["username", "userName"]) ??
    fallback?.username?.trim() ??
    "User";

  const email =
    normalizeEmail(
      pickString(nested, ["email", "emailAddress", "mail"]) ??
        pickString(root, ["email", "emailAddress"]),
      username,
    );

  const name =
    pickString(nested, ["name", "fullName", "fullname", "displayName"]) ??
    pickString(root, ["name", "fullName", "fullname", "displayName"]) ??
    username;

  const avatar = pickString(nested, ["avatar", "avatarUrl", "photoUrl", "imageUrl"]) ?? "/avatars/shadcn.jpg";

  return {
    name,
    email,
    username,
    avatar,
    site: fallback?.site?.trim() || pickString(nested, ["site", "siteCode"]) || pickString(root, ["site", "siteCode"]) || "",
    nik: pickString(nested, ["nik", "NIK", "employeeId", "employeeID", "nip"]) || pickString(root, ["nik", "NIK", "employeeId", "employeeID", "nip"]) || username,
    jobLvlName: pickString(nested, ["jobLvlName", "JobLvlName", "jobLevel", "jobLvl", "employeeJobLvl", "employeeLevel"]) || pickString(root, ["jobLvlName", "JobLvlName", "jobLevel", "jobLvl", "employeeJobLvl", "employeeLevel"]) || "",
    jobTtlName: pickString(nested, ["jobTtlName", "JobTtlName", "employeeCluster", "EmployeeCluster", "cluster"]) || pickString(root, ["jobTtlName", "JobTtlName", "employeeCluster", "EmployeeCluster", "cluster"]) || "",
    compName: pickString(nested, ["compName", "CompName", "employeeCompName", "EmployeeCompName", "companyName"]) || pickString(root, ["compName", "CompName", "employeeCompName", "EmployeeCompName", "companyName"]) || "",
  };
}

export function saveAuthSession(args: { token?: string; refreshToken?: string; user: AuthUserProfile }) {
  if (typeof window === "undefined") return;

  if (args.token) localStorage.setItem(TOKEN_STORAGE_KEY, args.token);
  if (args.refreshToken) localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, args.refreshToken);
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(args.user));
}

function extractUserProfileFromToken(token: string): AuthUserProfile | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;

  const username =
    pickString(payload, ["preferred_username", "unique_name", "username", "userName", "sub", "nik"]) ??
    "user";

  const email =
    normalizeEmail(pickString(payload, ["email", "upn", "mail"]), username);

  const name =
    pickString(payload, ["name", "given_name", "displayName", "fullName"]) ??
    username;

  return {
    name,
    email,
    username,
    avatar: "/avatars/shadcn.jpg",
    site: pickString(payload, ["site", "siteCode"]) || "",
    nik: pickString(payload, ["nik", "NIK", "employeeId", "employeeID", "nip"]) || username,
    jobLvlName: pickString(payload, ["jobLvlName", "JobLvlName", "jobLevel", "jobLvl", "employeeJobLvl", "employeeLevel"]) || "",
    jobTtlName: pickString(payload, ["jobTtlName", "JobTtlName", "employeeCluster", "EmployeeCluster", "cluster"]) || "",
    compName: pickString(payload, ["compName", "CompName", "employeeCompName", "EmployeeCompName", "companyName"]) || "",
  };
}

export function getStoredAuthUser(): AuthUserProfile | null {
  if (typeof window === "undefined") return null;

  const raw = readStorage(USER_STORAGE_KEY);
  const token = readStorage(TOKEN_STORAGE_KEY) ?? undefined;
  const tokenUser = token ? extractUserProfileFromToken(token) : null;
  if (!raw) return tokenUser;

  try {
    const parsed = JSON.parse(raw) as Partial<AuthUserProfile>;
    if (!parsed || typeof parsed !== "object") return null;

    const parsedName = typeof parsed.name === "string" && parsed.name.trim() ? parsed.name : "";
    const parsedEmail = typeof parsed.email === "string" && parsed.email.trim() ? parsed.email : "";
    const parsedUsername = typeof parsed.username === "string" && parsed.username.trim() ? parsed.username : "";
    const parsedAvatar = typeof parsed.avatar === "string" && parsed.avatar.trim() ? parsed.avatar : "";
    const parsedSite = typeof parsed.site === "string" && parsed.site.trim() ? parsed.site.trim() : "";
    const parsedNik = typeof parsed.nik === "string" && parsed.nik.trim() ? parsed.nik.trim() : "";
    const parsedJobLvlName = typeof parsed.jobLvlName === "string" && parsed.jobLvlName.trim() ? parsed.jobLvlName.trim() : "";
    const parsedJobTtlName = typeof parsed.jobTtlName === "string" && parsed.jobTtlName.trim() ? parsed.jobTtlName.trim() : "";
    const parsedCompName = typeof parsed.compName === "string" && parsed.compName.trim() ? parsed.compName.trim() : "";

    return {
      name: parsedName || tokenUser?.name || "User",
      email: normalizeEmail(parsedEmail || tokenUser?.email, parsedUsername || tokenUser?.username),
      username: parsedUsername || tokenUser?.username || "user",
      avatar: parsedAvatar || tokenUser?.avatar || "/avatars/shadcn.jpg",
      site: parsedSite || tokenUser?.site || "",
      nik: parsedNik || tokenUser?.nik || parsedUsername || tokenUser?.username || "",
      jobLvlName: parsedJobLvlName || tokenUser?.jobLvlName || "",
      jobTtlName: parsedJobTtlName || tokenUser?.jobTtlName || "",
      compName: parsedCompName || tokenUser?.compName || "",
    };
  } catch {
    return tokenUser;
  }
}

/** Tells the server the user logged out (for the audit trail); a failure here must not stop the logout. */
export async function notifyLogout(token?: string) {
  if (!token) return;
  try {
    await apiFetch(apiPath("Auth/logout"), { method: "POST", token });
  } catch {
    // ignore: the local session is cleared anyway
  }
}

export function clearAuthSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(USER_STORAGE_KEY);
}

export function getStoredAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return readStorage(TOKEN_STORAGE_KEY);
}
