"use client";

import { LoaderCircle, MapPin, Navigation, ShieldCheck } from "lucide-react";
import { useApp } from "./AppProvider";
import { useLang } from "../lib/i18n";

/** Customer-only location gate. GPS is requested from a clear user gesture. */
export default function LocationNotice() {
  const { locating, locationError, locationPromptVisible, detectLocation } = useApp();
  const { s } = useLang();
  if (!locationPromptVisible) return null;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-[#071a32]/80 px-4 py-8 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="location-gate-title">
      <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-[0_35px_100px_-25px_rgba(0,0,0,0.55)]">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#0b2545] via-[#124d7c] to-[#1476a8] px-7 pb-10 pt-9 text-white">
          <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full border-[24px] border-white/10" />
          <div className="pointer-events-none absolute -bottom-24 -left-12 h-48 w-48 rounded-full bg-cyan-300/20 blur-2xl" />
          <div className="relative mx-auto grid h-20 w-20 place-items-center rounded-3xl border border-white/20 bg-white/15 shadow-lg backdrop-blur">
            <MapPin className="h-10 w-10 text-white" strokeWidth={2.2} />
            <span className="absolute -bottom-2 -right-2 grid h-8 w-8 place-items-center rounded-full border-4 border-[#14517d] bg-orange-400 text-[#09233e]"><Navigation className="h-4 w-4" /></span>
          </div>
          <p className="relative mt-6 text-center text-xs font-bold uppercase tracking-[0.22em] text-cyan-100">Welcome to Kaamdaar</p>
          <h2 id="location-gate-title" className="relative mt-2 text-center text-3xl font-black tracking-tight">Find help near you</h2>
          <p className="relative mx-auto mt-3 max-w-xs text-center text-sm leading-6 text-blue-100">Allow your current location to discover nearby professionals and book trusted services in your area.</p>
        </div>
        <div className="px-7 pb-7 pt-6">
          <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
            <p className="text-xs leading-5 text-slate-600">Your location is used to find nearby Kaamdaar professionals and support your active booking. Admin does not request its own location through this website prompt.</p>
          </div>
          {locationError && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700">{locationError}</p>}
          <button type="button" onClick={() => void detectLocation(true)} disabled={locating} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-400 to-amber-400 px-5 py-4 text-base font-extrabold text-[#102b46] shadow-lg shadow-orange-200 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-wait disabled:opacity-70">
            {locating ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Navigation className="h-5 w-5" />}
            {locating ? "Detecting your location…" : locationError ? "Try location again" : "Allow location & continue"}
          </button>
          <p className="mt-4 text-center text-[11px] leading-5 text-slate-400">Please choose “Allow” in your browser permission prompt. Location access is required to continue using the customer website.</p>
        </div>
      </div>
    </div>
  );
}
