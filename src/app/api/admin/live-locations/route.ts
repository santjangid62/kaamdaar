import { NextResponse } from "next/server";
import { all, ready } from "../../../../server/db";
import { isAuthed } from "../../../../lib/admin/auth";
import type { Booking } from "../../../../lib/types";


export async function GET() {
  await ready();
  if (!(await isAuthed())) return NextResponse.json({ error: "Admin authentication required" }, { status: 401 });
  const active = new Set(["dispatched", "accepted", "scheduled", "enroute", "arrived", "in_progress"]);
  const bookings = (await all<Booking>("bookings"))
    .filter((booking) => active.has(booking.status))
    .sort((a, b) => (b.customerPingAt ?? b.pingAt ?? b.createdAt) - (a.customerPingAt ?? a.pingAt ?? a.createdAt))
    .map((booking) => ({
      id: booking.id,
      serviceName: booking.serviceName,
      status: booking.status,
      phone: booking.phone,
      providerName: booking.providerName,
      address: booking.address,
      customerLivePoint: booking.customerLivePoint ?? null,
      customerPingAt: booking.customerPingAt ?? null,
      providerLivePoint: booking.livePoint ?? booking.providerPoint ?? null,
      providerPingAt: booking.pingAt ?? null,
    }));
  return NextResponse.json({ bookings });
}
