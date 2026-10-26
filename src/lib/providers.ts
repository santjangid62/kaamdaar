import { DEFAULT_RADIUS_KM, haversineKm } from "./geo";
import { PROVIDERS } from "./seed";
import { isFirebaseConfigured } from "./firebase";
import type { GeoPoint, Provider } from "./types";

export interface NearbyProvider {
  provider: Provider;
  distanceKm: number;
}

const DEV_NAMES = [
  "Anil Kumar", "Pooja Devi", "Rakesh Singh", "Meena Sharma",
  "Imran Khan", "Sarita Patel", "Tarun Rao", "Geeta Nair",
];

/**
 * Providers offering `serviceId` within `radiusKm` of `center`.
 *
 * Seeded providers come from the catalogue (Firestore `providers` in
 * production). When the catalogue has no coverage yet in dev mode, a small
 * demo set is generated around the picked location so the radius flow stays
 * testable anywhere; this path never runs once Firebase is configured.
 */
export function nearbyProviders(
  serviceId: string,
  center: GeoPoint,
  radiusKm: number = DEFAULT_RADIUS_KM,
): NearbyProvider[] {
  const hits = PROVIDERS.filter((p) => p.services.includes(serviceId))
    .map((p) => ({ provider: p, distanceKm: haversineKm(center, p) }))
    .filter((r) => r.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  if (hits.length > 0 || isFirebaseConfigured) return hits;

  return syntheticProviders(serviceId, center, radiusKm);
}

function syntheticProviders(
  serviceId: string,
  center: GeoPoint,
  radiusKm: number,
): NearbyProvider[] {
  const offsets: Array<[number, number]> = [
    [0.004, 0.005],
    [-0.006, 0.008],
    [0.011, -0.005],
    [-0.009, -0.012],
    [0.015, 0.013],
    [-0.016, 0.007],
  ];
  return offsets.slice(0, 6).map(([dLat, dLng], i) => {
    const scale = radiusKm / 3;
    const lat = center.lat + dLat * scale;
    const lng = center.lng + dLng * scale;
    const provider: Provider = {
      id: `demo-${serviceId}-${i + 1}`,
      name: DEV_NAMES[(i * 3) % DEV_NAMES.length],
      services: [serviceId],
      lat,
      lng,
      city: "",
      rating: Number((4.3 + (i % 6) / 10).toFixed(1)),
      jobs: 180 + i * 137,
      experience: 1 + (i % 7),
      verified: true,
      synthetic: true,
    };
    return { provider, distanceKm: haversineKm(center, provider) };
  });
}