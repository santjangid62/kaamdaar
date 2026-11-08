/**
 * Booking timeline — the append-only audit trail behind the Admin activity log
 * and the customer's "what happened" strip.
 *
 * Every entry is written by the server on the transition it describes, so a
 * client can never rewrite history. Pings are stored on the booking (livePoint)
 * rather than as events: a Pro moving every few seconds would otherwise flood
 * the log.
 */
import type { BookingActor, BookingEvent, BookingStatus } from "../lib/types";

/** Human titles per transition, shared by the log and the tracking strip. */
export const EVENT_TITLE: Record<string, string> = {
  created: "Booking created",
  accepted: "Pro accepted the job",
  declined: "Pro declined the offer",
  enroute: "Pro started the journey",
  navigation: "Navigation started",
  ping: "Live location received",
  arrived: "Pro arrived at the location",
  started: "Work started (start OTP verified)",
  pending_confirm: "Work marked complete — waiting for the customer OTP",
  completed: "Customer verified — job completed",
  cancelled: "Booking cancelled",
  paid: "Payment collected",
  rescheduled: "Booking details updated",
};

/** Status → event type for the transitions dispatched by the booking PATCH. */
export const STATUS_EVENT: Partial<Record<BookingStatus, string>> = {
  accepted: "accepted",
  enroute: "enroute",
  arrived: "arrived",
  in_progress: "started",
  pending_confirm: "pending_confirm",
  completed: "completed",
  cancelled: "cancelled",
  scheduled: "rescheduled",
};

const MAX_EVENTS = 120;

function eventId(): string {
  return `ev_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function newEvent(
  actor: BookingActor,
  type: string,
  detail?: string,
  extra?: { status?: BookingStatus; lat?: number; lng?: number; title?: string },
): BookingEvent {
  return {
    id: eventId(),
    at: Date.now(),
    actor,
    type,
    title: extra?.title ?? EVENT_TITLE[type] ?? type,
    detail,
    ...(extra?.status ? { status: extra.status } : {}),
    ...(typeof extra?.lat === "number" ? { lat: extra.lat } : {}),
    ...(typeof extra?.lng === "number" ? { lng: extra.lng } : {}),
  };
}

/** Append, keeping the newest entries so a long-lived job cannot bloat the file. */
export function appendEvents(
  existing: BookingEvent[] | undefined,
  added: BookingEvent[],
): BookingEvent[] {
  const merged = [...(existing ?? []), ...added];
  return merged.length > MAX_EVENTS ? merged.slice(merged.length - MAX_EVENTS) : merged;
}

/** Turn a PATCH diff into the events it represents. */
export function eventsForChange(opts: {
  status?: BookingStatus;
  actor: BookingActor;
  detail?: string;
  point?: { lat: number; lng: number };
}): BookingEvent[] {
  const { status } = opts;
  if (!status) return [];
  const type = STATUS_EVENT[status];
  if (!type) return [];
  return [
    newEvent(opts.actor, type, opts.detail, {
      status,
      lat: opts.point?.lat,
      lng: opts.point?.lng,
    }),
  ];
}
