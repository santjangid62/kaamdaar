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
  if (!identity?.role || !identity.deviceId) {
    return NextResponse.json({ error: "A valid device session is required" }, { status: 401 });
  }
  const released = await releaseDeviceSession(identity.role, identity.phone, identity.deviceId);
  const response = NextResponse.json({ released });
  response.cookies.delete({ name: "kaamdaar_device_session", path: "/api" });
  return response;
}
