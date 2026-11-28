/** POST /api/reviews — one review from each party per completed booking. */
import { NextResponse } from "next/server";
import { all, get, insert, patch, ready } from "../../../server/db";
import { firebaseIdentityFromRequest, normalizeIndianPhone } from "../../../server/firebase-auth";
import type { Booking, Provider, User } from "../../../lib/types";

async function insertReviewOnce(doc: Record<string, unknown>) {
  try {
    return await insert("reviews", doc);
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code === 11000 || String(error).includes("duplicate id")) return null;
    throw error;
  }
}


export async function GET(req: Request) {
  await ready();
  const identity = await firebaseIdentityFromRequest(req);
  if (!identity) return NextResponse.json({ error: "Firebase sign-in is required" }, { status: 401 });
  const [users, providers, reviews] = await Promise.all([
    all<User>("users"), all<Provider>("providers"),
    all<Record<string, unknown> & { reviewerRole?: string; userId?: string; providerId?: string }>("reviews"),
  ]);
  const user = users.find((u) => normalizeIndianPhone(u.phone ?? "") === identity.phone);
  const provider = providers.find((p) => normalizeIndianPhone(p.phone ?? "") === identity.phone);
  if (provider) return NextResponse.json({
    reviews: reviews.filter((r) => r.reviewerRole === "customer" && r.providerId === provider.id),
    authoredReviews: reviews.filter((r) => r.reviewerRole === "provider" && r.providerId === provider.id),
  });
  if (user) return NextResponse.json({ reviews: reviews.filter((r) => r.reviewerRole === "customer" && r.userId === user.id) });
  return NextResponse.json({ error: "Account not found" }, { status: 404 });
}

export async function PATCH(req: Request) {
  await ready();
  const identity = await firebaseIdentityFromRequest(req);
  if (!identity) return NextResponse.json({ error: "Firebase sign-in is required" }, { status: 401 });
  let body: { bookingId?: string; actorRole?: "customer" | "provider"; providerRating?: number; serviceRating?: number; customerRating?: number; text?: string };
  try { body = await req.json() as typeof body; }
  catch { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }
  const bookingId = String(body.bookingId ?? "");
  const actorRole = body.actorRole === "provider" ? "provider" : "customer";
  const rating = Number(actorRole === "provider" ? body.customerRating : body.providerRating);
  const serviceRating = Number(body.serviceRating);
  const text = String(body.text ?? "").trim().slice(0, 1000);
  if (!bookingId || !Number.isInteger(rating) || rating < 1 || rating > 5 ||
      (actorRole === "customer" && (!Number.isInteger(serviceRating) || serviceRating < 1 || serviceRating > 5))) {
    return NextResponse.json({ error: "Booking and valid 1–5 star ratings are required" }, { status: 422 });
  }
  const [booking, users, providers, review] = await Promise.all([
    get<Booking>("bookings", bookingId), all<User>("users"), all<Provider>("providers"),
    get<Record<string, unknown> & { reviewerRole?: string; editCount?: number; userId?: string; providerId?: string }>("reviews", "review_" + bookingId + "_" + actorRole),
  ]);
  if (!booking || booking.status !== "completed" || !booking.paidAt || !review || review.reviewerRole !== actorRole) {
    return NextResponse.json({ error: "Review not found or booking is not eligible" }, { status: 404 });
  }
  if ((Number(review.editCount) || 0) >= 1) return NextResponse.json({ error: "This review has already used its one allowed edit" }, { status: 409 });
  if (actorRole === "customer") {
    const user = users.find((u) => normalizeIndianPhone(u.phone ?? "") === identity.phone);
    if (!user || review.userId !== user.id || booking.userId !== user.id) return NextResponse.json({ error: "Not your review" }, { status: 403 });
  } else {
    const provider = providers.find((p) => p.id === booking.providerId && normalizeIndianPhone(p.phone ?? "") === identity.phone);
    if (!provider || review.providerId !== provider.id) return NextResponse.json({ error: "Not your review" }, { status: 403 });
  }
  const updated = await patch("reviews", "review_" + bookingId + "_" + actorRole, {
    ...(actorRole === "customer" ? { providerRating: rating, rating, serviceRating } : { customerRating: rating, rating }),
    text, editCount: 1, editedAt: Date.now(),
  });
  if (actorRole === "customer") {
    const provider = providers.find((p) => p.id === booking.providerId);
    if (provider) {
      const rows = await all<Record<string, unknown> & { providerId?: string; reviewerRole?: string; rating?: number; author?: string; text?: string }>("reviews");
      const own = rows.filter((r) => r.providerId === provider.id && r.reviewerRole === "customer");
      const average = own.length ? own.reduce((sum, r) => sum + Number(r.rating ?? 0), 0) / own.length : 0;
      await patch<Provider>("providers", provider.id, {
        reviews: own.slice(-100).map((r) => ({ author: r.author ?? "Customer", rating: Number(r.rating ?? 0), text: r.text ?? "" })),
        rating: Math.round(average * 10) / 10, reviewCount: own.length,
      });
    }
  }
  return NextResponse.json({ review: updated });
}

export async function POST(req: Request) {
  await ready();
  const identity = await firebaseIdentityFromRequest(req);
  if (!identity) return NextResponse.json({ error: "Firebase sign-in is required" }, { status: 401 });
  let body: { bookingId?: string; providerRating?: number; serviceRating?: number; customerRating?: number; text?: string; actorRole?: "customer" | "provider" };
  try { body = await req.json() as typeof body; }
  catch { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }

  const bookingId = String(body.bookingId ?? "");
  const actorRole = body.actorRole === "provider" ? "provider" : "customer";
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
    const review = await insertReviewOnce({
      // A deterministic document id makes simultaneous retries idempotent in MongoDB.
      id: "review_" + bookingId + "_customer", bookingId, reviewerRole: "customer", userId: user.id, providerId: provider.id,
      serviceId: booking.serviceId, service: booking.serviceName,
      author, name: author, providerRating: rating, serviceRating, rating,
      text, editCount: 0, createdAt: Date.now(),
    });
    if (!review) return NextResponse.json({ error: "You have already rated this booking" }, { status: 409 });
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
  const review = await insertReviewOnce({
    // Keep the provider's review independently idempotent from the customer's.
    id: "review_" + bookingId + "_provider", bookingId, reviewerRole: "provider", userId: customer.id, providerId: provider.id,
    serviceId: booking.serviceId, service: booking.serviceName,
    author: provider.name, name: provider.name, customerRating: rating, rating,
    text, createdAt: Date.now(),
  });
  if (!review) return NextResponse.json({ error: "You have already rated this booking" }, { status: 409 });
  const nextCustomerReviews = [...customerReviews, {
    bookingId, rating, text, service: booking.serviceName, providerName: provider.name, createdAt: Date.now(),
  }];
  await patch("users", customer.id, { customerReviews: nextCustomerReviews.slice(-100) });
  return NextResponse.json({ review }, { status: 201 });
}
