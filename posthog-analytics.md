# PostHog product analytics — KaamDaar web booking journey

## Repository facts (read from source, manifests and safe examples only)

| Item | Value |
| --- | --- |
| `packageManager` (declared) | none in `package.json`; resolved from the single lockfile: **npm** |
| Original lock path | `package-lock.json` (lockfileVersion 3) |
| Other lockfiles | none — no `yarn.lock`, `pnpm-lock.yaml`, `bun.lockb`, `bun.lock`; no `.yarn/`, no `workspaces` |
| Owning package | root package `kaamdaar` (single-package Next.js app, `src/app` layout) |
| SDK importer | root package `kaamdaar` → `package.json`, `package-lock.json` |
| Node / npm | v24.21.0 / 11.19.0 |
| Next.js / React | 16.4.3 / 19.3.0 (App Router, `src/` dir) |
| TypeScript | `^5` (no `typecheck` script; the real command is `npx tsc --noEmit`) |
| Lint | `npm run lint` → `eslint` (flat config, `eslint-config-next`) |
| Tests | none in the repo before this change; offline suite added here runs on Node's built-in `node --test` |

### Baseline checks (before any edit, truthful)

- `npx tsc --noEmit` → **pass** (exit 0).
- `npm run lint` → **fail**: 8 errors / 3 warnings, all pre-existing
  (`react-hooks/set-state-in-effect` in `book/[serviceId]/[providerId]`, `services/[slug]/providers`,
  `AppProvider`, `MyBookings`, `ProfileDetails`, `ServiceFilterBar`, `Year`;
  `react-hooks/rules-of-hooks` for `useCurrentLocationForAddress`; unused-symbol warnings).
  These are left failing exactly as found; this change adds no new lint findings of its own.

## Product question

**Of the visitors who open the provider list for a service, what share open checkout for a specific
Pro, and what share confirm the booking — and where do they drop off?**

This is the money path of the web app (browse → pick service → pick Pro → book), so the answer is
actionable: a large gap between "providers viewed" and "checkout opened" is a matching/location
problem (radius, coverage, provider quality), a large gap between "checkout opened" and
"booking confirmed" is a login/address/checkout friction problem.

## Event contract

Three events, one funnel, no duplicates with anything that already exists (the app had no analytics
before this change, so there is nothing to extend or de-duplicate).

| Event | Real trigger (file / function) | Allowed properties |
| --- | --- | --- |
| `service_providers_viewed` (funnel start) | `src/app/services/[slug]/providers/page.tsx` — `ProvidersFlow`, once per page visit when the service and a location centre resolve | `service_id`, `service_category`, `provider_count` |
| `booking_checkout_opened` | `src/app/services/[slug]/providers/page.tsx` — the **Book now** button handler, before `router.push` to `/book/:serviceId/:providerId` | `service_id`, `provider_id` |
| `booking_confirmed` (funnel success) | `src/app/book/[serviceId]/[providerId]/page.tsx` — `handleConfirm`, immediately after `createBooking()` resolves | `service_id`, `booking_mode`, `amount_inr` |

Deliberately **not** sent: phone number, name, email, address lines, pincode, OTP, free-text
instructions, geolocation coordinates, URL, referrer, session recordings, IP geolocation.

## Identity

- Signed in: `identify()` with an opaque, stable, one-way ID — `u_` + first 32 hex chars of
  `SHA-256("kaamdaar-analytics-v1:" + account id)`. The account id in this app is the phone number,
  so it is **hashed client-side and never sent**; no name/email traits are sent either. If
  `crypto.subtle` is unavailable the session stays anonymous instead of falling back to a weak hash.
- Signed out / not yet identified: stays on PostHog's own anonymous `distinct_id`.
- Logout: `reset()` in `AppProvider.logout`, so the next visitor on the device starts clean.
- Same-week funnel semantics: an anonymous visitor who clicks **Book now** (event 2) then logs in and
  confirms (event 3) is linked by PostHog's anonymous→identified person merge, so the funnel is read
  on **unique persons**, not distinct IDs.

## Consent

- The app had no analytics and therefore no consent decision. A new first-party notice
  (`src/components/ConsentNotice.tsx`) records `granted` / `denied` in
  `localStorage["kaamdaar.analytics.consent"]` and the notice is only rendered when a PostHog project
  token + host are configured.
