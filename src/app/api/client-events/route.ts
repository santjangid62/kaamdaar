import { NextResponse } from "next/server";
import { recordAudit } from "../../../server/audit";

const WINDOW_MS = 60_000;
const MAX_EVENTS_PER_WINDOW = 20;
const recentByIp = new Map<string, { startedAt: number; count: number }>();

/**
 * Receives safe client-side diagnostic events that happen before Firebase
 * finishes authentication. Never persist OTPs, passwords, ID tokens or full
 * phone numbers here.
 */
export async function POST(req: Request) {
  const ipAddress = (req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "").split(",")[0].trim() || "unknown";
  const now = Date.now();
  const current = recentByIp.get(ipAddress);
  if (current && now - current.startedAt < WINDOW_MS && current.count >= MAX_EVENTS_PER_WINDOW) {
    return NextResponse.json({ error: "Too many diagnostic events" }, { status: 429 });
  }
  if (!current || now - current.startedAt >= WINDOW_MS) recentByIp.set(ipAddress, { startedAt: now, count: 1 });
  else recentByIp.set(ipAddress, { ...current, count: current.count + 1 });

  let body: {
    event?: string;
    platform?: string;
    phone?: string;
    errorCode?: string;
    errorMessage?: string;
  };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid event payload" }, { status: 400 });
  }

  if (body.event !== "firebase_phone_verification_failed") {
    return NextResponse.json({ error: "Unsupported diagnostic event" }, { status: 422 });
  }
  const platform = body.platform;
  if (!["customer_app", "provider_app", "web"].includes(platform ?? "")) {
    return NextResponse.json({ error: "Invalid client platform" }, { status: 422 });
  }

  const userAgent = req.headers.get("user-agent") ?? "unknown";
  const device = /android/i.test(userAgent) ? "Android" : /iphone|ipad|ios/i.test(userAgent) ? "iOS" : /mobile/i.test(userAgent) ? "Mobile browser" : "Desktop browser";
  const digits = String(body.phone ?? "").replace(/\\D/g, "");
  const phoneMasked = digits.length >= 4 ? "••••" + digits.slice(-4) : "unknown phone";
  const errorCode = String(body.errorCode ?? "unknown").replace(/[^a-zA-Z0-9_/-]/g, "").slice(0, 100) || "unknown";
  const errorMessage = String(body.errorMessage ?? "")
    .replace(/\\+?\\d[\\d\\s()-]{5,}\\d/g, "[redacted number]")
    .replace(/\\b\\d{6,}\\b/g, "[redacted digits]")
    .slice(0, 240);

  await recordAudit({
    actor: platform === "provider_app" ? "provider" : "customer",
    action: "login",
    module: "Authentication",
    title: "Firebase phone verification failed",
    description: `${platform} could not start or complete phone verification for ${phoneMasked}`,
    reference: phoneMasked,
    severity: "warning",
    metadata: {
      result: "failed",
      platform,
      device,
      ipAddress,
      userAgent: userAgent.slice(0, 240),
      phoneMasked,
      errorCode,
      errorMessage,
      occurredAt: now,
    },
  });
  return NextResponse.json({ ok: true }, { status: 202 });
}
