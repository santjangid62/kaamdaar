/**
 * Offline verification for the PostHog booking-journey instrumentation.
 *
 * Run through `posthog-analytics.verify.mjs` (or `node --test posthog-analytics.test.mjs`).
 * The suite drives the real handlers in `src/lib/analytics.ts` — the same
 * functions the providers and booking screens call — with an in-memory client
 * injected through the module's documented factory seam. No network, no real
 * project token: the token below is a fixed synthetic value.
 */

import { strict as assert } from "node:assert";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = dirname(fileURLToPath(import.meta.url));
const read = (relative) => readFileSync(join(root, relative), "utf8");

/* ------------------------- network is denied up front ---------------------- */

const networkAttempts = [];
globalThis.fetch = (...args) => {
  networkAttempts.push(args[0]);
  throw new Error("network denied during offline verification");
};

/* --------------------- a minimal in-memory browser window ------------------ */

function createStorage() {
  const items = new Map();
  return {
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => {
      items.set(key, String(value));
    },
    removeItem: (key) => {
      items.delete(key);
    },
    clear: () => items.clear(),
    key: (index) => Array.from(items.keys())[index] ?? null,
    get length() {
      return items.size;
    },
  };
}

const storage = createStorage();
const browserWindow = new EventTarget();
browserWindow.localStorage = storage;
globalThis.window = browserWindow;

const analytics = await import("./src/lib/analytics.ts");

/* ----------------------- in-memory analytics transport --------------------- */

function createMemoryClient({ failing = false } = {}) {
  const record = {
    captures: [],
    identities: [],
    resets: 0,
    optIns: 0,
    optOuts: 0,
  };
  return {
    record,
    capture(event, properties) {
      if (failing) throw new Error("transport down");
      record.captures.push({ event, properties });
    },
    identify(distinctId, properties) {
      if (failing) throw new Error("transport down");
      record.identities.push({ distinctId, properties });
    },
    reset() {
      record.resets += 1;
    },
    opt_in_capturing() {
      record.optIns += 1;
    },
    opt_out_capturing() {
      record.optOuts += 1;
    },
  };
}

const SYNTHETIC_TOKEN = "synthetic-project-token-offline-verification";
const SYNTHETIC_HOST = "https://us.i.posthog.com";
const PHONE = "+919876543210";

let clientConfigSeen = null;
let factoryCalls = 0;

function configure(token = SYNTHETIC_TOKEN, host = SYNTHETIC_HOST) {
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = token;
  process.env.NEXT_PUBLIC_POSTHOG_HOST = host;
}

function freshState() {
  delete globalThis[analytics.ANALYTICS_CLIENT_KEY];
  storage.clear();
  clientConfigSeen = null;
  factoryCalls = 0;
  analytics.setAnalyticsClientFactory(null);
}

/** Start a session with the in-memory transport as the SDK. */
function startSession({ consent = null } = {}) {
  const client = createMemoryClient();
  analytics.setAnalyticsClientFactory((token, config) => {
    factoryCalls += 1;
    clientConfigSeen = { token, config };
    return client;
  });
  if (consent) storage.setItem(analytics.ANALYTICS_CONSENT_KEY, consent);
  const started = analytics.initAnalytics();
  return { client, started };
}

/* ------------------------------ assertion count ---------------------------- */

let assertions = 0;
function ok(condition, message) {
  assertions += 1;
  assert.ok(condition, message);
}
function same(actual, expected, message) {
  assertions += 1;
  assert.deepStrictEqual(actual, expected, message);
}

/* -------------------------------- the tests -------------------------------- */

test("configuration guard: missing or unusable token/host never creates a client", () => {
  freshState();

  configure("", SYNTHETIC_HOST);
  same(analytics.analyticsConfig(), null, "empty token keeps analytics off");
  same(analytics.initAnalytics(), false, "no client without a token");
  same(globalThis[analytics.ANALYTICS_CLIENT_KEY], undefined, "no client is bridged");
  same(factoryCalls, 0, "the SDK factory is never called without a token");

  configure(SYNTHETIC_TOKEN, "");
  same(analytics.initAnalytics(), false, "no client without an ingestion host");

  configure(SYNTHETIC_TOKEN, "not-a-url");
  same(analytics.analyticsConfig(), null, "a non-http host keeps analytics off");
  same(analytics.initAnalytics(), false, "no client with an unusable host");

  same(analytics.trackServiceProvidersViewed({ serviceId: "deep-cleaning", category: "Cleaning", providerCount: 3 }), false, "capture is a no-op");
  same(factoryCalls, 0, "still nothing initialised");
  same(networkAttempts.length, 0, "no network attempt during configuration checks");
});

