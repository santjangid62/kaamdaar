import { all, claimDispatchAdvance, get } from "./db";
import type { Booking } from "../lib/types";
import { appendEvents, newEvent } from "./events";
import { cancelProviderJobOffer } from "./fcm";
import type { Provider } from "../lib/types";

/**
 * Broadcast dispatch has one shared 40-second response window. All eligible
 * providers are notified together; the first atomic claim wins. This function
 * only closes the offer after its shared deadline — it never reassigns it
 * sequentially to another provider.
 */
export async function advanceProviderDispatch(bookingId: string): Promise<void> {
  const booking = await get<Booking>("bookings", bookingId);
  if (!booking || booking.status !== "dispatched" || booking.providerId) return;

  const now = Date.now();
  const expiresAt = booking.offerExpiresAt ?? ((booking.dispatchedAt ?? booking.createdAt) + 40_000);
  if (now < expiresAt) return;

  const outstanding = [...new Set(booking.notifiedIds ?? [])];
  const missed = [...new Set([...(booking.missedProviderIds ?? []), ...outstanding])];
  const history = [...(booking.providerOfferHistory ?? [])];
  for (const providerId of outstanding) {
    if (!history.some((row) => row.providerId === providerId && row.outcome === "missed")) {
      history.push({ providerId, outcome: "missed", at: now });
    }
  }

  const events = [
    ...(outstanding.length
      ? [newEvent("system", "offer_missed", `${outstanding.length} provider offer(s) expired after 40 seconds`)]
      : []),
    newEvent("system", "dispatch_failed", "No notified provider accepted within the 40-second offer window"),
  ];
  const closed = await claimDispatchAdvance(booking.id, booking.offerExpiresAt ?? 0, {
    notifiedIds: [],
    missedProviderIds: missed,
    providerOfferHistory: history,
    dispatchFailedAt: now,
    dispatchFailedMessage: "Maaf kijiye, 40 seconds ke andar koi professional booking accept nahi kar saka. Kripya dobara booking karein.",
    events: appendEvents(booking.events, events),
  });
  if (closed && outstanding.length) {
    const providers = await all<Provider & { fcmTokens?: string[] }>("providers");
    const tokens = providers
      .filter((provider) => outstanding.includes(provider.id))
      .flatMap((provider) => provider.fcmTokens ?? []);
    try {
      await cancelProviderJobOffer(tokens, booking.id);
    } catch (error) {
      console.error("[fcm] expired-offer cancellation push failed", error);
    }
  }
}
