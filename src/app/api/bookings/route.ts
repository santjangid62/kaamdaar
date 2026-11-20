/**
 * Bookings. GET lists a user's bookings (?providerId=… returns a Pro's inbox:
 * allotted + still-notified dispatches, ?status= filters); POST creates one — the server
 * assigns the id and recomputes the 10% commission from settings, so the
 * client can never set those itself.
 */
import { NextResponse } from "next/server";
import { all, insert, patch, ready } from "../../../server/db";
import { commissionRate, minWallet } from "../../../server/settings";
import type { Booking, GeoPoint, Provider, Service } from "../../../lib/types";
import { matchProviders } from "../../../lib/match";
import { isInsideJaipur } from "../../../lib/areas";
import { newEvent } from "../../../server/events";
import { sendProviderJobOffer } from "../../../server/fcm";
import { advanceProviderDispatch } from "../../../server/dispatch";
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
  const professional = providers.find((p) => p.id === providerId && normalizeIndianPhone(p.phone ?? "") === identity.phone);
  if (providerId) {
    if (!professional || professional.id !== providerId) {
      return NextResponse.json({ error: "Not your provider account" }, { status: 403 });
    }
  } else if (!customer || customer.id !== userId) {
    return NextResponse.json({ error: "Not your customer account" }, { status: 403 });
  }

  // Polling is the lightweight scheduler for sequential dispatch. The customer
  // tracking page and provider inbox both poll this endpoint every few seconds.
  const dispatchRows = await all<Booking>("bookings");
  const relevantDispatches = dispatchRows.filter((b) =>
    b.status === "dispatched" && !b.dispatchFailedAt &&
    (providerId
      ? (b.notifiedIds ?? []).includes(providerId)
      : b.userId === userId),
  );
  await Promise.all(relevantDispatches.map((b) => advanceProviderDispatch(b.id)));

  // Customers see their own bookings. Pros see assigned, current, missed and
  // explicitly rejected offers so their history remains available.
  const rows = (await all<Booking>("bookings"))
    .filter((b) =>
      providerId
        ? b.providerId === providerId ||
          (b.notifiedIds ?? []).includes(providerId) ||
          (b.missedProviderIds ?? []).includes(providerId) ||
          (b.rejectedProviderIds ?? []).includes(providerId)
        : b.userId === userId,
    )
    .filter((b) => !status || b.status === status)
    .filter((b) => b.status !== "dispatched" || !b.offerExpiresAt || b.offerExpiresAt > Date.now() ||
      (providerId && ((b.missedProviderIds ?? []).includes(providerId) || (b.rejectedProviderIds ?? []).includes(providerId))))
    .sort((a, b) => b.createdAt - a.createdAt);

  const providerBusy = Boolean(
    professional && (professional as Provider & { activeBookingId?: string }).activeBookingId
  ) || (providerId && rows.some((b) =>
    b.providerId === providerId && ["accepted", "enroute", "arrived", "in_progress"].includes(b.status)
  ));
  const visibleRows = providerId
    ? rows
        // Hide only a live offer while the Pro is already working. Keep the
        // provider's own missed/rejected history visible in every state.
        .filter((b) => !(providerBusy && b.status === "dispatched" &&
          (b.notifiedIds ?? []).includes(providerId) &&
          !(b.missedProviderIds ?? []).includes(providerId) &&
          !(b.rejectedProviderIds ?? []).includes(providerId)))
        .map(({ startOtp: _startOtp, completeOtp: _completeOtp, ...safe }) => safe)
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
  if (!body.serviceId || !body.address) {
    return NextResponse.json({ error: "serviceId and address are required" }, { status: 422 });
  }

  const catalogue = await all<Service & { parent?: string; active?: boolean; durationMinutes?: number }>("services");
  const parentService = catalogue.find((s) => s.id === body.serviceId && !s.parent && s.active !== false);
  if (!parentService) return NextResponse.json({ error: "Selected main service is unavailable" }, { status: 422 });
  const requestedIds = Array.isArray(body.selectedSubServiceIds) ? [...new Set(body.selectedSubServiceIds)] : [];
  const selectedSubs = requestedIds.map((sid) => catalogue.find((s) => s.id === sid && s.parent === parentService.id && s.active !== false));
  if (selectedSubs.some((s) => !s)) return NextResponse.json({ error: "One or more selected add-on services are invalid" }, { status: 422 });
  const selectedRows = [parentService, ...selectedSubs.filter(Boolean) as Service[]];
  const amount = selectedRows.reduce((sum, s) => sum + Math.max(0, Number(s.price) || 0), 0);
  const durationMinutes = selectedRows.reduce((sum, s) => sum + Math.max(0, Number((s as Service & { durationMinutes?: number }).durationMinutes) || (() => {
    const matches = String(s.duration ?? "").match(/\d+/g) ?? [];
    return matches.length ? Math.round(matches.map(Number).reduce((a,b)=>a+b,0) / matches.length) : 0;
  })()), 0);
  const serviceItems = selectedRows.map((s) => ({
    id: s.id, name: s.name, price: Number(s.price) || 0,
    durationMinutes: Math.max(0, Number((s as Service & { durationMinutes?: number }).durationMinutes) || (() => {
      const matches = String(s.duration ?? "").match(/\d+/g) ?? [];
      return matches.length ? Math.round(matches.map(Number).reduce((a,b)=>a+b,0) / matches.length) : 0;
    })()),
  }));
  const combinedServiceName = selectedRows.map((s) => s.name).join(" + ");

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
  if (!isInsideJaipur(origin)) {
    return NextResponse.json(
      { error: "Kaamdaar is currently available in Jaipur only. Please choose a Jaipur service address." },
      { status: 422 },
    );
  }

  const [providers, wallets, existingBookings] = await Promise.all([
    all<Provider & { activeBookingId?: string; fcmTokens?: string[] }>("providers"),
    all<{ providerId: string; balance: number }>("wallets"),
    all<Booking>("bookings"),
  ]);
  const minimum = await minWallet();
  // Never notify a professional who is already handling an active job.
  // pending_confirm means the Pro has marked work complete, so availability
  // is released at that point while customer completion OTP remains pending.
  const busyProviderIds = new Set(existingBookings
    .filter((b) => ["accepted", "enroute", "arrived", "in_progress"].includes(b.status))
    .map((b) => b.providerId)
    .filter(Boolean));
  const eligibleProviders = providers.filter((provider) =>
    isInsideJaipur(provider) &&
    provider.verified === true &&
    provider.availabilityStatus === "available" &&
    !provider.activeBookingId &&
    !busyProviderIds.has(provider.id) &&
    (wallets.find((wallet) => wallet.providerId === provider.id)?.balance ?? 0) >= minimum
  );
  const match = matchProviders(eligibleProviders, body.serviceId, origin);
  const rate = await commissionRate();
  const now = Date.now();
  const firstMatch = match.matches[0];

  // Keep the booking alive for the full five-minute search window even when
  // no Pro is available at creation time; the dispatcher rechecks availability.
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
    serviceName: combinedServiceName,
    selectedSubServiceIds: requestedIds,
    serviceItems,
    durationMinutes,
    duration: durationMinutes ? `${durationMinutes} min` : body.duration,
    amount: Math.round(amount),
    paymentStatus: "unpaid",
    commission: Math.round((amount * rate) / 100),
    status: "dispatched",
    createdAt: now,
    offerExpiresAt: firstMatch ? Math.min(now + 40_000, now + 5 * 60_000) : now + 5_000,
    // Sequential dispatch: notify one Pro at a time; when none are available,
    // keep searching the same 3 km / 5 km rings until the five-minute deadline.
    notifiedIds: firstMatch ? [firstMatch.provider.id] : [],
    dispatchQueueIds: match.matches.map((m) => m.provider.id),
    dispatchCursor: firstMatch ? 1 : 0,
    dispatchStartedAt: now,
    dispatchDeadlineAt: now + 5 * 60_000,
    missedProviderIds: [],
    rejectedProviderIds: [],
    providerOfferHistory: [],
    dispatchRadiusKm: match.radiusKm,
    dispatchedAt: now,
    originPoint: origin,
    // first line of the audit trail the Admin log reads
    events: [
      newEvent(
        "customer",
        "created",
        `${match.matches.length} eligible Pros found within ${match.radiusKm} km (${match.ring} ring); one-at-a-time dispatch started`,
        { status: "dispatched" },
      ),
    ],
  } as unknown as Record<string, unknown>);

  // Only the first ranked Pro is notified now. Later Pros are notified by
  // advanceProviderDispatch after reject/timeout; inbox polling is the fallback.
  if (firstMatch) {
    const firstProvider = providers.find((provider) => provider.id === firstMatch.provider.id);
    const fcmTokens = firstProvider?.fcmTokens ?? [];
    try {
      await sendProviderJobOffer(fcmTokens, {
        id: booking.id,
        serviceName: combinedServiceName,
        serviceId: body.serviceId,
        offerExpiresAt: booking.offerExpiresAt ?? now + 40_000,
      });
    } catch (error) {
      console.error("[fcm] job offer push could not be sent", error);
    }
  }

  // Persist real catalogue demand so homepage ranking learns from actual bookings.
  const bookedService = await all<{ id: string; bookingCount?: number }>("services");
  const serviceRow = bookedService.find((service) => service.id === body.serviceId);
  if (serviceRow) {
    await patch("services", serviceRow.id, { bookingCount: Number(serviceRow.bookingCount ?? 0) + 1, lastBookedAt: now });
  }

  return NextResponse.json({
    booking,
    dispatch: {
      notified: firstMatch ? 1 : 0,
      queued: match.matches.length,
      dispatchWindowMinutes: 5,
      radiusKm: match.radiusKm,
      ring: match.ring,
    },
  });
}
