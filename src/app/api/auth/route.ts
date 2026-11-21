/**
 * Firebase Phone Auth verification and account resolution for web + Flutter.
 * Firebase is the sole OTP authority; MongoDB stores application accounts.
 */
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { find, insert, ready } from "../../../server/db";
import type { Provider, User } from "../../../lib/types";
import { createUserRegisteredNotification } from "../../../server/notifications";
import { createQaMobileToken, normalizeIndianPhone, verifyFirebasePhoneToken } from "../../../server/firebase-auth";
import { recordAudit } from "../../../server/audit";

const PHONE_RE = /^\+91[6-9]\d{9}$/;

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
    otp?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  let phone = normalizeIndianPhone(body.phone ?? "");
  let qaSessionToken: string | undefined;

  if (body.action === "qa_verify") {
    // Explicit preview-only QA path. Production remains Firebase-only because
    // these env vars are configured solely for the named Preview branch.
    if (process.env.QA_MOBILE_AUTH_ENABLED !== "true" ||
        !process.env.QA_MOBILE_AUTH_SECRET ||
        !process.env.QA_MOBILE_TEST_OTP_SHA256 ||
        !process.env.QA_MOBILE_CUSTOMER_PHONE_HASH ||
        !process.env.QA_MOBILE_PROVIDER_PHONE_HASH) {
      return NextResponse.json({ error: "QA mobile login is not enabled on this backend" }, { status: 403 });
    }
    const phoneHash = createHash("sha256").update(phone).digest("hex");
    const expectedPhoneHash = body.role === "customer"
      ? process.env.QA_MOBILE_CUSTOMER_PHONE_HASH
      : body.role === "provider" ? process.env.QA_MOBILE_PROVIDER_PHONE_HASH : "";
    const otpHash = createHash("sha256").update(body.otp ?? "").digest("hex");
    if (!phone || phoneHash !== expectedPhoneHash ||
        otpHash !== process.env.QA_MOBILE_TEST_OTP_SHA256 ||
        (body.role !== "customer" && body.role !== "provider")) {
      return NextResponse.json({ error: "Invalid QA phone number or test OTP" }, { status: 401 });
    }
    qaSessionToken = createQaMobileToken(phone, body.role);
  } else if (body.action === "verify") {
    if (!body.idToken) {
      return NextResponse.json({ error: "A valid Firebase verification token is required" }, { status: 401 });
    }
    try {
      const identity = await verifyFirebasePhoneToken(body.idToken);
      if (phone && phone !== identity.phone) {
        return NextResponse.json({ error: "Verified mobile number does not match" }, { status: 401 });
      }
      phone = identity.phone;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Phone verification failed";
      try {
        await recordAudit({
          actor: body.role === "provider" ? "provider" : "customer",
          action: "login",
          module: "Authentication",
          title: "Firebase phone verification failed",
          description: `platform=${body.platform === "web" ? "web" : "mobile_app"}; role=${body.role === "provider" ? "provider" : "customer"}; reason=${reason.slice(0, 220)}`,
          severity: "warning",
        });
      } catch (auditError) {
        console.error("[audit] phone verification failure log could not be saved", auditError);
      }
      return NextResponse.json({ error: reason }, { status: 401 });
    }
  } else {
    return NextResponse.json({ error: "Unsupported authentication action" }, { status: 410 });
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
      return NextResponse.json(
        { error: "This number is not on the Kaamdaar Pro roster. Ask the admin to add you." },
        { status: 403 },
      );
    }
    if (provider.status === "blocked") {
      return NextResponse.json({ error: "This provider account is blocked. Contact support." }, { status: 403 });
    }
    try {
      await recordAudit({ actor: provider.name || "provider", action: "login", module: "Authentication", title: "Provider login successful", description: `platform=${body.platform === "web" ? "web" : "mobile_app"}`, severity: "success" });
    } catch (error) { console.error("[audit] provider login log could not be saved", error); }
    return NextResponse.json({ provider, ...(qaSessionToken ? { sessionToken: qaSessionToken } : {}) });
  }

  const existing = await find<User & { id: string; status?: string }>(
    "users",
    (u) => normalizeIndianPhone(u.phone ?? "") === phone,
  );
  if (existing[0]) {
    if (existing[0].status === "deleted") {
      return NextResponse.json({ error: "This account has been deleted" }, { status: 403 });
    }
    if (existing[0].status === "blocked") {
      return NextResponse.json({
        error: "You have Blocked. Your Kaamdaar account is blocked after more than five booking cancellations. To request unblocking, email admin@kaamdaar.com with your full name, registered mobile number and booking details. If your appeal is approved, you will receive an email confirmation.",
        code: "CUSTOMER_ACCOUNT_BLOCKED",
        supportEmail: "admin@kaamdaar.com",
      }, { status: 403 });
    }
    try {
      await recordAudit({ actor: "customer", action: "login", module: "Authentication", title: "Customer login successful", description: `platform=${body.platform === "web" ? "web" : "mobile_app"}`, severity: "success" });
    } catch (error) { console.error("[audit] customer login log could not be saved", error); }
    return NextResponse.json({ user: existing[0], isNew: false, ...(qaSessionToken ? { sessionToken: qaSessionToken } : {}) });
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
  try {
    await recordAudit({ actor: "customer", action: "login", module: "Authentication", title: "New customer verified phone login", description: `platform=${body.platform === "web" ? "web" : "mobile_app"}`, severity: "success" });
  } catch (error) { console.error("[audit] customer login log could not be saved", error); }
  return NextResponse.json({ user, isNew: true, ...(qaSessionToken ? { sessionToken: qaSessionToken } : {}) });
}
