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
      <section className="bg-navy py-14 text-white">
        <div className="section-shell text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-blue-100">
            <LifeBuoy className="h-3.5 w-3.5 text-flame-400" /> {s.help.supportBadge}
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
            {s.help.heading}
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-blue-200">{s.help.sub}</p>
          <div className="relative mx-auto mt-6 max-w-xl">
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
      <section className="section-shell -mt-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {s.help.categories.map((c, i) => {
            const Icon = CATEGORY_ICONS[i];
            return (
              <div
                key={c.title}
                className="card flex items-start gap-4 p-5 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg"
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
      <section className="section-shell grid gap-8 py-12 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="text-xl font-extrabold text-slate-900">{s.help.popular}</h2>
          <div className="mt-4 space-y-3">
            {s.help.articles.map((art) => (
              <details key={art.q} className="card p-5">
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
