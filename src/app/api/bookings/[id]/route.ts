/** PATCH /api/bookings/:id — dispatch lifecycle updates (owner-checked). */
import { NextResponse } from "next/server";
import { all, claimDispatchedBooking, get, patch, ready } from "../../../../server/db";
import { minWallet } from "../../../../server/settings";
import { debitCommission, type WalletTxn } from "../../../../server/wallet";
import { etaMinutes, generateOtp, toProfile } from "../../../../lib/dispatch";
import { haversineKm } from "../../../../lib/geo";
import { appendEvents, eventsForChange, newEvent } from "../../../../server/events";
import { isAuthed } from "../../../../lib/admin/auth";
import { firebaseIdentityFromRequest, normalizeIndianPhone } from "../../../../server/firebase-auth";
import type {
  Booking,
  BookingActor,
  BookingEvent,
  BookingStatus,
  Provider,
} from "../../../../lib/types";

/** Fields the client is allowed to change on its own booking. */
const ALLOWED = new Set([
  // NB: notifiedIds is deliberately absent — the notify list is server-owned,
  // so no client can dispatch a request or mask an offer from another Pro.
  "status", "providerId",
  "paymentMethod", "paymentReported", "paymentReference", "date", "slot", "duration",
]);

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await ready();
  const { id } = await ctx.params;
  let body: {
    userId?: string;
    /** One-time completion code entered by the customer. */
    completionOtp?: string;
    /** `withdrawNotify` lets a Pro drop only their own offer. */
    patch?: Partial<Booking> & {
      withdrawNotify?: string;
      /** live GPS the Provider app reports while travelling to the job */
      providerPing?: { lat: number; lng: number; accuracy?: number };
      /** Fresh device GPS captured at the moment the Pro accepts the offer. */
      providerAcceptPoint?: { lat: number; lng: number; accuracy?: number };
      /** Pro tapped "Start navigation" — timestamped server-side */
      navigationStarted?: boolean;
      startOtp?: string;
    };
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const booking = await get<Booking>("bookings", id);
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  // Admin dashboard keeps its signed httpOnly session; customers and providers
  // must prove their Firebase phone identity on every mutation.
  const admin = await isAuthed();
  let actorRole: "admin" | "customer" | "provider" = admin ? "admin" : "customer";
  let authenticatedProviderId = "";
  if (!admin) {
    const identity = await firebaseIdentityFromRequest(req);
    if (!identity) {
      return NextResponse.json({ error: "Firebase sign-in is required" }, { status: 401 });
    }
    const [users, providers] = await Promise.all([
      all<{ id: string; phone?: string }>("users"),
      all<Provider & { phone?: string }>("providers"),
    ]);
    const customer = users.find((u) => normalizeIndianPhone(u.phone ?? "") === identity.phone);
    const professional = providers.find((p) => normalizeIndianPhone(p.phone ?? "") === identity.phone);
    if (
      professional &&
      (booking.providerId === professional.id ||
        (booking.status === "dispatched" && (booking.notifiedIds ?? []).includes(professional.id)))
    ) {
      actorRole = "provider";
      authenticatedProviderId = professional.id;
    } else if (customer?.id === booking.userId) {
      actorRole = "customer";
    } else {
      return NextResponse.json({ error: "Not authorized for this booking" }, { status: 403 });
    }
  }

  const changes: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body.patch ?? {})) {
    if (ALLOWED.has(k)) changes[k] = v;
  }
  // Customers may cancel their own active booking; provider lifecycle changes are server-verified.
  if (actorRole === "customer") {
    const keys = Object.keys(body.patch ?? {});
    const customerFields = new Set(["status"]);
    if (keys.some((key) => !customerFields.has(key))) {
      return NextResponse.json({ error: "Customers cannot edit provider or dispatch fields" }, { status: 403 });
    }
    if (changes.status === "cancelled") {
      if (booking.status === "completed" || booking.status === "cancelled") {
        return NextResponse.json({ error: "This booking can no longer be cancelled" }, { status: 409 });
      }
    } else if (changes.status !== undefined) {
      return NextResponse.json({ error: "Customers can only cancel an active booking" }, { status: 403 });
    }
  }

  if (actorRole === "provider") {
    if (body.patch?.providerId && body.patch.providerId !== authenticatedProviderId) {
      return NextResponse.json({ error: "Provider identity mismatch" }, { status: 403 });
    }
    if (changes.status === "accepted") {
      changes.providerId = authenticatedProviderId;
    } else if (booking.providerId !== authenticatedProviderId && !body.patch?.withdrawNotify) {
      return NextResponse.json({ error: "Only the assigned provider can update this job" }, { status: 403 });
    }
    const providerStatuses = new Set(["accepted", "enroute", "arrived", "in_progress", "pending_confirm", "completed", "cancelled"]);
    if (typeof changes.status === "string" && !providerStatuses.has(changes.status)) {
      return NextResponse.json({ error: "Invalid provider booking status" }, { status: 403 });
    }
    if (changes.status === "cancelled") {
      if (!["accepted", "enroute", "arrived"].includes(booking.status)) {
        return NextResponse.json({ error: "Provider can cancel only an accepted job before work starts" }, { status: 409 });
      }
      changes.cancelledAt = Date.now();
      changes.cancelledBy = "provider";
      changes.cancellationReason = String((body.patch as Record<string, unknown>)?.cancellationReason ?? "Cancelled by provider").slice(0, 300);
      changes.providerId = "";
      changes.providerName = "";
      changes.providerProfile = undefined;
    }
    if (changes.status === "enroute" && booking.status !== "accepted") {
      return NextResponse.json({ error: "Navigation can start only after accepting the job" }, { status: 409 });
    }
    if (changes.status === "arrived") {
      const point = booking.livePoint ?? booking.providerPoint;
      if (booking.status !== "enroute" || !point || !booking.pingAt ||
          Date.now() - booking.pingAt > 30_000 || !booking.originPoint ||
          haversineKm(point, booking.originPoint) > 0.15) {
        return NextResponse.json({ error: "Arrival can be confirmed only within 150 metres with a fresh GPS fix" }, { status: 409 });
      }
      changes.arrivedAt = Date.now();
    }
    if (changes.status === "in_progress") {
      if (booking.status !== "arrived" || !booking.startOtp ||
          body.patch?.startOtp !== booking.startOtp) {
        return NextResponse.json({ error: "A valid customer start OTP is required" }, { status: 403 });
      }
      changes.startedAt = Date.now();
    }
    if (changes.status === "pending_confirm") {
      if (booking.status !== "in_progress") {
        return NextResponse.json({ error: "Work can be completed only after it has started" }, { status: 409 });
      }
      changes.workMarkedCompleteAt = Date.now();
      changes.completeOtp = generateOtp();
    }
    if (changes.status === "completed") {
      if (booking.status !== "pending_confirm" || !booking.completeOtp ||
          body.completionOtp !== booking.completeOtp) {
        return NextResponse.json({ error: "Customer completion OTP is invalid" }, { status: 403 });
      }
      changes.completedAt = Date.now();
    }
    if (body.patch?.paymentReported === true) {
      if (booking.status !== "completed" || booking.paymentStatus === "verified" || booking.paymentReportedAt) {
        return NextResponse.json({ error: "Payment can be reported once, after customer completion verification" }, { status: 409 });
      }
      const method = String(body.patch?.paymentMethod ?? "");
      if (!new Set(["cash", "upi"]).has(method)) return NextResponse.json({ error: "Select cash or UPI payment" }, { status: 422 });
      const reference = String(body.patch?.paymentReference ?? "").trim().slice(0, 100);
      if (method === "upi" && reference.length < 6) return NextResponse.json({ error: "UPI transaction/reference ID is required for Admin verification" }, { status: 422 });
      changes.paymentStatus = "reported";
      changes.paymentReportedAt = Date.now();
      changes.paymentReportedBy = authenticatedProviderId;
      changes.paymentMethod = method;
      changes.paymentReference = reference;
    }
    if (body.patch?.paidAt !== undefined) {
      return NextResponse.json({ error: "Only Admin can verify and finalize a reported payment" }, { status: 403 });
    }
  }

  // commission stays server-owned; recalculate if the amount ever changes
  if (typeof changes.amount === "number") delete changes.amount;

  // A Pro may withdraw only their own offer; the id comes from Firebase identity.
  let withdraw = body.patch?.withdrawNotify;
  if (actorRole === "provider" && withdraw) {
    if (withdraw !== authenticatedProviderId) {
      return NextResponse.json({ error: "Provider identity mismatch" }, { status: 403 });
    }
    withdraw = authenticatedProviderId;
  }
  if (typeof withdraw === "string" && withdraw) {
    changes.notifiedIds = (booking.notifiedIds ?? []).filter((pid) => pid !== withdraw);
  }

  /* ---- live tracking: the Pro app reports its GPS while travelling ----
   * Only the Pro holding this job may move its pin, and the server stamps the
   * receipt time, so the customer map and the Admin panel can tell a fresh
   * position from a stale one. */
  const ping = body.patch?.providerPing;
  let pinged = false;
  if (ping && (!Number.isFinite(ping.lat) || !Number.isFinite(ping.lng))) {
    return NextResponse.json({ error: "providerPing needs numeric lat/lng" }, { status: 422 });
  }
  if (ping && (Math.abs(ping.lat) > 90 || Math.abs(ping.lng) > 180)) {
    return NextResponse.json({ error: "providerPing is outside valid coordinates" }, { status: 422 });
  }
  if (ping) {
    if (actorRole !== "provider" || booking.status !== "enroute") {
      return NextResponse.json({ error: "Live GPS is accepted only from the assigned provider while en route" }, { status: 403 });
    }
    if (!booking.providerId) {
      return NextResponse.json(
        { error: "No Pro is assigned to this job yet" },
        { status: 409 },
      );
    }
    changes.livePoint = { lat: ping.lat, lng: ping.lng };
    changes.pingAt = Date.now();
    changes.pingCount = (booking.pingCount ?? 0) + 1;
    // the first ping is also where the journey started
    if (!booking.providerPoint) {
      changes.providerPoint = { lat: ping.lat, lng: ping.lng };
    }
    pinged = true;
  }

  if (body.patch?.navigationStarted === true && booking.providerId) {
    if (actorRole !== "provider" || booking.status !== "accepted") {
      return NextResponse.json({ error: "Navigation can start only for an accepted job" }, { status: 409 });
    }
    if (!booking.navigationStartedAt) changes.navigationStartedAt = Date.now();
  }

  // First accept wins (Rapido-style dispatch): once a request is allotted to
  // a Pro, no other Pro's accept can take it over — the race between two
  // providers tapping Accept is decided here, not by client timing. The
  // notify list is withdrawn server-side as well, so every other Pro's phone
  // stops showing the offer in the same write.
  if (changes.status === "accepted") {
    const expiresAt = booking.offerExpiresAt ?? ((booking.dispatchedAt ?? booking.createdAt) + 40_000);
    if (booking.status !== "dispatched" || Date.now() >= expiresAt) {
      return NextResponse.json({ error: "This 40-second job offer has expired" }, { status: 409 });
    }
    const acceptingId =
      typeof changes.providerId === "string" ? changes.providerId : "";
    if (!acceptingId) {
      return NextResponse.json(
        { error: "providerId is required to accept" },
        { status: 422 },
      );
    }
    if (booking.providerId && booking.providerId !== acceptingId) {
      return NextResponse.json(
        { error: "Request already accepted by another Pro" },
        { status: 409 },
      );
    }
    const notified = booking.notifiedIds ?? [];
    if (booking.providerId !== acceptingId && !notified.includes(acceptingId)) {
      return NextResponse.json(
        { error: "This request is no longer offered to you" },
        { status: 403 },
      );
    }
    // The dispatch list is authoritative: an arbitrary provider id must not
    // be able to claim a booking when notifiedIds is empty or malformed.
    const pro = (await all<Provider>("providers")).find((p) => p.id === acceptingId);
    if (!pro) {
      return NextResponse.json({ error: "Professional account not found" }, { status: 404 });
    }
    if (!(pro.services ?? []).includes(booking.serviceId)) {
      return NextResponse.json({ error: "You are not eligible for this service" }, { status: 403 });
    }
    if (!Number.isFinite(pro.lat) || !Number.isFinite(pro.lng) ||
        Math.abs(pro.lat) > 90 || Math.abs(pro.lng) > 180) {
      return NextResponse.json({ error: "Professional location is not configured" }, { status: 409 });
    }
    // Use a fresh device fix when the Pro accepts; never trust the old
    // profile pin as the starting point for the customer's live map.
    const acceptPoint = body.patch?.providerAcceptPoint;
    if (acceptPoint && (
      !Number.isFinite(acceptPoint.lat) || !Number.isFinite(acceptPoint.lng) ||
      Math.abs(acceptPoint.lat) > 90 || Math.abs(acceptPoint.lng) > 180
    )) {
      return NextResponse.json({ error: "Invalid GPS location from professional device" }, { status: 422 });
    }
    if (!acceptPoint) {
      return NextResponse.json({ error: "Current GPS location is required to accept this job" }, { status: 422 });
    }
    // Freeze the Pro's public details, ETA and start OTP server-side so the
    // customer's card never depends on a client-supplied profile.
    const [wallets, minimum] = await Promise.all([
      all<{ providerId: string; balance: number }>("wallets"),
      minWallet(),
    ]);
    const balance = wallets.find((wallet) => wallet.providerId === acceptingId)?.balance ?? 0;
    if (balance < minimum) {
      return NextResponse.json(
        { error: `Wallet balance must be at least ₹${minimum} to accept jobs` },
        { status: 409 },
      );
    }
    if (pro) {
      const distanceKm = booking.originPoint
        ? haversineKm(booking.originPoint, acceptPoint)
        : 0;
      changes.providerName = pro.name;
      changes.providerProfile = toProfile(pro, distanceKm);
      changes.providerPoint = { lat: acceptPoint.lat, lng: acceptPoint.lng, accuracy: acceptPoint.accuracy };
      changes.livePoint = { lat: acceptPoint.lat, lng: acceptPoint.lng, accuracy: acceptPoint.accuracy };
      changes.pingAt = Date.now();
      changes.etaMinutes = etaMinutes(distanceKm);
    }
    if (!booking.startOtp && typeof changes.startOtp !== "string") {
      changes.startOtp = generateOtp();
    }
    changes.notifiedIds = []; // withdrawn from every other Pro
    changes.acceptedAt =
      typeof changes.acceptedAt === "number" ? changes.acceptedAt : Date.now();

    // Compare-and-set in the database prevents two Pros from accepting the
    // same request concurrently, even when their requests hit different
    // serverless instances.
    const claimed = await claimDispatchedBooking(id, acceptingId, Date.now());
    if (!claimed) {
      return NextResponse.json(
        { error: "Request already accepted or this 40-second offer has expired" },
        { status: 409 },
      );
    }
  }

  /* ---- audit trail: written here, never by a client ---- */
  const actor: BookingActor = actorRole;
  const added: BookingEvent[] = [];
  if (typeof changes.status === "string" && changes.status !== booking.status) {
    added.push(
      ...eventsForChange({
        status: changes.status as BookingStatus,
        actor,
        point: booking.originPoint,
        detail:
          changes.status === "accepted" && changes.providerName
            ? `${String(changes.providerName)} accepted · ETA ${Number(changes.etaMinutes ?? 0)} min`
            : undefined,
      }),
    );
  }
  if (typeof withdraw === "string" && withdraw) {
    added.push(newEvent("provider", "declined", `Offer declined by Pro ${withdraw}`));
  }
  if (changes.navigationStartedAt) {
    added.push(newEvent("provider", "navigation", "Pro started navigation to the customer"));
  }
  if (changes.paymentReportedAt) added.push(newEvent("provider", "payment_reported", `Provider reported ${String(changes.paymentMethod).toUpperCase()} payment; awaiting Admin verification`));
  if (pinged && !booking.livePoint) {
    added.push(newEvent("provider", "ping", "Live GPS tracking started"));
  }
  if (added.length) changes.events = appendEvents(booking.events, added);

  const updated = await patch<Booking>("bookings", id, changes);
  if (!updated) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (changes.paidAt && !booking.paidAt && booking.providerId) {
    const txns = await all<WalletTxn>("walletTxns");
    const alreadyDebited = txns.some((txn) => txn.bookingId === booking.id && txn.kind === "commission");
    const commission = Math.max(0, Number(booking.commission ?? 0));
    if (!alreadyDebited && commission > 0) {
      await debitCommission(
        booking.providerId,
        commission,
        `Commission for ${booking.serviceName} · ${booking.id}`,
        { bookingId: booking.id, service: booking.serviceName, serviceCharge: booking.amount, commission },
      );
    }
  }
  if (actorRole === "provider") {
    const { startOtp: _startOtp, completeOtp: _completeOtp, ...safeBooking } = updated;
    return NextResponse.json({ booking: safeBooking });
  }
  return NextResponse.json({ booking: updated });
}