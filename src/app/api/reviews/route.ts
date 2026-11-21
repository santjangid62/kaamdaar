/** POST /api/reviews — one review from each party per completed booking. */
import { NextResponse } from "next/server";
import { all, get, insert, patch, ready, uid } from "../../../server/db";
import { firebaseIdentityFromRequest, normalizeIndianPhone } from "../../../server/firebase-auth";
import type { Booking, Provider, User } from "../../../lib/types";

export async function POST(req: Request) {
  await ready();
  const identity = await firebaseIdentityFromRequest(req);
  if (!identity) return NextResponse.json({ error: "Firebase sign-in is required" }, { status: 401 });
  let body: { bookingId?: string; providerRating?: number; serviceRating?: number; customerRating?: number; text?: string; actorRole?: "customer" | "provider" };
  try { body = await req.json() as typeof body; }
  catch { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }

  const bookingId = String(body.bookingId ?? "");
  const actorRole = body.actorRole === "provider" ? "provider" : "customer";
  if (identity.role !== actorRole) {
    return NextResponse.json({ error: "This device session cannot submit a review for that account role" }, { status: 403 });
  }
  const text = String(body.text ?? "").trim().slice(0, 1000);
  const rating = Number(actorRole === "provider" ? body.customerRating : body.providerRating);
  const serviceRating = Number(body.serviceRating);
  if (!bookingId || !Number.isInteger(rating) || rating < 1 || rating > 5 ||
      (actorRole === "customer" && (!Number.isInteger(serviceRating) || serviceRating < 1 || serviceRating > 5))) {
    return NextResponse.json({ error: "Booking and valid 1–5 star ratings are required" }, { status: 422 });
  }

  const [booking, users, reviews, providers] = await Promise.all([
    get<Booking>("bookings", bookingId),
    all<User>("users"),
    all<{ bookingId: string; reviewerRole?: string }>("reviews"),
    all<Provider>("providers"),
  ]);
  if (!booking || booking.status !== "completed" || !booking.paidAt || !booking.providerId) {
    return NextResponse.json({ error: "Ratings are available after verified work completion and payment" }, { status: 409 });
  }
  if (reviews.some((r) => r.bookingId === bookingId && (r.reviewerRole ?? "customer") === actorRole)) {
    return NextResponse.json({ error: "You have already rated this booking" }, { status: 409 });
  }

  if (actorRole === "customer") {
    const user = users.find((u) => normalizeIndianPhone(u.phone ?? "") === identity.phone);
    if (!user || booking.userId !== user.id) {
      return NextResponse.json({ error: "Booking not found for this customer" }, { status: 404 });
    }
    const provider = providers.find((p) => p.id === booking.providerId);
    if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    const author = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || "Customer";
    const review = await insert("reviews", {
      id: uid("rev"), bookingId, reviewerRole: "customer", userId: user.id, providerId: provider.id,
      serviceId: booking.serviceId, service: booking.serviceName,
      author, name: author, providerRating: rating, serviceRating, rating,
      text, createdAt: Date.now(),
    });
    const providerReviews = [...(provider.reviews ?? []), { author, rating, text }];
    const average = providerReviews.reduce((sum, row) => sum + row.rating, 0) / providerReviews.length;
    await patch<Provider>("providers", provider.id, {
      reviews: providerReviews.slice(-100),
      rating: Math.round(average * 10) / 10,
      reviewCount: providerReviews.length,
    });
    return NextResponse.json({ review }, { status: 201 });
  }

  const provider = providers.find((p) =>
    p.id === booking.providerId && normalizeIndianPhone(p.phone ?? "") === identity.phone
  );
  if (!provider) return NextResponse.json({ error: "Only the assigned provider can rate this customer" }, { status: 403 });
  const customer = users.find((u) => u.id === booking.userId);
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  const customerReviews = (customer as User & { customerReviews?: Array<{ bookingId: string; rating: number; text: string; service: string; providerName: string; createdAt: number }> }).customerReviews ?? [];
  const review = await insert("reviews", {
    id: uid("rev"), bookingId, reviewerRole: "provider", userId: customer.id, providerId: provider.id,
    serviceId: booking.serviceId, service: booking.serviceName,
    author: provider.name, name: provider.name, customerRating: rating, rating,
    text, createdAt: Date.now(),
  });
  const nextCustomerReviews = [...customerReviews, {
    bookingId, rating, text, service: booking.serviceName, providerName: provider.name, createdAt: Date.now(),
  }];
  await patch("users", customer.id, { customerReviews: nextCustomerReviews.slice(-100) });
  return NextResponse.json({ review }, { status: 201 });
}
