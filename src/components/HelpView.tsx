"use client";

import Link from "next/link";
import {
  BadgeCheck,
  CreditCard,
  LifeBuoy,
  MessageSquareWarning,
  Search,
  UserRound,
  Wallet,
  Wrench,
  XCircle,
} from "lucide-react";
import { useLang } from "../lib/i18n";

const CATEGORY_ICONS = [Wallet, Wrench, UserRound, XCircle, CreditCard, BadgeCheck];

export default function HelpView() {
  const { s } = useLang();

  return (
    <div>
      {/* hero */}
      <section className="relative isolate overflow-hidden bg-navy py-16 text-white sm:py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(59,130,246,.28),transparent_32%),radial-gradient(circle_at_85%_80%,rgba(255,122,0,.22),transparent_30%)]" />
        <div className="section-shell relative text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[.18em] text-orange-200">
            <LifeBuoy className="h-3.5 w-3.5 text-flame-400" /> {s.help.supportBadge}
          </span>
          <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
            {s.help.heading}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-blue-100 sm:text-lg">{s.help.sub}</p>
          <div className="relative mx-auto mt-8 max-w-xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              placeholder={s.help.searchPlaceholder}
              aria-label={s.help.searchPlaceholder}
              className="w-full rounded-full border-0 bg-white py-3.5 pl-11 pr-4 text-sm text-slate-900 outline-none ring-2 ring-transparent transition placeholder:text-slate-400 focus:ring-flame"
            />
          </div>
        </div>
      </section>

      {/* categories */}
      <section className="section-shell relative z-10 -mt-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {s.help.categories.map((c, i) => {
            const Icon = CATEGORY_ICONS[i];
            return (
              <div
                key={c.title}
                className="group flex items-start gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_55px_-35px_rgba(15,35,65,.35)] transition duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-flame-50 text-flame-600">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-bold text-slate-900">{c.title}</h2>
                  <p className="mt-0.5 text-sm text-slate-500">{c.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* popular articles */}
      <section className="section-shell grid gap-8 py-14 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="text-xl font-extrabold text-slate-900">{s.help.popular}</h2>
          <div className="mt-4 space-y-3">
            {s.help.articles.map((art) => (
              <details key={art.q} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md">
                <summary className="cursor-pointer font-bold text-slate-900">
                  {art.q}
                </summary>
                <p className="mt-2 text-sm leading-6 text-slate-600">{art.a}</p>
              </details>
            ))}
          </div>
        </div>

        {/* still need help */}
        <aside>
          <div className="card sticky top-24 overflow-hidden">
            <div className="bg-navy p-6 text-white">
              <h2 className="text-lg font-extrabold">{s.help.stillNeed}</h2>
              <p className="mt-1 text-sm text-blue-200">{s.help.stillSub}</p>
            </div>
            <div className="space-y-3 p-6">
              <a
                href="mailto:support@kaamdaar.in?subject=Kaamdaar%20support%20request"
                className="btn-accent w-full"
              >
                <MessageSquareWarning className="h-4 w-4" /> {s.help.chat}
              </a>
              <a
                href="mailto:support@kaamdaar.in?subject=Complaint%20-%20Kaamdaar"
                className="btn-ghost w-full text-red-600"
              >
                {s.help.complain}
              </a>
              <p className="pt-2 text-center text-xs text-slate-400">
                support@kaamdaar.in · 7:00 AM – 10:00 PM
              </p>
              <Link
                href="/dashboard"
                className="block text-center text-sm font-semibold text-blue-600 hover:underline"
              >
                {s.help.openBookings}
              </Link>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
