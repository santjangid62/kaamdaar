import { NextResponse } from "next/server";
import { all, patch, ready } from "../../../../server/db";
import { minWallet } from "../../../../server/settings";
import { recordAudit } from "../../../../server/audit";
import { firebaseIdentityFromRequest, normalizeIndianPhone } from "../../../../server/firebase-auth";
import { isInsideJaipur } from "../../../../lib/areas";
import type { Booking, Provider } from "../../../../lib/types";

export async function POST(req: Request) {
  await ready();
  const identity = await firebaseIdentityFromRequest(req);
  if (!identity) return NextResponse.json({ error: "Firebase sign-in is required" }, { status: 401 });

  let body: { online?: unknown };
  try { body = await req.json() as typeof body; }
  catch { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }
  if (typeof body.online !== "boolean") {
    return NextResponse.json({ error: "online must be true or false" }, { status: 422 });
  }

  const providers = await all<Provider & { kycStatus?: string; status?: string; phone?: string }>("providers");
  const provider = providers.find((p) => normalizeIndianPhone(p.phone ?? "") === identity.phone);
  if (!provider) return NextResponse.json({ error: "Provider account not found" }, { status: 404 });
  if (provider.status === "blocked") return NextResponse.json({ error: "This provider account is blocked" }, { status: 403 });

  if (body.online) {
    if (provider.kycStatus !== "Verified") {
      return NextResponse.json({ error: "Admin KYC verification is required before going Online" }, { status: 403 });
    }
    if (!(provider.services ?? []).length) {
      return NextResponse.json({ error: "Choose at least one service before going Online" }, { status: 422 });
    }
    if (!isInsideJaipur(provider)) {
      return NextResponse.json({ error: "A valid Jaipur provider location is required before going Online" }, { status: 422 });
    }
    const [wallets, bookings] = await Promise.all([
      all<{ providerId: string; balance: number }>("wallets"),
      all<Booking>("bookings"),
    ]);
    const required = await minWallet();
    const balance = wallets.find((w) => w.providerId === provider.id)?.balance ?? 0;
    if (balance < required) {
      return NextResponse.json({ error: `Minimum wallet balance ₹${required} is required to receive jobs (current ₹${balance})` }, { status: 409 });
    }
    const busy = bookings.some((b) => b.providerId === provider.id &&
      ["accepted", "enroute", "arrived", "in_progress"].includes(b.status));
    if (provider.activeBookingId || busy) {
      return NextResponse.json({ error: "Complete your active job before changing availability" }, { status: 409 });
    }
  }

  const now = Date.now();
  const status = body.online ? "Online" : "Offline";
  const updated = await patch<Provider & { status?: string }>("providers", provider.id, {
    status,
    availabilityStatus: provider.activeBookingId ? "busy" : "available",
    availabilityUpdatedAt: now,
  });
  if (!updated) return NextResponse.json({ error: "Provider record could not be updated" }, { status: 500 });

  const userAgent = req.headers.get("user-agent") ?? "unknown";
  const ipAddress = (req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "").split(",")[0].trim() || "unknown";
  await recordAudit({
    actor: "provider",
    action: "status_changed",
    module: "Provider Availability",
    title: body.online ? "Provider went Online" : "Provider went Offline",
    description: `${provider.name} changed availability to ${status}`,
    reference: provider.id,
    severity: "info",
    metadata: {
      providerId: provider.id,
      platform: req.headers.get("x-kaamdaar-platform") ?? "unknown",
      device: /android/i.test(userAgent) ? "Android" : /iphone|ipad|ios/i.test(userAgent) ? "iOS" : "Browser",
      ipAddress,
      userAgent: userAgent.slice(0, 240),
      status,
      latitude: provider.lat,
      longitude: provider.lng,
      occurredAt: now,
    },
  });

  return NextResponse.json({ provider: updated });
}
