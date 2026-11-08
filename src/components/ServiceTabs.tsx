"use client";

import { useState } from "react";
import { BadgeCheck, Check, Clock, IndianRupee, ThumbsUp, X } from "lucide-react";
import type { Service } from "../lib/types";
import { useLang, useServiceLabels } from "../lib/i18n";

const TAB_KEYS = ["overview", "pricing", "reviews", "faqs"] as const;
type TabKey = (typeof TAB_KEYS)[number];

const REVIEW_NAMES = ["Priya Sharma", "Amit Verma", "Neha Chawla"];
const REVIEW_RATINGS = [5, 5, 4];

const DISTRIBUTION = [
  { stars: 5, pct: 72 },
  { stars: 4, pct: 20 },
  { stars: 3, pct: 6 },
  { stars: 2, pct: 1 },
  { stars: 1, pct: 1 },
];

export default function ServiceTabs({ service }: { service: Service }) {
  const { s } = useLang();
  const labels = useServiceLabels();
  const L = labels(service);
  const [tab, setTab] = useState<TabKey>("overview");

  const TAB_LABELS: Record<TabKey, string> = {
    overview: s.detail.tabOverview,
    pricing: s.detail.tabPricing,
    reviews: s.detail.tabReviews,
    faqs: s.detail.tabFaqs,
  };

  const unitKey = (service.unit ?? "per task").replace(
    "per ",
    "",
  ) as keyof typeof s.services.units;
  const unitLabel = s.services.units[unitKey] ?? unitKey;

  return (
    <div>
      {/* badges */}
      <ul className="flex flex-wrap gap-2">
        {s.detail.badges.map((b) => (
          <li
            key={b}
            className="flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700"
          >
            <BadgeCheck className="h-3.5 w-3.5" /> {b}
          </li>
        ))}
      </ul>

      {/* tab bar */}
      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-slate-200">
        {TAB_KEYS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition ${
              tab === t
                ? "border-flame text-flame-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "overview" && (
          <div className="space-y-6">
            <section>
              <h2 className="text-lg font-extrabold text-slate-900">
                {s.detail.about}
              </h2>
              <p className="mt-2 leading-7 text-slate-600">
                {L.description}
              </p>
            </section>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="card p-5">
                <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-green-700">
                  <Check className="h-4 w-4" /> {s.detail.includes}
                </h3>
                <ul className="mt-3 space-y-2">
                  {L.includes.map((i) => (
                    <li key={i} className="flex gap-2 text-sm text-slate-600">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                      {i}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="card p-5">
                <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-red-600">
                  <X className="h-4 w-4" /> {s.detail.excludes}
                </h3>
                <ul className="mt-3 space-y-2">
                  {L.excludes.map((i) => (
                    <li key={i} className="flex gap-2 text-sm text-slate-600">
                      <X className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                      {i}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="card p-5">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">
                {s.detail.howBooking}
              </h3>
              <ol className="mt-3 grid gap-3 sm:grid-cols-3">
                {s.detail.bookingSteps.map((step, i) => (
                  <li
                    key={step}
                    className="rounded-xl bg-offwhite p-3 text-sm text-slate-600"
                  >
                    <span className="mb-1 block font-bold text-blue-600">
                      {s.detail.step} {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}

        {tab === "pricing" && (
          <div className="card p-5">
            <h2 className="text-lg font-extrabold text-slate-900">
              {s.detail.tabPricing}
            </h2>
            <table className="mt-4 w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-3 text-slate-500">
                    {s.detail.priceRows.starting}
                  </td>
                  <td className="py-3 text-right font-bold text-slate-900">
                    ₹{service.price}
                    <span className="font-normal text-slate-500">/{unitLabel}</span>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 text-slate-500">
                    {s.detail.priceRows.duration}
                  </td>
                  <td className="py-3 text-right font-semibold text-slate-800">
                    {L.duration}
                  </td>
                </tr>
                <tr>
                  <td className="py-3 text-slate-500">{s.detail.priceRows.billing}</td>
                  <td className="py-3 text-right font-semibold text-slate-800">
                    {unitLabel}
                  </td>
                </tr>
                {service.slots && (
                  <tr>
                    <td className="py-3 text-slate-500">{s.detail.priceRows.slots}</td>
                    <td className="py-3 text-right font-semibold text-slate-800">
                      {service.slots.join(" · ")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <p className="mt-4 rounded-xl bg-flame-50 p-3 text-xs leading-5 text-amber-800">
              {s.detail.priceNote}
            </p>
          </div>
        )}

        {tab === "reviews" && (
          <div className="space-y-5">
            <div className="card flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
              <div className="text-center">
                <p className="text-5xl font-extrabold text-slate-900">4.8</p>
                <div className="mt-1 flex justify-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span
                      key={i}
                      className="h-3.5 w-3.5 rounded-sm bg-amber-400"
                    />
                  ))}
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {s.detail.reviewsCount}
                </p>
              </div>
              <div className="flex-1 space-y-1.5">
                {DISTRIBUTION.map((d) => (
                  <div key={d.stars} className="flex items-center gap-2 text-xs">
                    <span className="w-3 font-semibold text-slate-500">
                      {d.stars}
                    </span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <span
                        className="block h-full rounded-full bg-amber-400"
                        style={{ width: `${d.pct}%` }}
                      />
                    </span>
                    <span className="w-8 text-right text-slate-400">
                      {d.pct}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {s.detail.reviews.map((r, idx) => (
              <article key={REVIEW_NAMES[idx]} className="card p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    {REVIEW_NAMES[idx]
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {REVIEW_NAMES[idx]}
                    </p>
                    <p className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="flex gap-0.5">
                        {Array.from({ length: REVIEW_RATINGS[idx] }).map((_, i) => (
                          <span
                            key={i}
                            className="h-2.5 w-2.5 rounded-sm bg-amber-400"
                          />
                        ))}
                      </span>
                      {r.when}
                    </p>
                  </div>
                  <ThumbsUp className="ml-auto h-4 w-4 text-slate-300" />
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{r.text}</p>
              </article>
            ))}
          </div>
        )}

        {tab === "faqs" && (
          <div className="space-y-3">
            {s.detail.faqs.map((f) => (
              <details key={f.q} className="card p-5">
                <summary className="cursor-pointer font-bold text-slate-900">
                  {f.q}
                </summary>
                <p className="mt-2 text-sm leading-6 text-slate-600">{f.a}</p>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Small price + duration strip reused in the booking rail. */
export function PriceMeta({ service }: { service: Service }) {
  const { s } = useLang();
  return (
    <div className="flex items-end gap-2">
      <span className="flex items-center text-4xl font-extrabold text-slate-900">
        <IndianRupee className="h-6 w-6" />
        {service.price}
      </span>
      <span className="pb-1.5 text-sm text-slate-500">
        {s.detail.startingPriceLabel}
      </span>
    </div>
  );
}

/** Duration chips reused in the booking rail. */
export function DurationChips({ service }: { service: Service }) {
  if (!service.slots) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {service.slots.map((s) => (
        <span
          key={s}
          className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
        >
          <Clock className="h-3 w-3" /> {s}
        </span>
      ))}
    </div>
  );
}
