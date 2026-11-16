/**
 * GET /api/booking-slots?serviceId=...&date=YYYY-MM-DD&lat=...&lng=...
 * Returns date-specific slots from the provider roster and existing workload.
 * No Google Maps key or billing is required; coordinates come from device GPS.
 */
import { NextResponse } from "next/server";
import { all, ready } from "../../../server/db";
import { haversineKm } from "../../../lib/geo";
import { isInsideJaipur } from "../../../lib/areas";
import type { Booking, Provider, Service } from "../../../lib/types";

const DAY_START_MIN = 8 * 60;
const DAY_END_MIN = 20 * 60;
const SLOT_STEP_MIN = 30;
const ACTIVE_STATUSES = new Set(["accepted", "enroute", "arrived", "in_progress"]);

function durationOf(service?: Service & { durationMinutes?: number }): number {
  if (!service) return 60;
  const explicit = Number((service as Service & { durationMinutes?: number }).durationMinutes);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const durationText = String(service.duration ?? "").toLowerCase();
  const numbers = durationText.match(/\d+/g)?.map(Number) ?? [];
  if (!numbers.length) return 60;
  const average = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  return Math.max(30, Math.round(average * (/hours?|hrs?/.test(durationText) ? 60 : 1)));
}

function slotStartMinutes(value: string): number | null {
  const match = value.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const meridiem = match[3]?.toUpperCase();
  if (minute > 59 || hour > 23 || (meridiem && (hour < 1 || hour > 12))) return null;
  if (meridiem === "AM" && hour === 12) hour = 0;
  if (meridiem === "PM" && hour !== 12) hour += 12;
  return hour * 60 + minute;
}

function overlaps(start: number, end: number, otherStart: number, otherEnd: number): boolean {
  return start < otherEnd && otherStart < end;
}

export async function GET(req: Request) {
  await ready();
  const url = new URL(req.url);
  const serviceId = url.searchParams.get("serviceId") ?? "";
  const date = url.searchParams.get("date") ?? "";
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (!serviceId || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "serviceId, date, lat and lng are required" }, { status: 422 });
  }
  const [year, month, day] = date.split("-").map(Number);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));
  if (parsedDate.getUTCFullYear() !== year || parsedDate.getUTCMonth() !== month - 1 || parsedDate.getUTCDate() !== day) {
    return NextResponse.json({ error: "A valid Jaipur booking date is required" }, { status: 422 });
  }
  const origin = { lat, lng };
  if (!isInsideJaipur(origin)) {
    return NextResponse.json({ error: "Kaamdaar is currently available in Jaipur only." }, { status: 422 });
  }

  const [services, providers, bookings] = await Promise.all([
    all<Service & { durationMinutes?: number; active?: boolean }>("services"),
    all<Provider & { activeBookingId?: string }>("providers"),
    all<Booking>("bookings"),
  ]);
  const service = services.find((row) => row.id === serviceId && !("parent" in row) && row.active !== false);
  if (!service) return NextResponse.json({ error: "Selected service is unavailable" }, { status: 404 });

  const duration = durationOf(service);
  const eligible = providers.filter((provider) =>
    isInsideJaipur(provider) &&
    (provider.services ?? []).includes(serviceId) &&
    Number.isFinite(provider.lat) && Number.isFinite(provider.lng) &&
    haversineKm(origin, provider) <= 5
  );
  const candidates = eligible.filter((provider) => {
    // Until a Pro marks the current job complete, do not advertise their time.
    if (provider.activeBookingId || bookings.some((b) =>
      b.providerId === provider.id && ACTIVE_STATUSES.has(b.status)
    )) return false;
    return true;
  });

  const now = Date.now();
  const todayIndia = new Date(now + 330 * 60_000).toISOString().slice(0, 10);
  const currentMinute = date === todayIndia
    ? new Date(now + 330 * 60_000).getUTCHours() * 60 + new Date(now + 330 * 60_000).getUTCMinutes()
    : -1;
  const slots: Array<{ start: string; end: string; availableProviderCount: number }> = [];

  for (let start = DAY_START_MIN; start + duration <= DAY_END_MIN; start += SLOT_STEP_MIN) {
    if (start <= currentMinute) continue;
    const available = candidates.filter((provider) => {
      const reservations = bookings.filter((b) =>
        b.providerId === provider.id &&
        b.date === date &&
        b.status !== "cancelled" &&
        b.status !== "completed" &&
        b.status !== "pending_confirm"
      );
      return !reservations.some((booking) => {
        const bookedStart = slotStartMinutes(booking.slot ?? "");
        if (bookedStart === null) return false;
        const bookedDuration = Math.max(30, Number(booking.durationMinutes) || 60);
        return overlaps(start, start + duration, bookedStart, bookedStart + bookedDuration);
      });
    });
    if (available.length) {
      const fmt = (minute: number) => {
        const hour24 = Math.floor(minute / 60);
        const minutePart = minute % 60;
        const suffix = hour24 >= 12 ? "PM" : "AM";
        const hour12 = hour24 % 12 || 12;
        return `${hour12}:${String(minutePart).padStart(2, "0")} ${suffix}`;
      };
      slots.push({ start: fmt(start), end: fmt(start + duration), availableProviderCount: available.length });
    }
  }

  return NextResponse.json({ date, serviceId, durationMinutes: duration, slots, serviceCity: "Jaipur" });
}
