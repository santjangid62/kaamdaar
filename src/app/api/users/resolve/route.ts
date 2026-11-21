/**
 * POST /api/users/resolve — after the phone-OTP verification succeeds, the
 * client sends the verified number; existing users come back unchanged,
 * first-timers get their account row created here (backend registration).
 */
import { NextResponse } from "next/server";
import { find, insert, ready } from "../../../../server/db";
import type { User } from "../../../../lib/types";
import { createUserRegisteredNotification } from "../../../../server/notifications";
import { firebaseIdentityFromRequest, normalizeIndianPhone } from "../../../../server/firebase-auth";

function referralCode(phone: string): string {
  return `KDM${phone.replace(/\D/g, "").slice(-4)}`;
}

/** GET — fetch-only (used to refresh the session; never creates a row). */
export async function GET(req: Request) {
  await ready();
  const identity = await firebaseIdentityFromRequest(req);
  if (!identity || identity.role !== "customer") {
    return NextResponse.json({ error: "A valid Customer device session is required" }, { status: 401 });
  }
  const requestedPhone = new URL(req.url).searchParams.get("phone") ?? identity.phone;
  const phone = normalizeIndianPhone(requestedPhone);
  if (!phone || phone !== identity.phone) {
    return NextResponse.json({ error: "You can only read your own customer profile" }, { status: 403 });
  }
  const user = await find<User & { id: string; status?: string }>("users", (u) => u.phone === phone);
  if (!user[0]) return NextResponse.json({ user: null }, { status: 404 });
  if (user[0].status === "deleted" || user[0].status === "blocked") {
    return NextResponse.json({ user: null, error: "This account is unavailable" }, { status: 403 });
  }
  return NextResponse.json({ user: user[0] });
}

export async function POST(req: Request) {
  await ready();
  const identity = await firebaseIdentityFromRequest(req);
  if (!identity || identity.role !== "customer") {
    return NextResponse.json({ error: "A valid Customer device session is required" }, { status: 401 });
  }
  let body: { phone?: string; platform?: "web" | "mobile_app" };
  try {
    body = (await req.json()) as { phone?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const phone = normalizeIndianPhone(body.phone ?? "");
  if (!phone || phone !== identity.phone) {
    return NextResponse.json({ error: "You can only resolve your own customer account" }, { status: 403 });
  }

  const existing = await find<User & { id: string; status?: string }>("users", (u) => u.phone === phone);
  if (existing[0]) {
    if (existing[0].status === "deleted") {
      return NextResponse.json({ error: "This account has been deleted" }, { status: 403 });
    }
    if (existing[0].status === "blocked") {
      return NextResponse.json({ error: "This account is blocked. Contact support." }, { status: 403 });
    }
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
    registrationPlatform: body.platform === "mobile_app" ? "mobile_app" : "web",
  });
  await createUserRegisteredNotification(user);
  return NextResponse.json({ user, isNew: true });
}