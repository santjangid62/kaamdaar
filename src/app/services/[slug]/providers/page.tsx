"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  BellRing,
  Briefcase,
  CheckCircle2,
  Loader2,
  Navigation,
  ShieldCheck,
  Star,
  X,
} from "lucide-react";
import { useApp } from "../../../../components/AppProvider";
import DispatchMap, { type MapProviderMarker } from "../../../../components/DispatchMap";
import ProviderPanel from "../../../../components/ProviderPanel";
import LocationButton from "../../../../components/LocationButton";
import { fill, useLang, useServiceLabels } from "../../../../lib/i18n";
import {
  trackBookingCheckoutOpened,
  trackServiceProvidersViewed,
} from "../../../../lib/analytics";
import { formatDistance } from "../../../../lib/geo";
import { etaMinutes } from "../../../../lib/dispatch";
import { WIDE_RING_KM } from "../../../../lib/match";
import type { NearbyProvider } from "../../../../lib/providers";
import { createBooking, listBookings, updateBooking } from "../../../../lib/store";
import type {
  Address,
  Booking,
  GeoPoint,
  Provider,
  ProviderProfile,
  Service,
} from "../../../../lib/types";

type Phase = "idle" | "searching" | "found";

/** A Pro who accepted can sit outside the rendered ring snapshot — rebuild the
 *  card from the profile frozen into the booking. */
