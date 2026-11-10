/**
 * Provider matching — the company's dispatch rule, in one place.
 *
 * A request is first offered to every Pro who serves the service inside the
 * near ring (2–3 km) around the customer. Only when nobody qualifies there
 * does the search widen to the 3–5 km ring, and if that ring is empty too the
 * offer goes to every Pro who serves the service. The customer never picks a
 * Pro: the whole ring is notified and the first accept wins (enforced in
 * /api/bookings/[id]).
 *
 * The ring is ranked so a well-reviewed, experienced Pro slightly further
 * away can beat a bare-bones one next door — distance dominates, but not
 * absolutely.
 */
import { haversineKm } from "./geo";
import type { GeoPoint, Provider } from "./types";

/** Inner ring: "2–3 km around the customer". */
export const NEAR_RING_KM = 3;
/** Outer ring: the widened search when the inner ring is empty. */
export const WIDE_RING_KM = 5;

export type MatchRing = "near" | "wide" | "all" | "none";

export interface RankedMatch {
  provider: Provider;
  distanceKm: number;
  /** 0–100, higher is a better match (distance, rating, reviews, experience). */
  score: number;
}

export interface MatchResult {
  matches: RankedMatch[];
  /** Radius actually used for this search (3 or 5). */
  radiusKm: number;
  ring: MatchRing;
}

const WEIGHT_DISTANCE = 40;
const WEIGHT_RATING = 30;
const WEIGHT_REVIEWS = 15;
const WEIGHT_EXPERIENCE = 15;

/** Review volume saturates at this many reviews — beyond it the signal is flat. */
const REVIEWS_FULL = 200;
const EXPERIENCE_FULL = 15;

export function matchScore(provider: Provider, distanceKm: number, radiusKm: number): number {
  const closeness =
    radiusKm <= 0 ? 0 : 1 - Math.min(1, Math.max(0, distanceKm) / radiusKm);
  const rating = Math.min(5, Math.max(0, provider.rating || 0)) / 5;
  const reviews =
    Math.min(REVIEWS_FULL, Math.max(0, provider.reviewCount ?? provider.jobs ?? 0)) /
    REVIEWS_FULL;
  const experience =
    Math.min(EXPERIENCE_FULL, Math.max(0, provider.experience || 0)) / EXPERIENCE_FULL;

  return Number(
    (
      closeness * WEIGHT_DISTANCE +
      rating * WEIGHT_RATING +
      reviews * WEIGHT_REVIEWS +
      experience * WEIGHT_EXPERIENCE
    ).toFixed(2),
  );
}

/**
 * Everyone who should be notified for `serviceId` near `center`.
 *
 * `wideKm` lets a caller tighten the outer ring, never widen it past the
 * company rule.
 */
export function matchProviders(
  providers: Provider[],
  serviceId: string,
  center: GeoPoint | null,
  opts: { nearKm?: number; wideKm?: number } = {},
): MatchResult {
  const nearKm = opts.nearKm ?? NEAR_RING_KM;
  const wideKm = Math.max(nearKm, Math.min(opts.wideKm ?? WIDE_RING_KM, WIDE_RING_KM));

  if (!center || !serviceId) {
    return { matches: [], radiusKm: wideKm, ring: "none" };
  }

  const pool = providers
    .filter((p) => (p.services ?? []).includes(serviceId))
    .map((p) => ({ provider: p, distanceKm: haversineKm(center, p) }))
    .filter((m) => Number.isFinite(m.distanceKm));

  const near = pool.filter((m) => m.distanceKm <= nearKm);
  if (near.length > 0) {
    return rank(near, nearKm, "near");
  }

  const wide = pool.filter((m) => m.distanceKm <= wideKm);
  if (wide.length > 0) {
    return rank(wide, wideKm, "wide");
  }

  // Nobody inside the wide ring: a paid request must never die silently, so
  // fall back to every Pro who serves the service (nearest first) and tell the
  // caller that no radius was applied.
  if (pool.length > 0) {
    const widest = pool.reduce((max, m) => Math.max(max, m.distanceKm), 0);
    return rank(pool, Number(widest.toFixed(1)), "all");
  }

  return { matches: [], radiusKm: wideKm, ring: "none" };
}

function rank(
  hits: Array<{ provider: Provider; distanceKm: number }>,
  radiusKm: number,
  ring: MatchRing,
): MatchResult {
  return {
    matches: hits
      .map((m) => ({ ...m, score: matchScore(m.provider, m.distanceKm, radiusKm) }))
      .sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm),
    radiusKm,
    ring,
  };
}
