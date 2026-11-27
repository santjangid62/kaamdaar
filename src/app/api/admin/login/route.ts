import { NextResponse } from "next/server";
import { recordAudit } from "../../../../server/audit";
import { all, ready } from "../../../../server/db";
import {
  ADMIN_COOKIE,
  checkCredentials,
  createSessionToken,
  isAuthed,
  isAdminAuthConfigured,
} from "../../../../lib/admin/auth";

/** GET — quick session check used by the login screen to skip a re-login. */
export async function GET() {
  return NextResponse.json({ authed: await isAuthed() });
}

export async function POST(req: Request) {
  if (!isAdminAuthConfigured()) {
    return NextResponse.json({ error: "Super Admin credentials are not configured on the server" }, { status: 503 });
  }
  let body: { email?: string; password?: string };
  try {
    body = (await req.json()) as { email?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = body.email ?? "";
  const password = body.password ?? "";

  if (!email.trim() || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  if (!checkCredentials(email, password)) {
    const userAgent = req.headers.get("user-agent") ?? "unknown";
    const platform = /android|iphone|ipad|mobile/i.test(userAgent) ? "mobile" : "web";
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim().slice(0, 64);
    try {
      await recordAudit({ actor: "admin", action: "login", module: "Authentication", title: "Admin login failed", description: `platform=${platform}; ip=${ip || "unknown"}; reason=invalid_credentials`, severity: "warning" });
    } catch (error) { console.error("[audit] admin login failure log could not be saved", error); }
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  await ready();
  const adminRows = await all<{ id: string; email?: string; status?: string }>("adminUsers");
  const adminAccount = adminRows.find((row) => row.email?.trim().toLowerCase() === email.trim().toLowerCase());
  if (adminAccount?.status === "blocked") {
    return NextResponse.json({ error: "This Admin account is blocked. Contact the Super Admin." }, { status: 403 });
  }

  const userAgent = req.headers.get("user-agent") ?? "unknown";
  const platform = /android|iphone|ipad|mobile/i.test(userAgent) ? "mobile" : "web";
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim().slice(0, 64);
  try {
    await recordAudit({ actor: email.trim().toLowerCase(), action: "login", module: "Authentication", title: "Admin login successful", description: `platform=${platform}; ip=${ip || "unknown"}`, severity: "success" });
  } catch (error) { console.error("[audit] admin login success log could not be saved", error); }

  const res = NextResponse.json({ ok: true, email: email.trim().toLowerCase() });
  res.cookies.set(ADMIN_COOKIE, createSessionToken(email), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}