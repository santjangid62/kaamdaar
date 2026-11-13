/** POST /api/reviews — one verified customer review per paid booking. */
import { NextResponse } from "next/server";
import { all, get, insert, patch, ready, uid } from "../../../../server/db";
import { firebaseIdentityFromRequest, normalizeIndianPhone } from "../../../../server/firebase-auth";
import type { Booking, Provider, User } from "../../../../lib/types";

export async function POST(req: Request) {
  await ready();
  const identity = await firebaseIdentityFromRequest(req);
  if (!identity) return NextResponse.json({ error: "Firebase sign-in is required" }, { status: 401 });
  let body: { bookingId?: string; providerRating?: number; serviceRating?: number; text?: string };
  try { body = await req.json() as typeof body; }
  catch { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }

  const bookingId = String(body.bookingId ?? "");
  const providerRating = Number(body.providerRating);
  const serviceRating = Number(body.serviceRating);
  const text = String(body.text ?? "").trim().slice(0, 1000);
  if (!bookingId || !Number.isInteger(providerRating) || providerRating < 1 || providerRating > 5 ||
      !Number.isInteger(serviceRating) || serviceRating < 1 || serviceRating > 5) {
    return NextResponse.json({ error: "Booking and both 1–5 star ratings are required" }, { status: 422 });
  }

  const [booking, users, reviews, providers] = await Promise.all([
    get<Booking>("bookings", bookingId),
    all<User>("users"),
    all<{ bookingId: string }>("reviews"),
    all<Provider>("providers"),
  ]);
  const user = users.find((u) => normalizeIndianPhone(u.phone ?? "") === identity.phone);
  if (!booking || !user || booking.userId !== user.id) {
    return NextResponse.json({ error: "Booking not found for this customer" }, { status: 404 });
  }
  if (booking.status !== "completed" || !booking.paidAt || !booking.providerId) {
    return NextResponse.json({ error: "Review is available after verified work completion and payment" }, { status: 409 });
  }
  if (reviews.some((r) => r.bookingId === bookingId)) {
    return NextResponse.json({ error: "This booking has already been reviewed" }, { status: 409 });
  }
  const provider = providers.find((p) => p.id === booking.providerId);
  if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 });

  const author = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || "Customer";
  const review = await insert("reviews", {
    id: uid("rev"), bookingId, userId: user.id, providerId: provider.id,
    serviceId: booking.serviceId, service: booking.serviceName,
    author, name: author, providerRating, serviceRating, rating: providerRating,
    text, createdAt: Date.now(),
  });
  const providerReviews = [...(provider.reviews ?? []), { author, rating: providerRating, text }];
  const rating = providerReviews.reduce((sum, row) => sum + row.rating, 0) / providerReviews.length;
  await patch<Provider>("providers", provider.id, {
    reviews: providerReviews.slice(-100),
    rating: Math.round(rating * 10) / 10,
    reviewCount: providerReviews.length,
  });
  return NextResponse.json({ review }, { status: 201 });
}
