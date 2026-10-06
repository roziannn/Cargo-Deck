import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_TTL_SECONDS = 8 * 60 * 60;

export type TokenPayload = {
  sub: string;
  preferred_username: string;
  email: string;
  name: string;
  site: string;
  iat: number;
  exp: number;
};

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error('AUTH_SECRET must be set (min 32 chars) in ".env.local".');
  return secret;
}

const b64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");
const sign = (data: string) => createHmac("sha256", getSecret()).update(data).digest();

/** HS256 JWT. Its claims (name, email, preferred_username, site) are what the FE reads for the user profile. */
export function signToken(user: { username: string; email: string; name: string; site: string }) {
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = {
    sub: user.username,
    preferred_username: user.username,
    email: user.email,
    name: user.name,
    site: user.site,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };
  const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  return `${head}.${body}.${b64url(sign(`${head}.${body}`))}`;
}

export function verifyToken(token: string): TokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [head, body, sig] = parts;

  const expected = sign(`${head}.${body}`);
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as TokenPayload;
    return payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
  } catch {
    return null;
  }
}
