"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, MapPin, ShieldCheck } from "lucide-react";
import type { Service } from "../lib/types";
import { PriceMeta } from "./ServiceTabs";

const TIMES = [
  "10:00 AM",
  "12:00 PM",
  "02:00 PM",
  "04:00 PM",
  "06:00 PM",
  "08:00 PM",
];

/** Right rail of the service detail page — rate, date/time pick, Book Now. */
export default function BookingBox({ service }: { service: Service }) {
  const dates = useMemo(() => {
    const list: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 5; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      list.push({
        value: d.toISOString().slice(0, 10),
        label:
          i === 0
            ? "Today"
            : d.toLocaleDateString("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "short",
              }),
      });
    }
    return list;
  }, []);

  const [date, setDate] = useState(dates[0].value);
  const [time, setTime] = useState(TIMES[1]);

  const href = `/services/${service.id}/providers?date=${encodeURIComponent(
    date,
  )}&time=${encodeURIComponent(time)}`;

  return (
    <div className="card sticky top-24 p-6">
      <PriceMeta service={service} />

      <div className="mt-5">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-green-700">
          <Check className="h-4 w-4" /> Service includes
        </h2>
        <ul className="mt-2.5 space-y-1.5">
          {service.includes.slice(0, 4).map((i) => (
            <li key={i} className="flex gap-2 text-sm text-slate-600">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
              {i}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-bold text-slate-900">Select Date</h3>
        <div className="mt-2 grid grid-cols-5 gap-1.5">
          {dates.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => setDate(d.value)}
              className={`rounded-lg border px-1 py-2 text-[11px] font-semibold leading-4 transition ${
                date === d.value
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <h3 className="text-sm font-bold text-slate-900">Select Time</h3>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {TIMES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTime(t)}
              className={`rounded-lg border px-1 py-2 text-xs font-semibold transition ${
                time === t
                  ? "border-flame bg-flame text-navy"
                  : "border-slate-200 bg-white text-slate-600 hover:border-flame-400"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <Link href={href} className="btn-accent mt-5 w-full py-3 text-base">
        Book Now
      </Link>

      <ul className="mt-4 space-y-2 text-xs text-slate-500">
        <li className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-green-600" /> Trained &
          verified Pros
        </li>
        <li className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-blue-600" /> Providers within 2–3 km
          of you
        </li>
      </ul>

      <p className="mt-4 rounded-xl bg-flame-50 p-3 text-xs leading-5 text-amber-800">
        Final price is shown at checkout and can vary with location and service
        complexity.
      </p>
    </div>
  );
}