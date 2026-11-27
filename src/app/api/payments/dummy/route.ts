import { NextResponse } from "next/server";
import { all, get, insert, patch, ready, uid } from "../../../../server/db";
import { firebaseIdentityFromRequest, normalizeIndianPhone } from "../../../../server/firebase-auth";
import { isAuthed } from "../../../../lib/admin/auth";
import type { Booking } from "../../../../lib/types";

const METHODS = ["cash", "upi"] as const;
const GATEWAYS = ["phonepe", "razorpay", "paytm", "other"] as const;
const STATES = ["success", "failed", "pending"] as const;

export async function POST(req: Request) {
  await ready();
  const admin = await isAuthed();
  const identity = admin ? null : await firebaseIdentityFromRequest(req);
  if (!admin && !identity) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  let body: { bookingId?: string; method?: string; gateway?: string; outcome?: string; reference?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }
  const bookingId = String(body.bookingId ?? "");
  const booking = await get<Booking>("bookings", bookingId);
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (identity) {
    const users = await all<{ id: string; phone?: string; status?: string }>("users");
    const user = users.find((u) => u.id === booking.userId && normalizeIndianPhone(u.phone ?? "") === identity.phone);
    if (!user || user.status === "blocked" || user.status === "deleted") return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  if (booking.status !== "completed") return NextResponse.json({ error: "Payment can be tested only after customer confirms service completion" }, { status: 409 });
  const method = String(body.method ?? "");
  const gateway = String(body.gateway ?? "other");
  const outcome = String(body.outcome ?? "success");
  if (!METHODS.includes(method as typeof METHODS[number])) return NextResponse.json({ error: "Select Cash or UPI" }, { status: 422 });
  if (!GATEWAYS.includes(gateway as typeof GATEWAYS[number])) return NextResponse.json({ error: "Unsupported dummy gateway" }, { status: 422 });
  if (!STATES.includes(outcome as typeof STATES[number])) return NextResponse.json({ error: "Invalid test outcome" }, { status: 422 });
  if (booking.paymentStatus === "verified") return NextResponse.json({ error: "Payment already finalized" }, { status: 409 });
  const reference = String(body.reference ?? "").trim().slice(0, 100) || `DUMMY-${uid("txn").toUpperCase()}`;
  const timestamp = Date.now();
  const isSuccess = outcome === "success";
  const record = await insert("providerPayments", {
    id: uid("dummy_payment"), bookingId, providerId: booking.providerId, userId: booking.userId,
    amount: Number(booking.amount), method, gateway: method === "cash" ? "cash" : gateway,
    reference, status: outcome, state: outcome.toUpperCase(),
    environment: "dummy", dummy: true, verificationSource: "mock_simulator",
    createdAt: timestamp, verifiedAt: isSuccess ? timestamp : null,
  });
  const updated = await patch<Booking>("bookings", bookingId, {
    paymentMethod: method,
    paymentGateway: method === "cash" ? "cash" : gateway,
    paymentReference: reference,
    paymentStatus: outcome === "failed" ? "disputed" : "reported",
    paymentReportedAt: timestamp,
    paymentReportedBy: admin ? "admin_dummy_test" : booking.providerId,
    paymentEnvironment: "dummy",
  });
  if (isSuccess && booking.providerId) {
    await insert("notifications", {
      id: uid("ntf"), type: "booking_payment_report",
      title: "Dummy payment scenario recorded (Test only)",
      message: `Dummy ${outcome.toUpperCase()} ${method.toUpperCase()} payment scenario of ₹${booking.amount} recorded for booking ${booking.id}. No real payment is verified.`,
      userId: booking.userId, userName: booking.providerName || "Provider", phone: "",
      platform: "Dummy payment test", bookingId, readAt: null, createdAt: timestamp,
    });
  }
  return NextResponse.json({
    environment: "dummy",
    warning: "TEST ONLY — no money was transferred and no gateway was contacted.",
    payment: record,
    booking: updated,
  }, { status: 201 });
}
