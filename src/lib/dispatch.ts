/**
 * Dispatch flow helpers — shared by the map dispatch page, the tracking page
 * and the Provider (demo) panel.
 *
 * Company rules live here:
 *   • 10% commission is debited from the Pro's wallet on every paid service.
 *   • A Pro must keep at least ₹500 in the wallet to keep receiving requests.
 */
import { haversineKm } from "./geo";
import type { GeoPoint, Provider, ProviderProfile } from "./types";

export const COMMISSION_PCT = 10;
export const MIN_WALLET_BALANCE = 500;

/** ₹10 of commission for every ₹100 collected — rounded to whole rupees. */
export function commissionOf(amount: number): number {
  return Math.round((amount * COMMISSION_PCT) / 100);
}

/** City travel ≈ 24 km/h plus 4 minutes to gear up at the door. */
export function etaMinutes(distanceKm: number): number {
  return Math.max(4, Math.round(distanceKm * 2.5 + 4));
}

/** 6-digit OTP — shown to the user, entered by the Pro. */
export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Freeze the accepted Pro's public details into the booking. */
export function toProfile(provider: Provider, distanceKm: number): ProviderProfile {
  return {
    id: provider.id,
    name: provider.name,
    rating: provider.rating,
    jobs: provider.jobs,
    experience: provider.experience,
    verified: provider.verified,
    policeVerified: provider.policeVerified ?? false,
    hourlyRate: provider.hourlyRate ?? 199,
    reviewCount: provider.reviewCount ?? provider.jobs,
    reviews: provider.reviews ?? [],
    distanceKm,
  };
}

/** Linear interpolation between two points (map marker animation). */
export function lerpPoint(from: GeoPoint, to: GeoPoint, t: number): GeoPoint {
  const k = Math.min(1, Math.max(0, t));
  return { lat: from.lat + (to.lat - from.lat) * k, lng: from.lng + (to.lng - from.lng) * k };
}

/** Straight-line distance used for ETA display while the Pro is enroute. */
export function distanceBetween(a: GeoPoint, b: GeoPoint): number {
  return haversineKm(a, b);
}

/** Demo travel duration: the whole approach plays out over ~45 seconds. */
export const DEMO_TRAVEL_MS = 45_000;