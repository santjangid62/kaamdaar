import { NextResponse } from "next/server";
import { all, ready } from "../../../../../server/db";
import { bearerToken, verifyMobileSuperAdminToken } from "../../../../../lib/super-admin/mobile-auth";
import type { Booking } from "../../../../../lib/types";

const ACTIVE = new Set([
  "dispatched", "accepted", "scheduled", "enroute", "arrived", "in_progress",
]);

export async function GET(req: Request) {
  if (!verifyMobileSuperAdminToken(bearerToken(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ready();
  const bookings = (await all<Booking>("bookings"))
    .filter((booking) => ACTIVE.has(booking.status))
    .sort((a, b) =>
      (b.customerPingAt ?? b.pingAt ?? b.createdAt) -
      (a.customerPingAt ?? a.pingAt ?? a.createdAt),
    )
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
  return NextResponse.json(
    { bookings, total: bookings.length },
    { headers: { "Cache-Control": "no-store" } },
  );
}
