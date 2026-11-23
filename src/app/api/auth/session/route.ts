import { NextResponse } from "next/server";
import { firebaseIdentityFromRequest } from "../../../../server/firebase-auth";
import { revokeDeviceSession, type AccountRole } from "../../../../server/device-sessions";

export async function GET(req: Request) {
  const identity = await firebaseIdentityFromRequest(req);
  if (!identity?.role || !identity.accountId) {
    return NextResponse.json({ error: "A valid device session is required" }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    role: identity.role,
    accountId: identity.accountId,
    phone: identity.phone,
    deviceId: identity.deviceId,
  });
}

export async function DELETE(req: Request) {
  const identity = await firebaseIdentityFromRequest(req);
  if (req.headers.get("x-kaamdaar-client") === "mobile") {
    if (!identity?.role || !identity.accountId) {
      return NextResponse.json({ error: "A valid device session is required" }, { status: 401 });
    }
    await revokeDeviceSession(identity.role as AccountRole, identity.accountId);
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set({ name: "kaamdaar_session", value: "", httpOnly: true, secure: process.env.NODE_ENV !== "development", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
