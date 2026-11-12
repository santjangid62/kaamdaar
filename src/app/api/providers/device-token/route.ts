import { NextResponse } from "next/server";
import { find, patch, ready } from "../../../../server/db";
import type { Provider } from "../../../../lib/types";
import { normalizeIndianPhone, verifyFirebasePhoneToken } from "../../../../server/firebase-auth";

export async function POST(req: Request) {
  await ready();
  let body: { providerId?: string; token?: string; platform?: string; idToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const providerId = (body.providerId ?? "").trim();
  const token = (body.token ?? "").trim();
  if (!providerId || token.length < 40 || token.length > 4096) {
    return NextResponse.json({ error: "Valid providerId and FCM token are required" }, { status: 422 });
  }
  if (!body.idToken) {
    return NextResponse.json({ error: "Firebase sign-in is required to register a device" }, { status: 401 });
  }

  let verifiedPhone: string;
  try {
    ({ phone: verifiedPhone } = await verifyFirebasePhoneToken(body.idToken));
  } catch {
    return NextResponse.json({ error: "Firebase phone verification failed" }, { status: 401 });
  }

  const matches = await find<Provider & { id: string; phone?: string; status?: string; fcmTokens?: string[] }>(
    "providers",
    (item) => item.id === providerId && normalizeIndianPhone(item.phone ?? "") === verifiedPhone,
  );
  const provider = matches[0];
  if (!provider) return NextResponse.json({ error: "Provider identity does not match this account" }, { status: 403 });
  if (provider.status === "blocked") {
    return NextResponse.json({ error: "This provider account is blocked" }, { status: 403 });
  }

  const tokens = (provider.fcmTokens ?? []).filter((value) => value !== token);
  tokens.push(token);
  await patch("providers", providerId, {
    fcmTokens: tokens.slice(-5),
    fcmPlatform: body.platform === "ios" ? "ios" : "android",
  });
  return NextResponse.json({ ok: true });
}
