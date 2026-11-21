import { NextResponse } from "next/server";
import { all, ready } from "../../../server/db";
import { firebaseIdentityFromRequest, normalizeIndianPhone } from "../../../server/firebase-auth";
import { getServices } from "../../../server/catalog";
import type { Booking, User } from "../../../lib/types";

export async function GET(req: Request) {
  await ready();
  const identity = await firebaseIdentityFromRequest(req);
  if (!identity) return NextResponse.json({ error: "Firebase sign-in is required" }, { status: 401 });
  const [users, bookings, services] = await Promise.all([
    all<User>("users"),
    all<Booking>("bookings"),
    getServices(),
  ]);
  const customer = users.find((u) => normalizeIndianPhone(u.phone ?? "") === identity.phone);
  if (!customer) return NextResponse.json({ error: "Customer account not found" }, { status: 404 });
  const history = bookings.filter((booking) => booking.userId === customer.id);
  const counts = new Map<string, number>();
  const latest = new Map<string, number>();
  for (const booking of history) {
    if (booking.status !== "completed") continue;
    counts.set(booking.serviceId, (counts.get(booking.serviceId) ?? 0) + 1);
    latest.set(booking.serviceId, Math.max(latest.get(booking.serviceId) ?? 0, booking.completedAt ?? booking.createdAt));
  }
  const ranked = services.filter((service) => !("parent" in service && service.parent))
    .map((service) => ({
      service,
      count: counts.get(service.id) ?? 0,
      recent: latest.get(service.id) ?? 0,
    }))
    .sort((a, b) => b.count - a.count || b.recent - a.recent || Number(Boolean(b.service.popular)) - Number(Boolean(a.service.popular)));
  const hasHistory = ranked.some((row) => row.count > 0);
  const recommendations = ranked.slice(0, 4).map(({ service, count }) => ({
    ...service,
    recommendationReason: count > 0 ? `Based on ${count} completed booking(s) in your history` : "Popular service on Kaamdaar",
  }));
  return NextResponse.json({ recommendations, basedOnHistory: hasHistory });
}
