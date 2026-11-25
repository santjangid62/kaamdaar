import { NextResponse } from "next/server";
import { all, get, insert, patch, ready, uid } from "../../../../../server/db";
import { bearerToken, verifyMobileSuperAdminToken } from "../../../../../lib/super-admin/mobile-auth";
import { debitCommission, getWallet, rechargeWallet, type WalletTxn } from "../../../../../server/wallet";
import { appendEvents, newEvent } from "../../../../../server/events";
import { recordAudit } from "../../../../../server/audit";
import { revokeDeviceSession } from "../../../../../server/device-sessions";
import type { Booking, User, Provider } from "../../../../../lib/types";

const jsonError = (error: string, status = 400) => NextResponse.json({ error }, { status });
async function authorized(req: Request) {
  return verifyMobileSuperAdminToken(bearerToken(req));
}
export async function POST(req: Request) {
  if (!(await authorized(req))) return jsonError("Unauthorized", 401);
  await ready();
  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; } catch { return jsonError("Invalid request body"); }
  const action = String(body.action ?? "");
  const id = String(body.id ?? "").trim();
  const now = Date.now();

  if (action === "account_status") {
    const kind = body.kind === "provider" ? "providers" : body.kind === "admin" ? "adminUsers" : "users";
    const status = body.status === "blocked" ? "blocked" : body.status === "active" ? "active" : "";
    if (!id || !status) return jsonError("id and valid status are required", 422);
    if (kind === "users") {
      const account = await get<User>("users", id);
      if (!account) return jsonError("Customer not found", 404);
      const updated = await patch<User>("users", id, { status, updatedAt: now });
      if (status === "blocked") await revokeDeviceSession("customer", id);
      await insert("notifications", { id: uid("ntf"), type: status === "blocked" ? "customer_account_blocked" : "customer_account_unblocked", title: status === "blocked" ? "Kaamdaar account restricted" : "Your Kaamdaar account is active again", message: status === "blocked" ? "Your account has been restricted by Kaamdaar Admin. Contact support for assistance." : "Your account has been unblocked. You can book services again.", userId: id, userName: account.firstName || "Customer", phone: account.phone || "", platform: "Owner control centre", readAt: null, createdAt: now });
      await recordAudit({ actor: "super_admin", action: "status_changed", module: "Customers", title: `Customer ${status}`, description: id, reference: id });
      return NextResponse.json({ ok: true, record: updated });
    }
    if (kind === "providers") {
      const account = await get<Provider & { status?: string }>("providers", id);
      if (!account) return jsonError("Provider not found", 404);
      const updated = await patch("providers", id, { status, ...(status === "blocked" ? { availabilityStatus: "offline" } : {}), updatedAt: now });
      if (status === "blocked") await revokeDeviceSession("provider", id);
      await recordAudit({ actor: "super_admin", action: "status_changed", module: "Providers", title: `Provider ${status}`, description: id, reference: id });
      return NextResponse.json({ ok: true, record: updated });
    }
    const account = await get<Record<string, unknown>>("adminUsers", id);
    if (!account) return jsonError("Admin account not found", 404);
    const updated = await patch("adminUsers", id, { status, updatedAt: now });
    await recordAudit({ actor: "super_admin", action: "status_changed", module: "Admins", title: `Admin ${status}`, description: id, reference: id });
    return NextResponse.json({ ok: true, record: updated });
  }

  if (action === "complaint_reply") {
    const complaint = await get<Record<string, unknown>>("complaints", id);
    const response = String(body.response ?? "").trim().slice(0, 2000);
    const status = String(body.status ?? "In Review");
    if (!complaint) return jsonError("Complaint not found", 404);
    if (response.length < 3 || !["Open", "In Review", "Escalated", "Resolved"].includes(status)) return jsonError("A response and valid complaint status are required", 422);
    const replies = Array.isArray(complaint.replies) ? complaint.replies as Array<Record<string, unknown>> : [];
    const updated = await patch("complaints", id, { status, adminResponse: response, replies: [...replies, { by: "super_admin", message: response, createdAt: now }], respondedAt: now, updatedAt: now });
    if (complaint.customerId) await insert("notifications", { id: uid("ntf"), type: "customer_complaint_response", title: "Kaamdaar Support replied to your complaint", message: response, userId: complaint.customerId, userName: complaint.customer || "Customer", phone: complaint.customerPhone || "", complaintId: id, platform: "Customer support", readAt: null, createdAt: now });
    await recordAudit({ actor: "super_admin", action: "updated", module: "Complaints", title: "Complaint response sent", description: id, reference: id });
    return NextResponse.json({ ok: true, record: updated });
  }

  if (action === "booking_payment") {
    const booking = await get<Booking>("bookings", id);
    if (!booking) return jsonError("Booking not found", 404);
    const decision = body.decision;
    if (!["reported", "disputed"].includes(booking.paymentStatus ?? "") || !booking.paymentReportedAt) return jsonError("No pending provider payment report exists", 409);
    if (decision !== "verify" && decision !== "dispute") return jsonError("Choose verify or dispute", 422);
    if (decision === "dispute" && booking.paymentStatus !== "reported") return jsonError("Only a new report can be disputed", 409);
    const events = appendEvents(booking.events, [newEvent("admin", decision === "verify" ? "paid" : "payment_disputed", decision === "verify" ? `Admin verified ${booking.paymentMethod?.toUpperCase()} payment` : `Admin disputed provider payment: ${String(body.note ?? "Needs review").slice(0,180)}`)]);
    const updated = await patch<Booking>("bookings", id, decision === "verify" ? { paymentStatus: "verified", paidAt: now, paymentVerifiedAt: now, paymentVerifiedBy: "super_admin", events } : { paymentStatus: "disputed", paymentDisputeNote: String(body.note ?? "Needs review").slice(0,300), events });
    if (decision === "verify" && booking.providerId) {
      const txns = await all<WalletTxn>("walletTxns");
      const commission = Math.max(0, Number(booking.commission ?? 0));
      if (!txns.some(t => t.bookingId === id && t.kind === "commission") && commission > 0) await debitCommission(booking.providerId, commission, `Commission for ${booking.serviceName} · ${id}`, { bookingId: id, service: booking.serviceName, serviceCharge: booking.amount, commission });
    }
    await recordAudit({ actor: "super_admin", action: decision === "verify" ? "approved" : "rejected", module: "Booking payments", title: `Booking payment ${decision}d`, description: id, reference: id });
    return NextResponse.json({ ok: true, record: updated });
  }

  if (action === "provider_payment") {
    const payment = await get<Record<string, unknown>>("providerPayments", id);
    if (!payment) return jsonError("Provider payment request not found", 404);
    if (payment.status !== "pending") return jsonError("Payment request is already closed", 409);
    if (body.decision === "reject") {
      const updated = await patch("providerPayments", id, { status: "rejected" });
      await recordAudit({ actor: "super_admin", action: "rejected", module: "Provider payments", title: "Provider payment rejected", description: id, reference: id });
      return NextResponse.json({ ok: true, record: updated, mode: payment.demo === true ? "demo" : "live" });
    }
    if (body.decision !== "verify" || String(body.otp ?? "") !== String(payment.otp ?? "")) return jsonError("Correct payment verification OTP is required", 422);
    if (payment.demo !== true) return jsonError("This payment requires the configured live payment gateway verification workflow", 409);
    const txns = await all<WalletTxn>("walletTxns");
    if (!txns.some(t => t.paymentId === id && t.kind === "recharge")) await rechargeWallet(String(payment.providerId), Number(payment.amount), id);
    const updated = await patch("providerPayments", id, { status: "verified", verifiedAt: now });
    await recordAudit({ actor: "super_admin", action: "approved", module: "Provider payments", title: "Demo provider payment verified", description: id, reference: id });
    return NextResponse.json({ ok: true, record: updated, wallet: await getWallet(String(payment.providerId)), mode: "demo" });
  }

  if (action === "payout_mark_paid") {
    const payout = await get<Record<string, unknown>>("payouts", id);
    if (!payout) return jsonError("Payout record not found", 404);
    if (String(payout.status ?? "") !== "Processing") return jsonError("Only Processing payouts can be marked Paid", 409);
    const reference = String(body.reference ?? "").trim().slice(0, 120);
    if (reference.length < 6) return jsonError("Enter a valid bank / UPI transaction reference (minimum 6 characters)", 422);
    const updated = await patch("payouts", id, { status: "Paid", paidAt: now, paymentReference: reference, paidBy: "super_admin" });
    await recordAudit({ actor: "super_admin", action: "approved", module: "Payouts", title: "Payout marked Paid", description: `${id}; reference=${reference}`, reference: id });
    return NextResponse.json({ ok: true, record: updated, note: "This records a manually completed transfer; it does not initiate a bank transfer." });
  }
  return jsonError("Unsupported owner action", 404);
}
