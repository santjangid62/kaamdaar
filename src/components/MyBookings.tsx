"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock, IndianRupee, MapPin, Repeat, Zap } from "lucide-react";
import { useApp } from "./AppProvider";
import { fill, useLang } from "../lib/i18n";
import { listBookings } from "../lib/store";
import type { Booking, BookingTab } from "../lib/types";

function bucket(status: Booking["status"]): BookingTab {
  if (status === "completed" || status === "cancelled") return "previous";
  if (status === "scheduled") return "upcoming";
  return "current";
}

function tabLabels(s: (typeof import("../lib/strings").en)["bookings"]): Record<BookingTab, string> {
  return {
    current: s.tabs[0],
    upcoming: s.tabs[1],
    previous: s.tabs[2],
  };
}

const STATUS_STYLE: Record<Booking["status"], string> = {
  dispatched: "bg-amber-50 text-amber-700",
  accepted: "bg-blue-50 text-blue-700",
  scheduled: "bg-amber-50 text-amber-700",
  enroute: "bg-indigo-50 text-indigo-700",
  arrived: "bg-indigo-50 text-indigo-700",
  in_progress: "bg-indigo-50 text-indigo-700",
  pending_confirm: "bg-purple-50 text-purple-700",
  completed: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-600",
};

const LIVE_STATUSES = new Set<Booking["status"]>([
  "accepted",
  "enroute",
  "arrived",
  "in_progress",
  "pending_confirm",
]);

export default function MyBookings({ initialTab }: { initialTab?: BookingTab }) {
  const { user, ready } = useApp();
  const { s } = useLang();
  const d = s.dispatch;
  const TAB_LABEL = tabLabels(s.bookings);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [tab, setTab] = useState<BookingTab>(initialTab ?? "current");

  useEffect(() => {
    if (user) void listBookings(user.id).then(setBookings);
  }, [user]);

  const grouped = useMemo(() => {
    const g: Record<BookingTab, Booking[]> = { current: [], upcoming: [], previous: [] };
    bookings.forEach((b) => g[bucket(b.status)].push(b));
    g.current.sort((a, b) => {
      const aIsLive = Boolean(a.providerId) && LIVE_STATUSES.has(a.status);
      const bIsLive = Boolean(b.providerId) && LIVE_STATUSES.has(b.status);
      if (aIsLive !== bIsLive) return aIsLive ? -1 : 1;
      const aTime = a.enrouteAt ?? a.acceptedAt ?? a.createdAt;
      const bTime = b.enrouteAt ?? b.acceptedAt ?? b.createdAt;
      return bTime - aTime;
    });
    return g;
  }, [bookings]);

  // guard against an unknown tab reaching us from the URL
  const active: BookingTab = grouped[tab] ? tab : "current";

  if (!ready || !user) return null;

  return (
    <section className="card p-6" id="bookings">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-slate-900">{s.bookings.title}</h2>
        <Link href="/services" className="text-sm font-semibold text-flame-600 hover:underline">
          {s.bookings.newBooking}
        </Link>
      </div>

      <div className="mt-4 flex gap-2 border-b border-slate-100 pb-3">
        {(Object.keys(TAB_LABEL) as BookingTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={
              active === t
                ? "rounded-full bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white"
                : "rounded-full px-4 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100"
            }
          >
            {TAB_LABEL[t]} ({grouped[t].length})
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {grouped[active].length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
            <p className="font-semibold text-slate-700">
              {fill(s.bookings.none, { tab: TAB_LABEL[active] })}
            </p>
            <Link href="/services" className="btn-primary mt-4">
              {s.bookings.browse}
            </Link>
          </div>
        )}

        {grouped[active].map((b) => {
          const canTrack = active === "current" && Boolean(b.providerId) && LIVE_STATUSES.has(b.status);
          const card = (
            <div className={`rounded-xl border border-slate-200 p-4 transition ${canTrack ? "hover:border-blue-400 hover:bg-blue-50/40" : "hover:border-blue-300"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
                  <CalendarDays className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-slate-900">{b.serviceName}</h3>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase ${STATUS_STYLE[b.status]}`}
                  >
                    {s.bookings.status[b.status]}
                  </span>
                  {b.mode === "instant" && <Zap className="h-3.5 w-3.5 text-amber-500" />}
                  {b.mode === "recurring" && <Repeat className="h-3.5 w-3.5 text-indigo-500" />}
                </div>
                {b.providerName ? (
                  <p className="mt-1 text-sm text-slate-500">
                    {s.bookings.pro} {b.providerName}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-slate-500">{d.searching}</p>
                )}
                </div>
              </div>
              <span className="flex items-center gap-1 font-extrabold text-slate-900">
                <IndianRupee className="h-3.5 w-3.5" />
                {b.amount}
              </span>
            </div>
            <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500 sm:grid-cols-3">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" /> {b.date}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> {b.slot}
              </span>
              <span className="flex items-center gap-1.5 truncate">
                <MapPin className="h-3.5 w-3.5 shrink-0" /> {b.address.label}, {b.address.city}
              </span>
            </div>
            {canTrack && (
              <p className="mt-3 flex items-center justify-end gap-1.5 text-xs font-semibold text-blue-700">
                <MapPin className="h-3.5 w-3.5" /> {d.liveTrack}
              </p>
            )}
            </div>
          );

          return canTrack ? (
            <Link key={b.id} href={`/track/${b.id}`} className="group block rounded-xl focus-visible:outline-blue-600" aria-label={`${b.serviceName}: ${d.liveTrack}`}>
              {card}
            </Link>
          ) : (
            <article key={b.id}>{card}</article>
          );
        })}
      </div>
    </section>
  );
}
