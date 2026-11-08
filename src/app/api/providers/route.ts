/**
 * GET /api/providers[?serviceId=…&lat=…&lng=…&radiusKm=…]
 *
 * With a service and a point this is the dispatch search: everyone who serves
 * `serviceId` inside 3 km, or — when that ring is empty — inside the widened
 * 5 km ring. Results are ranked by distance, rating, review volume and
 * experience (see lib/match), so the customer never chooses a Pro and the
 * Provider app can offer the job to every notified Pro at once.
 *
 * Without them it returns the full roster (used by the app shell for
 * areas/assistant context). Admin manages the rows; the customer site only
 * reads them here.
 */
import { NextResponse } from "next/server";
import { all, ready } from "../../../server/db";
import { haversineKm } from "../../../lib/geo";
import { matchProviders, NEAR_RING_KM, WIDE_RING_KM } from "../../../lib/match";
import type { Provider } from "../../../lib/types";

// live DB read — never part of the prerendered shell
export const instant = false;

export async function GET(req: Request) {
  await ready();
  const url = new URL(req.url);
  const serviceId = url.searchParams.get("serviceId") ?? "";
  const latRaw = url.searchParams.get("lat");
  const lngRaw = url.searchParams.get("lng");
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  const radiusRaw = Number(url.searchParams.get("radiusKm") ?? "");

  const providers = await all<Provider & { kycStatus?: string }>("providers");
  // NB: Number(null) === 0 — an absent param must not be mistaken for (0, 0)
  const hasPoint =
    latRaw !== null && lngRaw !== null && Number.isFinite(lat) && Number.isFinite(lng);

  if (!serviceId && !hasPoint) {
    return NextResponse.json({ providers, radiusKm: null, ring: null });
  }

  if (!serviceId) {
    const cap = Number.isFinite(radiusRaw) ? radiusRaw : WIDE_RING_KM;
    const hits = providers
      .map((p) => ({ provider: p, distanceKm: hasPoint ? haversineKm({ lat, lng }, p) : undefined }))
      .filter((r) => !hasPoint || (r.distanceKm ?? 0) <= cap)
      .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
    return NextResponse.json({ providers: hits, radiusKm: hasPoint ? cap : null, ring: null });
  }

  if (!hasPoint) {
    // no origin yet — the whole roster that serves this service
    const roster = providers.filter((p) => (p.services ?? []).includes(serviceId));
    return NextResponse.json({
      providers: roster.map((provider) => ({ provider })),
      radiusKm: null,
      ring: null,
    });
  }

  // NB: an absent radiusKm parses to 0 — passing that through would clamp the
  // widened ring back to the near ring, so only a real request tightens it.
  const wideOverride =
    Number.isFinite(radiusRaw) && radiusRaw > 0 ? radiusRaw : undefined;
  const match = matchProviders(providers, serviceId, { lat, lng }, { wideKm: wideOverride });

  return NextResponse.json({
    providers: match.matches.map((m) => ({
      provider: m.provider,
      distanceKm: m.distanceKm,
      score: m.score,
    })),
    radiusKm: match.radiusKm,
    ring: match.ring,
    nearRadiusKm: NEAR_RING_KM,
    wideRadiusKm: WIDE_RING_KM,
  });
}
