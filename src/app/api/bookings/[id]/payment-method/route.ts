import { NextResponse } from "next/server";
import { all, get, patch, ready } from "../../../../../server/db";
import { firebaseIdentityFromRequest, normalizeIndianPhone } from "../../../../../server/firebase-auth";
import type { Booking } from "../../../../../lib/types";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await ready();
  const identity = await firebaseIdentityFromRequest(req);
  if (!identity) return NextResponse.json({ error: "Firebase sign-in is required" }, { status: 401 });
  const { id } = await ctx.params;
  const booking = await get<Booking>("bookings", id);
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  const users = await all<{ id: string; phone?: string; status?: string }>("users");
  const user = users.find((u) => u.id === booking.userId && normalizeIndianPhone(u.phone ?? "") === identity.phone);
  if (!user || user.status === "blocked" || user.status === "deleted") return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  if (booking.status !== "completed" || booking.paymentStatus === "verified" || booking.paymentReportedAt) {
    return NextResponse.json({ error: "Payment method can be selected only after work completion and before collection is reported" }, { status: 409 });
  }
  let body: { method?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }
  if (body.method !== "cash" && body.method !== "upi") return NextResponse.json({ error: "Choose Cash or UPI" }, { status: 422 });
  const updated = await patch<Booking>("bookings", id, { paymentMethod: body.method, paymentStatus: "unpaid" });
  return NextResponse.json({ booking: updated, message: "Payment method saved. Please pay the provider directly." });
}
