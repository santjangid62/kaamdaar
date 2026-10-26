/**
 * Product analytics for the booking journey (PostHog, browser SDK).
 *
 * One client, created at the Next.js client-instrumentation boundary
 * (`src/instrumentation-client.ts`) and shared with the React tree through a
 * `globalThis` bridge, so the SDK is never initialised twice.
 *
 * Privacy model:
 *   - analytics is off until the visitor grants consent in the app's own notice
 *     (`opt_out_capturing_by_default: true`, and every capture re-checks the
 *     stored decision),
 *   - only the allowlisted event properties below ever leave the browser,
 *     `before_send` strips automatic URL/referrer/person metadata,
 *   - the account is identified by an opaque one-way hash, never by phone,
 *     name or email,
 *   - a missing project token or host, missing consent or a transport failure
 *     are all harmless no-ops for the calling screen.
 */

import posthog, { type PostHogConfig } from "posthog-js";

/** localStorage key holding the visitor's analytics decision. */
export const ANALYTICS_CONSENT_KEY = "kaamdaar.analytics.consent";

/** Global bridge so instrumentation-client and app chunks share one client. */
export const ANALYTICS_CLIENT_KEY = "__kaamdaarPostHogClient";

const CONSENT_EVENT = "kaamdaar:analytics-consent";

export type AnalyticsConsent = "granted" | "denied";

/** Properties that may leave the browser. Everything else is dropped. */
export const ALLOWED_EVENT_PROPERTIES = [
  "service_id",
  "service_category",
  "provider_count",
  "provider_id",
  "booking_mode",
  "amount_inr",
] as const;

export const ANALYTICS_EVENTS = {
  providersViewed: "service_providers_viewed",
  checkoutOpened: "booking_checkout_opened",
  bookingConfirmed: "booking_confirmed",
} as const;

/** The slice of the PostHog client this app uses. */
export interface AnalyticsClient {
  capture(event: string, properties?: Record<string, unknown>): unknown;
  identify(distinctId: string, properties?: Record<string, unknown>): unknown;
  reset(): void;
  opt_in_capturing(): void;
  opt_out_capturing(): void;
}

export type AnalyticsClientFactory = (
  token: string,
  config: Partial<PostHogConfig>,
) => AnalyticsClient;

export interface AnalyticsConfig {
  token: string;
  host: string;
}

/* ------------------------------ configuration ----------------------------- */

/**
 * Public project token + ingestion host from the environment.
 * Empty (or a non-http) host keeps capture off, so an unknown region never
 * sends data to the wrong place.
 */
export function analyticsConfig(): AnalyticsConfig | null {
  const token = (process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN ?? "").trim();
  const host = (process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "").trim();
  if (!token || !host) return null;
  if (!/^https?:\/\/[^\s]+$/i.test(host)) return null;
  return { token, host };
}

export function isAnalyticsConfigured(): boolean {
  return analyticsConfig() !== null;
}

/* --------------------------- property allowlisting ------------------------- */

/**
 * `before_send` hook: rewrites every event so only allowlisted app properties
 * survive. Automatic URL, referrer, host and person metadata are removed and
 * GeoIP is disabled per event.
 */
export function scrubEvent<
  T extends { properties?: Record<string, unknown>; $set?: unknown; $set_once?: unknown } | null,
>(event: T): T {
  if (!event) return event;
  const properties = (event.properties ?? {}) as Record<string, unknown>;
  const safe: Record<string, unknown> = { $geoip_disable: true };
  for (const key of ALLOWED_EVENT_PROPERTIES) {
    if (key in properties) safe[key] = properties[key];
  }
  event.properties = safe;
  delete event.$set;
  delete event.$set_once;
  return event;
}

/** Client configuration: everything automatic is off, capture starts opted out. */
export function posthogClientConfig(host: string): Partial<PostHogConfig> {
  return {
    api_host: host,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    capture_dead_clicks: false,
    disable_session_recording: true,
    disable_surveys: true,
    disable_external_dependency_loading: true,
    advanced_disable_flags: true,
    person_profiles: "identified_only",
    opt_out_capturing_by_default: true,
    respect_dnt: true,
    before_send: scrubEvent as Partial<PostHogConfig>["before_send"],
  };
}

/* -------------------------------- the client ------------------------------- */

/**
 * Test seam for the offline verification suite: swap the SDK transport for an
 * in-memory client. `null` restores the real PostHog client.
 */
let clientFactory: AnalyticsClientFactory | null = null;

export function setAnalyticsClientFactory(
  factory: AnalyticsClientFactory | null,
): void {
  clientFactory = factory;
}

