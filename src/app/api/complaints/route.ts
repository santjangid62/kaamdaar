import { NextResponse } from "next/server";
import { all, get, insert, ready, uid } from "../../../server/db";
import { firebaseIdentityFromRequest, normalizeIndianPhone } from "../../../server/firebase-auth";
import type { Booking, User } from "../../../lib/types";

type EvidenceInput = { name?: string; dataUrl?: string };

export async function GET(req: Request) {
  await ready();
  const identity = await firebaseIdentityFromRequest(req);
  if (!identity || identity.role !== "customer") return NextResponse.json({ error: "A valid Customer device session is required" }, { status: 401 });
  const users = await all<User>("users");
  const customer = users.find((u) => normalizeIndianPhone(u.phone ?? "") === identity.phone);
  if (!customer) return NextResponse.json({ error: "Customer account not found" }, { status: 404 });
  const rows = await all<Record<string, unknown> & { customerId?: string; attachments?: Array<{ name: string; mimeType: string; size: number }> }>("complaints");
  const complaints = rows.filter((row) => row.customerId === customer.id).map((row) => ({
    ...row,
    attachments: (row.attachments ?? []).map(({ name, mimeType, size }) => ({ name, mimeType, size })),
  }));
  return NextResponse.json({ complaints });
}

export async function POST(req: Request) {
  await ready();
  const identity = await firebaseIdentityFromRequest(req);
  if (!identity) return NextResponse.json({ error: "Firebase sign-in is required" }, { status: 401 });

  let body: { bookingId?: string; issue?: string; attachments?: EvidenceInput[] };
  try { body = await req.json() as typeof body; }
  catch { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }

  const issue = String(body.issue ?? "").trim().slice(0, 3000);
  if (issue.length < 10) return NextResponse.json({ error: "Please describe the issue in at least 10 characters." }, { status: 422 });
  const users = await all<User>("users");
  const customer = users.find((u) => normalizeIndianPhone(u.phone ?? "") === identity.phone);
  if (!customer) return NextResponse.json({ error: "Customer account not found" }, { status: 404 });

  const bookingId = String(body.bookingId ?? "").trim();
  let booking: Booking | null = null;
  if (bookingId) {
    booking = await get<Booking>("bookings", bookingId);
    if (!booking || booking.userId !== customer.id) return NextResponse.json({ error: "Booking not found for this customer" }, { status: 404 });
  }

  const rawAttachments = Array.isArray(body.attachments) ? body.attachments : [];
  if (rawAttachments.length > 3) return NextResponse.json({ error: "Maximum 3 evidence files are allowed." }, { status: 422 });
  const attachments = [];
  for (const file of rawAttachments) {
    const dataUrl = String(file.dataUrl ?? "");
    const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp)|application\/pdf);base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return NextResponse.json({ error: "Evidence must be JPG, PNG, WEBP or PDF." }, { status: 422 });
    const size = Math.floor(match[2].length * 3 / 4);
    if (size > 1_500_000) return NextResponse.json({ error: "Each evidence file must be 1.5 MB or smaller." }, { status: 413 });
    attachments.push({ name: String(file.name ?? "evidence").slice(0, 120), mimeType: match[1], data: match[2], size });
  }

  const id = uid("cmp");
  const now = Date.now();
  const customerName = [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim() || customer.phone;
  const complaint = await insert("complaints", {
    id, customer: customerName, customerId: customer.id, customerPhone: customer.phone,
    provider: booking?.providerName || "—", providerId: booking?.providerId || "",
    issue, booking: booking?.id || "—", bookingId: booking?.id || "",
    status: "Open", adminResponse: "", attachments, replies: [], createdAt: now, updatedAt: now,
  });
  await insert("notifications", {
    id: uid("ntf"), type: "customer_complaint_created",
    title: "New customer complaint",
    message: `${customerName} (${customer.phone}) raised a support ticket ${id}. ${booking ? `Booking: ${booking.id}. Service: ${booking.serviceName}.` : "No booking reference supplied."} Evidence files: ${attachments.length}.`,
    userId: "admin", userName: customerName, phone: customer.phone,
    bookingId: booking?.id || "", complaintId: id, platform: "Customer support", readAt: null, createdAt: now,
  });
  return NextResponse.json({ ok: true, complaint: { id, status: "Open", createdAt: now, evidenceCount: attachments.length } }, { status: 201 });
}
