"use client";

import Link from "next/link";
import { ArrowRight, Search, CalendarCheck, MapPin, ShieldCheck, Sparkles, CheckCircle2 } from "lucide-react";
import { useLang } from "../lib/i18n";

const icons = [Search, CalendarCheck, MapPin, ShieldCheck];
const tones = [
  "from-blue-600 to-cyan-500",
  "from-orange-500 to-amber-400",
  "from-violet-600 to-blue-500",
  "from-emerald-600 to-teal-500",
];

export default function HowItWorksPage() {
  const { s, lang } = useLang();
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="relative isolate overflow-hidden bg-navy py-20 text-white sm:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(59,130,246,.28),transparent_32%),radial-gradient(circle_at_85%_80%,rgba(255,122,0,.22),transparent_30%)]" />
        <div className="section-shell relative text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[.18em] text-orange-200">
            <Sparkles className="h-4 w-4" /> {lang === "hi" ? "सरल बुकिंग प्रक्रिया" : "SIMPLE BOOKING PROCESS"}
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
            {s.how.heading}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-blue-100 sm:text-lg">{s.how.sub}</p>
          <Link href="/services" className="mt-8 inline-flex items-center gap-2 rounded-full bg-flame px-7 py-3.5 text-sm font-extrabold text-navy shadow-lg shadow-orange-950/20 transition hover:-translate-y-0.5 hover:bg-orange-300">
            {lang === "hi" ? "सेवा बुक करें" : "Book a Service"} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="section-shell -mt-8 relative z-10 pb-20">
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {s.how.steps.map((step, i) => {
            const Icon = icons[i] ?? CheckCircle2;
            return (
              <article key={step.title} className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-7 shadow-[0_18px_55px_-35px_rgba(15,35,65,.35)] transition duration-300 hover:-translate-y-2 hover:shadow-xl">
                <div className="absolute right-4 top-3 text-6xl font-black tracking-tighter text-slate-100 transition group-hover:text-orange-50">{String(i + 1).padStart(2, "0")}</div>
                <div className={`relative grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br ${tones[i] ?? tones[0]} text-white shadow-lg`}>
                  <Icon className="h-7 w-7" />
                </div>
                <h2 className="relative mt-7 text-xl font-extrabold text-slate-900">{step.title}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-500">{step.body}</p>
                <div className="mt-6 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-700">
                  <CheckCircle2 className="h-4 w-4" /> {lang === "hi" ? "आसान और सुरक्षित" : "Easy & secure"}
                </div>
              </article>
            );
          })}
        </div>
        <div className="mt-12 rounded-3xl bg-gradient-to-r from-blue-700 via-blue-800 to-navy p-8 text-white shadow-xl sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-10">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-orange-300">{lang === "hi" ? "शुरू करने के लिए तैयार?" : "READY TO GET STARTED?"}</p>
            <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">{lang === "hi" ? "अपना काम आज ही बुक करें" : "Get your task done today"}</h2>
            <p className="mt-2 text-sm leading-6 text-blue-100">{lang === "hi" ? "अपनी जरूरत की सेवा चुनें और भरोसेमंद मदद पाएं।" : "Choose the service you need and get reliable help at your doorstep."}</p>
          </div>
          <Link href="/services" className="mt-6 inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-extrabold text-blue-900 transition hover:bg-orange-100 sm:mt-0">
            {lang === "hi" ? "सभी सेवाएं देखें" : "Explore Services"} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
