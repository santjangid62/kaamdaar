"use client";

import Link from "next/link";
import {
  ArrowRight,
  MapPin,
  Navigation,
  Radar,
  Users,
} from "lucide-react";
import { useApp } from "./AppProvider";
import { fill, useLang, useServiceLabels } from "../lib/i18n";
import { formatDistance } from "../lib/geo";
import { nearbyAreas } from "../lib/areas";
import type { Provider } from "../lib/types";
import LocationButton from "./LocationButton";

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Coverage section — its own framed panel (navy header + map-grid body) so it
 * reads as a distinct block: which localities we serve, how far they are, and
 * the live Pros working there with the services they offer.
 */
export default function AreasWeServe() {
  const {
    location,
    detectLocation,
    locating,
    locationError,
    providers,
    services,
    radiusKm,
    setRadiusKm,
  } = useApp();
  const { s, lang } = useLang();
  const serviceLabels = useServiceLabels();

  const t = (en: string, hi: string) => (lang === "hi" ? hi : en);
  const areas = nearbyAreas(location, radiusKm, providers);
  const serviceById = new Map(services.map((service) => [service.id, service]));
  const prosNear = new Set(areas.flatMap((a) => a.providers.map((p) => p.id))).size;

  /** services offered by the Pros working in this area (deduped, capped) */
  function areaServices(list: Provider[]) {
    const ids = Array.from(new Set(list.flatMap((p) => p.services ?? [])));
    return ids
      .map((id) => serviceById.get(id))
      .filter((svc): svc is NonNullable<typeof svc> => Boolean(svc))
      .slice(0, 4)
      .map((svc) => ({ id: svc.id, name: serviceLabels(svc).name }));
  }

  return (
    <section
      id="areas"
      className="relative scroll-mt-20 overflow-hidden bg-linear-to-b from-blue-50/80 via-white to-white py-16"
    >
      {/* section-level glow, so the block sits apart from the white sections */}
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-blue-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-4 h-64 w-64 rounded-full bg-flame-100/70 blur-3xl" />

      <div className="section-shell relative">
        <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_28px_70px_-46px_rgba(15,23,42,0.55)]">
          {/* ── header band ─────────────────────────────────── */}
          <div className="relative overflow-hidden bg-navy px-6 py-8 sm:px-9 sm:py-10">
            <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-flame/25 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 left-1/4 h-56 w-56 rounded-full bg-blue-600/40 blur-3xl" />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-20 mask-[linear-gradient(to_bottom,black,transparent_75%)]"
              style={{
                backgroundImage: "radial-gradient(circle, #8ab6e0 1px, transparent 1px)",
                backgroundSize: "22px 22px",
              }}
            />

            <div className="relative flex flex-wrap items-end justify-between gap-6">
              <div className="min-w-0 max-w-xl">
                <span className="inline-flex items-center gap-2 rounded-full border border-flame-400/40 bg-white/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white">
                  <Radar className="h-3.5 w-3.5 text-flame-400" />
                  {t("Live service coverage", "लाइव सेवा कवरेज")}
                </span>

                <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                  {s.areas.heading}
                </h2>
                <p className="mt-2 text-sm leading-6 text-blue-200 sm:text-base">
                  {fill(s.areas.sub, { km: radiusKm })}
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-2.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/15">
                    <MapPin className="h-3.5 w-3.5 text-flame-400" />
                    {areas.length} {t("areas", "क्षेत्र")}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/15">
                    <Users className="h-3.5 w-3.5 text-flame-400" />
                    {prosNear} {s.areas.pros} {t("nearby", "आस-पास")}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-start gap-3 sm:items-end">
                <div
                  className="inline-flex rounded-full bg-white/10 p-1 ring-1 ring-white/20"
                  aria-label={s.areas.radius}
                >
                  {([3, 5] as const).map((radius) => (
                    <button
                      key={radius}
                      type="button"
                      aria-pressed={radiusKm === radius}
                      onClick={() => setRadiusKm(radius)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                        radiusKm === radius
                          ? "bg-white text-navy shadow"
                          : "text-blue-100 hover:text-white"
                      }`}
                    >
                      {radius} km
                    </button>
                  ))}
                </div>
                <p className="flex items-center gap-1.5 text-xs font-semibold text-blue-100">
                  <MapPin className="h-3.5 w-3.5 text-flame-400" />
                  {location ? (
                    <>
                      {s.areas.updated}{" "}
                      <span className="max-w-52 truncate text-white">{location.label}</span>
                    </>
                  ) : (
                    s.areas.setLoc
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* ── body ────────────────────────────────────────── */}
          <div
            className="relative px-5 py-7 sm:px-8 sm:py-8"
            style={{
              backgroundImage: "radial-gradient(circle, #dbeafe 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          >
            {!location ? (
              <div className="mx-auto max-w-lg rounded-2xl border border-blue-200/70 bg-white/95 p-7 text-center shadow-sm backdrop-blur">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">
                  <Navigation className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-bold text-slate-800">{s.areas.setLoc}</p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                  <LocationButton variant="inline" />
                  <button
                    type="button"
                    onClick={() => void detectLocation()}
                    disabled={locating}
                    className="btn-primary"
                  >
                    {locating ? s.common.loading : s.areas.allow}
                  </button>
                </div>
                {locationError && <p className="mt-3 text-xs text-red-600">{locationError}</p>}
              </div>
            ) : areas.length === 0 ? (
              <div className="mx-auto flex max-w-lg flex-col items-center gap-3 rounded-2xl border border-dashed border-blue-200 bg-white/95 p-7 text-center shadow-sm">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-600">
                  <MapPin className="h-5 w-5" />
                </span>
                <p className="text-sm font-medium text-slate-600">
                  {fill(s.areas.none, { km: radiusKm })}
                </p>
                {radiusKm < 5 && (
                  <button
                    type="button"
                    onClick={() => setRadiusKm(5)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-blue-700"
                  >
                    <Radar className="h-3.5 w-3.5" />
                    {t("Search within 5 km", "5 किमी तक खोजें")}
                  </button>
                )}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {areas.map((a) => {
                  const live = a.pros > 0;
                  const chips = areaServices(a.providers);
                  return (
                    <article
                      key={`${a.city}-${a.name}`}
                      className="group relative min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_10px_-8px_rgba(15,23,42,0.35)] transition duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-[0_18px_34px_-22px_rgba(18,97,160,0.5)]"
                    >
                      <span
                        className={`absolute inset-x-0 top-0 h-1 ${
                          live
                            ? "bg-linear-to-r from-flame to-amber-400"
                            : "bg-slate-200"
                        }`}
                      />

                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition ${
                              live
                                ? "bg-flame-50 text-flame-600 group-hover:bg-flame group-hover:text-white"
                                : "bg-slate-100 text-slate-400"
                            }`}
                          >
                            <MapPin className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-extrabold text-navy">
                              {a.name}
                            </h3>
                            <p className="truncate text-[11px] text-slate-500">
                              {a.city} · {formatDistance(a.km)} {t("away", "दूर")}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            live
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              live ? "animate-pulse bg-emerald-500" : "bg-slate-400"
                            }`}
                          />
                          {a.pros} {s.areas.pros}
                        </span>
                      </div>

                      <div className="mt-3.5">
                        {a.providers.length === 0 ? (
                          <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                            {s.areas.noPros}
                          </p>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <div className="flex -space-x-2">
                                {a.providers.slice(0, 4).map((provider) => (
                                  <span
                                    key={provider.id}
                                    title={provider.name}
                                    className="grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-blue-100 text-[9px] font-bold text-blue-700"
                                  >
                                    {initials(provider.name)}
                                  </span>
                                ))}
                              </div>
                              <p className="truncate text-[11px] font-semibold text-slate-600">
                                {a.providers
                                  .slice(0, 2)
                                  .map((provider) => provider.name)
                                  .join(", ")}
                                {a.providers.length > 2
                                  ? ` +${a.providers.length - 2}`
                                  : ""}
                              </p>
                            </div>

                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {chips.map((chip) => (
                                <Link
                                  key={chip.id}
                                  href={`/services/${chip.id}/providers`}
                                  className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 transition hover:bg-blue-600 hover:text-white"
                                >
                                  {chip.name}
                                </Link>
                              ))}
                            </div>
                          </>
                        )}
                      </div>

                      {/* proximity: a fuller bar means the area is closer */}
                      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                        <span
                          className={`block h-full rounded-full ${
                            live
                              ? "bg-linear-to-r from-flame to-amber-400"
                              : "bg-slate-200"
                          }`}
                          style={{
                            width: `${Math.max(8, Math.min(100, (1 - a.km / radiusKm) * 100))}%`,
                          }}
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 pt-4">
              <p className="text-[11px] text-slate-500">
                {fill(s.providers.radiusNote, { km: radiusKm })}
              </p>
              <Link
                href="/services"
                className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
              >
                {t("Browse all services", "सभी सेवाएं देखें")}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