test("no consent decision means analytics stays off, opt-out is applied at init", () => {
  freshState();
  configure();
  const { client, started } = startSession();

  ok(started, "a configured deployment creates the client");
  same(factoryCalls, 1, "exactly one client is created");
  same(client.record.optOuts, 1, "the client is opted out while there is no decision");

  same(analytics.readConsent(), null, "no decision has been stored");
  same(analytics.trackServiceProvidersViewed({ serviceId: "deep-cleaning", category: "Cleaning", providerCount: 2 }), false, "capture is refused");
  same(client.record.captures.length, 0, "nothing is sent without consent");
});

test("denied consent sends nothing and ignores identity", async () => {
  freshState();
  configure();
  const { client } = startSession({ consent: "denied" });

  same(analytics.readConsent(), "denied", "the denial is stored");
  ok(client.record.optOuts >= 1, "opting out is pushed to the client");

  same(analytics.trackServiceProvidersViewed({ serviceId: "deep-cleaning", category: "Cleaning", providerCount: 2 }), false, "providers-viewed refused");
  same(analytics.trackBookingCheckoutOpened({ serviceId: "deep-cleaning", providerId: "p-1" }), false, "checkout refused");
  same(analytics.trackBookingConfirmed({ serviceId: "deep-cleaning", mode: "instant", amountInr: 499 }), false, "confirm refused");
  same(await analytics.identifyAccount(PHONE), null, "identity is not sent");
  same(client.record.captures.length, 0, "no event left the browser");
  same(client.record.identities.length, 0, "no identify call happened");
});

test("the client is configured with privacy defaults and no automatic capture", () => {
  freshState();
  configure();
  startSession();

  ok(clientConfigSeen !== null, "the SDK received a configuration");
  same(clientConfigSeen.token, SYNTHETIC_TOKEN, "the public project token comes from configuration");
  const config = clientConfigSeen.config;
  same(config.api_host, SYNTHETIC_HOST, "the ingestion host is explicit configuration");
  same(config.autocapture, false, "autocapture is off");
  same(config.capture_pageview, false, "pageviews are off");
  same(config.capture_pageleave, false, "pageleave is off");
  same(config.capture_dead_clicks, false, "dead clicks are off");
  same(config.disable_session_recording, true, "session recording is off");
  same(config.disable_surveys, true, "surveys are off");
  same(config.disable_external_dependency_loading, true, "no remote scripts are loaded");
  same(config.advanced_disable_flags, true, "feature flags are off");
  same(config.person_profiles, "identified_only", "no person profiles for anonymous events");
  same(config.opt_out_capturing_by_default, true, "capture starts opted out");
  same(config.respect_dnt, true, "DNT is respected");
  same(typeof config.before_send, "function", "the property scrubber is wired into the SDK");
});

test("granted consent emits each real journey action exactly once with allowlisted properties", () => {
  freshState();
  configure();
  const { client } = startSession({ consent: "granted" });

  ok(client.record.optIns >= 1, "opting in is pushed to the client");

  // The three calls the instrumented screens make.
  const viewed = analytics.trackServiceProvidersViewed({
    serviceId: "deep-cleaning",
    category: "Cleaning",
    providerCount: 4,
  });
  const checkout = analytics.trackBookingCheckoutOpened({
    serviceId: "deep-cleaning",
    providerId: "demo-deep-cleaning-1",
  });
  const confirmed = analytics.trackBookingConfirmed({
    serviceId: "deep-cleaning",
    mode: "scheduled",
    amountInr: 499,
  });

  same([viewed, checkout, confirmed], [true, true, true], "each handler reports one capture");
  same(
    client.record.captures.map((entry) => entry.event),
    ["service_providers_viewed", "booking_checkout_opened", "booking_confirmed"],
    "the funnel emits the three contracted events, once each",
  );

  const [viewedEvent, checkoutEvent, confirmedEvent] = client.record.captures;
  same(viewedEvent.properties, { service_id: "deep-cleaning", service_category: "Cleaning", provider_count: 4 }, "providers-viewed payload");
  same(checkoutEvent.properties, { service_id: "deep-cleaning", provider_id: "demo-deep-cleaning-1" }, "checkout payload");
  same(confirmedEvent.properties, { service_id: "deep-cleaning", booking_mode: "scheduled", amount_inr: 499 }, "confirm payload");

  const allowed = new Set(analytics.ALLOWED_EVENT_PROPERTIES);
  for (const entry of client.record.captures) {
    for (const key of Object.keys(entry.properties)) {
      ok(allowed.has(key), `property ${key} is allowlisted`);
    }
  }
  same(networkAttempts.length, 0, "no network call is made in the offline suite");
});

