import { DEFAULT_RADIUS_KM, haversineKm } from "./geo";
import type { GeoPoint, Provider } from "./types";

export interface NearbyProvider {
  provider: Provider;
  distanceKm: number;
}

/**
 * Providers offering `serviceId` within `radiusKm` of `center`.
 *
 * `roster` is the live provider list from the backend (/api/providers) held
 * by AppProvider — Admin panel rows only, no demo fallback.
 */
export function nearbyProviders(
  serviceId: string,
  center: GeoPoint,
  radiusKm: number = DEFAULT_RADIUS_KM,
  roster: Provider[] = [],
): NearbyProvider[] {
  return roster
    .filter((p) => (p.services ?? []).includes(serviceId))
    .map((p) => ({ provider: p, distanceKm: haversineKm(center, p) }))
    .filter((r) => r.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
