import { NextResponse } from "next/server";
import { firebaseIdentityFromRequest } from "../../../../server/firebase-auth";
import { revokeDeviceSession, type AccountRole } from "../../../../server/device-sessions";

export async function GET(req: Request) {
  const identity = await firebaseIdentityFromRequest(req);
  if (!identity?.role || !identity.accountId || !identity.sessionId) {
    return NextResponse.json({ error: "A valid device session is required" }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    role: identity.role,
    accountId: identity.accountId,
    deviceId: identity.deviceId,
  });
}

export async function DELETE(req: Request) {
  const identity = await firebaseIdentityFromRequest(req);
  if (!identity?.role || !identity.accountId) {
    return NextResponse.json({ error: "A valid device session is required" }, { status: 401 });
  }
  await revokeDeviceSession(identity.role as AccountRole, identity.accountId);
  return NextResponse.json({ ok: true });
}