test("sensitive data never leaves: scrubber keeps only allowlisted properties", () => {
  const sentinels = {
    email: "leak-sentinel@example.com",
    phone: PHONE,
    password: "correct-horse-sentinel",
    token: "secret-sentinel-token",
    card: "4242424242424242",
  };

  const synthetic = {
    event: "service_providers_viewed",
    distinct_id: "u_0123456789abcdef0123456789abcdef",
    properties: {
      service_id: "deep-cleaning",
      service_category: "Cleaning",
      provider_count: 4,
      email: sentinels.email,
      phone: sentinels.phone,
      password: sentinels.password,
      token: sentinels.token,
      card: sentinels.card,
      $current_url: `https://kaamdaar.test/book/x/y?phone=${encodeURIComponent(sentinels.phone)}&token=${sentinels.token}`,
      $referrer: `https://referrer.test/?email=${sentinels.email}`,
      $referring_domain: "referrer.test",
      $host: "kaamdaar.test",
      $pathname: "/book/x/y",
      $session_id: "session-sentinel",
    },
    $set: { email: sentinels.email, phone: sentinels.phone },
    $set_once: { first_seen: "2026-10-24" },
  };

  const scrubbed = analytics.scrubEvent(synthetic);
  same(
    Object.keys(scrubbed.properties).sort(),
    ["$geoip_disable", "provider_count", "service_category", "service_id"],
    "only allowlisted properties survive, with GeoIP disabled",
  );
  same(scrubbed.$set, undefined, "person properties are dropped");
  same(scrubbed.$set_once, undefined, "person set-once properties are dropped");

  const serialised = JSON.stringify(scrubbed);
  for (const [name, value] of Object.entries(sentinels)) {
    ok(!serialised.includes(value), `${name} sentinel is not in the captured payload`);
  }
  ok(!serialised.includes("kaamdaar.test"), "no page URL survives");
  ok(!serialised.includes("referrer.test"), "no referrer survives");

  // the same scrubber is the one the live client uses
  freshState();
  configure();
  startSession();
  const liveScrubber = clientConfigSeen.config.before_send;
  const liveEvent = {
    event: "booking_confirmed",
    properties: {
      service_id: "deep-cleaning",
      booking_mode: "instant",
      amount_inr: 499,
      email: sentinels.email,
      $current_url: `https://kaamdaar.test/profile?token=${sentinels.token}`,
    },
    $set: { email: sentinels.email },
  };
  const liveScrubbed = liveScrubber(liveEvent);
  same(
    Object.keys(liveScrubbed.properties).sort(),
    ["$geoip_disable", "amount_inr", "booking_mode", "service_id"],
    "the live client runs the same allowlist scrubber",
  );
  ok(!JSON.stringify(liveScrubbed).includes(sentinels.email), "email never reaches the transport");
});

test("a failing transport leaves the caller's result intact", async () => {
  freshState();
  configure();
  const { record } = createMemoryClient({ failing: true });
  const failing = createMemoryClient({ failing: true });
  analytics.setAnalyticsClientFactory(() => failing);
  storage.setItem(analytics.ANALYTICS_CONSENT_KEY, "granted");
  ok(analytics.initAnalytics(), "the client is created");

  const booking = { id: "bk-1", status: "scheduled" };
  const submit = () => {
    analytics.trackBookingConfirmed({ serviceId: "deep-cleaning", mode: "scheduled", amountInr: 499 });
    return booking;
  };
  same(submit(), booking, "the booking result survives a transport failure");
  same(analytics.trackServiceProvidersViewed({ serviceId: "deep-cleaning", category: "Cleaning", providerCount: 1 }), false, "the failed capture reports false");
  same(await analytics.identifyAccount(PHONE), null, "a failed identify stays harmless");
  same(record.captures.length, 0, "nothing is recorded by the failing transport");
  analytics.resetAnalytics();
  same(failing.record.resets, 1, "reset still works on a failing client");
});

test("identity is an opaque stable id and logout resets it", async () => {
  freshState();
  configure();
  const { client } = startSession({ consent: "granted" });

  const first = await analytics.identifyAccount(PHONE);
  const second = await analytics.identifyAccount(PHONE);

  ok(typeof first === "string", "an identity is produced");
  same(first, second, "the account id is stable across calls");
  ok(first.startsWith("u_"), "the identity uses the app's opaque prefix");
  same(first.length, 34, "the identity is a fixed-length opaque hash");
  ok(!first.includes("9876543210"), "the phone number is not recoverable from the id");
  ok(!first.includes("+91"), "the country code is not in the id");

  same(client.record.identities.length, 2, "each identify call reaches the client");
  same(client.record.identities[0].distinctId, first, "the client identifies with the opaque id");
  same(client.record.identities[0].properties, undefined, "no person traits are sent");

  // a different account gets a different id
  const other = await analytics.identifyAccount("+919000000001");
  ok(other !== first, "distinct accounts get distinct opaque ids");

  analytics.resetAnalytics();
  same(client.record.resets, 1, "logout resets the client identity");
});

