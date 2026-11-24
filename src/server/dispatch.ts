import { all, claimDispatchAdvance, get, insert, uid } from "./db";
import type { Booking, Provider } from "../lib/types";
import { appendEvents, newEvent } from "./events";
import { cancelProviderJobOffer, sendProviderJobOffer } from "./fcm";
import { haversineKm } from "../lib/geo";
import { minWallet } from "./settings";

const MAX_RADIUS_KM = 5;
const RING_WINDOW_MS = 60_000;
const TOTAL_SEARCH_MS = 5 * 60_000;
const LIVE_LOCATION_MAX_AGE_MS = 2 * 60_000;

/**
 * Progressive provider dispatch. Each non-empty one-kilometre ring gets up to
 * 60 seconds; empty rings are skipped immediately. The fifth ring remains open
 * until the five-minute deadline. All providers inside the active ring are notified
 * together; first atomic accept wins. Every poll advances the state machine.
 */
export async function advanceProviderDispatch(bookingId: string): Promise<void> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const booking = await get<Booking>("bookings", bookingId);
    if (!booking || booking.status !== "dispatched" || booking.providerId || booking.dispatchFailedAt) return;

    const now = Date.now();
    const startedAt = booking.dispatchStartedAt ?? booking.dispatchedAt ?? booking.createdAt;
    const deadline = booking.dispatchDeadlineAt ?? startedAt + TOTAL_SEARCH_MS;
    const expiresAt = booking.offerExpiresAt ?? startedAt;
    const outstanding = [...new Set(booking.notifiedIds ?? [])];
    const rejected = new Set(booking.rejectedProviderIds ?? []);
    const missed = new Set(booking.missedProviderIds ?? []);
    const ringIds = [...new Set(booking.dispatchRingIds ?? outstanding)];
    const allResponded = ringIds.length > 0 && ringIds.every((id) => rejected.has(id) || missed.has(id));

    if (now < expiresAt && !allResponded) return;
    // Keep the final 4–5 km ring open until the full five-minute deadline,
    // even if every provider in that last ring rejects early.
    if (allResponded && Number(booking.dispatchRingKm ?? 0) >= MAX_RADIUS_KM && now < deadline) return;

    const providers = await all<Provider & {
      fcmTokens?: string[];
      activeBookingId?: string;
      locationUpdatedAt?: number;
    }>("providers");
    const wallets = await all<{ providerId: string; balance: number }>("wallets");
    const activeBookings = await all<Booking>("bookings");
    const minimum = await minWallet();
    const busyIds = new Set(activeBookings
      .filter((row) => row.id !== booking.id && ["accepted", "enroute", "arrived", "in_progress"].includes(row.status))
      .map((row) => row.providerId)
      .filter(Boolean));
    const providerById = new Map(providers.map((provider) => [provider.id, provider]));
    const previousHistory = [...(booking.providerOfferHistory ?? [])];
    const nextMissed = new Set(missed);
    const expiredNow = now >= expiresAt && !allResponded;
    if (expiredNow) {
      for (const providerId of outstanding) {
        if (!rejected.has(providerId)) {
          nextMissed.add(providerId);
          if (!previousHistory.some((row) => row.providerId === providerId && row.outcome === "missed")) {
            previousHistory.push({ providerId, outcome: "missed", at: now });
          }
        }
      }
    }

    const nextRing = Math.max(1, Number(booking.dispatchRingKm ?? 0) + 1);
    if (nextRing > MAX_RADIUS_KM || now >= deadline) {
      const failed = await claimDispatchAdvance(booking.id, expiresAt, {
        notifiedIds: [],
        missedProviderIds: [...nextMissed],
        providerOfferHistory: previousHistory,
        dispatchFailedAt: now,
        dispatchFailedMessage: "No provider is accepting your request right now. Please try again after some time.",
        events: appendEvents(booking.events, [
          ...(outstanding.length && expiredNow
            ? [newEvent("system", "offer_missed", `${outstanding.length} provider offer(s) expired in the final search ring`)]
            : []),
          newEvent("system", "dispatch_failed", "Five-minute provider search completed across the full 5 km radius; no provider accepted"),
        ]),
      });
      if (failed) {
        const users = await all<{ id: string; phone?: string }>("users");
        const customer = users.find((user) => user.id === booking.userId);
        await insert("notifications", {
          id: uid("ntf"),
          type: "booking_provider_unavailable",
          title: "No provider is accepting your request right now",
          message: "Please try again after some time.",
          userId: booking.userId,
          userName: customer?.phone ?? booking.phone ?? "Customer",
          phone: customer?.phone ?? booking.phone ?? "",
          platform: "Booking update",
          bookingId: booking.id,
          readAt: null,
          createdAt: now,
        });
        if (outstanding.length) {
          const tokens = providers.filter((p) => outstanding.includes(p.id)).flatMap((p) => p.fcmTokens ?? []);
          try { await cancelProviderJobOffer(tokens, booking.id); }
          catch (error) { console.error("[fcm] final-ring offer cancellation failed", error); }
        }
      }
      return;
    }

    // Re-evaluate providers when each ring opens: they must still be online,
    // verified, not busy, wallet-funded and have a recent GPS fix.
    // FCM is an optional delivery channel, not an eligibility requirement:
    // the Web portal and Provider app also receive offers through inbox polling.
    const previouslyContacted = new Set([
      ...(booking.notifiedIds ?? []),
      ...(booking.missedProviderIds ?? []),
      ...(booking.rejectedProviderIds ?? []),
    ]);
    const queue = booking.dispatchQueueIds ?? [];
    const ringProviders = queue
      .map((id) => providerById.get(id))
      .filter((provider): provider is Provider & { fcmTokens?: string[]; activeBookingId?: string; locationUpdatedAt?: number } => Boolean(provider))
      .filter((provider) => {
        const distance = booking.originPoint ? haversineKm(booking.originPoint, provider) : Infinity;
        const inRing = distance >= nextRing - 1 && distance <= nextRing;
        const live = provider.locationUpdatedAt != null && now - provider.locationUpdatedAt <= LIVE_LOCATION_MAX_AGE_MS;
        const wallet = wallets.find((row) => row.providerId === provider.id)?.balance ?? 0;
        return inRing &&
          !previouslyContacted.has(provider.id) &&
          provider.verified === true &&
          provider.availabilityStatus === "available" &&
          !provider.activeBookingId &&
          !busyIds.has(provider.id) &&
          live &&
          wallet >= minimum &&
          (provider.services ?? []).includes(booking.serviceId);
      });

    const ringExpiry = nextRing === MAX_RADIUS_KM
      ? deadline
      : ringProviders.length ? Math.min(now + RING_WINDOW_MS, deadline) : now;
    const oldRecipients = expiredNow ? outstanding.filter((id) => !rejected.has(id)) : [];
    const ringEvent = newEvent(
      "system",
      "dispatch_ring",
      ringProviders.length
        ? `Ring ${nextRing} km opened; ${ringProviders.length} eligible provider(s) notified`
        : `Ring ${nextRing} km opened; no live eligible provider found`,
    );
    const advanced = await claimDispatchAdvance(booking.id, expiresAt, {
      dispatchRingKm: nextRing,
      dispatchRadiusKm: nextRing,
      notifiedIds: ringProviders.map((provider) => provider.id),
      dispatchRingIds: ringProviders.map((provider) => provider.id),
      dispatchNotifiedTotal: Number(booking.dispatchNotifiedTotal ?? 0) + ringProviders.length,
      offerExpiresAt: ringExpiry,
      dispatchCursor: nextRing,
      missedProviderIds: [...nextMissed],
      providerOfferHistory: previousHistory,
      events: appendEvents(booking.events, [
        ...(oldRecipients.length
          ? [newEvent("system", "offer_missed", `${oldRecipients.length} provider offer(s) expired after 60 seconds`)]
          : []),
        ringEvent,
      ]),
    });

    if (!advanced) return;

    if (oldRecipients.length) {
      const tokens = providers.filter((p) => oldRecipients.includes(p.id)).flatMap((p) => p.fcmTokens ?? []);
      try { await cancelProviderJobOffer(tokens, booking.id); }
      catch (error) { console.error("[fcm] expired-ring offer cancellation failed", error); }
    }

    if (ringProviders.length) {
      const tokens = ringProviders.flatMap((provider) => provider.fcmTokens ?? []);
      try {
        await sendProviderJobOffer(tokens, {
          id: booking.id,
          serviceName: booking.serviceName,
          serviceId: booking.serviceId,
          offerExpiresAt: ringExpiry,
        });
      } catch (error) {
        console.error("[fcm] progressive provider offer could not be sent", error);
      }
      return;
    }

    // Empty rings are skipped immediately; ring five always waits for the
    // common five-minute deadline so the total search duration is preserved.
    if (ringExpiry > now) return;
  }
}
