/**
 * Client instrumentation (Next.js `instrumentation-client` convention).
 *
 * Runs once per page, after the document is loaded and before hydration, so the
 * single PostHog client exists before any screen can emit an event. Missing
 * project token/host keeps analytics off; nothing here throws.
 */
import { initAnalytics } from "./lib/analytics";

try {
  initAnalytics();
} catch {
  /* analytics must never block the app from becoming interactive */
}
