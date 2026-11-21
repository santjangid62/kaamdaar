import { NextResponse } from "next/server";
import { find, patch, ready } from "../../../../server/db";
import type { Provider } from "../../../../lib/types";
import { firebaseIdentityFromRequest, normalizeIndianPhone } from "../../../../server/firebase-auth";

export async function POST(req: Request) {
  await ready();
  let body: { providerId?: string; token?: string; platform?: string };
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
  let verifiedPhone: string;
  const requestIdentity = await firebaseIdentityFromRequest(req);
  if (!requestIdentity) {
    return NextResponse.json({ error: "A valid authorized device session is required to register notifications" }, { status: 401 });
  }
  verifiedPhone = requestIdentity.phone;

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
