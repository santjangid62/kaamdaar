import { NextResponse } from "next/server";
import { find, patch, ready } from "../../../server/db";
import type { Provider, User } from "../../../lib/types";
import { firebaseIdentityFromRequest } from "../../../server/firebase-auth";

export async function POST(request: Request) {
  const identity = await firebaseIdentityFromRequest(request);
  if (!identity) return NextResponse.json({ error: "A valid signed-in session is required" }, { status: 401 });
  let body: { latitude?: number; longitude?: number; accuracy?: number; address?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid location payload" }, { status: 400 });
  }
  const lat = Number(body.latitude), lng = Number(body.longitude), accuracy = Number(body.accuracy);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    return NextResponse.json({ error: "Valid latitude and longitude are required" }, { status: 422 });
  }
  await ready();
  const location = {
    latitude: lat, longitude: lng,
    accuracy: Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null,
    address: typeof body.address === "string" ? body.address.slice(0, 500) : "",
    capturedAt: Date.now(),
  };
  const providers = await find<Provider & { id: string; phone?: string }>("providers", (p) => p.phone === identity.phone);
  if (providers[0]) {
    await patch("providers", providers[0].id, { currentLocation: location, locationUpdatedAt: location.capturedAt });
    return NextResponse.json({ ok: true, role: "provider", location });
  }
  const users = await find<User & { id: string; phone?: string }>("users", (u) => u.phone === identity.phone);
  if (users[0]) {
    await patch("users", users[0].id, { currentLocation: location, locationUpdatedAt: location.capturedAt });
    return NextResponse.json({ ok: true, role: "customer", location });
  }
  return NextResponse.json({ error: "No account is linked to this signed-in phone" }, { status: 404 });
}
