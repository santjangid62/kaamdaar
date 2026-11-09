/**
 * GET /api/stats — public live counters for the marketing pages.
 *
 * Every number is computed from the same database the admin panel edits, so
 * the home page never shows a made-up figure. Polled by <LiveStats /> on the
 * home page (20s) so the counters move as Pros go online and bookings finish.
 */
import { NextResponse } from "next/server";
import { all, count, ready } from "../../../server/db";
import type { Booking, Provider } from "../../../lib/types";

const LIVE_STATUSES = new Set([
  "dispatched",
  "accepted",
  "enroute",
  "arrived",
  "in_progress",
  "pending_confirm",
]);

export async function GET() {
  await ready();

  const [providers, bookings, services, customers] = await Promise.all([
    all<Provider & { status?: string; rating?: number; city?: string }>("providers"),
    all<Booking>("bookings"),
    all<{ id: string; active?: boolean }>("services"),
    count("users"),
  ]);

  const onlinePros = providers.filter((p) => p.status === "Online").length;
  const completed = bookings.filter((b) => b.status === "completed").length;
  const liveNow = bookings.filter((b) => LIVE_STATUSES.has(b.status)).length;
  const liveServices = services.filter((s) => s.active !== false).length;
  const rated = providers.filter((p) => Number(p.rating) > 0);
  const avgRating = rated.length
    ? Math.round((rated.reduce((sum, p) => sum + Number(p.rating), 0) / rated.length) * 10) / 10
    : 0;
  const areas = new Set(providers.map((p) => (p.city ?? "").trim()).filter(Boolean)).size;

  return NextResponse.json(
    {
      customers,
      providers: providers.length,
      onlinePros,
      services: liveServices,
      completedBookings: completed,
      liveBookings: liveNow,
      avgRating,
      areas,
      updatedAt: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
