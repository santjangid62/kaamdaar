/**
 * Firebase Phone Auth verification and account resolution for web + Flutter.
 * Production requests must carry a Firebase ID token; OTP codes are accepted
 * only in non-production development mode.
 */
import { NextResponse } from "next/server";
import { find, insert, ready } from "../../../server/db";
import type { Provider, User } from "../../../lib/types";
import { createUserRegisteredNotification } from "../../../server/notifications";

const PHONE_RE = /^\+91[6-9]\d{9}$/;

function normalizePhone(value: string): string {
  const digits = (value ?? "").replace(/\D/g, "");
  const ten = digits.length > 10 ? digits.slice(-10) : digits;
  return /^\d{10}$/.test(ten) ? `+91${ten}` : "";
}

function referralCode(phone: string): string {
  return `KDM${phone.replace(/\D/g, "").slice(-4)}`;
}

async function verifiedFirebasePhone(idToken: string): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) throw new Error("Firebase server verification is not configured");
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
      cache: "no-store",
    },
  );
  if (!response.ok) throw new Error("Firebase phone verification failed");
  const payload = (await response.json()) as {
    users?: Array<{ phoneNumber?: string; phone_number?: string; localId?: string }>;
  };
  const user = payload.users?.[0];
  const phone = normalizePhone(user?.phoneNumber ?? user?.phone_number ?? "");
  if (!phone || !user?.localId) throw new Error("Firebase account has no verified mobile number");
  return phone;
}

export async function POST(req: Request) {
  await ready();
  let body: {
    action?: string;
    phone?: string;
    code?: string;
    idToken?: string;
    role?: string;
    platform?: "web" | "mobile_app";
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  let phone = normalizePhone(body.phone ?? "");

  // Development-only OTP path. Never expose or accept server-generated OTPs
  // in production; production identity is established by Firebase ID tokens.
  if (body.action === "send") {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Use Firebase Phone Authentication" }, { status: 410 });
    }
    if (!PHONE_RE.test(phone)) {
      return NextResponse.json({ error: "A valid Indian mobile number is required" }, { status: 400 });
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const { upsert } = await import("../../../server/db");
    await upsert("loginOtps", phone, { code, at: Date.now() });
    return NextResponse.json({ devCode: code, expiresIn: 300 });
  }

  if (body.action !== "verify") {
    return NextResponse.json({ error: "action must be verify" }, { status: 422 });
  }

  if (body.idToken) {
    try {
      const verifiedPhone = await verifiedFirebasePhone(body.idToken);
      if (phone && phone !== verifiedPhone) {
        return NextResponse.json({ error: "Verified mobile number does not match" }, { status: 401 });
      }
      phone = verifiedPhone;
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Phone verification failed" },
        { status: 401 },
      );
    }
  } else if (process.env.NODE_ENV !== "production") {
    if (!PHONE_RE.test(phone)) {
      return NextResponse.json({ error: "A valid Indian mobile number is required" }, { status: 400 });
    }
    const { get, remove } = await import("../../../server/db");
    const entry = await get<{ id: string; code: string; at: number }>("loginOtps", phone);
    if (!entry || Date.now() - entry.at > 5 * 60 * 1000) {
      await remove("loginOtps", phone);
      return NextResponse.json({ error: "OTP expired — request a new one" }, { status: 410 });
    }
    if (entry.code !== (body.code ?? "").trim()) {
      return NextResponse.json({ error: "Incorrect OTP" }, { status: 401 });
    }
    await remove("loginOtps", phone);
  } else {
    return NextResponse.json({ error: "A valid Firebase verification token is required" }, { status: 401 });
  }

  if (!PHONE_RE.test(phone)) {
    return NextResponse.json({ error: "A valid Indian mobile number is required" }, { status: 400 });
  }

  if (body.role === "provider") {
    const found = await find<Provider & { id: string; phone?: string; status?: string }>(
      "providers",
      (p) => normalizePhone(p.phone ?? "") === phone,
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
    return NextResponse.json({ provider });
  }

  const existing = await find<User & { id: string; status?: string }>(
    "users",
    (u) => normalizePhone(u.phone ?? "") === phone,
  );
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
    registrationPlatform: body.platform === "web" ? "web" : "mobile_app",
  });
  await createUserRegisteredNotification(user);
  return NextResponse.json({ user, isNew: true });
}
