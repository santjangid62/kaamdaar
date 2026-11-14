import { NextResponse } from "next/server";
import { all, get, patch, ready } from "../../../../server/db";
import { isAuthed } from "../../../../lib/admin/auth";
import { appendEvents, newEvent } from "../../../../server/events";
import { debitCommission, type WalletTxn } from "../../../../server/wallet";
import type { Booking } from "../../../../lib/types";

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ready();
  const rows = await all<Booking>("bookings");
  const reports = rows.filter((b) => b.paymentStatus === "reported" || b.paymentStatus === "disputed")
    .sort((a,b) => (b.paymentReportedAt ?? 0) - (a.paymentReportedAt ?? 0));
  return NextResponse.json({ reports });
}

export async function PATCH(req: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ready();
  let body: { bookingId?: string; action?: "verify" | "dispute"; note?: string };
  try { body = await req.json() as typeof body; }
  catch { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }
  const booking = await get<Booking>("bookings", String(body.bookingId ?? ""));
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (booking.paymentStatus !== "reported" || !booking.paymentReportedAt) {
    return NextResponse.json({ error: "No pending provider payment report exists for this booking" }, { status: 409 });
  }
  if (body.action !== "verify" && body.action !== "dispute") {
    return NextResponse.json({ error: "Choose verify or dispute" }, { status: 422 });
  }
  const now = Date.now();
  const events = appendEvents(booking.events, [newEvent("admin", body.action === "verify" ? "paid" : "payment_disputed",
    body.action === "verify" ? `Admin verified ${booking.paymentMethod?.toUpperCase()} payment` : `Admin disputed provider payment: ${String(body.note ?? "Needs review").slice(0,180)}`)]);
  const updated = await patch<Booking>("bookings", booking.id, body.action === "verify"
    ? { paymentStatus: "verified", paidAt: now, paymentVerifiedAt: now, paymentVerifiedBy: "admin", events }
    : { paymentStatus: "disputed", paymentDisputeNote: String(body.note ?? "Needs review").slice(0,300), events });
  if (body.action === "verify" && booking.providerId) {
    const txns = await all<WalletTxn>("walletTxns");
    const exists = txns.some((t) => t.bookingId === booking.id && t.kind === "commission");
    const commission = Math.max(0, Number(booking.commission ?? 0));
    if (!exists && commission > 0) {
      await debitCommission(booking.providerId, commission, `Commission for ${booking.serviceName} · ${booking.id}`,
        { bookingId: booking.id, service: booking.serviceName, serviceCharge: booking.amount, commission });
    }
  }
  return NextResponse.json({ booking: updated });
}
