const SESSION_MAX_AGE_MS = 60 * 60 * 24 * 7 * 1000;

export const SESSION_COOKIE = "df_admin";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export function authSecret() {
  return process.env.AUTH_SECRET || "dev-footwear-local-auth-secret-change-me";
}

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const buf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export async function signSession(adminId: number): Promise<string> {
  const exp = Date.now() + SESSION_MAX_AGE_MS;
  const payload = `${adminId}.${exp}`;
  const sig = await hmacHex(authSecret(), payload);
  return `${payload}.${sig}`;
}

export async function readSession(token: string | undefined | null): Promise<number | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [id, exp, sig] = parts;
  const payload = `${id}.${exp}`;
  const expected = await hmacHex(authSecret(), payload);
  if (!safeEqual(sig, expected)) return null;
  if (Number(exp) < Date.now()) return null;
  const adminId = Number(id);
  return Number.isFinite(adminId) ? adminId : null;
}