function fromProfile(profile?: ProviderProfile): NearbyProvider | null {
  if (!profile) return null;
  const provider: Provider = {
    id: profile.id,
    name: profile.name,
    services: [],
    lat: 0,
    lng: 0,
    city: "",
    rating: profile.rating,
    jobs: profile.jobs,
    experience: profile.experience,
    verified: profile.verified,
    policeVerified: profile.policeVerified,
    hourlyRate: profile.hourlyRate,
    reviewCount: profile.reviewCount,
    reviews: profile.reviews,
  };
  return { provider, distanceKm: profile.distanceKm };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function ProvidersFlow() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const slug = params.slug;
  const { location, user, locating, services, catalogReady } = useApp();
  const service = services.find((x) => x.id === slug) ?? null;
  const { s } = useLang();
  const labels = useServiceLabels();

  const dateParam = search.get("date");
  const timeParam = search.get("time");

  const [phase, setPhase] = useState<Phase>("idle");
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [foundIdx, setFoundIdx] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [matchInfo, setMatchInfo] = useState<{ radiusKm: number; ring: "near" | "wide" | "none" }>({
    radiusKm: WIDE_RING_KM,
    ring: "none",
  });
  const [matchLoading, setMatchLoading] = useState(false);
  const [dispatchRadiusKm, setDispatchRadiusKm] = useState<number>(WIDE_RING_KM);
  const [accepted, setAccepted] = useState<NearbyProvider | null>(null);
  const [selectedSubServiceIds, setSelectedSubServiceIds] = useState<string[]>([]);

  const center = useMemo<GeoPoint | null>(
    () => (location ? { lat: location.lat, lng: location.lng } : null),
    [location],
  );

  // Who gets this request is a backend decision: everyone serving it inside
  // the 3 km ring, widened to 5 km when that ring is empty, ranked by
  // distance/rating/reviews/experience. This page only renders the result.
  const [results, setResults] = useState<NearbyProvider[]>([]);
  useEffect(() => {
    if (!service || !center) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setMatchLoading(true);
    void (async () => {
      try {
        const res = await fetch(
          `/api/providers?serviceId=${encodeURIComponent(service.id)}&lat=${center.lat}&lng=${center.lng}`,
        );
        if (!res.ok) throw new Error(`match ${res.status}`);
        const data = (await res.json()) as {
          providers?: NearbyProvider[];
          radiusKm?: number;
          ring?: "near" | "wide" | "none";
        };
        if (cancelled) return;
        setResults(data.providers ?? []);
        setMatchInfo({
          radiusKm: data.radiusKm ?? WIDE_RING_KM,
          ring: data.ring ?? "none",
        });
        setDispatchRadiusKm(data.radiusKm ?? WIDE_RING_KM);
      } catch {
        // Keep the last good ring: a transient read error must never look like
        // "0 Pros nearby" and contradict a Pro who just accepted.
        if (cancelled) return;
      } finally {
        if (!cancelled) setMatchLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [service, center]);

  const addOnServices = services.filter((item) => (item as Service & { parent?: string }).parent === service?.id);
  const selectedAddOns = addOnServices.filter((item) => selectedSubServiceIds.includes(item.id));
  const bookingTotal = (service?.price ?? 0) + selectedAddOns.reduce((sum, item) => sum + item.price, 0);
  const minutesFor = (item: Service) => {
    const explicit = Number((item as Service & { durationMinutes?: number }).durationMinutes);
    if (explicit > 0) return explicit;
    const nums = item.duration.match(/\\d+/g)?.map(Number) ?? [];
    return nums.length ? Math.round(nums.reduce((a,b)=>a+b,0) / nums.length) : 0;
  };
  const bookingDuration = service ? minutesFor(service) + selectedAddOns.reduce((sum,item)=>sum+minutesFor(item),0) : 0;

  // already ranked by the server — the page never re-orders the ring
  const candidates = results;

  const found = phase === "found" ? (accepted ?? candidates[foundIdx]) : undefined;

  const markers: MapProviderMarker[] = useMemo(
    () =>
      results.map((r) => ({
        id: r.provider.id,
        point: { lat: r.provider.lat, lng: r.provider.lng },
        rating: r.provider.rating,
        name: r.provider.name,
        pulse: phase === "searching",
      })),
    [results, phase],
  );

  // analytics: one event per visit
  const viewedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!service || !center) return;
    if (viewedRef.current === service.id) return;
    viewedRef.current = service.id;
    trackServiceProvidersViewed({
      serviceId: service.id,
      category: service.category,
      providerCount: results.length,
    });
  }, [service, center, results.length]);

  // A Pro taps Accept in Pro mode; the server decides the race and stamps the
  // profile, start OTP and ETA. This page only reflects the outcome.
  const proAccept = useCallback(
    async (providerId: string) => {
      if (!user || !bookingId) return;
      setBusy(true);
      try {
        await updateBooking(user.id, bookingId, { status: "accepted", providerId });
        const match = results.find((r) => r.provider.id === providerId);
        if (match) {
          setAccepted(match);
          setFoundIdx(results.indexOf(match));
          setPhase("found");
        }
      } catch {
        // another Pro got there first — the poll below shows theirs
      } finally {
        setBusy(false);
      }
    },
    [user, bookingId, results],
  );

  // The request lives on the server; while it is dispatched we poll it so the
  // first Pro to accept appears here — the notify list is already withdrawn
  // for everyone else in the same write.
  useEffect(() => {
    if (phase !== "searching" || !bookingId || !user) return;
    let stopped = false;
    const check = async () => {
      const rows = await listBookings(user.id);
      if (stopped) return;
      const live = rows.find((b) => b.id === bookingId);
      if (!live) return;
      if (live.dispatchRadiusKm) setDispatchRadiusKm(live.dispatchRadiusKm);
      if (live.providerId && live.status !== "dispatched") {
        const match = results.find((r) => r.provider.id === live.providerId);
        setAccepted(match ?? fromProfile(live.providerProfile));
        setPhase("found");
      }
    };
    const id = window.setInterval(() => void check(), 3000);
    void check();
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [phase, bookingId, user, results]);

  const handleDispatch = useCallback(async () => {
    if (!service || !center || !user || results.length === 0) return;
    trackBookingCheckoutOpened({ serviceId: service.id, providerId: results[0].provider.id });
    setBusy(true);
    try {
      const addr: Address = {
        id: "live",
        label: location?.label.split(",")[0] ?? "Location",
        line1: location?.label ?? "Current location",
        city: location?.city ?? "",
        pincode: "",
        lat: center.lat,
        lng: center.lng,
      };
      const scheduled = Boolean(dateParam && dateParam !== todayIso());
      const created = await createBooking({
        userId: user.id,
        phone: user.phone,
        serviceId: service.id,
        serviceName: labels(service).name,
        providerId: "",
        providerName: "",
        address: addr,
        mode: scheduled ? "scheduled" : "instant",
        date: dateParam ?? todayIso(),
        slot: timeParam ?? "ASAP",
        amount: bookingTotal,
        selectedSubServiceIds,
        status: "dispatched",
        createdAt: Date.now(),
        dispatchedAt: Date.now(),
        originPoint: center,
        etaMinutes: etaMinutes(results[0].distanceKm),
      } as Omit<Booking, "id">);
      setBookingId(created.id);
      // the server already notified the ring and stamped the radius it used
      setDispatchRadiusKm(created.dispatchRadiusKm ?? matchInfo.radiusKm);
      setAccepted(null);
      setFoundIdx(0);
      setPhase("searching");
    } finally {
      setBusy(false);
    }
  }, [service, center, user, results, location, dateParam, timeParam, labels, bookingTotal, selectedSubServiceIds]);

  const handleUserAccept = useCallback(async () => {
    if (!user || !bookingId) return;
    const scheduled = (dateParam ?? todayIso()) !== todayIso();
    await updateBooking(user.id, bookingId, {
      status: scheduled ? "scheduled" : "enroute",
      enrouteAt: Date.now(),
    });
    router.push(`/track/${bookingId}`);
  }, [user, bookingId, dateParam, router]);

  const requestLogin = () => {
    const next = encodeURIComponent(`/services/${slug}/providers${window.location.search}`);
    router.push(`/login?next=${next}`);
  };

  if (!service) {
    if (!catalogReady) {
      return (
        <div className="section-shell py-16 text-center" aria-busy>
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-600" />
          <p className="mt-3 text-sm text-slate-500">{s.common.loading}</p>
        </div>
      );
    }
    return (
      <div className="section-shell py-16 text-center">
        <h1 className="text-xl font-bold">{s.providers.notFound}</h1>
        <Link href="/services" className="btn-primary mt-4">
          {s.common.browse}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-blue-600"
      >
        <ArrowLeft className="h-4 w-4" /> {s.providers.back}
      </button>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            {fill(s.dispatch.nearbyTitle, { n: results.length })}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {fill(s.dispatch.nearbySub, {
              km: matchInfo.radiusKm,
              service: labels(service).name,
            })}
            {dateParam && timeParam ? ` · ${dateParam} · ${timeParam}` : ""}
          </p>
        </div>
        <span className="rounded-full bg-flame-50 px-3 py-1.5 text-xs font-semibold text-flame-700">
          {fill(s.dispatch.radiusBadge, { km: matchInfo.radiusKm })}
        </span>
      </div>

      {/* ------------------------------- map ------------------------------- */}
      {center ? (
        <div className="relative mt-4">
          <DispatchMap
            className="h-[52vh] min-h-[340px] w-full"
            center={center}
            user={center}
            providers={markers}
            radiusKm={matchInfo.radiusKm}
          />
          {/* overlay chip: notification status (hidden once the Pro card takes over) */}
          {phase !== "found" && (
          <div className="pointer-events-none absolute left-3 top-3 z-[500] max-w-[calc(100%-1.5rem)] rounded-2xl bg-white/95 px-4 py-2.5 shadow-lg ring-1 ring-slate-200 backdrop-blur">
            <p className="flex items-center gap-2 text-sm font-bold text-navy">
              <BellRing
                className={`h-4 w-4 text-flame-600 ${phase === "searching" ? "animate-pulse" : ""}`}
              />
              {phase === "idle"
                ? fill(s.dispatch.notifyNote, { n: results.length })
                : s.dispatch.searching}
            </p>
            {phase === "searching" && (
              <p className="mt-0.5 text-xs text-slate-500">{s.dispatch.searchingNote}</p>
            )}
          </div>
          )}
        </div>
      ) : (
        <div className="mt-6 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 p-12 text-slate-500">
          {locating ? (
            <p className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> {s.providers.waiting}
            </p>
          ) : (
            <>
              <p className="font-semibold text-slate-700">{s.dispatch.waitingLocation}</p>
              <p className="max-w-sm text-center text-sm">
                {fill(s.dispatch.waitingLocationNote, { km: WIDE_RING_KM })}
              </p>
              <LocationButton variant="inline" />
            </>
          )}
        </div>
      )}

      {/* --------------------------- bottom sheet --------------------------- */}
      <div className="card mt-4 p-5">
        {phase === "idle" && addOnServices.length > 0 && (
          <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><h2 className="font-bold text-slate-900">Customize your service</h2>
                <p className="text-xs text-slate-500">Add related services to the same booking.</p></div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-blue-700">{selectedAddOns.length} add-ons</span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {addOnServices.map(item => (
                <label key={item.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-white bg-white p-3 shadow-sm">
                  <input type="checkbox" checked={selectedSubServiceIds.includes(item.id)}
                    onChange={e => setSelectedSubServiceIds(current => e.target.checked ? [...current,item.id] : current.filter(id=>id!==item.id))}
                    className="h-4 w-4 accent-blue-600"/>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-800">{item.name}</span>
                    <span className="text-xs text-slate-500">{minutesFor(item) || "—"} min</span></span>
                  <span className="text-sm font-extrabold text-slate-900">+₹{item.price}</span>
                </label>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap justify-between gap-2 border-t border-blue-100 pt-3 text-sm">
              <span className="text-slate-600">Estimated total: <b className="text-slate-900">₹{bookingTotal}</b></span>
              <span className="text-slate-600">Estimated time: <b className="text-slate-900">{bookingDuration ? `${bookingDuration} min` : service.duration}</b></span>
            </div>
          </div>
        )}
        {center && results.length === 0 && !matchLoading && (
          <div className="text-center">
            <p className="font-bold text-slate-900">
              {fill(s.dispatch.noProviders, { km: WIDE_RING_KM })}
            </p>
            <p className="mt-1 text-sm text-slate-500">{s.dispatch.noProvidersNote}</p>
            <Link href="/services" className="btn-ghost mt-4">
              {s.common.browse}
            </Link>
          </div>
        )}

        {center && results.length > 0 && phase === "idle" && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5 text-sm text-slate-600">
              <Navigation className="mt-0.5 h-4 w-4 shrink-0 text-flame-600" />
              <p>
                <span className="mt-0.5 block text-xs text-slate-400">
                  {formatDistance(results[0].distanceKm)} · {s.dispatch.radiusBadge.replace("{km}", String(matchInfo.radiusKm))}
                </span>
              </p>
            </div>
            {user ? (
              <button
                type="button"
                onClick={() => void handleDispatch()}
                disabled={busy}
                className="btn-accent justify-center px-6 py-3"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <BellRing className="h-4 w-4" />
                )}
                {s.dispatch.sendRequest}
              </button>
            ) : (
              <button type="button" onClick={requestLogin} className="btn-primary justify-center px-6 py-3">
                {s.dispatch.loginToBook}
              </button>
            )}
          </div>
        )}

        {phase === "searching" && (
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-flame-50">
              <Loader2 className="h-5 w-5 animate-spin text-flame-600" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-slate-900">{s.dispatch.searching}</p>
              <p className="truncate text-sm text-slate-500">
                {s.dispatch.searchingNote} · {dispatchRadiusKm} km
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPhase("idle")}
              className="btn-ghost px-3 py-2 text-sm"
            >
              <X className="h-4 w-4" /> {s.dispatch.cancelRequest}
            </button>
          </div>
        )}

        {phase === "found" && found && (
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-green-700">
              <CheckCircle2 className="h-4 w-4" /> {s.dispatch.foundTitle}
              <span className="font-normal text-slate-500">— {s.dispatch.foundSub}</span>
            </div>

            {/* --------- accepted Pro's full detail card --------- */}
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-base font-bold text-white">
                  {found.provider.name
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-slate-900">{found.provider.name}</h3>
                    {found.provider.verified && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                        <BadgeCheck className="h-3 w-3" /> {s.dispatch.verified}
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        found.provider.policeVerified
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      <ShieldCheck className="h-3 w-3" />
                      {found.provider.policeVerified
                        ? s.dispatch.policeVerified
                        : s.dispatch.notPolice}
                    </span>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                    <span className="flex items-center gap-1 font-bold text-amber-600">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      {found.provider.rating} ·{" "}
                      {fill(s.dispatch.reviewsCount, {
                        n: found.provider.reviewCount ?? found.provider.jobs,
                      })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Briefcase className="h-3.5 w-3.5" />
                      {fill(s.dispatch.jobsCount, { n: found.provider.jobs })}
                    </span>
                    <span>
                      {fill(s.dispatch.experience, { n: found.provider.experience })}
                    </span>
                    <span className="font-bold text-navy">
                      {fill(s.dispatch.hourlyRate, { n: found.provider.hourlyRate ?? 199 })}
                    </span>
                    <span>{formatDistance(found.distanceKm)}</span>
                  </div>

                  {found.provider.reviews && found.provider.reviews.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {found.provider.reviews.map((rv) => (
                        <li
                          key={rv.author + rv.text}
                          className="rounded-lg bg-white p-2.5 text-xs text-slate-600 ring-1 ring-slate-200"
                        >
                          <span className="flex items-center gap-1.5 font-bold text-slate-800">
                            {rv.author}
                            <span className="flex items-center gap-0.5 font-semibold text-amber-600">
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                              {rv.rating}
                            </span>
                          </span>
                          <p className="mt-0.5">{rv.text}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void handleUserAccept()}
                  disabled={busy}
                  className="btn-accent flex-1 justify-center px-5 py-3"
                >
                  {s.dispatch.accept}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pro mode — demo of the Provider app (accept / OTP / Work Completed / wallet) */}
      <ProviderPanel
        open={panelOpen}
        onToggle={() => setPanelOpen((v) => !v)}
        bookingId={bookingId}
        candidate={
          phase === "searching" && candidates[0]
            ? {
                id: candidates[0].provider.id,
                name: candidates[0].provider.name,
                service: labels(service).name,
                distanceKm: candidates[0].distanceKm,
              }
            : null
        }
        onAccept={(id) => void proAccept(id)}
      />
    </div>
  );
}

export default function ProvidersPage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 text-center text-sm text-slate-400">Loading…</div>
      }
    >
      <ProvidersFlow />
    </Suspense>
  );
}