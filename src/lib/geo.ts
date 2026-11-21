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

type Fix = { lat: number; lng: number; accuracy: number };

/** One geolocation request. Preserve browser error codes for useful recovery guidance. */
function requestFix(opts: PositionOptions): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("position-unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? 9999,
        }),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) reject(new Error("permission-denied"));
        else if (error.code === error.TIMEOUT) reject(new Error("timeout"));
        else reject(new Error("position-unavailable"));
      },
      opts,
    );
  });
}

/**
 * Accept only a fresh, high-confidence GPS result. Desktop browsers can return
 * Wi-Fi/network estimates several kilometres away while reporting a plausible
 * address; collect independent fresh fixes and require both good accuracy and
 * spatial agreement before using the point for service dispatch.
 */
export async function browserLocation(timeoutMs = 12000): Promise<GeoPoint> {
  const opts: PositionOptions = {
    enableHighAccuracy: true,
    timeout: timeoutMs,
    maximumAge: 0,
  };

  const fixes: Fix[] = [];
  let firstError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      fixes.push(await requestFix(opts));
    } catch (error) {
      firstError ??= error;
      if (error instanceof Error && error.message === "permission-denied") throw error;
    }
  }

  if (!fixes.length) {
    if (firstError instanceof Error && firstError.message === "timeout") throw firstError;
    throw new Error("position-unavailable");
  }

  const accurate = fixes.filter((fix) => fix.accuracy <= 50);
  if (!accurate.length) throw new Error("low-accuracy");

  // Do not accept a drifting or contradictory position estimate.
  const best = accurate.reduce((a, b) => (b.accuracy < a.accuracy ? b : a));
  const consistent = accurate.every((fix) => haversineKm(best, fix) <= 0.25);
  if (!consistent) throw new Error("inconsistent-location");

  return { lat: best.lat, lng: best.lng, accuracy: best.accuracy };
}

/** Reverse geocode to a readable label. Falls back gracefully when offline/blocked. */
export async function reverseGeocode(point: GeoPoint): Promise<GeoResult> {
  // Prefer Google Maps reverse geocoding through a server endpoint so the key
  // stays private. Fall back gracefully when Google is not configured.
  try {
    const res = await fetch(`/api/geocode?lat=${point.lat}&lng=${point.lng}`, { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { label?: string; city?: string; pincode?: string };
      if (data.label) return { ...point, label: data.label, city: data.city ?? "", pincode: data.pincode };
    }
  } catch { /* use fallback geocoder */ }
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${point.lat}&lon=${point.lng}&zoom=18&addressdetails=1&accept-language=en`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`geocode ${res.status}`);
    const data = (await res.json()) as { address?: Record<string, string>; name?: string; display_name?: string };
    const a = data.address ?? {};
    const locality = a.suburb || a.neighbourhood || a.quarter || a.residential || a.village || a.town || a.city_district || a.city || data.name || "";
    const city = a.city || a.town || a.village || a.state_district || a.state || "";
    const pincode = a.postcode || "";
    const street = [a.house_number, a.road].filter(Boolean).join(" ");
    const label = [...new Set([street, locality, city, pincode].filter(Boolean))].join(", ") || data.display_name || "Current location";
    return { ...point, label, city, pincode };
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