- Capture is consent-gated twice: the SDK is created with `opt_out_capturing_by_default: true` and
  every capture helper re-checks the stored decision. **No decision = analytics off.**
- `granted` → `opt_in_capturing()`; `denied` → `opt_out_capturing()`. There is no cookieless
  fallback. No CMP existed, so nothing was replaced.

## Configuration

| Variable | Where | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` | `.env.local` (git-ignored), empty placeholder in `.env.example` | public project token only; empty = analytics off |
| `NEXT_PUBLIC_POSTHOG_HOST` | `.env.local` (git-ignored), empty placeholder in `.env.example` | ingestion host, e.g. `https://us.i.posthog.com` (US) or `https://eu.i.posthog.com` (EU); empty or not http(s) = analytics off |

`.env.example` is the canonical example file for this change (the existing `.env.local.example`
is left untouched — it still documents only the Firebase variables).

Initialisation boundary: `src/instrumentation-client.ts` (the Next.js 16 supported client
instrumentation entry point) calls `initAnalytics()` from `src/lib/analytics.ts`; the app and the
instrumentation entry share one client instance through a `globalThis` bridge, so there is no second
singleton. Client config: `autocapture`, `capture_pageview`, `capture_pageleave`,
`capture_dead_clicks` off, session recording/surveys/external deps/feature flags disabled,
`before_send` rewriting every event's properties to the allowlist above (plus `$geoip_disable: true`)
and dropping `$set` / `$set_once`.

## Integrated version evidence

- Importer: root package `kaamdaar` (`package.json` → `"posthog-js": "1.438.13"`, exact pin).
- Install command used: `npm install posthog-js@1.438.13` (npm, original `package-lock.json` updated in
  place; no second manager, no migration).
- `package-lock.json` → `packages["node_modules/posthog-js"].version = 1.438.13`,
  resolved `https://registry.npmjs.org/posthog-js/-/posthog-js-1.438.13.tgz`.

## Live analysis (the insight to build in step 5)

- **Insight type:** funnel, steps in this order (same order as the contract above).
- **Denominator:** unique persons with `service_providers_viewed` in the window.
- **Event order:** `service_providers_viewed` → `booking_checkout_opened` → `booking_confirmed`,
  conversion window **7 days**, counted on **unique persons**.
- **Timeframe:** last 7 days, compared with the previous 7 days when enough data exists.
- **Success measure:** `booking_confirmed ÷ service_providers_viewed` (end-to-end booking conversion)
  plus the drop-off at each step; the step with the biggest loss is the named finding.
- **How to read it:** events only arrive when a PostHog token + host are set and the visitor granted
  consent in the notice, so an empty insight means "not configured / not consented", not "no traffic".
- Data is only produced by real visits; nothing is deployed and no test sends anything.

## Checks after the change

- `node posthog-analytics.verify.mjs` → **pass**: 13 tests, 151 assertions, no network.
- `npx tsc --noEmit` → **pass** (exit 0).
- `npm run build` → **pass**: Turbopack build, 37 pages; the client-instrumentation chunk is
  injected into the served page HTML.
- `npm run lint` → **exit 0** with 1 warning (an unused `eslint-disable` directive in
  `src/components/AppProvider.tsx`). Note: the 8 baseline errors were annotated/removed in the
  working copy by edits made outside this task while it ran; this change added no new lint findings
  and contains no suppressions of its own.

## Offline verification

- `posthog-analytics.verify.mjs` (root) runs `posthog-analytics.test.mjs` with `node --test`,
  `shell: false`, a bounded timeout and a minimal child env (OS/path/temp values plus a fixed
  synthetic project token and host — never a real `phc_`/`phx_` value).
- The suite calls the real instrumented helpers (`src/lib/analytics.ts`) with an in-memory transport
  injected through the documented factory seam, blocks `fetch`, and asserts: missing token/host and
  denied/undecided consent send nothing; each real action emits exactly once; the `before_send`
  scrubber keeps only allowlisted properties and drops URL/referrer/person metadata plus
  email/phone/card sentinels; a throwing transport leaves the caller's result intact; identity is
  opaque and stable and `reset()` fires on logout; the manifest pins 1.438.13, the original lock
  resolves it, and no extra lockfile appeared; `.env.local.example` declares empty placeholders and
  `.env*` stays git-ignored.