function bridge(): Record<string, unknown> {
  return globalThis as unknown as Record<string, unknown>;
}

function readClient(): AnalyticsClient | null {
  const client = bridge()[ANALYTICS_CLIENT_KEY];
  return (client as AnalyticsClient | undefined) ?? null;
}

/** Create the single client. Missing configuration is a no-op. */
export function initAnalytics(): boolean {
  if (readClient()) {
    applyConsent();
    return true;
  }
  const config = analyticsConfig();
  if (!config || typeof window === "undefined") return false;
  try {
    const factory: AnalyticsClientFactory =
      clientFactory ??
      ((token, clientConfig) =>
        posthog.init(token, clientConfig) as unknown as AnalyticsClient);
    bridge()[ANALYTICS_CLIENT_KEY] = factory(
      config.token,
      posthogClientConfig(config.host),
    );
    applyConsent();
    return true;
  } catch {
    return false;
  }
}

/* --------------------------------- consent -------------------------------- */

export function readConsent(): AnalyticsConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
    return raw === "granted" || raw === "denied" ? raw : null;
  } catch {
    return null;
  }
}

function applyConsent(): void {
  const client = readClient();
  if (!client) return;
  try {
    if (readConsent() === "granted") client.opt_in_capturing();
    else client.opt_out_capturing();
  } catch {
    /* analytics must never break the app */
  }
}

/** Persist the visitor's decision and apply it to the live client. */
export function setAnalyticsConsent(consent: AnalyticsConsent): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(ANALYTICS_CONSENT_KEY, consent);
    } catch {
      /* private mode / quota */
    }
    window.dispatchEvent(new Event(CONSENT_EVENT));
  }
  applyConsent();
}

/** Subscribe to consent changes (used with `useSyncExternalStore`). */
export function subscribeToAnalyticsConsent(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CONSENT_EVENT, onChange);
  return () => window.removeEventListener(CONSENT_EVENT, onChange);
}

/* ------------------------------- capture api ------------------------------- */

function captureEvent(
  event: string,
  properties: Record<string, unknown>,
): boolean {
  const client = readClient();
  if (!client || readConsent() !== "granted") return false;
  try {
    client.capture(event, properties);
    return true;
  } catch {
    return false;
  }
}

/** Someone opened the provider list for a service (funnel start). */
export function trackServiceProvidersViewed(input: {
  serviceId: string;
  category: string;
  providerCount: number;
}): boolean {
  return captureEvent(ANALYTICS_EVENTS.providersViewed, {
    service_id: input.serviceId,
    service_category: input.category,
    provider_count: input.providerCount,
  });
}

/** Someone tapped "Book now" on a specific Pro (checkout opened). */
export function trackBookingCheckoutOpened(input: {
  serviceId: string;
  providerId: string;
}): boolean {
  return captureEvent(ANALYTICS_EVENTS.checkoutOpened, {
    service_id: input.serviceId,
    provider_id: input.providerId,
  });
}

/** A booking was written (funnel success). */
export function trackBookingConfirmed(input: {
  serviceId: string;
  mode: string;
  amountInr: number;
}): boolean {
  return captureEvent(ANALYTICS_EVENTS.bookingConfirmed, {
    service_id: input.serviceId,
    booking_mode: input.mode,
    amount_inr: input.amountInr,
  });
}

/* -------------------------------- identity -------------------------------- */

const IDENTITY_SALT = "kaamdaar-analytics-v1";

/**
 * Opaque, stable account id: one-way hash of the account id, so the phone
 * number stored as the account key is never sent. Returns `null` when WebCrypto
 * is unavailable — the session then simply stays anonymous.
 */
export async function opaqueAccountId(
  accountId: string,
): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  try {
    const bytes = new TextEncoder().encode(`${IDENTITY_SALT}:${accountId}`);
    const digest = await subtle.digest("SHA-256", bytes);
    const hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return `u_${hex.slice(0, 32)}`;
  } catch {
    return null;
  }
}

/**
 * Identify the signed-in account with the opaque id only: no traits are sent
 * (no name, email, phone, photo or address).
 */
export async function identifyAccount(
  accountId: string,
): Promise<string | null> {
  const client = readClient();
  if (!client || readConsent() !== "granted") return null;
  try {
    const distinctId = await opaqueAccountId(accountId);
    if (!distinctId) return null;
    client.identify(distinctId);
    return distinctId;
  } catch {
    return null;
  }
}

/** Logout: detach the identity so the next visitor starts clean. */
export function resetAnalytics(): void {
  const client = readClient();
  if (!client) return;
  try {
    client.reset();
  } catch {
    /* analytics must never break logout */
  }
}
