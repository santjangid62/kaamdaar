"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  Loader2,
  MapPin,
  Navigation,
  Star,
} from "lucide-react";
import { useApp } from "../../../../components/AppProvider";
import LocationButton from "../../../../components/LocationButton";
import {
  trackBookingCheckoutOpened,
  trackServiceProvidersViewed,
} from "../../../../lib/analytics";
import { DEFAULT_RADIUS_KM, formatDistance } from "../../../../lib/geo";
import { getService } from "../../../../lib/seed";
import { nearbyProviders, type NearbyProvider } from "../../../../lib/providers";
import { listAddresses } from "../../../../lib/store";
import type { Address, GeoPoint } from "../../../../lib/types";

type Origin = "current" | "address";

function ProvidersFlow() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const slug = params.slug;
  const service = getService(slug);
  const { location, user, locating } = useApp();

  const [origin, setOrigin] = useState<Origin>("current");
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    void listAddresses(user.id).then((list) => {
      setAddresses(list);
      if (list.length && !addressId) {
        const withCoords = list.find((a) => typeof a.lat === "number");
        if (withCoords) {
          setAddressId(withCoords.id);
          setOrigin("address");
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // derived, not stored: the picked origin fully determines the search point
  const center = useMemo<GeoPoint | null>(() => {
    if (origin === "current") {
      return location ? { lat: location.lat, lng: location.lng } : null;
    }
    const addr = addresses.find((a) => a.id === addressId);
    if (addr && typeof addr.lat === "number" && typeof addr.lng === "number") {
      return { lat: addr.lat, lng: addr.lng };
    }
    return null;
  }, [origin, location, addresses, addressId]);

  const results = useMemo<NearbyProvider[]>(
    () => (service && center ? nearbyProviders(service.id, center, DEFAULT_RADIUS_KM) : []),
    [service, center],
  );

  const [sortBy, setSortBy] = useState<"distance" | "rating" | "experience">("distance");
  const sorted = useMemo(() => {
    const list = [...results];
    if (sortBy === "rating") list.sort((a, b) => b.provider.rating - a.provider.rating);
    if (sortBy === "distance") list.sort((a, b) => a.distanceKm - b.distanceKm);
    if (sortBy === "experience") list.sort((a, b) => b.provider.experience - a.provider.experience);
    return list;
  }, [results, sortBy]);

  // date & time chosen on the service detail page
  const dateParam = search.get("date");
  const timeParam = search.get("time");

  // funnel start: one event per providers page visit, once a location is known
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

  if (!service) {
    return (
      <div className="section-shell py-16 text-center">
        <h1 className="text-xl font-bold">Service not found.</h1>
        <Link href="/services" className="btn-primary mt-4">
          Browse services
        </Link>
      </div>
    );
  }

  const addressPicker = addresses.length > 0 && (
    <div className="flex flex-wrap gap-2">
      {addresses.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => {
            setOrigin("address");
            setAddressId(a.id);
          }}
          className={
            origin === "address" && addressId === a.id
              ? "rounded-full bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white"
              : "rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium text-slate-600 hover:border-blue-300"
          }
        >
          {a.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="section-shell py-10">
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-5 flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-blue-600"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            {results.length} {service.name} professionals near you
          </h1>
          <p className="mt-1.5 text-slate-500">
            Verified Pros within {DEFAULT_RADIUS_KM} km • starting ₹{service.price}/
            {service.unit.replace("per ", "")}
            {dateParam && timeParam ? ` • ${dateParam} · ${timeParam}` : ""}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-500">
          Sort by
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "distance" | "rating" | "experience")}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400"
          >
            <option value="distance">Nearest first</option>
            <option value="rating">Rating</option>
            <option value="experience">Experience</option>
          </select>
        </label>
      </div>

      {/* location origin */}
      <div className="card mt-6 p-5">
        <p className="text-sm font-semibold text-slate-700">Showing providers around</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOrigin("current")}
            className={
              origin === "current"
                ? "flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                : "flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:border-blue-300"
            }
          >
            <Navigation className="h-4 w-4" /> Current location
          </button>
          {user && addressPicker}
          {!user && (
            <Link href="/login?next=/profile" className="text-sm font-medium text-blue-600 hover:underline">
              Login to use saved addresses
            </Link>
          )}
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-sm text-slate-500">
          {origin === "current" ? (
            <LocationButton variant="inline" />
          ) : (
            <>
              <MapPin className="h-4 w-4 text-blue-600" />
              {addresses.find((a) => a.id === addressId)?.label}
            </>
          )}
        </div>
      </div>

      {/* list */}
      {!center ? (
        <div className="mt-8 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 p-12 text-slate-500">
          {locating ? (
            <p className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Waiting for your location…
            </p>
          ) : (
            <>
              <p className="font-semibold text-slate-700">Set your location to see Pros nearby</p>
              <p className="max-w-sm text-center text-sm">
                We use it to list verified providers within {DEFAULT_RADIUS_KM} km of you.
              </p>
              {origin === "current" ? (
                <LocationButton variant="inline" />
              ) : (
                <Link href="/profile" className="text-sm font-medium text-blue-600 hover:underline">
                  Add an address with a location
                </Link>
              )}
            </>
          )}
        </div>
      ) : results.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <p className="font-semibold text-slate-700">No {service.name} providers within {DEFAULT_RADIUS_KM} km yet.</p>
          <p className="mt-1 text-sm text-slate-500">
            We are expanding in your area — try again in a while or check a nearby locality.
          </p>
          <Link href="/services" className="btn-ghost mt-5">
            Browse other services
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {sorted.map(({ provider, distanceKm }) => (
            <div key={provider.id} className="card flex flex-col p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-base font-bold text-white">
                  {provider.name
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="truncate font-bold text-slate-900">{provider.name}</h3>
                    {provider.verified && (
                      <BadgeCheck className="h-4 w-4 shrink-0 text-blue-600" />
                    )}
                  </div>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1 font-semibold text-amber-600">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      {provider.rating}
                    </span>
                    <span className="flex items-center gap-1">
                      <Briefcase className="h-3.5 w-3.5" />
                      {provider.jobs} jobs
                    </span>
                    <span>{provider.experience} yrs exp</span>
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {formatDistance(distanceKm)}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {provider.services
                  .filter((s) => s !== service.id)
                  .slice(0, 3)
                  .map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700"
                    >
                      {getService(s)?.name ?? s}
                    </span>
                  ))}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                <span className="text-sm font-bold text-slate-900">
                  ₹{service.price}
                  <span className="font-normal text-slate-500">/{service.unit.replace("per ", "")}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    trackBookingCheckoutOpened({
                      serviceId: service.id,
                      providerId: provider.id,
                    });
                    const qs =
                      dateParam && timeParam
                        ? `?date=${encodeURIComponent(dateParam)}&time=${encodeURIComponent(timeParam)}`
                        : "";
                    router.push(`/book/${service.id}/${provider.id}${qs}`);
                  }}
                  className="btn-accent px-5 py-2"
                >
                  Book Now
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProvidersPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-sm text-slate-400">Loading…</div>}>
      <ProvidersFlow />
    </Suspense>
  );
}
