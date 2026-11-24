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
 * Collect live updates from the browser location provider rather than making
 * several immediately-resolved getCurrentPosition calls (which can repeat the
 * same cached Wi-Fi/IP estimate). Only accept a high-confidence fix.
 *
 * Desktop browsers without a real location source may not be able to provide
 * this accuracy; in that case we fail closed instead of showing a false area.
 */
export async function browserLocation(timeoutMs = 45000): Promise<GeoPoint> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new Error("position-unavailable");
  }

  return new Promise((resolve, reject) => {
    const fixes: Fix[] = [];
    let watchId: number | null = null;
    let settled = false;
    let sawLowAccuracy = false;

    const finish = (error?: Error, point?: GeoPoint) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (error) reject(error);
      else if (point) resolve(point);
      else reject(new Error("position-unavailable"));
    };

    // Desktop Wi-Fi location can be less precise than phone GPS. Accept a
    // practical 1 km fix, but still reject coarse IP-level estimates.
    const timer = window.setTimeout(() => {
      const usable = fixes.filter((sample) => sample.accuracy <= 1000);
      if (usable.length) {
        const best = usable.reduce((a, b) => b.accuracy < a.accuracy ? b : a);
        finish(undefined, { lat: best.lat, lng: best.lng, accuracy: best.accuracy });
      } else {
        finish(new Error(sawLowAccuracy ? "low-accuracy" : "timeout"));
      }
    }, timeoutMs);

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const fix: Fix = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy ?? 9999,
        };
        if (fix.accuracy > 1000) {
          sawLowAccuracy = true;
          return;
        }

        fixes.push(fix);
        // Two nearby readings are enough; requiring three fixes within 100m
        // caused valid desktop/laptop locations to time out indefinitely.
        const best = fixes.reduce((a, b) => b.accuracy < a.accuracy ? b : a);
        const agreeing = fixes.filter((sample) => haversineKm(best, sample) <= 0.5);
        if (agreeing.length >= 2 || fix.accuracy <= 200) {
          finish(undefined, {
            lat: best.lat,
            lng: best.lng,
            accuracy: best.accuracy,
          });
        }
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) finish(new Error("permission-denied"));
        else if (error.code === error.TIMEOUT) finish(new Error("timeout"));
        else finish(new Error("position-unavailable"));
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 10000 },
    );
  });
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
