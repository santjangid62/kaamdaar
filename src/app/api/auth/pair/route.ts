import { NextResponse } from "next/server";
import { consumeDevicePairingCodeAndCreateWebToken } from "../../../../server/device-sessions";

export async function POST(req: Request) {
  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Enter the six-digit code shown in your Kaamdaar app." }, { status: 400 });
  }
  const paired = await consumeDevicePairingCodeAndCreateWebToken((body.code ?? "").trim());
  if (!paired) {
    return NextResponse.json({ error: "Pairing code is invalid, expired, or already used. Generate a new code in your Kaamdaar app." }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true, role: paired.session.role, phone: paired.session.phone });
  response.cookies.set({
    name: "kaamdaar_session",
    value: paired.token,
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 60 * 60,
  });
  return response;
}
