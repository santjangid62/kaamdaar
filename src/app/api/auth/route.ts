/**
 * Firebase Phone Auth verification and account resolution for web + Flutter.
 * Firebase is the sole OTP authority; MongoDB stores application accounts.
 */
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { find, insert, ready } from "../../../server/db";
import type { Provider, User } from "../../../lib/types";
import { createUserRegisteredNotification } from "../../../server/notifications";
import { normalizeIndianPhone, verifyFirebasePhoneToken } from "../../../server/firebase-auth";
import { createDeviceSession } from "../../../server/device-sessions";
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
    deviceId?: string;
    deviceName?: string;
    locationLabel?: string;
    latitude?: number;
    longitude?: number;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  let phone = normalizeIndianPhone(body.phone ?? "");
  let verifiedUid = "";

  if (body.action === "qa_verify") {
    // Explicit preview-only QA path. Production remains Firebase-only because
    // these env vars are configured solely for the named Preview branch.
    if (process.env.QA_MOBILE_AUTH_ENABLED !== "true" ||
        !process.env.QA_MOBILE_AUTH_SECRET ||
        !process.env.QA_MOBILE_TEST_OTP_SHA256 ||
        !(process.env.QA_MOBILE_CUSTOMER_PHONE_HASHES || process.env.QA_MOBILE_CUSTOMER_PHONE_HASH) ||
        !(process.env.QA_MOBILE_PROVIDER_PHONE_HASHES || process.env.QA_MOBILE_PROVIDER_PHONE_HASH)) {
      return NextResponse.json({ error: "QA mobile login is not enabled on this backend" }, { status: 403 });
    }
    const phoneHash = createHash("sha256").update(phone).digest("hex");
    const expectedPhoneHashes = (body.role === "customer"
      ? process.env.QA_MOBILE_CUSTOMER_PHONE_HASHES || process.env.QA_MOBILE_CUSTOMER_PHONE_HASH
      : body.role === "provider"
        ? process.env.QA_MOBILE_PROVIDER_PHONE_HASHES || process.env.QA_MOBILE_PROVIDER_PHONE_HASH
        : "")?.split(/[\s,]+/).filter(Boolean) ?? [];
    const otpHash = createHash("sha256").update(body.otp ?? "").digest("hex");
    if (!phone || !expectedPhoneHashes.includes(phoneHash) ||
        otpHash !== process.env.QA_MOBILE_TEST_OTP_SHA256 ||
        (body.role !== "customer" && body.role !== "provider")) {
      return NextResponse.json({ error: "Invalid QA phone number or test OTP" }, { status: 401 });
    }
    verifiedUid = `qa:${body.role}:${phone}`;
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
      verifiedUid = identity.uid;
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

  const issueMobileSession = async (role: "customer" | "provider", accountId: string) => {
    if (body.platform !== "mobile_app") return { sessionToken: undefined as string | undefined, response: null as NextResponse | null };
    if (!body.deviceId?.trim()) return { sessionToken: undefined, response: NextResponse.json({ error: "App installation ID is required. Please update the app." }, { status: 400 }) };
    try {
      const result = await createDeviceSession({
        accountId, role, phone, uid: verifiedUid || `phone:${phone}`,
        deviceId: body.deviceId.trim(),
        deviceName: (body.deviceName || "Mobile device").trim().slice(0, 100),
        ...(body.locationLabel ? { locationLabel: body.locationLabel.trim().slice(0, 180) } : {}),
        ...(Number.isFinite(body.latitude) ? { latitude: body.latitude } : {}),
        ...(Number.isFinite(body.longitude) ? { longitude: body.longitude } : {}),
      });
      if ("conflict" in result) {
        const d = result.conflict.existingDevice;
        const when = d.loginAt ? new Date(d.loginAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "Unknown";
        const locationTime = d.locationAt ? new Date(d.locationAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "";
        const message = `${result.conflict.error} Authorized device: ${d.deviceName}. Location: ${d.location}.${locationTime ? ` Location updated: ${locationTime}.` : ""} Login time: ${when}.`;
        return { sessionToken: undefined, response: NextResponse.json({ ...result.conflict, error: message }, { status: 409 }) };
      }
      return { sessionToken: result.token, response: null };
    } catch (error) {
      console.error("[auth] device session could not be created", error);
      return { sessionToken: undefined, response: NextResponse.json({ error: "Secure device login is temporarily unavailable. Please try again later." }, { status: 503 }) };
    }
  };

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
    const mobileSession = await issueMobileSession("provider", provider.id);
    if (mobileSession.response) return mobileSession.response;
    try {
      await recordAudit({ actor: provider.name || "provider", action: "login", module: "Authentication", title: "Provider login successful", description: `platform=${body.platform === "web" ? "web" : "mobile_app"}`, severity: "success" });
    } catch (error) { console.error("[audit] provider login log could not be saved", error); }
    return NextResponse.json({ provider, ...(mobileSession.sessionToken ? { sessionToken: mobileSession.sessionToken } : {}) });
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
    const mobileSession = await issueMobileSession("customer", existing[0].id);
    if (mobileSession.response) return mobileSession.response;
    try {
      await recordAudit({ actor: "customer", action: "login", module: "Authentication", title: "Customer login successful", description: `platform=${body.platform === "web" ? "web" : "mobile_app"}`, severity: "success" });
    } catch (error) { console.error("[audit] customer login log could not be saved", error); }
    return NextResponse.json({ user: existing[0], isNew: false, ...(mobileSession.sessionToken ? { sessionToken: mobileSession.sessionToken } : {}) });
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
  const mobileSession = await issueMobileSession("customer", user.id);
  if (mobileSession.response) return mobileSession.response;
  await createUserRegisteredNotification(user);
  try {
    await recordAudit({ actor: "customer", action: "login", module: "Authentication", title: "New customer verified phone login", description: `platform=${body.platform === "web" ? "web" : "mobile_app"}`, severity: "success" });
  } catch (error) { console.error("[audit] customer login log could not be saved", error); }
  return NextResponse.json({ user, isNew: true, ...(mobileSession.sessionToken ? { sessionToken: mobileSession.sessionToken } : {}) });
}
