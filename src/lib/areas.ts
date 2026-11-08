/**
 * Localities ("areas") we operate in, one list for every covered city.
 *
 * Nearby areas are listed even when no provider is currently available there;
 * provider counts and service links come from the live backend roster.
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
  // Gurugram
  { name: "Sector 14", city: "Gurugram", lat: 28.456, lng: 77.051 },
  { name: "Sector 22", city: "Gurugram", lat: 28.478, lng: 77.03 },
  { name: "Sector 29", city: "Gurugram", lat: 28.447, lng: 77.065 },
  { name: "Sector 43", city: "Gurugram", lat: 28.462, lng: 77.093 },
  { name: "Sector 56", city: "Gurugram", lat: 28.421, lng: 77.096 },
  { name: "DLF Phase 1", city: "Gurugram", lat: 28.454, lng: 77.045 },
  { name: "DLF Phase 5", city: "Gurugram", lat: 28.443, lng: 77.098 },
  { name: "Palam Vihar", city: "Gurugram", lat: 28.465, lng: 77.0 },
  { name: "Sohna Road", city: "Gurugram", lat: 28.409, lng: 77.038 },
  { name: "Cyber City", city: "Gurugram", lat: 28.495, lng: 77.026 },

  // Delhi (east cluster)
  { name: "Karkarduma", city: "Delhi", lat: 28.647, lng: 77.242 },
  { name: "Laxmi Nagar", city: "Delhi", lat: 28.635, lng: 77.277 },
  { name: "Vishwas Nagar", city: "Delhi", lat: 28.64, lng: 77.268 },
  { name: "Ganesh Nagar", city: "Delhi", lat: 28.625, lng: 77.257 },
  { name: "Preet Vihar", city: "Delhi", lat: 28.641, lng: 77.293 },
  { name: "Mayur Vihar Phase 1", city: "Delhi", lat: 28.609, lng: 77.294 },

  // Noida
  { name: "Sector 137", city: "Noida", lat: 28.543, lng: 77.387 },
  { name: "Sector 143", city: "Noida", lat: 28.53, lng: 77.395 },
  { name: "Sector 128", city: "Noida", lat: 28.57, lng: 77.36 },
  { name: "Sector 76", city: "Noida", lat: 28.585, lng: 77.365 },
  { name: "Sector 150", city: "Noida", lat: 28.47, lng: 77.41 },
  { name: "Film City", city: "Noida", lat: 28.57, lng: 77.36 },

  // Mumbai (Andheri belt)
  { name: "Andheri West", city: "Mumbai", lat: 19.135, lng: 72.829 },
  { name: "Andheri East", city: "Mumbai", lat: 19.114, lng: 72.875 },
  { name: "Vile Parle", city: "Mumbai", lat: 19.097, lng: 72.844 },
  { name: "Santacruz", city: "Mumbai", lat: 19.08, lng: 72.841 },
  { name: "Jogeshwari", city: "Mumbai", lat: 19.136, lng: 72.849 },
  { name: "Goregaon", city: "Mumbai", lat: 19.155, lng: 72.849 },
  { name: "Powai", city: "Mumbai", lat: 19.118, lng: 72.905 },
  { name: "Kurla", city: "Mumbai", lat: 19.072, lng: 72.889 },

  // Bengaluru (east cluster)
  { name: "Hoodi", city: "Bengaluru", lat: 12.985, lng: 77.647 },
  { name: "BEML", city: "Bengaluru", lat: 12.975, lng: 77.645 },
  { name: "Marathahalli", city: "Bengaluru", lat: 12.956, lng: 77.697 },
  { name: "Bellandur", city: "Bengaluru", lat: 12.93, lng: 77.677 },
  { name: "KR Puram", city: "Bengaluru", lat: 13.006, lng: 77.62 },
  { name: "Banaswadi", city: "Bengaluru", lat: 13.01, lng: 77.63 },

  // Pune (Baner–Aundh belt)
  { name: "Aundh", city: "Pune", lat: 18.559, lng: 73.807 },
  { name: "Baner", city: "Pune", lat: 18.568, lng: 73.78 },
  { name: "Balewadi", city: "Pune", lat: 18.575, lng: 73.76 },
  { name: "Sangvi", city: "Pune", lat: 18.559, lng: 73.8 },
  { name: "Wakad", city: "Pune", lat: 18.598, lng: 73.762 },
  { name: "Hinjewadi", city: "Pune", lat: 18.591, lng: 73.738 },
  { name: "Kothrud", city: "Pune", lat: 18.507, lng: 73.807 },

  // Jaipur (north-west belt — the seeded Pros live here)
  { name: "Vidyadhar Nagar", city: "Jaipur", lat: 26.981, lng: 75.7563 },
  { name: "Shastri Nagar", city: "Jaipur", lat: 26.9515, lng: 75.7703 },
  { name: "Vaishali Nagar", city: "Jaipur", lat: 26.9124, lng: 75.7397 },
  { name: "Mansarovar", city: "Jaipur", lat: 26.8465, lng: 75.7626 },
  { name: "Malviya Nagar", city: "Jaipur", lat: 26.8536, lng: 75.8068 },
  { name: "Jagatpura", city: "Jaipur", lat: 26.8159, lng: 75.8498 },

  // Hyderabad
  { name: "Gachibowli", city: "Hyderabad", lat: 17.44, lng: 78.348 },
  { name: "Kondapur", city: "Hyderabad", lat: 17.44, lng: 78.36 },
  { name: "Madhapur", city: "Hyderabad", lat: 17.443, lng: 78.395 },
  { name: "Hitec City", city: "Hyderabad", lat: 17.443, lng: 78.38 },
  { name: "KPHB", city: "Hyderabad", lat: 17.485, lng: 78.39 },
  { name: "Kukatpally", city: "Hyderabad", lat: 17.484, lng: 78.413 },
  { name: "Miyapur", city: "Hyderabad", lat: 17.497, lng: 78.392 },
];

export interface NearbyArea extends Area {
  km: number;
  providers: Provider[];
  pros: number;
}

const PROVIDER_AREA_RADIUS_KM = 3;

/** All mapped areas within `radiusKm`, annotated with nearby live providers. */
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
