import { NextResponse } from "next/server";
import { find, patch, ready } from "../../../server/db";
import type { Provider, User } from "../../../lib/types";
import { firebaseIdentityFromRequest, normalizeIndianPhone } from "../../../server/firebase-auth";
import { isInsideJaipur } from "../../../lib/areas";
import { touchDeviceSession } from "../../../server/device-session";

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
  const sessionLocation = {
    label: location.address || `GPS ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    latitude: lat,
    longitude: lng,
    updatedAt: location.capturedAt,
  };
  if (identity.role === "provider") {
    const providers = await find<Provider & { id: string; phone?: string }>("providers", (p) => normalizeIndianPhone(p.phone ?? "") === identity.phone);
    if (!providers[0]) return NextResponse.json({ error: "Provider account not found" }, { status: 404 });
    if (!isInsideJaipur({ lat, lng })) {
      return NextResponse.json({ error: "Provider location must remain inside Jaipur service areas." }, { status: 422 });
    }
    await patch("providers", providers[0].id, { lat, lng, currentLocation: location, locationUpdatedAt: location.capturedAt });
    if (identity.deviceId) await touchDeviceSession("provider", identity.phone, identity.deviceId, sessionLocation);
    return NextResponse.json({ ok: true, role: "provider", location });
  }
  if (identity.role === "customer") {
    const users = await find<User & { id: string; phone?: string }>("users", (u) => normalizeIndianPhone(u.phone ?? "") === identity.phone);
    if (!users[0]) return NextResponse.json({ error: "Customer account not found" }, { status: 404 });
    await patch("users", users[0].id, { currentLocation: location, locationUpdatedAt: location.capturedAt });
    if (identity.deviceId) await touchDeviceSession("customer", identity.phone, identity.deviceId, sessionLocation);
    return NextResponse.json({ ok: true, role: "customer", location });
  }
  return NextResponse.json({ error: "This device session has no application role" }, { status: 403 });
}
