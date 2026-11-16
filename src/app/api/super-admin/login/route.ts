import { NextResponse } from "next/server";
import { checkSuperAdminCredentials, createSuperAdminSession, isSuperAdminConfigured, isSuperAuthed, SUPER_ADMIN_COOKIE } from "../../../../lib/super-admin/auth";

export async function GET() {
  return NextResponse.json({ authed: await isSuperAuthed() });
}
export async function POST(req: Request) {
  if (!isSuperAdminConfigured()) {
    return NextResponse.json({ error: "Set SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD and a 32+ character SUPER_ADMIN_SESSION_SECRET in Vercel." }, { status: 503 });
  }
  let body: { email?: string; password?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const email = body.email ?? "";
  const password = body.password ?? "";
  if (!email.trim() || !password) return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  if (!checkSuperAdminCredentials(email,password)) return NextResponse.json({ error: "Invalid Super Admin credentials" }, { status: 401 });
  const response = NextResponse.json({ ok: true, email: email.trim().toLowerCase(), role: "super_admin" });
  response.cookies.set(SUPER_ADMIN_COOKIE, createSuperAdminSession(), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60*60*12 });
  return response;
}
