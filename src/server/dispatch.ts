import { all, claimDispatchAdvance, get } from "./db";
import { minWallet } from "./settings";
import { isInsideJaipur } from "../lib/areas";
import { matchProviders } from "../lib/match";
import type { Booking, Provider } from "../lib/types";
import { appendEvents, newEvent } from "./events";
import { sendProviderJobOffer } from "./fcm";

const OFFER_MS = 40_000;
const DISPATCH_WINDOW_MS = 5 * 60_000;
const RETRY_POLL_MS = 5_000;

/**
 * Advance a sequential provider offer. Called by customer/provider inbox polling
 * and immediately after a provider rejects. Mongo compare-and-set prevents two
 * polling requests from advancing the same offer twice.
 */
export async function advanceProviderDispatch(bookingId: string): Promise<void> {
  const booking = await get<Booking>("bookings", bookingId);
  if (!booking || booking.status !== "dispatched" || booking.providerId) return;

  const now = Date.now();
  const startedAt = booking.dispatchStartedAt ?? booking.dispatchedAt ?? booking.createdAt;
  const deadline = booking.dispatchDeadlineAt ?? (startedAt + DISPATCH_WINDOW_MS);
  const currentIds = booking.notifiedIds ?? [];
  const currentExpired = currentIds.length > 0 && (booking.offerExpiresAt ?? 0) <= now;
  const missed = [...new Set(booking.missedProviderIds ?? [])];
  const offerHistory = [...(booking.providerOfferHistory ?? [])];
  if (currentExpired && !missed.includes(currentIds[0])) missed.push(currentIds[0]);
  if (currentExpired && !offerHistory.some((row) => row.providerId === currentIds[0] && row.outcome === "missed")) {
    offerHistory.push({ providerId: currentIds[0], outcome: "missed", at: now });
  }

  const baseEvents = booking.events ?? [];
  if (now >= deadline) {
    const failed = await claimDispatchAdvance(booking.id, booking.offerExpiresAt ?? 0, {
      notifiedIds: [],
      missedProviderIds: missed,
      providerOfferHistory: offerHistory,
      dispatchFailedAt: now,
      dispatchFailedMessage: "Maaf kijiye, 5 minute tak koi professional aapki booking accept nahi kar saka. Kripya dobara booking karein ya support se sampark karein.",
      events: appendEvents(baseEvents, [
        ...(currentExpired ? [newEvent("system", "offer_missed", "Provider did not respond within 40 seconds")] : []),
        newEvent("system", "dispatch_failed", "No professional accepted within the 5-minute dispatch window"),
      ]),
    });
    void failed;
    return;
  }

  // An active offer is still waiting for its 40-second response window.
  if (currentIds.length > 0 && !currentExpired) return;
  if (!currentIds.length && (booking.offerExpiresAt ?? 0) > now) return;

  const [providers, wallets, bookings] = await Promise.all([
    all<Provider & { fcmTokens?: string[]; activeBookingId?: string }>("providers"),
    all<{ providerId: string; balance: number }>("wallets"),
    all<Booking>("bookings"),
  ]);
  const minimum = await minWallet();
  const busyIds = new Set(bookings
    .filter((row) => row.id !== booking.id && ["accepted", "enroute", "arrived", "in_progress"].includes(row.status))
    .map((row) => row.providerId)
    .filter(Boolean));
  const rejected = new Set(booking.rejectedProviderIds ?? []);
  const attempted = new Set([...missed, ...rejected]);
  const origin = booking.originPoint ??
    (typeof booking.address?.lat === "number" && typeof booking.address?.lng === "number"
      ? { lat: booking.address.lat, lng: booking.address.lng }
      : null);
  // Rebuild the candidate list on every retry. A Pro who was offline/busy when
  // the request was created can become eligible during the five-minute window.
  const eligibleProviders = providers.filter((provider) =>
    isInsideJaipur(provider) &&
    provider.verified === true &&
    provider.availabilityStatus === "available" &&
    !provider.activeBookingId &&
    !busyIds.has(provider.id) &&
    (wallets.find((wallet) => wallet.providerId === provider.id)?.balance ?? 0) >= minimum
  );
  const match = matchProviders(eligibleProviders, booking.serviceId, origin);
  const queue = match.matches.map((row) => row.provider.id);
  const nextMatch = match.matches.find((row) => !attempted.has(row.provider.id));
  const next = nextMatch?.provider as (Provider & { fcmTokens?: string[] }) | undefined;
  const cursor = next ? queue.indexOf(next.id) + 1 : queue.length;

  const events = [
    ...(currentExpired ? [newEvent("system", "offer_missed", "Provider did not respond within 40 seconds")] : []),
  ];
  if (!next) {
    await claimDispatchAdvance(booking.id, booking.offerExpiresAt ?? 0, {
      notifiedIds: [],
      missedProviderIds: missed,
      providerOfferHistory: offerHistory,
      dispatchCursor: cursor,
      offerExpiresAt: Math.min(deadline, now + RETRY_POLL_MS),
      events: events.length ? appendEvents(baseEvents, events) : baseEvents,
    });
    return;
  }

  const expiresAt = Math.min(deadline, now + OFFER_MS);
  const claimed = await claimDispatchAdvance(booking.id, booking.offerExpiresAt ?? 0, {
    notifiedIds: [next.id],
    missedProviderIds: missed,
    providerOfferHistory: offerHistory,
    dispatchCursor: cursor,
    dispatchedAt: now,
    offerExpiresAt: expiresAt,
    dispatchRadiusKm: booking.dispatchRadiusKm ?? 5,
    events: appendEvents(baseEvents, [
      ...events,
      newEvent("system", "provider_notified", `${next.name} notified; response window 40 seconds`),
    ]),
  });
  if (!claimed) return;

  try {
    await sendProviderJobOffer(next.fcmTokens ?? [], {
      id: booking.id,
      serviceName: booking.serviceName,
      serviceId: booking.serviceId,
      offerExpiresAt: expiresAt,
    });
  } catch (error) {
    console.error("[fcm] sequential provider offer failed", error);
  }
}
