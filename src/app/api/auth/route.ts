/**
 * POST /api/auth — phone-OTP verification for the native apps (customer +
 * provider Flutter apps).
 *
 * The web UI runs Firebase phone auth inside the browser (dev fallback: a
 * local code shown on screen). The Flutter apps have no browser/recaptcha
 * context, so they send the OTP through this endpoint instead. Dev mode here
 * mirrors the web: the 6-digit code is generated server-side and returned as
 * `devCode` so the flow can be exercised end to end without Firebase keys.
 *
 * body:
 *   { action: "send", phone }                        → { devCode, expiresIn }
 *   { action: "verify", phone, code, role? }         → customer: { user, isNew }
 *                                                       provider: { provider }
 *
 * Provider numbers are never self-registered — they must already exist in
 * the admin-managed roster (admins add Pro rows with their phone number).
 */
import { NextResponse } from "next/server";
import { find, insert, ready } from "../../../server/db";
import type { Provider, User } from "../../../lib/types";
import { createUserRegisteredNotification } from "../../../server/notifications";

const PHONE_RE = /^\+91[6-9]\d{9}$/;
const TTL_MS = 5 * 60 * 1000;
const codes = new Map<string, { code: string; at: number }>();

function referralCode(phone: string): string {
  return `KDM${phone.replace(/\D/g, "").slice(-4)}`;
}

export async function POST(req: Request) {
  await ready();
  let body: { action?: string; phone?: string; code?: string; role?: string; platform?: "web" | "mobile_app" };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const phone = (body.phone ?? "").trim();
  if (!PHONE_RE.test(phone)) {
    return NextResponse.json(
      { error: "A valid Indian mobile number is required" },
      { status: 400 },
    );
  }

  if (body.action === "send") {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    for (const [k, v] of codes) if (Date.now() - v.at > TTL_MS) codes.delete(k);
    codes.set(phone, { code, at: Date.now() });
    return NextResponse.json({ devCode: code, expiresIn: 300 });
  }

  if (body.action === "verify") {
    const entry = codes.get(phone);
    if (!entry || Date.now() - entry.at > TTL_MS) {
      codes.delete(phone);
      return NextResponse.json({ error: "OTP expired — request a new one" }, { status: 410 });
    }
    if (entry.code !== (body.code ?? "").trim()) {
      return NextResponse.json({ error: "Incorrect OTP" }, { status: 401 });
    }
    codes.delete(phone);

    if (body.role === "provider") {
      const found = await find<
        Provider & { id: string; phone?: string; status?: string }
      >("providers", (p) => p.phone === phone);
      const provider = found[0];
      if (!provider) {
        return NextResponse.json(
          {
            error:
              "This number is not on the Kaamdaar Pro roster. Ask the admin to add you.",
          },
          { status: 403 },
        );
      }
      if (provider.status === "blocked") {
        return NextResponse.json(
          { error: "This provider account is blocked. Contact support." },
          { status: 403 },
        );
      }
      return NextResponse.json({ provider });
    }

    // customer: return the existing account, or register the first-timer
    const existing = await find<User & { id: string; status?: string }>(
      "users",
      (u) => u.phone === phone,
    );
    if (existing[0]) {
      if (existing[0].status === "deleted") {
        return NextResponse.json({ error: "This account has been deleted" }, { status: 403 });
      }
      if (existing[0].status === "blocked") {
        return NextResponse.json(
          { error: "This account is blocked. Contact support." },
          { status: 403 },
        );
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
      registrationPlatform: body.platform === "web" ? "web" : "mobile_app",
    });
    await createUserRegisteredNotification(user);
    return NextResponse.json({ user, isNew: true });
  }

  return NextResponse.json({ error: "action must be send or verify" }, { status: 422 });
}