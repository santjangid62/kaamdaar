import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SUPER_ADMIN_COOKIE = "kaamdaar_super_admin_session";
const email = (process.env.SUPER_ADMIN_EMAIL ?? "").trim().toLowerCase();
const password = process.env.SUPER_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD ?? "";
const secret = process.env.SUPER_ADMIN_SESSION_SECRET ?? process.env.ADMIN_SESSION_SECRET ?? "";

export function isSuperAdminConfigured(): boolean {
  return Boolean(email && password && secret.length >= 32);
}
export function checkSuperAdminCredentials(candidateEmail: string, candidatePassword: string): boolean {
  if (!isSuperAdminConfigured()) return false;
  const a = Buffer.from(candidateEmail.trim().toLowerCase());
  const b = Buffer.from(email);
  const c = Buffer.from(candidatePassword);
  const d = Buffer.from(password);
  return a.length === b.length && timingSafeEqual(a,b) && c.length === d.length && timingSafeEqual(c,d);
}
function sign(payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}
export function createSuperAdminSession(): string {
  if (!isSuperAdminConfigured()) throw new Error("Super Admin authentication is not configured");
  const payload = Buffer.from(JSON.stringify({ role: "super_admin", exp: Date.now() + 12*60*60*1000 })).toString("base64url");
  return payload + "." + sign(payload);
}
export function verifySuperAdminSession(token?: string): boolean {
  if (!token || !isSuperAdminConfigured()) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected,actual)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload,"base64url").toString()) as {role?:string;exp?:number};
    return data.role === "super_admin" && typeof data.exp === "number" && data.exp > Date.now();
  } catch { return false; }
}
export async function isSuperAuthed(): Promise<boolean> {
  const store = await cookies();
  return verifySuperAdminSession(store.get(SUPER_ADMIN_COOKIE)?.value);
}
