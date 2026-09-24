/**
 * Signed session cookie using Web Crypto, so the same code verifies in the
 * Edge middleware and in Node route handlers. Single operator account
 * (ADMIN_EMAIL / ADMIN_PASSWORD).
 */
export const SESSION_COOKIE = "agg_session";
const MAX_AGE_S = 60 * 60 * 24 * 14;

const enc = new TextEncoder();

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET is not set");
  return s || "dev-only-secret";
}

async function hmac(value: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSession(email: string) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_S;
  const payload = `${email}|${exp}`;
  return { value: `${btoa(payload)}.${await hmac(payload)}`, maxAge: MAX_AGE_S };
}

export async function readSession(token: string | undefined): Promise<{ email: string } | null> {
  if (!token) return null;
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return null;
  let payload: string;
  try {
    payload = atob(b64);
  } catch {
    return null;
  }
  if (!constantTimeEqual(await hmac(payload), sig)) return null;
  const [email, exp] = payload.split("|");
  if (!email || Number(exp) < Date.now() / 1000) return null;
  return { email };
}

export async function checkPassword(email: string, password: string) {
  const wantEmail = (process.env.ADMIN_EMAIL ?? "").toLowerCase().trim();
  const wantPass = process.env.ADMIN_PASSWORD ?? "";
  if (!wantEmail || !wantPass) return false;
  // Compare HMACs so timing doesn't leak the password length/prefix.
  const [a, b] = await Promise.all([hmac(`pw:${password}`), hmac(`pw:${wantPass}`)]);
  return email.toLowerCase().trim() === wantEmail && constantTimeEqual(a, b);
}
