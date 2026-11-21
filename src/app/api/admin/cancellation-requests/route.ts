import { NextResponse } from "next/server";
import { all, get, patch, ready, releaseProviderBooking, insert } from "../../../../server/db";
import { isAuthed } from "../../../../lib/admin/auth";
import { recordAudit } from "../../../../server/audit";
import type { Booking, User } from "../../../../lib/types";

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ready();
  const [bookings, users] = await Promise.all([all<Booking>("bookings"), all<User>("users")]);
  const pending = bookings.filter((b) => b.cancellationRequest?.status === "pending");
  return NextResponse.json({ requests: pending.map((b) => {
    const customer = users.find((u) => u.id === b.userId);
    return { bookingId: b.id, service: b.serviceName, customerName: [customer?.firstName, customer?.lastName].filter(Boolean).join(" ") || customer?.phone || b.phone, customerPhone: customer?.phone || b.phone, providerName: b.cancellationRequest?.providerName || b.providerName, reason: b.cancellationRequest?.reason || "", requestedAt: b.cancellationRequest?.requestedAt || b.createdAt, bookingStatus: b.status };
  }) });
}

export async function PATCH(req: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ready();
  let body: { bookingId?: string; decision?: string; note?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }
  const bookingId = String(body.bookingId || "");
  const decision = body.decision;
  const note = String(body.note || "").trim().slice(0, 500);
  if (!bookingId || !["approved", "rejected"].includes(String(decision))) return NextResponse.json({ error: "bookingId and a valid decision are required" }, { status: 422 });
  const booking = await get<Booking>("bookings", bookingId);
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (booking.cancellationRequest?.status !== "pending") return NextResponse.json({ error: "This request has already been reviewed" }, { status: 409 });
  if (decision === "approved" && ["in_progress", "pending_confirm", "completed", "cancelled"].includes(booking.status)) return NextResponse.json({ error: "This booking can no longer be cancelled at its current stage" }, { status: 409 });
  const reviewedAt = Date.now();
  const cancellationRequest = { ...booking.cancellationRequest, status: decision as "approved" | "rejected", reviewedAt, reviewNote: note };
  const changes: Record<string, unknown> = { cancellationRequest };
  if (decision === "approved") Object.assign(changes, { status: "cancelled", cancelledAt: reviewedAt, cancelledBy: "admin", cancellationReason: booking.cancellationRequest.reason, notifiedIds: [] });
  const updated = await patch<Booking>("bookings", bookingId, changes);
  if (!updated) return NextResponse.json({ error: "Could not update booking" }, { status: 404 });
  if (decision === "approved" && booking.providerId) await releaseProviderBooking(booking.providerId, bookingId);
  const users = await all<User>("users");
  const customer = users.find((u) => u.id === booking.userId);
  await insert("notifications", {
    id: `ntf-cancel-review-${bookingId}-${reviewedAt}`,
    type: decision === "approved" ? "booking_cancelled_by_admin" : "provider_cancellation_rejected",
    title: decision === "approved" ? "Booking cancelled after Admin review" : "Provider cancellation request declined",
    message: decision === "approved" ? `Your ${booking.serviceName} booking was cancelled after Admin reviewed the provider request. Kaamdaar apologises for the inconvenience.` : `Your ${booking.serviceName} booking remains active. The provider cancellation request was not approved.${note ? ` Admin note: ${note}` : ""}`,
    userId: booking.userId, userName: customer?.firstName || customer?.phone || booking.phone, phone: customer?.phone || booking.phone,
    bookingId, platform: "Booking cancellation review", readAt: null, createdAt: reviewedAt
  });
  await recordAudit({ actor: "admin", action: decision, module: "Bookings", title: `Provider cancellation request ${decision}`, description: bookingId, reference: bookingId });
  return NextResponse.json({ ok: true, booking: updated });
}
