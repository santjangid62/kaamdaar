import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Clock,
  MapPin,
  Phone,
  Quote,
  Star,
  Wallet,
} from "lucide-react";
import ServiceCard from "../components/ServiceCard";
import { CITIES, SERVICES, SERVICE_CATEGORIES } from "../lib/seed";

export const metadata: Metadata = {
  title: "Kaamdaar — Har Kaam Turant | Trusted house help in minutes",
};

export default function HomePage() {
  const popular = SERVICES.filter((s) => s.popular);
  const steps = [
    {
      icon: MapPin,
      title: "We detect your location",
      body: "Open the site anywhere — your current area shows in the navbar so you only see services and Pro rates relevant to you.",
    },
    {
      icon: Phone,
      title: "Login with your phone number",
      body: "Enter the number, verify the OTP, and you stay signed in until you log out. First time users are taken straight to profile setup.",
    },
    {
      icon: BadgeCheck,
      title: "Pick a Pro within 2–3 km",
      body: "Choose a service and every verified provider nearby is listed with rating, distance and rate. Confirm and the Pro is assigned.",
    },
  ];

  const testimonials = [
    {
      quote:
        "Booked a kitchen cleanup at 9 pm, a Pro was at my door the next morning. The rates on the site were exactly what I paid.",
      name: "Ridhi Saluja",
      place: "Sector 56, Gurugram",
    },
    {
      quote:
        "I use the hourly booking every weekend. Login once with OTP and my address is remembered for every order.",
      name: "Aditya Menon",
      place: "Koramangala, Bengaluru",
    },
    {
      quote:
        "Transparent rates and trained help. My mother books from her phone without any help from me.",
      name: "Priya Deshpande",
      place: "Baner, Pune",
    },
  ];

  return (
    <div>
      {/* hero */}
      <section className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-b from-blue-50 via-white to-white">
        <div className="section-shell grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700">
              <MapPin className="h-3.5 w-3.5" /> Serving homes across India
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl">
              Trusted house help
              <span className="text-flame-600"> in minutes</span>
            </h1>
            <p className="mt-4 max-w-lg text-lg leading-7 text-slate-600">
              Cleaning, laundry, kitchen prep, hourly help and more — book a
              trained Kaamdaar Pro from the website itself, at transparent
              rates.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/services" className="btn-accent px-6 py-3 text-base">
                Browse services <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/#how-it-works" className="btn-ghost px-6 py-3 text-base">
                How it works
              </Link>
            </div>
            <dl className="mt-9 grid max-w-md grid-cols-3 gap-4">
              {[
                ["20+", "Services"],
                ["2–3 km", "Pro radius"],
                ["4.5★", "App rating"],
              ].map(([value, label]) => (
                <div key={label}>
                  <dt className="text-2xl font-extrabold text-slate-900">{value}</dt>
                  <dd className="text-xs uppercase tracking-wide text-slate-400">{label}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* booking mock */}
          <div className="relative">
            <div className="card mx-auto max-w-sm p-5 shadow-2xl shadow-blue-100">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Image
                    src="/kaamdaar-icon.png"
                    alt=""
                    width={32}
                    height={32}
                    className="h-8 w-8 rounded-lg"
                  />
                  Kaamdaar Pro
                </span>
                <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
                  Assigned
                </span>
              </div>
              <div className="mt-4 rounded-xl bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-900">Kitchen Cleaning</p>
                <p className="mt-0.5 text-xs text-slate-500">Today · 5:00 PM – 6:00 PM</p>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-amber-600">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> 4.8 · Sunita Sharma
                  </span>
                  <span className="font-bold text-slate-900">₹349</span>
                </div>
              </div>
              <ul className="mt-4 space-y-2 text-xs text-slate-500">
                <li className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-blue-600" /> Pro arriving in ~15 minutes
                </li>
                <li className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-blue-600" /> 1.2 km away from your address
                </li>
                <li className="flex items-center gap-2">
                  <Wallet className="h-3.5 w-3.5 text-blue-600" /> Paid via UPI — no cash needed
                </li>
              </ul>
            </div>
            <div className="card absolute -bottom-6 -left-4 hidden w-44 p-3 shadow-xl sm:block">
              <p className="text-xs font-semibold text-slate-700">OTP verified</p>
              <p className="mt-1 font-mono text-lg font-bold tracking-[0.3em] text-blue-600">••••••</p>
              <p className="mt-1 text-[10px] text-slate-400">Phone-only login</p>
            </div>
          </div>
        </div>
      </section>

      {/* services */}
      <section className="section-shell py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
              Popular services
            </h2>
            <p className="mt-1.5 text-slate-500">Starting rates shown upfront — no surprises.</p>
          </div>
          <Link href="/services" className="text-sm font-semibold text-blue-600 hover:underline">
            View all services →
          </Link>
        </div>
        <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {popular.slice(0, 6).map((s) => (
            <ServiceCard key={s.id} service={s} />
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {SERVICE_CATEGORIES.map((c) => (
            <Link
              key={c}
              href={`/services?cat=${encodeURIComponent(c)}`}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-blue-300 hover:text-blue-700"
            >
              {c}
            </Link>
          ))}
        </div>
      </section>

      {/* how it works */}
      <section id="how-it-works" className="border-y border-slate-100 bg-slate-50 py-14">
        <div className="section-shell">
          <h2 className="text-center text-2xl font-extrabold text-slate-900 sm:text-3xl">
            Booking takes less than a minute
          </h2>
          <div className="mt-9 grid gap-5 md:grid-cols-3">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.title} className="card p-6">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-sm font-bold text-blue-600">Step {i + 1}</span>
                  </div>
                  <h3 className="mt-4 font-bold text-slate-900">{s.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{s.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* testimonials */}
      <section className="section-shell py-14">
        <h2 className="text-center text-2xl font-extrabold text-slate-900 sm:text-3xl">
          Homes that run smoother
        </h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {testimonials.map((t) => (
            <figure key={t.name} className="card p-6">
              <Quote className="h-6 w-6 text-blue-200" />
              <blockquote className="mt-3 text-sm leading-6 text-slate-600">
                “{t.quote}”
              </blockquote>
              <figcaption className="mt-4 text-sm">
                <span className="font-bold text-slate-900">{t.name}</span>
                <span className="block text-xs text-slate-400">{t.place}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* cities */}
      <section className="border-t border-slate-100 bg-gradient-to-b from-white to-blue-50 py-14">
        <div className="section-shell text-center">
          <h2 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">Cities we serve</h2>
          <p className="mt-2 text-slate-500">Trained Pros across {CITIES.length} cities.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-2.5">
            {CITIES.map((c) => (
              <span
                key={c}
                className="rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm"
              >
                {c}
              </span>
            ))}
          </div>
          <Link href="/cities" className="btn-ghost mt-7">
            See coverage details
          </Link>
        </div>
      </section>

      {/* apps */}
      <section className="section-shell py-14">
        <div className="grid items-center gap-6 rounded-3xl bg-slate-900 p-8 text-white sm:p-10 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-extrabold">Kaamdaar on your phone</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              The customer app and the Pro partner app are coming soon — same
              phone-OTP login, same saved addresses, same bookings.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <span className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300">
                Android — coming soon
              </span>
              <span className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300">
                iOS — coming soon
              </span>
            </div>
          </div>
          <div className="rounded-2xl bg-slate-800/60 p-5 text-sm text-slate-300">
            <p className="font-bold text-white">Web booking already works</p>
            <p className="mt-2 leading-6">
              Everything — location detection, search, rates, OTP login, profile
              and nearby Pro selection — runs right here in the browser.
            </p>
            <Link href="/services" className="btn-primary mt-4">
              Book a service
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}