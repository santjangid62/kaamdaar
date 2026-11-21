import { NextResponse } from "next/server";
import { firebaseIdentityFromRequest } from "../../../../server/firebase-auth";
import { createWebPairingCode } from "../../../../server/device-session";

export async function POST(req: Request) {
  const identity = await firebaseIdentityFromRequest(req, { requireDeviceSession: true });
  if (!identity?.role || !identity.deviceId || identity.clientType !== "native") {
    return NextResponse.json({ error: "Pairing codes can only be created from the authorized native app" }, { status: 403 });
  }
  try {
    const result = await createWebPairingCode(identity.role, identity.phone, identity.deviceId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create pairing code" },
      { status: 409 },
    );
  }
}