test("consent can be granted and withdrawn, and drives opt-in/opt-out", () => {
  freshState();
  configure();
  const { client } = startSession();
  const baseOptOuts = client.record.optOuts;
  const baseOptIns = client.record.optIns;

  analytics.setAnalyticsConsent("granted");
  same(analytics.readConsent(), "granted", "the grant is persisted");
  same(client.record.optIns, baseOptIns + 1, "opting in is applied once");
  same(
    analytics.trackServiceProvidersViewed({ serviceId: "deep-cleaning", category: "Cleaning", providerCount: 2 }),
    true,
    "capture starts working after consent",
  );

  analytics.setAnalyticsConsent("denied");
  same(analytics.readConsent(), "denied", "the withdrawal is persisted");
  same(client.record.optOuts, baseOptOuts + 1, "opting out is applied once");
  same(
    analytics.trackServiceProvidersViewed({ serviceId: "deep-cleaning", category: "Cleaning", providerCount: 2 }),
    false,
    "capture stops again after withdrawal",
  );
  same(client.record.captures.length, 1, "only the consented event was sent");
});

test("the real screens call the instrumented handlers", () => {
  const providers = read("src/app/services/[slug]/providers/page.tsx");
  const booking = read("src/app/book/[serviceId]/[providerId]/page.tsx");
  const provider = read("src/components/AppProvider.tsx");

  ok(providers.includes("trackServiceProvidersViewed"), "providers list emits the funnel start");
  ok(providers.includes("trackBookingCheckoutOpened"), "Book now emits the checkout step");
  ok(booking.includes("trackBookingConfirmed"), "confirm booking emits the success step");
  ok(provider.includes("identifyAccount"), "sign-in identifies the opaque account");
  ok(provider.includes("resetAnalytics"), "logout resets the identity");
  ok(read("src/components/ConsentNotice.tsx").includes("setAnalyticsConsent"), "the consent notice records the decision");
  ok(read("src/instrumentation-client.ts").includes("initAnalytics"), "the instrumentation boundary initialises analytics");
});

test("manifest and lock pin posthog-js 1.438.13 in the original npm importer", () => {
  const manifest = JSON.parse(read("package.json"));
  const lock = JSON.parse(read("package-lock.json"));

  same(manifest.dependencies["posthog-js"], "1.438.13", "the manifest pins the exact version");
  same(lock.lockfileVersion, 3, "the original npm lockfile is still used");
  same(lock.packages[""].dependencies["posthog-js"], "1.438.13", "the lock root records the pin");
  same(lock.packages["node_modules/posthog-js"].version, "1.438.13", "the lock resolves 1.438.13");
  ok(
    String(lock.packages["node_modules/posthog-js"].resolved).includes("posthog-js-1.438.13.tgz"),
    "the lock resolves the pinned tarball",
  );
  ok(existsSync(join(root, "package-lock.json")), "the original lock path still exists");
  for (const other of ["yarn.lock", "pnpm-lock.yaml", "bun.lockb", "bun.lock"]) {
    ok(!existsSync(join(root, other)), `no ${other} was introduced`);
  }
});

test("configuration is env-driven, placeholders are empty and env files stay ignored", () => {
  const example = read(".env.example");
  ok(example.includes("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=\n"), "the example declares an empty project token");
  ok(example.includes("NEXT_PUBLIC_POSTHOG_HOST="), "the example declares the host");
  ok(read(".gitignore").includes(".env*"), "local env files are git-ignored");

  const sources = [];
  const walk = (dir) => {
    for (const name of readdirSync(join(root, dir))) {
      const relative = `${dir}/${name}`;
      if (statSync(join(root, relative)).isDirectory()) walk(relative);
      else sources.push(relative);
    }
  };
  walk("src");
  for (const file of sources) {
    const content = read(file);
    ok(!/\bph[circx]_[A-Za-z0-9]/.test(content), `${file} holds no real PostHog token literal`);
  }
  ok(read("src/lib/analytics.ts").includes("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN"), "the token name is read from configuration");
  ok(read("src/lib/analytics.ts").includes("NEXT_PUBLIC_POSTHOG_HOST"), "the host name is read from configuration");
  same(networkAttempts.length, 0, "the whole suite stayed offline");
});

test("assertion budget", (t) => {
  t.diagnostic(`assertions: ${assertions}`);
  ok(assertions >= 60, "the suite really asserted its behaviour");
});
