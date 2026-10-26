import type { GeoPoint, GeoResult } from "./types";

export const DEFAULT_RADIUS_KM = 3; // "around 2-3 km"

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

/** Ask the browser for a one-shot position. */
export function browserLocation(timeoutMs = 8000): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}

/** Reverse geocode to a readable label. Falls back gracefully when offline/blocked. */
export async function reverseGeocode(point: GeoPoint): Promise<GeoResult> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${point.lat}&lon=${point.lng}&zoom=14&accept-language=en`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`geocode ${res.status}`);
    const data = (await res.json()) as {
      address?: Record<string, string>;
      name?: string;
      display_name?: string;
    };
    const a = data.address ?? {};
    const locality =
      a.suburb ||
      a.neighbourhood ||
      a.quarter ||
      a.village ||
      a.town ||
      a.city_district ||
      a.city ||
      data.name ||
      "";
    const city = a.city || a.state || "";
    const label = [locality, city].filter(Boolean).join(", ") || data.display_name || "Current location";
    return { ...point, label, city };
  } catch {
    return { ...point, label: "Current location", city: "" };
  }
}

export interface CityCluster {
  name: string;
  lat: number;
  lng: number;
}

/** Demo city centres used to seed service providers. */
export const CITY_CLUSTERS: CityCluster[] = [
  { name: "Gurugram", lat: 28.4595, lng: 77.0266 },
  { name: "Delhi", lat: 28.6315, lng: 77.2167 },
  { name: "Noida", lat: 28.5355, lng: 77.391 },
  { name: "Mumbai", lat: 19.1136, lng: 72.8697 },
  { name: "Bengaluru", lat: 12.9352, lng: 77.6245 },
  { name: "Pune", lat: 18.559, lng: 73.7868 },
  { name: "Hyderabad", lat: 17.4401, lng: 78.3489 },
];

export function nearestCluster(point: GeoPoint): CityCluster {
  let best = CITY_CLUSTERS[0];
  let bestDist = Infinity;
  for (const c of CITY_CLUSTERS) {
    const d = haversineKm(point, c);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}
