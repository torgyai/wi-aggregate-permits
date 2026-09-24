import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const secret = () => {
  const s = process.env.AUTH_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET is not set");
  return s || "dev-only-secret";
};

export function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url").slice(0, 32);
}

export function verify(value: string, sig: string): boolean {
  const expected = Buffer.from(sign(value));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Unguessable public token for proposal / intake links. */
export const randomToken = (bytes = 18) => randomBytes(bytes).toString("base64url");

/** Unsubscribe link token: base64url(email).signature — no DB lookup needed to verify. */
export function unsubscribeToken(email: string): string {
  const e = Buffer.from(email.toLowerCase()).toString("base64url");
  return `${e}.${sign(`unsub:${email.toLowerCase()}`)}`;
}

export function readUnsubscribeToken(token: string): string | null {
  const [e, sig] = token.split(".");
  if (!e || !sig) return null;
  const email = Buffer.from(e, "base64url").toString("utf8");
  return verify(`unsub:${email}`, sig) ? email : null;
}
