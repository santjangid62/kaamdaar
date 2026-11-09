"use client";

/**
 * Home page body (client so it can read the language switcher).
 * The route file (src/app/page.tsx) keeps exporting `metadata`.
 */
import Link from "next/link";
import Image from "next/image";
import {
  AirVent,
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  Car,
  ChefHat,
  Clock,
  Droplets,
  Fan,
  Hammer,
  LayoutGrid,
  MapPin,
  Mic,
  MessageCircleQuestion,
  PaintRoller,
  Plug,
  Refrigerator,
  Search,
  ShieldCheck,
  Shirt,
  Sparkles,
  SprayCan,
  Star,
  Utensils,
  Wind,
  Wrench,
} from "lucide-react";
import HeroSearch from "./HeroSearch";
import AreasWeServe from "./AreasWeServe";
import LiveStats from "./LiveStats";
import { fill, useLang } from "../lib/i18n";
import { SERVICE_HI } from "../lib/strings";
import { openVoiceAssistant } from "../lib/assistant";
import { FALLBACK_ICON, ICONS, SERVICE_ICONS } from "../lib/service-icons";
import { useApp } from "./AppProvider";

/** Icons for the popular-services grid, keyed by service id (admin-managed). */
const TILE_ICONS: Record<string, typeof Clock> = {
  "hourly-bookings": Clock,
  "kitchen-cleaning": SprayCan,
  "kitchen-prep": ChefHat,
  utensils: Utensils,
  "bathroom-cleaning": Droplets,
  "sweeping-mopping": Sparkles,
  laundry: Shirt,
  "ironing-folding": Wind,
  "fridge-cleaning": Refrigerator,
  "fan-cleaning": Fan,
  "car-surface-cleaning": Car,
  "ac-service": AirVent,
  plumbing: Wrench,
  electrical: Plug,
  painting: PaintRoller,
  carpentry: Hammer,
};

const STEPS_ICONS = [Search, CalendarCheck, MapPin, ShieldCheck];
const STEPS_TONES = ["bg-blue-600", "bg-flame", "bg-blue-600", "bg-flame"];

const testimonials = [
  { name: "Priya Sharma", place: "Malviya Nagar, Jaipur" },
  { name: "Amit Verma", place: "Sector 56, Gurugram" },
  { name: "Neha Chawla", place: "Jagatpura, Jaipur" },
];

const VOICE_CARD_ICONS = [Mic, CalendarCheck, MapPin];

