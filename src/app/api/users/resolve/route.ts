/**
 * POST /api/users/resolve — after the phone-OTP verification succeeds, the
 * client sends the verified number; existing users come back unchanged,
 * first-timers get their account row created here (backend registration).
 */
import { NextResponse } from "next/server";
import { find, insert, ready } from "../../../../server/db";
import type { User } from "../../../../lib/types";

function referralCode(phone: string): string {
  return `KDM${phone.replace(/\D/g, "").slice(-4)}`;
}

/** GET — fetch-only (used to refresh the session; never creates a row). */
export async function GET(req: Request) {
  await ready();
  const phone = new URL(req.url).searchParams.get("phone") ?? "";
  if (!/^\+91[6-9]\d{9}$/.test(phone)) {
    return NextResponse.json({ user: null }, { status: 400 });
  }
  const user = await find<User & { id: string; status?: string }>("users", (u) => u.phone === phone);
  if (!user[0] || user[0].status === "deleted") return NextResponse.json({ user: null }, { status: 404 });
  return NextResponse.json({ user: user[0] });
}

export async function POST(req: Request) {
  await ready();
  let body: { phone?: string };
  try {
    body = (await req.json()) as { phone?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const phone = (body.phone ?? "").trim();
  if (!/^\+91[6-9]\d{9}$/.test(phone)) {
    return NextResponse.json({ error: "A valid Indian mobile number is required" }, { status: 400 });
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

  const user = await insert("users", {
    id: phone,
    phone,
    firstName: "",
    lastName: "",
    email: "",
    referralCode: referralCode(phone),
    role: "customer",
    status: "active",
  });
  return NextResponse.json({ user, isNew: true });
}