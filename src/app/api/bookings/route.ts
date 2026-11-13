/**
 * Bookings. GET lists a user's bookings (?providerId=… returns a Pro's inbox:
 * allotted + still-notified dispatches, ?status= filters); POST creates one — the server
 * assigns the id and recomputes the 10% commission from settings, so the
 * client can never set those itself.
 */
import { NextResponse } from "next/server";
import { all, insert, ready } from "../../../server/db";
import { commissionRate, minWallet } from "../../../server/settings";
import type { Booking, GeoPoint, Provider } from "../../../lib/types";
import { matchProviders } from "../../../lib/match";
import { newEvent } from "../../../server/events";
import { sendProviderJobOffer } from "../../../server/fcm";
import { firebaseIdentityFromRequest, normalizeIndianPhone } from "../../../server/firebase-auth";

/** Booking location: the live point the customer is at, else the address pin. */
function resolveOrigin(body: Partial<Booking>): GeoPoint | null {
  const point = body.originPoint;
  if (point && Number.isFinite(point.lat) && Number.isFinite(point.lng)) {
    return { lat: point.lat, lng: point.lng };
  }
  const addr = body.address;
  if (addr && Number.isFinite(addr.lat) && Number.isFinite(addr.lng)) {
    return { lat: addr.lat as number, lng: addr.lng as number };
  }
  return null;
}

// live dispatch inbox — never cached, the mobile apps poll it every few seconds
export const instant = false;

export async function GET(req: Request) {
  await ready();
  const identity = await firebaseIdentityFromRequest(req);
  if (!identity) return NextResponse.json({ error: "Firebase sign-in is required" }, { status: 401 });
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  const providerId = url.searchParams.get("providerId");
  const status = url.searchParams.get("status");

  if (!userId && !providerId) {
    return NextResponse.json({ error: "userId or providerId is required" }, { status: 400 });
  }

  const [users, providers] = await Promise.all([
    all<{ id: string; phone?: string }>("users"),
    all<Provider & { phone?: string }>("providers"),
  ]);
  const customer = users.find((u) => normalizeIndianPhone(u.phone ?? "") === identity.phone);
  const professional = providers.find((p) => normalizeIndianPhone(p.phone ?? "") === identity.phone);
  if (providerId) {
    if (!professional || professional.id !== providerId) {
      return NextResponse.json({ error: "Not your provider account" }, { status: 403 });
    }
  } else if (!customer || customer.id !== userId) {
    return NextResponse.json({ error: "Not your customer account" }, { status: 403 });
  }

  // Customers see only their bookings; Pros see only jobs allotted or offered to them.
  const rows = (await all<Booking>("bookings"))
    .filter((b) =>
      providerId
        ? b.providerId === providerId || (b.notifiedIds ?? []).includes(providerId)
        : b.userId === userId,
    )
    .filter((b) => !status || b.status === status)
    .filter((b) => b.status !== "dispatched" || !b.offerExpiresAt || b.offerExpiresAt > Date.now())
    .sort((a, b) => b.createdAt - a.createdAt);

  const visibleRows = providerId
    ? rows.map(({ startOtp: _startOtp, completeOtp: _completeOtp, ...safe }) => safe)
    : rows;
  return NextResponse.json({ bookings: visibleRows });
}

export async function POST(req: Request) {
  await ready();
  const identity = await firebaseIdentityFromRequest(req);
  if (!identity) return NextResponse.json({ error: "Firebase sign-in is required" }, { status: 401 });
  let body: Partial<Booking>;
  try {
    body = (await req.json()) as Partial<Booking>;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const users = await all<{ id: string; phone?: string; status?: string }>("users");
  const user = users.find((u) => normalizeIndianPhone(u.phone ?? "") === identity.phone);
  if (!user || user.status === "blocked" || user.status === "deleted") {
    return NextResponse.json({ error: "Customer account not available" }, { status: 403 });
  }
  const userId = user.id;
  if (!body.serviceId || !body.address || !body.amount || typeof body.amount !== "number") {
    return NextResponse.json({ error: "serviceId, address and amount are required" }, { status: 422 });
  }

  // The customer never picks a Pro and never supplies the notify list: the
  // server finds everyone who serves this service near the address (3 km,
  // widening to 5 km) and offers the job to all of them. First accept wins.
  const origin = resolveOrigin(body);
  if (!origin) {
    return NextResponse.json(
      { error: "A location is required to find nearby professionals" },
      { status: 422 },
    );
  }

  const [providers, wallets] = await Promise.all([
    all<Provider>("providers"),
    all<{ providerId: string; balance: number }>("wallets"),
  ]);
  const minimum = await minWallet();
  const eligibleProviders = providers.filter((provider) =>
    (wallets.find((wallet) => wallet.providerId === provider.id)?.balance ?? 0) >= minimum
  );
  const match = matchProviders(eligibleProviders, body.serviceId, origin);
  const rate = await commissionRate();
  const amount = Math.max(0, Math.round(body.amount));
  const now = Date.now();

  const booking = await insert("bookings", {
    ...body,
    id: undefined, // never trust a client id
    userId,
    // nobody is assigned at creation — a Pro must accept the offer first
    providerId: "",
    providerName: "",
    providerProfile: undefined,
    providerPoint: undefined,
    phone: (user as { phone?: string }).phone ?? body.phone ?? "",
    amount,
    commission: Math.round((amount * rate) / 100),
    status: "dispatched",
    createdAt: now,
    offerExpiresAt: now + 40_000,
    // server-owned dispatch state — always recomputed, never taken from the client
    notifiedIds: match.matches.map((m) => m.provider.id),
    dispatchRadiusKm: match.radiusKm,
    dispatchedAt: now,
    originPoint: origin,
    // first line of the audit trail the Admin log reads
    events: [
      newEvent(
        "customer",
        "created",
        match.ring === "all"
          ? `${match.matches.length} Pros notified — nobody inside 5 km, so every Pro serving this service was pinged`
          : `${match.matches.length} Pros notified within ${match.radiusKm} km`,
        { status: "dispatched" },
      ),
    ],
  } as unknown as Record<string, unknown>);

  return NextResponse.json({
    booking,
    dispatch: {
      notified: match.matches.length,
      radiusKm: match.radiusKm,
      ring: match.ring,
    },
  });
}
