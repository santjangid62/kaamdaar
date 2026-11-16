/**
 * Jaipur localities where Kaamdaar currently offers services.
 * Nearby provider counts and service links come from the live backend roster.
 */
import { haversineKm } from "./geo";
import type { GeoPoint, Provider } from "./types";

export interface Area {
  name: string;
  city: string;
  lat: number;
  lng: number;
}

export const AREAS: Area[] = [
  // North Jaipur
  { name: "Sikar Road", city: "Jaipur", lat: 26.9732, lng: 75.7892 },
  { name: "Chomu Pulia", city: "Jaipur", lat: 26.9664, lng: 75.7781 },
  { name: "Jhotwara", city: "Jaipur", lat: 26.9418, lng: 75.7437 },
  { name: "Murlipura", city: "Jaipur", lat: 26.9592, lng: 75.7764 },
  { name: "Vidyadhar Nagar", city: "Jaipur", lat: 26.9810, lng: 75.7563 },
  { name: "Maharani Farm", city: "Jaipur", lat: 26.8717, lng: 75.7835 },
  { name: "VKI Area", city: "Jaipur", lat: 26.9748, lng: 75.7898 },

  // West Jaipur
  { name: "Ajmer Road", city: "Jaipur", lat: 26.9068, lng: 75.7315 },
  { name: "Vaishali Nagar", city: "Jaipur", lat: 26.9124, lng: 75.7397 },
  { name: "Sirsi Road", city: "Jaipur", lat: 26.9234, lng: 75.7078 },
  { name: "Kalwar Road", city: "Jaipur", lat: 26.9540, lng: 75.7110 },
  { name: "Gandhi Path", city: "Jaipur", lat: 26.9098, lng: 75.7270 },
  { name: "Queens Road", city: "Jaipur", lat: 26.9057, lng: 75.7480 },
  { name: "Shyam Nagar", city: "Jaipur", lat: 26.8918, lng: 75.7660 },
  { name: "Sodala", city: "Jaipur", lat: 26.9020, lng: 75.7750 },

  // Central Jaipur
  { name: "Shastri Nagar", city: "Jaipur", lat: 26.9515, lng: 75.7703 },
  { name: "Bani Park", city: "Jaipur", lat: 26.9290, lng: 75.7930 },
  { name: "Civil Lines", city: "Jaipur", lat: 26.9070, lng: 75.7850 },
  { name: "C-Scheme", city: "Jaipur", lat: 26.9098, lng: 75.8050 },
  { name: "MI Road", city: "Jaipur", lat: 26.9196, lng: 75.8008 },
  { name: "Raja Park", city: "Jaipur", lat: 26.9005, lng: 75.8300 },
  { name: "Adarsh Nagar", city: "Jaipur", lat: 26.8970, lng: 75.8230 },
  { name: "Amer Road", city: "Jaipur", lat: 26.9490, lng: 75.8510 },

  // South Jaipur
  { name: "Mansarovar", city: "Jaipur", lat: 26.8465, lng: 75.7626 },
  { name: "Gopalpura", city: "Jaipur", lat: 26.8730, lng: 75.7900 },
  { name: "Tonk Road", city: "Jaipur", lat: 26.8640, lng: 75.8050 },
  { name: "Durgapura", city: "Jaipur", lat: 26.8510, lng: 75.7990 },
  { name: "Malviya Nagar", city: "Jaipur", lat: 26.8536, lng: 75.8068 },
  { name: "Jagatpura", city: "Jaipur", lat: 26.8159, lng: 75.8498 },
  { name: "Pratap Nagar", city: "Jaipur", lat: 26.7950, lng: 75.8200 },
  { name: "Sanganer", city: "Jaipur", lat: 26.8190, lng: 75.7860 },
  { name: "Sitapura", city: "Jaipur", lat: 26.7820, lng: 75.8500 },
];

export interface NearbyArea extends Area {
  km: number;
  providers: Provider[];
  pros: number;
}

const PROVIDER_AREA_RADIUS_KM = 3;

/** All mapped Jaipur areas within radiusKm, annotated with nearby live providers. */
export function nearbyAreas(
  point: GeoPoint | null,
  radiusKm = 5,
  providers: Provider[] = [],
): NearbyArea[] {
  if (!point) return [];
  return AREAS.map((a) => ({ ...a, km: haversineKm(point, a) }))
    .filter((a) => a.km <= radiusKm)
    .map((a) => {
      const nearbyProviders = providers.filter(
        (provider) =>
          haversineKm(point, provider) <= radiusKm &&
          haversineKm(a, provider) <= PROVIDER_AREA_RADIUS_KM,
      );
      return { ...a, providers: nearbyProviders, pros: nearbyProviders.length };
    })
    .sort((x, y) => x.km - y.km);
}

/** Just the names — used as assistant context for “areas near me” questions. */
export function nearbyAreaNames(
  point: GeoPoint | null,
  radiusKm = 5,
  providers: Provider[] = [],
): string[] {
  return nearbyAreas(point, radiusKm, providers).map((a) => a.name);
}


/**
 * Kaamdaar Phase 1 is Jaipur-only. This coarse city boundary is a first
 * server-side guard; actual dispatch still requires a Pro within 3–5 km.
 */
export function isInsideJaipur(point: GeoPoint): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= 26.72 &&
    point.lat <= 27.06 &&
    point.lng >= 75.62 &&
    point.lng <= 76.02
  );
}
