import { NextResponse } from "next/server";
import { firebaseIdentityFromRequest } from "../../../../../server/firebase-auth";
import { createDevicePairingCode } from "../../../../../server/device-sessions";

export async function POST(req: Request) {
  const identity = await firebaseIdentityFromRequest(req);
  if (!identity?.role || !identity.accountId || !identity.sessionId) {
    return NextResponse.json({ error: "Sign in to the Kaamdaar app before pairing this browser." }, { status: 401 });
  }
  const pairing = await createDevicePairingCode(identity.role, identity.accountId, identity.sessionId);
  if (!pairing) return NextResponse.json({ error: "Device session is no longer active. Sign in again." }, { status: 401 });
  return NextResponse.json({ code: pairing.code, expiresAt: pairing.expiresAt });
}
