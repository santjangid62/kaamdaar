"use client";

/**
 * Live numbers strip under the hero. Replaces the old hardcoded marketing
 * figures with real counts from /api/stats, refreshed every 20 seconds, so the
 * page keeps updating while it is open (Pros going on duty, jobs finishing).
 */
import { useEffect, useState } from "react";
import { BadgeCheck, LayoutGrid, Star, Users } from "lucide-react";
import { useLang } from "../lib/i18n";

type Stats = {
  customers: number;
  providers: number;
  onlinePros: number;
  services: number;
  completedBookings: number;
  liveBookings: number;
  avgRating: number;
  areas: number;
  updatedAt: string;
};

export default function LiveStats() {
  const { s, lang } = useLang();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch("/api/stats", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as Stats;
        if (alive) setStats(data);
      } catch {
        /* keep the last numbers when the network blips */
      }
    }
    void load();
    const id = setInterval(load, 20_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // A brand-new deployment has no rows yet (production without a database) —
  // showing a row of zeros would look broken, so the strip simply stays away
  // until there is something real to show.
  if (stats && stats.providers === 0 && stats.customers === 0) return null;

  const t = (en: string, hi: string) => (lang === "hi" ? hi : en);
  const labels = s.stats;
  const value = (n: number | undefined, suffix = "") =>
    typeof n === "number" ? `${n.toLocaleString("en-IN")}${suffix}` : "—";

  const cards = [
    {
      icon: BadgeCheck,
      value: value(stats?.providers),
      label: labels[3].label,
      badge: stats ? `${stats.onlinePros} ${t("online", "ऑनलाइन")}` : "",
      tone: "bg-blue-50 text-blue-600",
    },
    {
      icon: LayoutGrid,
      value: value(stats?.services),
      label: labels[2].label,
      badge: stats?.areas ? `${stats.areas} ${t("areas", "क्षेत्र")}` : "",
      tone: "bg-flame-50 text-flame-600",
    },
    {
      icon: Users,
      value: value(stats?.customers),
      label: labels[0].label,
      badge: stats?.completedBookings
        ? `${stats.completedBookings.toLocaleString("en-IN")} ${t("bookings done", "बुकिंग पूरी")}`
        : "",
      tone: "bg-emerald-50 text-emerald-600",
    },
    {
      icon: Star,
      value: stats ? (stats.avgRating ? `${stats.avgRating} ★` : "New") : "—",
      label: labels[1].label,
      badge: stats?.liveBookings
        ? `${stats.liveBookings} ${t("live now", "अभी लाइव")}`
        : "",
      tone: "bg-amber-50 text-amber-600",
    },
  ];

  return (
    <section className="relative border-y border-slate-100 bg-linear-to-b from-white via-blue-50/40 to-white py-12">
      <div className="section-shell">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <p className="text-sm font-extrabold text-navy">
              {t("Kaamdaar right now", "कामदार अभी")}
            </p>
            <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200">
              {t("live", "लाइव")}
            </span>
          </div>
          <p className="text-xs font-medium text-slate-500">
            {t("Live counts from our database — refreshed every 20 seconds", "डेटाबेस से लाइव आंकड़े — हर 20 सेकंड में अपडेट")}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {cards.map((card) => (
            <div
              key={card.label}
              className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_18px_44px_-34px_rgba(11,31,58,0.65)] transition duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-[0_22px_48px_-28px_rgba(18,97,160,0.45)]"
            >
              <span className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-blue-600 via-blue-400 to-flame" />
              <div className="flex items-start justify-between gap-2">
                <span
                  className={`grid h-10 w-10 place-items-center rounded-xl transition group-hover:bg-navy group-hover:text-white ${card.tone}`}
                >
                  <card.icon className="h-5 w-5" />
                </span>
                {card.badge && (
                  <span className="rounded-full bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-500 ring-1 ring-slate-100">
                    {card.badge}
                  </span>
                )}
              </div>
              <dd className="mt-4 text-3xl font-extrabold tabular-nums tracking-tight text-navy">
                {card.value}
              </dd>
              <dt className="mt-1 text-xs font-semibold text-slate-500">{card.label}</dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
