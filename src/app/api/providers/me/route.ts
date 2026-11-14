/**
 * The signed-in Pro's own roster record — the bridge between an OTP login
 * (users table) and the provider row that dispatch matches against.
 *
 * GET  /api/providers/me?phone=+919876543210  → { provider } | { provider: null }
 * POST /api/providers/me  { phone, name, services, city, lat, lng, experience }
 *      → creates the row on first registration, then keeps it in sync.
 *
 * Admin still owns verification (KYC + verified badge) in the dashboard.
 */
import { NextResponse } from "next/server";
import { all, insert, patch, ready } from "../../../../server/db";
import type { Provider } from "../../../../lib/types";
import { firebaseIdentityFromRequest, normalizeIndianPhone } from "../../../../server/firebase-auth";

/** Last 10 digits — tolerates +91, spaces and dashes. */
function digits(phone: string): string {
  const d = (phone ?? "").replace(/\D/g, "");
  return d.length > 10 ? d.slice(-10) : d;
}

function validPhone(phone: string): boolean {
  const d = digits(phone);
  return /^[6-9][0-9]{9}$/.test(d);
}

async function findByPhone(phone: string): Promise<Provider | null> {
  const want = digits(phone);
  if (!want) return null;
  const rows = await all<Provider & { phone?: string }>("providers");
  return rows.find((p) => digits(p.phone ?? "") === want) ?? null;
}

export async function GET(req: Request) {
  await ready();
  const identity = await firebaseIdentityFromRequest(req);
  if (!identity) return NextResponse.json({ error: "Firebase sign-in is required" }, { status: 401 });
  const phone = new URL(req.url).searchParams.get("phone") ?? identity.phone;
  if (normalizeIndianPhone(phone) !== identity.phone || !validPhone(phone)) {
    return NextResponse.json({ error: "Valid Indian mobile is required" }, { status: 422 });
  }
  const provider = await findByPhone(phone);
  return NextResponse.json({ provider });
}

export async function POST(req: Request) {
  await ready();
  const identity = await firebaseIdentityFromRequest(req);
  if (!identity) return NextResponse.json({ error: "Firebase sign-in is required" }, { status: 401 });
  let body: Partial<Provider> & { phone?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const phone = identity.phone;
  if ((body.phone && normalizeIndianPhone(body.phone) !== identity.phone) || !validPhone(phone)) {
    return NextResponse.json({ error: "Valid Indian mobile is required" }, { status: 422 });
  }

  const name = (body.name ?? "").trim();
  const city = (body.city ?? "").trim();
  if (name.length < 2) {
    return NextResponse.json({ error: "Name is required" }, { status: 422 });
  }
  if (!city) {
    return NextResponse.json({ error: "City / area is required" }, { status: 422 });
  }

  const services = Array.isArray(body.services)
    ? body.services.map((s) => `${s}`.trim()).filter(Boolean)
    : [];
  if (services.length === 0) {
    return NextResponse.json({ error: "Pick at least one service" }, { status: 422 });
  }

  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "A valid current location is required" }, { status: 422 });
  }
  const experience = Number(body.experience ?? 0);

  const existing = await findByPhone(phone);
  const data = {
    name,
    phone,
    services,
    city,
    lat,
    lng,
    experience: Number.isFinite(experience) ? Math.max(0, experience) : 0,
  };

  if (existing) {
    const updated = await patch<Provider>("providers", existing.id, data);
    return NextResponse.json({ provider: updated });
  }

  const created = await insert("providers", {
    ...data,
    // new Pros start unverified — admin approves them in KYC queue
    rating: 0,
    jobs: 0,
    verified: false,
    policeVerified: false,
    hourlyRate: 0,
    reviewCount: 0,
    reviews: [],
    kycStatus: "Pending",
    status: "Offline",
  } as unknown as Record<string, unknown>);

  return NextResponse.json({ provider: created }, { status: 201 });
}
