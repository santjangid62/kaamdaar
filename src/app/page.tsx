import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  Car,
  ChefHat,
  Clock,
  Droplets,
  Fan,
  LayoutGrid,
  MapPin,
  Refrigerator,
  Search,
  ShieldCheck,
  Shirt,
  Sparkles,
  SprayCan,
  Star,
  Utensils,
  Wallet,
  Wind,
} from "lucide-react";
import HeroSearch from "../components/HeroSearch";
import { CITIES, SERVICES } from "../lib/seed";

export const metadata: Metadata = {
  title: "Kaamdaar — Har Kaam Turant | Trusted house help in minutes",
};

/** Icon tiles — the mockup's "Popular Services" grid, mapped to our catalogue. */
const TILES: Array<{ id: string; label: string; icon: typeof Clock }> = [
  { id: "hourly-bookings", label: "Hourly Bookings", icon: Clock },
  { id: "kitchen-cleaning", label: "Kitchen Cleaning", icon: SprayCan },
  { id: "kitchen-prep", label: "Kitchen Prep", icon: ChefHat },
  { id: "utensils", label: "Utensils", icon: Utensils },
  { id: "bathroom-cleaning", label: "Bathroom Cleaning", icon: Droplets },
  { id: "sweeping-mopping", label: "Sweeping & Mopping", icon: Sparkles },
  { id: "laundry", label: "Laundry", icon: Shirt },
  { id: "ironing-folding", label: "Ironing & Folding", icon: Wind },
  { id: "fridge-cleaning", label: "Fridge Cleaning", icon: Refrigerator },
  { id: "fan-cleaning", label: "Fan Cleaning", icon: Fan },
  { id: "car-surface-cleaning", label: "Car Cleaning", icon: Car },
];

const STEPS = [
  {
    title: "Search",
    body: "Choose your service and location",
    icon: Search,
    tone: "bg-blue-600",
  },
  {
    title: "Book",
    body: "Select time and confirm booking",
    icon: CalendarCheck,
    tone: "bg-flame",
  },
  {
    title: "Track",
    body: "Follow your booking and Pro status",
    icon: MapPin,
    tone: "bg-blue-600",
  },
  {
    title: "Relax",
    body: "Get your work done and pay safely",
    icon: ShieldCheck,
    tone: "bg-flame",
  },
];

const STATS = [
  { value: "20,000+", label: "Happy Customers" },
  { value: "4.9 ★", label: "Average Rating" },
  { value: "100+", label: "Services" },
  { value: "500+", label: "Verified Professionals" },
];

const TRUST = [
  { icon: BadgeCheck, label: "Verified Professionals" },
  { icon: Wallet, label: "Upfront Pricing" },
  { icon: MapPin, label: "Live Tracking" },
  { icon: ShieldCheck, label: "Secure Payments" },
];

const testimonials = [
  {
    quote:
      "Very professional service. Booked AC service and the technician arrived on time. Highly recommended!",
    name: "Priya Sharma",
    place: "Malviya Nagar, Jaipur",
  },
  {
    quote:
      "Transparent pricing and an easy booking process. The Pro was courteous and finished before time.",
    name: "Amit Verma",
    place: "Sector 56, Gurugram",
  },
  {
    quote:
      "Great platform with verified professionals. Booking from the website takes less than a minute.",
    name: "Neha Chawla",
    place: "Jagatpura, Jaipur",
  },
];

