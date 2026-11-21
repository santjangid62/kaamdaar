import { NextResponse } from "next/server";
import { firebaseIdentityFromRequest } from "../../../../server/firebase-auth";
import { releaseDeviceSession } from "../../../../server/device-session";

export async function GET(req: Request) {
  const identity = await firebaseIdentityFromRequest(req, { requireDeviceSession: true });
  if (!identity?.role || !identity.deviceId) {
    return NextResponse.json({ valid: false, error: "A valid device session is required" }, { status: 401 });
  }
  return NextResponse.json({
    valid: true,
    role: identity.role,
    deviceId: identity.deviceId,
    sessionId: identity.sessionId,
  });
}

export async function POST(req: Request) {
  const identity = await firebaseIdentityFromRequest(req, { requireDeviceSession: true });
  // A browser logout clears only that browser cookie. The native app
  // owns the device lock; releasing it invalidates every paired browser.
  const released = identity?.clientType === "native" && identity.role && identity.deviceId
    ? await releaseDeviceSession(identity.role, identity.phone, identity.deviceId)
    : false;
  const response = NextResponse.json({ released });
  response.cookies.set("kaamdaar_device_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api",
    maxAge: 0,
  });
  return response;
}
