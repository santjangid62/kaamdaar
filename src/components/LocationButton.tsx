"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, MapPin, Navigation } from "lucide-react";
import { useApp } from "./AppProvider";
import { CITY_CLUSTERS, formatDistance } from "../lib/geo";
import { nearbyAreas } from "../lib/areas";

interface Props {
  /** "pill" for the navbar, "inline" for in-page use. */
  variant?: "pill" | "inline";
  className?: string;
}

/**
 * Location control: tries browser geolocation first, and when that is denied
 * (or unavailable) the user can pick a city manually so the rest of the site —
 * rates, nearby Pros, radius filtering — still works.
 */
export default function LocationButton({ variant = "pill", className = "" }: Props) {
  const {
    location,
    locating,
    locationError,
    radiusKm,
    setRadiusKm,
    providers,
    detectLocation,
    setLocation,
  } = useApp();
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- gate client-only loading UI until hydration
    setHydrated(true);

    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const isLocating = hydrated && locating;
  const label = location
    ? location.label
    : isLocating
      ? "Detecting location…"
      : locationError
          ? "Try location again"
          : "Allow location";
  const areas = nearbyAreas(location, radiusKm, providers);

  const base =
    variant === "pill"
      ? "hidden max-w-[14rem] items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 md:flex"
      : "flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-blue-600";

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={base}
        title="Current location"
        aria-expanded={open}
      >
        {isLocating ? (
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
        ) : (
          <MapPin className="h-4 w-4 shrink-0 text-blue-600" />
        )}
        <span className="truncate">{label}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              void detectLocation();
            }}
            className="flex w-full items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-semibold text-blue-600 hover:bg-blue-50"
          >
            <Navigation className="h-4 w-4" /> Use my current location
          </button>
          {location && (
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {location.accuracy === undefined ? "Selected coordinates" : "Detected coordinates"}
              </p>
              <p className="mt-1 text-xs font-medium tabular-nums text-slate-700">
                {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
              </p>
              {location.accuracy !== undefined && (
                <p className="mt-1 text-[11px] text-slate-500">
                  Reported accuracy ±{Math.round(location.accuracy)} m
                </p>
              )}
            </div>
          )}
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Nearby radius
            </p>
            <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
              {([3, 5] as const).map((radius) => (
                <button
                  key={radius}
                  type="button"
                  aria-pressed={radiusKm === radius}
                  onClick={() => setRadiusKm(radius)}
                  className={`rounded-md px-2 py-1.5 text-xs font-semibold ${radiusKm === radius ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                >
                  {radius} km
                </button>
              ))}
            </div>
          </div>
          {location && (
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Nearby areas
              </p>
              {areas.length ? (
                <ul className="mt-2 max-h-36 space-y-2 overflow-y-auto">
                  {areas.map((area) => (
                    <li key={`${area.city}-${area.name}`} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-medium text-slate-700">{area.name}, {area.city}</span>
                      <span className="shrink-0 text-slate-400">{formatDistance(area.km)} · {area.pros} Pros</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-slate-500">No providers in this radius yet.</p>
              )}
            </div>
          )}
          <p className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Or choose your city
          </p>
          <ul className="max-h-64 overflow-y-auto pb-2">
            {CITY_CLUSTERS.map((c) => (
              <li key={c.name}>
                <button
                  type="button"
                  onClick={() => {
                    setLocation({ lat: c.lat, lng: c.lng, label: c.name, city: c.name });
                    setOpen(false);
                  }}
                  className={
                    location && location.label === c.name
                      ? "flex w-full items-center justify-between px-4 py-2 text-left text-sm font-semibold text-blue-600 hover:bg-blue-50"
                      : "flex w-full items-center justify-between px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  }
                >
                  {c.name}
                  {location && location.label === c.name && (
                    <MapPin className="h-3.5 w-3.5" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
