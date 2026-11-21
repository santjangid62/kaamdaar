import { NextResponse } from "next/server";
import { get, patch, ready } from "../../../../../server/db";
import { firebaseIdentityFromRequest, normalizeIndianPhone } from "../../../../../server/firebase-auth";
import type { Booking, Provider } from "../../../../../lib/types";
import { all } from "../../../../../server/db";

const TRACKABLE = new Set(["dispatched", "accepted", "scheduled", "enroute", "arrived", "in_progress"]);

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await ready();
  const identity = await firebaseIdentityFromRequest(req);
  if (!identity || identity.role !== "customer") return NextResponse.json({ error: "A valid Customer device session is required" }, { status: 401 });

  const { id } = await ctx.params;
  const booking = await get<Booking>("bookings", id);
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  const users = await all<{ id: string; phone?: string }>("users");
  const customer = users.find((user) => normalizeIndianPhone(user.phone ?? "") === identity.phone);
  if (!customer || customer.id !== booking.userId) {
    return NextResponse.json({ error: "Only the booking customer can share live location" }, { status: 403 });
  }
  if (!TRACKABLE.has(booking.status)) {
    return NextResponse.json({ error: "Live location sharing is closed for this booking" }, { status: 409 });
  }

  let point: { lat?: number; lng?: number; accuracy?: number };
  try {
    point = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid location payload" }, { status: 400 });
  }
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng) ||
      Math.abs(Number(point.lat)) > 90 || Math.abs(Number(point.lng)) > 180) {
    return NextResponse.json({ error: "Location must contain valid latitude and longitude" }, { status: 422 });
  }

  const updated = await patch<Booking>("bookings", id, {
    customerLivePoint: {
      lat: Number(point.lat),
      lng: Number(point.lng),
      ...(Number.isFinite(point.accuracy) ? { accuracy: Number(point.accuracy) } : {}),
    },
    customerPingAt: Date.now(),
    customerPingCount: (booking.customerPingCount ?? 0) + 1,
  });
  return NextResponse.json({ ok: Boolean(updated), customerPingAt: updated?.customerPingAt });
}
