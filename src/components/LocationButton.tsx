"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, MapPin, Navigation } from "lucide-react";
import { useApp } from "./AppProvider";
import { formatDistance } from "../lib/geo";
import { nearbyAreas } from "../lib/areas";

interface Props { variant?: "pill" | "inline"; className?: string }

export default function LocationButton({ variant = "pill", className = "" }: Props) {
  const { location, locating, locationError, radiusKm, providers, detectLocation } = useApp();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onClick(e: MouseEvent) { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, []);
  const areas = nearbyAreas(location, radiusKm, providers);
  const label = location?.label ?? (locating ? "Detecting current location…" : locationError ? "Location unavailable" : "Allow location");
  const base = variant === "pill"
    ? "flex w-fit min-w-0 max-w-[min(38vw,24rem)] shrink items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700"
    : "flex w-fit min-w-0 max-w-full items-center gap-1.5 text-sm font-medium text-slate-700";
  return <div ref={boxRef} className={`relative min-w-0 ${className}`}>
    <button type="button" onClick={() => setOpen(v => !v)} className={base} title={label} aria-expanded={open}>
      {locating ? <Loader2 className="h-4 w-4 animate-spin text-blue-600"/> : <MapPin className="h-4 w-4 text-blue-600"/>}
      <span className="min-w-0 flex-1 truncate text-left">{label}</span><ChevronDown className="h-3.5 w-3.5 text-slate-400"/>
    </button>
    {open && <div className="absolute left-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Detected current location</p><p className="mt-1 text-xs font-semibold text-slate-700">{label}</p></div>
        <button type="button" onClick={() => void detectLocation(true)} disabled={locating} aria-label="Refresh current location" className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"><Navigation className="h-4 w-4"/></button>
      </div>
      <div className="px-4 py-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Areas within {radiusKm} km</p>
        {areas.length ? <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto">{areas.map(a => <li key={a.name} className="flex justify-between gap-2 text-xs"><span className="font-medium text-slate-700">{a.name}</span><span className="text-slate-400">{formatDistance(a.km)} · {a.pros} Pros</span></li>)}</ul> : <p className="mt-2 text-xs text-slate-500">No service areas found in this radius.</p>}
      </div>
      {locationError && <p className="border-t border-red-100 px-4 py-2 text-xs text-red-600">{locationError}</p>}
    </div>}
  </div>;
}
