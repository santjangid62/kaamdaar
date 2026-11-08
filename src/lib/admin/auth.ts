/**
 * Admin session + credentials for the Kaamdaar Admin Dashboard.
 *
 * The session is a signed, httpOnly cookie (HMAC-SHA256) — no database
 * round-trip needed, and a tampered value fails verification immediately.
 * Credentials come from env with dev defaults so the dashboard works out of
 * the box; set ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_SESSION_SECRET in
 * `.env.local` before going live.
 */
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "kaamdaar_admin_session";
const DEV_SECRET = "kaamdaar-dev-admin-secret-change-me";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@kaamdaar.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "Kaamdaar@123";
const SECRET = process.env.ADMIN_SESSION_SECRET ?? DEV_SECRET;

export const isDevCredentials =
  ADMIN_EMAIL === "admin@kaamdaar.com" && process.env.ADMIN_SESSION_SECRET === undefined;

const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

function hmac(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function checkCredentials(email: string, password: string): boolean {
  const a = Buffer.from(email.trim().toLowerCase());
  const b = Buffer.from(ADMIN_EMAIL.toLowerCase());
  const c = Buffer.from(password);
  const d = Buffer.from(ADMIN_PASSWORD);
  return a.length === b.length && timingSafeEqual(a, b) && c.length === d.length && timingSafeEqual(c, d);
}

/** Create a signed session token valid for 12 hours. */
export function createSessionToken(): string {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
  return `${payload}.${hmac(payload)}`;
}

/** Verify a session token (signature + expiry). */
export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = hmac(payload);
  const given = Buffer.from(sig);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { exp: number };
    return typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
}

/** Read and verify the session cookie (server components & API routes). */
export async function isAuthed(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(ADMIN_COOKIE)?.value);
}
