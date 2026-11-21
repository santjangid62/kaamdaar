import { NextResponse } from "next/server";
import { normalizeIndianPhone, verifyFirebasePhoneToken } from "../../../../../server/firebase-auth";
import { consumeWebPairingCode, type DeviceRole } from "../../../../../server/device-session";

export async function POST(req: Request) {
  let body: { idToken?: string; code?: string; role?: string };
  try { body = await req.json() as typeof body; }
  catch { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }

  if (!body.idToken || (body.role !== "customer" && body.role !== "provider")) {
    return NextResponse.json({ error: "Verified phone token and account role are required" }, { status: 400 });
  }

  let identity: { phone: string; uid: string };
  try { identity = await verifyFirebasePhoneToken(body.idToken); }
  catch { return NextResponse.json({ error: "Phone verification expired. Please verify your number again." }, { status: 401 }); }

  const phone = normalizeIndianPhone(identity.phone);
  const token = await consumeWebPairingCode(body.role as DeviceRole, phone, (body.code ?? "").trim());
  if (!token) {
    return NextResponse.json({ error: "Pairing code is invalid, expired, or already used. Generate a new code in the Kaamdaar app." }, { status: 401 });
  }

  const response = NextResponse.json({ paired: true });
  response.cookies.set("kaamdaar_device_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api",
    maxAge: 90 * 24 * 60 * 60,
  });
  return response;
}
