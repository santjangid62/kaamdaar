import { NextResponse } from "next/server";
import { all, patch, ready } from "../../../../server/db";
import type { Provider } from "../../../../lib/types";

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

  const provider = (await all<Provider & { fcmTokens?: string[] }>("providers"))
    .find((item) => item.id === providerId);
  if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 });

  const tokens = (provider.fcmTokens ?? []).filter((value) => value !== token);
  tokens.push(token);
  await patch("providers", providerId, { fcmTokens: tokens.slice(-5), fcmPlatform: body.platform ?? "android" });
  return NextResponse.json({ ok: true });
}
