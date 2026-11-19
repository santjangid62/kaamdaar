/**
 * Firebase Phone Auth verification and account resolution for web + Flutter.
 * Firebase is the sole OTP authority; MongoDB stores application accounts.
 */
import { NextResponse } from "next/server";
import { find, insert, ready } from "../../../server/db";
import type { Provider, User } from "../../../lib/types";
import { createUserRegisteredNotification } from "../../../server/notifications";
import { recordAudit } from "../../../server/audit";
import { normalizeIndianPhone, verifyFirebasePhoneToken } from "../../../server/firebase-auth";

const PHONE_RE = /^\+91[6-9]\d{9}$/;

function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 4 ? `••••${digits.slice(-4)}` : "unknown phone";
}

async function auditPhoneLogin(req: Request, input: {
  role: "customer" | "provider";
  phone?: string;
  platform?: "web" | "mobile_app";
  result: "success" | "failed";
  title: string;
  reference?: string;
}) {
  const userAgent = req.headers.get("user-agent") ?? "unknown";
  const ipAddress = (req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "").split(",")[0].trim() || "unknown";
  const platformHeader = req.headers.get("x-kaamdaar-platform");
  const platform = platformHeader === "customer_app" || platformHeader === "provider_app"
    ? platformHeader
    : input.platform ?? (platformHeader === "mobile_app" ? "mobile_app" : "web");
  const device = /android/i.test(userAgent) ? "Android" : /iphone|ipad|ios/i.test(userAgent) ? "iOS" : /mobile/i.test(userAgent) ? "Mobile browser" : "Desktop browser";
  try {
    await recordAudit({
      actor: input.role, action: "login", module: "Authentication", title: input.title,
      description: `${input.role} phone sign-in ${input.result}: ${maskPhone(input.phone ?? "")}`,
      reference: input.reference ?? maskPhone(input.phone ?? ""),
      severity: input.result === "success" ? "success" : "warning",
      metadata: { result: input.result, platform, device, ipAddress, userAgent: userAgent.slice(0, 240), phoneMasked: maskPhone(input.phone ?? ""), occurredAt: Date.now() },
    });
  } catch {
    // Authentication must not fail because an auxiliary audit write failed.
  }
}

function referralCode(phone: string): string {
  return `KDM${phone.replace(/\D/g, "").slice(-4)}`;
}

export async function POST(req: Request) {
  await ready();
  let body: {
    action?: string;
    phone?: string;
    idToken?: string;
    role?: string;
    platform?: "web" | "mobile_app";
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (body.action !== "verify") {
    return NextResponse.json({ error: "OTP is handled by Firebase Phone Authentication" }, { status: 410 });
  }

  let phone = normalizeIndianPhone(body.phone ?? "");
  if (!body.idToken) {
    await auditPhoneLogin(req, { role: body.role === "provider" ? "provider" : "customer", phone, platform: body.platform, result: "failed", title: "Phone sign-in failed — missing Firebase token" });
    return NextResponse.json({ error: "A valid Firebase verification token is required" }, { status: 401 });
  }
  try {
    const identity = await verifyFirebasePhoneToken(body.idToken);
    if (phone && phone !== identity.phone) {
      await auditPhoneLogin(req, { role: body.role === "provider" ? "provider" : "customer", phone, platform: body.platform, result: "failed", title: "Phone sign-in failed — number mismatch" });
      return NextResponse.json({ error: "Verified mobile number does not match" }, { status: 401 });
    }
    phone = identity.phone;
  } catch (error) {
    await auditPhoneLogin(req, { role: body.role === "provider" ? "provider" : "customer", phone, platform: body.platform, result: "failed", title: "Phone sign-in failed — Firebase token rejected" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Phone verification failed" },
      { status: 401 },
    );
  }

  if (!PHONE_RE.test(phone)) {
    return NextResponse.json({ error: "A valid Indian mobile number is required" }, { status: 400 });
  }

  if (body.role === "provider") {
    const found = await find<Provider & { id: string; phone?: string; status?: string }>(
      "providers",
      (p) => normalizeIndianPhone(p.phone ?? "") === phone,
    );
    const provider = found[0];
    if (!provider) {
      await auditPhoneLogin(req, { role: "provider", phone, platform: body.platform, result: "failed", title: "Provider sign-in failed — not on roster" });
      return NextResponse.json(
        { error: "This number is not on the Kaamdaar Pro roster. Ask the admin to add you." },
        { status: 403 },
      );
    }
    if (provider.status === "blocked") {
      await auditPhoneLogin(req, { role: "provider", phone, platform: body.platform, result: "failed", title: "Provider sign-in failed — account blocked", reference: provider.id });
      return NextResponse.json({ error: "This provider account is blocked. Contact support." }, { status: 403 });
    }
    await auditPhoneLogin(req, { role: "provider", phone, platform: body.platform, result: "success", title: "Provider sign-in successful", reference: provider.id });
    return NextResponse.json({ provider });
  }

  const existing = await find<User & { id: string; status?: string }>(
    "users",
    (u) => normalizeIndianPhone(u.phone ?? "") === phone,
  );
  if (existing[0]) {
    if (existing[0].status === "deleted") {
      await auditPhoneLogin(req, { role: "customer", phone, platform: body.platform, result: "failed", title: "Customer sign-in failed — account deleted", reference: existing[0].id });
      return NextResponse.json({ error: "This account has been deleted" }, { status: 403 });
    }
    if (existing[0].status === "blocked") {
      await auditPhoneLogin(req, { role: "customer", phone, platform: body.platform, result: "failed", title: "Customer sign-in failed — account blocked", reference: existing[0].id });
      return NextResponse.json({ error: "This account is blocked. Contact support." }, { status: 403 });
    }
    await auditPhoneLogin(req, { role: "customer", phone, platform: body.platform, result: "success", title: "Customer sign-in successful", reference: existing[0].id });
    return NextResponse.json({ user: existing[0], isNew: false });
  }

  const user = await insert<User & Record<string, unknown>>("users", {
    id: phone,
    phone,
    firstName: "",
    lastName: "",
    email: "",
    createdAt: Date.now(),
    referralCode: referralCode(phone),
    role: "customer",
    status: "active",
    registrationPlatform: body.platform === "web" ? "web" : "mobile_app",
  });
  await createUserRegisteredNotification(user);
  await auditPhoneLogin(req, { role: "customer", phone, platform: body.platform, result: "success", title: "New customer signed in", reference: user.id });
  return NextResponse.json({ user, isNew: true });
}
