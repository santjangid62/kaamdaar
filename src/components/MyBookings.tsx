"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock, IndianRupee, MapPin, Repeat, Zap } from "lucide-react";
import { useApp } from "./AppProvider";
import { listBookings } from "../lib/store";
import type { Booking, BookingTab } from "../lib/types";

function bucket(status: Booking["status"]): BookingTab {
  if (status === "completed" || status === "cancelled") return "previous";
  if (status === "scheduled") return "upcoming";
  return "current";
}

const TAB_LABEL: Record<BookingTab, string> = {
  current: "Current",
  upcoming: "Upcoming",
  previous: "Previous",
};

const STATUS_STYLE: Record<Booking["status"], string> = {
  accepted: "bg-blue-50 text-blue-700",
  in_progress: "bg-indigo-50 text-indigo-700",
  scheduled: "bg-amber-50 text-amber-700",
  completed: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-600",
};

export default function MyBookings({ initialTab }: { initialTab?: BookingTab }) {
  const { user, ready } = useApp();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [tab, setTab] = useState<BookingTab>(initialTab ?? "current");

  useEffect(() => {
    if (user) void listBookings(user.id).then(setBookings);
  }, [user]);

  const grouped = useMemo(() => {
    const g: Record<BookingTab, Booking[]> = { current: [], upcoming: [], previous: [] };
    bookings.forEach((b) => g[bucket(b.status)].push(b));
    return g;
  }, [bookings]);

  // guard against an unknown tab reaching us from the URL
  const active: BookingTab = grouped[tab] ? tab : "current";

  if (!ready || !user) return null;

  return (
    <section className="card p-6" id="bookings">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-slate-900">My bookings</h2>
        <Link href="/services" className="text-sm font-semibold text-flame-600 hover:underline">
          + New booking
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
            <p className="font-semibold text-slate-700">No {TAB_LABEL[active].toLowerCase()} bookings.</p>
            <Link href="/services" className="btn-primary mt-4">
              Browse services
            </Link>
          </div>
        )}

        {grouped[active].map((b) => (
          <article key={b.id} className="rounded-xl border border-slate-200 p-4 transition hover:border-blue-300">
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
                    {b.status.replace("_", " ")}
                  </span>
                  {b.mode === "instant" && <Zap className="h-3.5 w-3.5 text-amber-500" />}
                  {b.mode === "recurring" && <Repeat className="h-3.5 w-3.5 text-indigo-500" />}
                </div>
                <p className="mt-1 text-sm text-slate-500">Pro: {b.providerName}</p>
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
          </article>
        ))}
      </div>
    </section>
  );
}