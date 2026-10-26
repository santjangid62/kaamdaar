"use client";

import { useSyncExternalStore } from "react";
import { BarChart3 } from "lucide-react";
import { useApp } from "./AppProvider";
import {
  identifyAccount,
  isAnalyticsConfigured,
  readConsent,
  setAnalyticsConsent,
  subscribeToAnalyticsConsent,
} from "../lib/analytics";

/**
 * Analytics consent notice.
 *
 * The app collects no product analytics until the visitor answers. Nothing is
 * rendered at all when no PostHog project token/host is configured, so the
 * notice never appears in an unconfigured deployment.
 */
export default function ConsentNotice() {
  const consent = useSyncExternalStore(
    subscribeToAnalyticsConsent,
    readConsent,
    () => null,
  );
  const { user } = useApp();

  if (!isAnalyticsConfigured() || consent !== null) return null;

  function decide(granted: boolean) {
    setAnalyticsConsent(granted ? "granted" : "denied");
    if (granted && user) void identifyAccount(user.id);
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 sm:left-auto sm:right-4 sm:w-96">
      <div className="card p-4 shadow-xl shadow-slate-900/10">
        <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <BarChart3 className="h-4 w-4 text-blue-600" /> Help us improve booking?
        </p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          With your permission we record which service and booking steps are used,
          using a pseudonymous ID. No phone number, name, email or address is sent.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => decide(true)}
            className="btn-primary flex-1 py-2 text-xs"
          >
            Allow analytics
          </button>
          <button
            type="button"
            onClick={() => decide(false)}
            className="btn-ghost flex-1 py-2 text-xs"
          >
            No thanks
          </button>
        </div>
      </div>
    </div>
  );
}
