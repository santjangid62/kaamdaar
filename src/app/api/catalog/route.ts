/**
 * GET /api/catalog[?lat=…&lng=…] — everything the customer website renders
 * from the backend: service catalogue, categories and live platform settings.
 *
 * With the customer's coordinates the catalogue is area-aware: services that
 * a nearby Pro actually covers are marked `availableInArea` and listed first,
 * everything else still follows in the same list (never hidden).
 */
import { NextResponse } from "next/server";
import { all, ready } from "../../../server/db";
import { getServices } from "../../../server/catalog";
import { haversineKm } from "../../../lib/geo";
import { WIDE_RING_KM } from "../../../lib/match";
import type { Provider, Service } from "../../../lib/types";

// live DB read — never part of the prerendered shell
export const instant = false;

export async function GET(req: Request) {
  await ready();
  const url = new URL(req.url);
  const latRaw = url.searchParams.get("lat");
  const lngRaw = url.searchParams.get("lng");
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  const hasPoint =
    latRaw !== null && lngRaw !== null && Number.isFinite(lat) && Number.isFinite(lng);

  const [live, categories, settings, providers] = await Promise.all([
    getServices(),
    all<{ id: string; name: string; active: boolean; order: number }>("categories"),
    all<{ id: string; key: string; value: string; scope: string }>("settings"),
    hasPoint ? all<Provider>("providers") : Promise.resolve<Provider[]>([]),
  ]);

  // categories = admin-managed list merged with whatever categories the live
  // services actually use (so the filter never misses a service's category)
  const catNames = new Set(
    categories.filter((c) => c.active).map((c) => c.name),
  );

  let services: Array<Service & { availableInArea?: boolean }> = live;
  let areaRadiusKm: number | null = null;

  if (hasPoint) {
    areaRadiusKm = WIDE_RING_KM;
    const covered = new Set<string>();
    for (const provider of providers) {
      if (haversineKm({ lat, lng }, provider) > WIDE_RING_KM) continue;
      for (const slug of provider.services ?? []) covered.add(slug);
    }
    // array sort is stable, so the Admin panel's order holds inside each tier
    services = live
      .map((service) => ({ ...service, availableInArea: covered.has(service.id) }))
      .sort((a, b) => Number(b.availableInArea) - Number(a.availableInArea));
  }

  services.forEach((s) => catNames.add(s.category));

  return NextResponse.json({
    services,
    categories: [...catNames],
    settings: Object.fromEntries(settings.map((s) => [s.id, s.value])),
    areaRadiusKm,
  });
}
