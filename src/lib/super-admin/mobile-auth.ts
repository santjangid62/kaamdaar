import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { get, insert, patch, ready } from "../../server/db";

const secret = process.env.SUPER_ADMIN_SESSION_SECRET ?? "";
const SESSION_COLLECTION = "deviceSessions";

type MobilePayload = { role?: string; exp?: number; sid?: string };

export function isMobileSuperAdminConfigured(): boolean {
  return secret.length >= 32;
}

export async function createMobileSuperAdminToken(): Promise<string> {
  if (!isMobileSuperAdminConfigured()) {
    throw new Error("SUPER_ADMIN_SESSION_SECRET must be configured with at least 32 characters");
  }
  await ready();
  const sid = randomUUID();
  const exp = Date.now() + 60 * 60 * 1000;
  await insert(SESSION_COLLECTION, {
    id: sid, role: "super_admin_mobile", status: "active", expiresAt: exp,
    createdAt: Date.now(), revokedAt: null,
  });
  const payload = Buffer.from(JSON.stringify({ role: "super_admin", exp, sid })).toString("base64url");
  return payload + "." + createHmac("sha256", secret).update(payload).digest("base64url");
}

export async function revokeMobileSuperAdminToken(token: string | undefined): Promise<void> {
  const payload = readPayload(token);
  if (!payload?.sid) return;
  await ready();
  const session = await get<Record<string, unknown>>(SESSION_COLLECTION, payload.sid);
  if (session && session.status !== "revoked") {
    await patch(SESSION_COLLECTION, payload.sid, { status: "revoked", revokedAt: Date.now() });
  }
}

function readPayload(token: string | undefined): MobilePayload | null {
  if (!token || !isMobileSuperAdminConfigured()) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(createHmac("sha256", secret).update(payload).digest("base64url"));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as MobilePayload;
    if (data.role !== "super_admin" || typeof data.exp !== "number" || data.exp <= Date.now() || typeof data.sid !== "string") return null;
    return data;
  } catch {
    return null;
  }
}

export async function verifyMobileSuperAdminToken(token: string | undefined): Promise<boolean> {
  const payload = readPayload(token);
  if (!payload?.sid) return false;
  await ready();
  const session = await get<Record<string, unknown>>(SESSION_COLLECTION, payload.sid);
  return Boolean(session && session.role === "super_admin_mobile" && session.status === "active" && Number(session.expiresAt) > Date.now());
}

export function bearerToken(req: Request): string | undefined {
  const header = req.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : undefined;
}