export default function HomeView() {
  const { lang, s } = useLang();
  const { services, providers, settings } = useApp();
  const onlinePros = providers.filter(
    (p) => (p as { status?: string }).status === "Online",
  ).length;
  const serviceAreas = new Set(providers.map((p) => (p.city ?? "").trim()).filter(Boolean)).size;
  const heroTitle = settings[`home_hero_title_${lang}`]?.trim() ||
    [s.hero.title1, s.hero.title2, s.hero.title3].join(" ");
  const heroWords = heroTitle.split(/\s+/);
  const heroLead = heroWords.slice(0, -1).join(" ");
  const heroAccent = heroWords.at(-1) ?? "";
  const heroSubtitle = settings[`home_hero_subtitle_${lang}`]?.trim() || s.hero.sub;

  // live catalogue first — popular services, then the rest, capped at 11
  const tiles = [
    ...services.filter((x) => x.popular),
    ...services.filter((x) => !x.popular),
  ].slice(0, 11);

  function tileLabel(id: string, fallback: string): string {
    return lang === "hi" && SERVICE_HI[id] ? SERVICE_HI[id].name : fallback;
  }

  return (
    <div>
      {/* ── hero ───────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-navy">
        {/* deep navy → blue wash, so the hero reads as one lit surface */}
        <div className="absolute inset-0 bg-linear-to-br from-navy via-navy-800 to-blue-900" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-linear-to-t from-navy to-transparent" />
        <div className="absolute -right-40 -top-40 h-96 w-96 rounded-full bg-blue-700/40 blur-3xl" />
        <div className="absolute -bottom-32 left-1/4 h-72 w-72 rounded-full bg-flame/20 blur-3xl" />
        <div className="absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
        {/* dotted grid, fading out towards the bottom */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-25 mask-[linear-gradient(to_bottom,black,transparent_70%)]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #8ab6e0 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        <div className="section-shell relative grid items-center gap-10 py-16 sm:py-24 lg:grid-cols-2">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-flame-400/40 bg-white/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-white">
              <BadgeCheck className="h-3.5 w-3.5 text-flame-400" />
              {s.hero.badge}
            </span>

            <h1 className="mt-5 max-w-3xl text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">
              {heroLead}{" "}
              <span className="text-flame drop-shadow-[0_0_24px_rgba(255,122,0,0.45)]">
                {heroAccent}
              </span>
            </h1>

            <p className="mt-4 max-w-lg text-base leading-7 text-blue-100 sm:text-lg">
              {heroSubtitle}
            </p>

            <div className="mt-7">
              <HeroSearch />
            </div>

            {/* voice highlight */}
            <button
              type="button"
              onClick={() => openVoiceAssistant(true)}
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-flame-400/50 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-flame hover:text-navy"
            >
              <Mic className="h-4 w-4 text-flame-400" />
              {s.hero.voiceCta}
              <span className="hidden text-xs font-normal text-blue-200 sm:inline">
                — {s.hero.voiceHint}
              </span>
            </button>

            {/* social proof + live availability */}
            <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2">
              <div className="flex -space-x-2">
                {[
                  { n: "PS", tone: "bg-flame" },
                  { n: "AV", tone: "bg-blue-500" },
                  { n: "NC", tone: "bg-blue-700" },
                ].map((a) => (
                  <span
                    key={a.n}
                    className={`grid h-8 w-8 place-items-center rounded-full border-2 border-navy text-[10px] font-bold text-white ${a.tone}`}
                  >
                    {a.n}
                  </span>
                ))}
              </div>
              <p className="text-xs leading-5 text-blue-200">
                <span className="font-bold text-white">{s.hero.socialNum}</span>{" "}
                {s.hero.socialTail}
              </p>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-bold text-emerald-200">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-80" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                {onlinePros > 0
                  ? `${onlinePros} ${lang === "hi" ? "प्रो अभी ऑनलाइन" : "Pros online now"}`
                  : lang === "hi"
                    ? "प्रो ऑनलाइन हो रहे हैं"
                    : "Pros coming online"}
              </span>
            </div>

            <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              {s.hero.trust.map((label, i) => {
                const Icon = [BadgeCheck, LayoutGrid, MapPin, ShieldCheck][i];
                return (
                  <li
                    key={label}
                    className="flex items-center gap-2 text-xs font-semibold text-blue-100 sm:text-sm"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-flame-400" />
                    {label}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* booking preview card */}
          <div className="hero-float relative mx-auto hidden w-full max-w-sm min-w-0 lg:block">
            <span className="absolute -left-10 -top-6 flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-800 shadow-xl">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{" "}
              {s.hero.card.rating}
            </span>
            <div className="card border-0 p-5 shadow-2xl ring-1 ring-black/5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy text-sm font-extrabold text-white">
                    K
                  </span>
                  {s.hero.card.pro}
                </span>
                <span className="rounded-full bg-flame-50 px-2.5 py-1 text-xs font-semibold text-flame-600">
                  {s.hero.card.status}
                </span>
              </div>
              <div className="mt-4 rounded-xl bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-900">
                  {s.hero.card.service}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{s.hero.card.when}</p>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-amber-600">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{" "}
                    4.8 · {lang === "hi" ? "सुनीता शर्मा" : "Sunita Sharma"}
                  </span>
                  <span className="font-bold text-slate-900">₹349</span>
                </div>
              </div>
              <ul className="mt-4 space-y-2 text-xs text-slate-500">
                <li className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-blue-600" />{" "}
                  {s.hero.card.arriving}
                </li>
                <li className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-blue-600" />{" "}
                  {s.hero.card.away}
                </li>
                <li className="flex items-center gap-2">
                  <BadgeCheck className="h-3.5 w-3.5 text-blue-600" />{" "}
                  {s.hero.card.paid}
                </li>
              </ul>
            </div>
            <div className="card -mt-5 w-52 border-0 p-4 shadow-xl ring-1 ring-black/5">
              <p className="text-xs font-semibold text-slate-700">
                {s.hero.card.nearbyTitle}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {s.hero.card.nearbySub}
              </p>
              <Link
                href="/services"
                className="mt-2 inline-block text-xs font-bold text-flame-600 hover:underline"
              >
                {s.hero.card.nearbyCta}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── popular service tiles ──────────────────────────── */}
      <section className="section-shell py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
              {s.popular.heading}
            </h2>
            <p className="mt-1.5 text-slate-500">
              {fill(s.popular.sub, { n: services.length })}
            </p>
          </div>
          <Link
            href="/services"
            className="text-sm font-semibold text-blue-600 hover:underline"
          >
            {s.popular.viewAll}
          </Link>
        </div>

        <div className="mt-7 grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-6">
          {tiles.map((t) => {
            // tile map first (extra ids), then admin-chosen / id-based icon
            const Icon =
              TILE_ICONS[t.id] ??
              (t.icon ? ICONS[t.icon] : undefined) ??
              SERVICE_ICONS[t.id] ??
              FALLBACK_ICON;
            return (
              <Link
                key={t.id}
                href={`/services/${t.id}`}
                className="card group flex flex-col items-center gap-3 p-4 text-center transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg"
              >
                {t.image ? (
                  <Image
                    src={t.image}
                    alt={t.name}
                    width={48}
                    height={48}
                    unoptimized
                    className="h-12 w-12 rounded-2xl object-cover transition group-hover:scale-105"
                  />
                ) : (
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-600 transition group-hover:bg-flame group-hover:text-white">
                    <Icon className="h-6 w-6" />
                  </span>
                )}
                <span className="text-xs font-semibold leading-4 text-slate-700 sm:text-sm">
                  {tileLabel(t.id, t.name)}
                </span>
              </Link>
            );
          })}
          <Link
            href="/services"
            className="card group flex flex-col items-center gap-3 p-4 text-center transition hover:-translate-y-0.5 hover:border-flame-400 hover:shadow-lg"
          >
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-flame-50 text-flame-600 transition group-hover:bg-flame group-hover:text-white">
              <LayoutGrid className="h-6 w-6" />
            </span>
            <span className="text-xs font-semibold leading-4 text-slate-700 sm:text-sm">
              {lang === "hi" ? "और सेवाएं" : "More Services"}
            </span>
          </Link>
        </div>
      </section>

      {/* ── how it works ───────────────────────────────────── */}
      <section
        id="how-it-works"
        className="border-y border-slate-100 bg-offwhite py-14"
      >
        <div className="section-shell">
          <h2 className="text-center text-2xl font-extrabold text-slate-900 sm:text-3xl">
            {s.how.heading}
          </h2>
          <p className="mt-2 text-center text-slate-500">{s.how.sub}</p>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {s.how.steps.map((step, i) => {
              const Icon = STEPS_ICONS[i];
              return (
                <div key={step.title} className="relative text-center">
                  {i < s.how.steps.length - 1 && (
                    <ArrowRight className="absolute -right-4 top-8 hidden h-5 w-5 text-blue-300 lg:block" />
                  )}
                  <span
                    className={`mx-auto grid h-16 w-16 place-items-center rounded-full text-white ${STEPS_TONES[i]}`}
                  >
                    <Icon className="h-7 w-7" />
                  </span>
                  <p className="mt-4 text-lg font-extrabold text-slate-900">
                    {i + 1}. {step.title}
                  </p>
                  <p className="mx-auto mt-1 max-w-56 text-sm leading-6 text-slate-500">
                    {step.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── voice + AI assistant highlight ─────────────────── */}
      <section className="relative overflow-hidden bg-navy py-16 text-white sm:py-20">
        <div className="absolute inset-0 bg-linear-to-br from-navy via-navy-800 to-blue-900" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-20 mask-[linear-gradient(to_bottom,black,transparent_75%)]"
          style={{
            backgroundImage: "radial-gradient(circle, #8ab6e0 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-flame/25 blur-3xl" />
        <div className="absolute -bottom-32 right-0 h-80 w-80 rounded-full bg-blue-500/30 blur-3xl" />

        <div className="section-shell relative grid items-center gap-10 lg:grid-cols-2">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-flame-400/40 bg-white/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-white">
              <Mic className="h-3.5 w-3.5 text-flame-400" />
              {s.voice.eyebrow}
            </span>
            <h2 className="mt-5 text-3xl font-extrabold leading-tight sm:text-4xl">
              {s.voice.heading}
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-blue-200">
              {s.voice.sub}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => openVoiceAssistant(true)}
                className="btn-accent px-7 py-3 text-base"
              >
                <Mic className="h-4 w-4" /> {s.voice.cta}
              </button>
              <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-xs font-semibold text-blue-100">
                <MessageCircleQuestion className="h-3.5 w-3.5 text-flame-400" />
                {s.voice.worksIn}
              </span>
            </div>

            <dl className="mt-8 grid max-w-md grid-cols-3 gap-3">
              {[
                { value: onlinePros, label: lang === "hi" ? "ऑनलाइन प्रो" : "Pros online" },
                { value: services.length, label: lang === "hi" ? "सेवाएं" : "Services" },
                { value: serviceAreas, label: lang === "hi" ? "क्षेत्र" : "Areas" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 text-center backdrop-blur"
                >
                  <dt className="text-xl font-extrabold tabular-nums text-white">{item.value}</dt>
                  <dd className="mt-0.5 text-[11px] font-semibold text-blue-200">{item.label}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="grid gap-4">
            {s.voice.cards.map((c, i) => {
              const Icon = VOICE_CARD_ICONS[i];
              return (
                <div
                  key={c.title}
                  className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur transition hover:border-flame-400/40 hover:bg-white/10"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-flame text-navy">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-bold">{c.title}</p>
                    <p className="mt-1 text-sm leading-6 text-blue-200">
                      {c.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── verified professionals ─────────────────────────── */}
      <section className="section-shell py-14">
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <div className="card relative overflow-hidden bg-navy p-8 text-white">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-flame/25 blur-2xl" />
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-flame text-white">
              <BadgeCheck className="h-7 w-7" />
            </span>
            <p className="mt-5 text-3xl font-extrabold leading-tight">
              {lang === "hi" ? (
                <>
                  प्रशिक्षित, वेरिफाइड
                  <br />
                  कामदार प्रो
                </>
              ) : (
                <>
                  Trained, verified
                  <br />
                  Kaamdaar Pros
                </>
              )}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {s.verified.checks.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-100"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
              {s.verified.heading}
            </h2>
            <p className="mt-2 text-slate-500">{s.verified.sub}</p>
            <ul className="mt-5 space-y-3">
              {s.verified.checks.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-2.5 font-semibold text-slate-700"
                >
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-green-50">
                    <BadgeCheck className="h-4 w-4 text-green-600" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/services" className="btn-accent mt-7 px-7 py-3 text-base">
              {s.verified.cta} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── live numbers — real rows, refreshed while the page is open ── */}
      <LiveStats />

      {/* ── testimonials ───────────────────────────────────── */}
      <section className="section-shell py-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
            {s.testimonials.heading}
          </h2>
          <Link
            href="/help"
            className="text-sm font-semibold text-blue-600 hover:underline"
          >
            {s.testimonials.viewAll}
          </Link>
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <figure key={t.name} className="card p-6">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, k) => (
                  <Star
                    key={k}
                    className="h-4 w-4 fill-amber-400 text-amber-400"
                  />
                ))}
              </div>
              <blockquote className="mt-3 text-sm leading-6 text-slate-600">
                “{s.testimonials.quotes[i]}”
              </blockquote>
              <figcaption className="mt-4 flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-blue-600 text-xs font-bold text-white">
                  {t.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </span>
                <span className="text-sm">
                  <span className="block font-bold text-slate-900">{t.name}</span>
                  <span className="block text-xs text-slate-400">{t.place}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ── nearby areas and available providers ──────────── */}
      <AreasWeServe />
    </div>
  );
}
