"use client";

import { LoaderCircle, MapPin, X } from "lucide-react";
import { useApp } from "./AppProvider";
import { useLang } from "../lib/i18n";

export default function LocationNotice() {
  const {
    locating,
    locationError,
    locationPromptVisible,
    detectLocation,
    dismissLocationPrompt,
  } = useApp();
  const { s } = useLang();

  if (!locationPromptVisible) return null;

  return (
    <aside className="fixed inset-x-3 top-20 z-70 mx-auto max-w-md" role="status" aria-live="polite">
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-white p-4 shadow-lg">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-blue-50 text-blue-700">
          <MapPin className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900">{s.location.title}</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            {locationError ? s.location.denied : s.location.description}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void detectLocation()}
              disabled={locating}
              className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:cursor-wait disabled:opacity-70"
            >
              {locating ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
              {locating ? s.location.locating : s.location.allow}
            </button>
            <button
              type="button"
              onClick={dismissLocationPrompt}
              className="rounded-md px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              {s.location.dismiss}
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismissLocationPrompt}
          aria-label={s.location.close}
          className="-mr-1 -mt-1 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
