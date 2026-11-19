import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  checkCredentials,
  createSessionToken,
  isAuthed,
  isAdminAuthConfigured,
} from "../../../../lib/admin/auth";
import { recordAudit } from "../../../../server/audit";


async function auditAdminLogin(req: Request, email: string, result: "success" | "failed", reason: string) {
  const userAgent = req.headers.get("user-agent") ?? "unknown";
  const ipAddress = (req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "").split(",")[0].trim() || "unknown";
  try {
    await recordAudit({
      actor: "admin", action: "login", module: "Authentication",
      title: result === "success" ? "Admin sign-in successful" : "Admin sign-in failed",
      description: reason, reference: email.trim().toLowerCase().slice(0, 120),
      severity: result === "success" ? "success" : "warning",
      metadata: { result, platform: "admin_web", device: /mobile/i.test(userAgent) ? "Mobile browser" : "Desktop browser", ipAddress, userAgent: userAgent.slice(0, 240), email: email.trim().toLowerCase().slice(0, 120), occurredAt: Date.now() },
    });
  } catch {
    // A failed audit write must not make a valid login unavailable.
  }
}

/** GET — quick session check used by the login screen to skip a re-login. */
export async function GET() {
  return NextResponse.json({ authed: await isAuthed() });
}

export async function POST(req: Request) {
  if (!isAdminAuthConfigured()) {
    await auditAdminLogin(req, "", "failed", "Admin login unavailable — server credentials are not configured");
    return NextResponse.json({ error: "Super Admin credentials are not configured on the server" }, { status: 503 });
  }
  let body: { email?: string; password?: string };
  try {
    body = (await req.json()) as { email?: string; password?: string };
  } catch {
    await auditAdminLogin(req, "", "failed", "Admin login failed — invalid request body");
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = body.email ?? "";
  const password = body.password ?? "";

  if (!email.trim() || !password) {
    await auditAdminLogin(req, email, "failed", "Admin login failed — required fields missing");
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
    await auditAdminLogin(req, email, "failed", "Admin login failed — invalid email format");
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  if (!checkCredentials(email, password)) {
    await auditAdminLogin(req, email, "failed", "Admin login failed — credentials rejected");
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  await auditAdminLogin(req, email, "success", "Admin authenticated and session issued");
  const res = NextResponse.json({ ok: true, email: email.trim().toLowerCase() });
  res.cookies.set(ADMIN_COOKIE, createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}