export default function HomePage() {
  return (
    <div>
      {/* ── hero ───────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-navy">
        <div className="absolute -right-40 -top-40 h-96 w-96 rounded-full bg-blue-700/40 blur-3xl" />
        <div className="absolute -bottom-32 left-1/4 h-72 w-72 rounded-full bg-flame/20 blur-3xl" />
        <div className="absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
        {/* dotted grid, fading out towards the bottom */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-25 [mask-image:linear-gradient(to_bottom,black,transparent_70%)]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #8ab6e0 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        <div className="section-shell relative grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-flame-400/40 bg-white/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-white">
              <BadgeCheck className="h-3.5 w-3.5 text-flame-400" />
              Trusted home services
            </span>

            <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Har Ghar Ka
              <br />
              Har Kaam{" "}
              <span className="text-flame drop-shadow-[0_0_24px_rgba(255,122,0,0.45)]">
                Turant
              </span>
            </h1>

            <p className="mt-4 max-w-lg text-lg leading-7 text-blue-200">
              Verified professionals for all your home and business needs. Book
              easily, track live, pay safely.
            </p>

            <div className="mt-7">
              <HeroSearch />
            </div>

            {/* social proof */}
            <div className="mt-6 flex items-center gap-3">
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
                <span className="font-bold text-white">10,000+</span> bookings
                completed this month
              </p>
            </div>

            <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              {TRUST.map((t) => {
                const Icon = t.icon;
                return (
                  <li
                    key={t.label}
                    className="flex items-center gap-2 text-xs font-semibold text-blue-100 sm:text-sm"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-flame-400" />
                    {t.label}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* booking preview card */}
          <div className="hero-float relative mx-auto hidden w-full max-w-sm lg:block">
            <span className="absolute -left-10 -top-6 flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-800 shadow-xl">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{" "}
              4.8 · 256 reviews
            </span>
            <div className="card border-0 p-5 shadow-2xl ring-1 ring-black/5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy text-sm font-extrabold text-white">
                    K
                  </span>
                  Kaamdaar Pro
                </span>
                <span className="rounded-full bg-flame-50 px-2.5 py-1 text-xs font-semibold text-flame-600">
                  On the way
                </span>
              </div>
              <div className="mt-4 rounded-xl bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-900">
                  Kitchen Cleaning
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Today · 5:00 PM – 6:00 PM
                </p>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-amber-600">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{" "}
                    4.8 · Sunita Sharma
                  </span>
                  <span className="font-bold text-slate-900">₹349</span>
                </div>
              </div>
              <ul className="mt-4 space-y-2 text-xs text-slate-500">
                <li className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-blue-600" /> Pro arriving
                  in ~15 minutes
                </li>
                <li className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-blue-600" /> 1.2 km away
                  from your address
                </li>
                <li className="flex items-center gap-2">
                  <Wallet className="h-3.5 w-3.5 text-blue-600" /> Paid via
                  UPI — no cash needed
                </li>
              </ul>
            </div>
            <div className="card -mt-5 w-52 border-0 p-4 shadow-xl ring-1 ring-black/5">
              <p className="text-xs font-semibold text-slate-700">
                Book AC Service in Jaipur
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                42 verified pros nearby
              </p>
              <Link
                href="/services"
                className="mt-2 inline-block text-xs font-bold text-flame-600 hover:underline"
              >
                Browse services →
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
              Popular Services
            </h2>
            <p className="mt-1.5 text-slate-500">
              Choose from {SERVICES.length}+ professional services — rates
              shown upfront.
            </p>
          </div>
          <Link
            href="/services"
            className="text-sm font-semibold text-blue-600 hover:underline"
          >
            View All →
          </Link>
        </div>

        <div className="mt-7 grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-6">
          {TILES.map((t) => {
            const Icon = t.icon;
            return (
              <Link
                key={t.id}
                href={`/services/${t.id}`}
                className="card group flex flex-col items-center gap-3 p-4 text-center transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg"
              >
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-600 transition group-hover:bg-flame group-hover:text-white">
                  <Icon className="h-6 w-6" />
                </span>
                <span className="text-xs font-semibold leading-4 text-slate-700 sm:text-sm">
                  {t.label}
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
              More Services
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
            How Kaamdaar Works?
          </h2>
          <p className="mt-2 text-center text-slate-500">
            Get your service in 4 simple steps
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.title} className="relative text-center">
                  {i < STEPS.length - 1 && (
                    <ArrowRight className="absolute -right-4 top-8 hidden h-5 w-5 text-blue-300 lg:block" />
                  )}
                  <span
                    className={`mx-auto grid h-16 w-16 place-items-center rounded-full text-white ${s.tone}`}
                  >
                    <Icon className="h-7 w-7" />
                  </span>
                  <p className="mt-4 text-lg font-extrabold text-slate-900">
                    {i + 1}. {s.title}
                  </p>
                  <p className="mx-auto mt-1 max-w-[14rem] text-sm leading-6 text-slate-500">
                    {s.body}
                  </p>
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
              Trained, verified
              <br />
              Kaamdaar Pros
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {["Background checked", "Trained", "Insured", "Rated 4.5+"].map(
                (chip) => (
                  <span
                    key={chip}
                    className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-100"
                  >
                    {chip}
                  </span>
                ),
              )}
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
              Verified Professionals at Your Service
            </h2>
            <ul className="mt-5 space-y-3">
              {[
                "Background Verified",
                "Trained & Experienced",
                "Rated by Customers",
              ].map((item) => (
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
              Book Now <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── stats ──────────────────────────────────────────── */}
      <section className="border-y border-slate-100 bg-flame-50 py-10">
        <dl className="section-shell grid grid-cols-2 gap-6 text-center lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label}>
              <dt className="text-3xl font-extrabold text-flame-600 sm:text-4xl">
                {s.value}
              </dt>
              <dd className="mt-1 text-sm font-medium text-slate-600">
                {s.label}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── testimonials ───────────────────────────────────── */}
      <section className="section-shell py-14">
        <h2 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
          What Our Customers Say
        </h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {testimonials.map((t) => (
            <figure key={t.name} className="card p-6">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className="h-4 w-4 fill-amber-400 text-amber-400"
                  />
                ))}
              </div>
              <blockquote className="mt-3 text-sm leading-6 text-slate-600">
                “{t.quote}”
              </blockquote>
              <figcaption className="mt-4 flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-blue-600 text-xs font-bold text-white">
                  {t.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </span>
                <span className="text-sm">
                  <span className="block font-bold text-slate-900">
                    {t.name}
                  </span>
                  <span className="block text-xs text-slate-400">
                    {t.place}
                  </span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ── cities ─────────────────────────────────────────── */}
      <section className="border-t border-slate-100 bg-offwhite py-12">
        <div className="section-shell text-center">
          <h2 className="text-2xl font-extrabold text-slate-900">
            Cities we serve
          </h2>
          <p className="mt-2 text-slate-500">
            Trained Pros across {CITIES.length} cities.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2.5">
            {CITIES.map((c) => (
              <span
                key={c}
                className="rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm"
              >
                {c}
              </span>
            ))}
          </div>
          <Link href="/cities" className="btn-ghost mt-6">
            See coverage details
          </Link>
        </div>
      </section>

      {/* ── become a provider removed: providers are onboarded by the admin team only ── */}
    </div>
  );
}