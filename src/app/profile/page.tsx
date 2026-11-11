"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import {
  ArrowUpRight, CalendarDays, CheckCircle2, Loader2, MapPin,
  ShieldCheck, UserRound, WalletCards
} from "lucide-react";
import { useApp } from "../../components/AppProvider";
import { useLang } from "../../lib/i18n";
import ProfileDetails from "../../components/ProfileDetails";
import AddressBook from "../../components/AddressBook";
import MyBookings from "../../components/MyBookings";
import ProfileMenu from "../../components/ProfileMenu";
import type { BookingTab } from "../../lib/types";

const BOOKING_TABS: BookingTab[] = ["current", "upcoming", "previous"];

function ProfileContent() {
  const params = useSearchParams();
  const { user, ready } = useApp();
  const { s } = useLang();
  const setup = params.get("setup") === "1";
  const booked = params.get("booked") === "1";
  const rawTab = params.get("tab");
  const tab = rawTab && BOOKING_TABS.includes(rawTab as BookingTab) ? (rawTab as BookingTab) : undefined;

  useEffect(() => {
    if (booked) document.getElementById("bookings")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [booked]);

  if (!ready) return <div className="flex justify-center py-24 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-50"><UserRound className="h-7 w-7 text-blue-600" /></span>
        <h1 className="mt-4 text-2xl font-extrabold text-slate-900">{s.profile.noProfile}</h1>
        <p className="mt-2 text-sm text-slate-500">{s.profile.loginNote}</p>
        <Link href="/login?next=/profile" className="btn-primary mt-6">{s.profile.loginCta}</Link>
      </div>
    );
  }

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Kaamdaar Customer";
  const shortcuts = [
    { title: "Personal details", description: "Manage your name, phone and email", href: "#profile", icon: UserRound, tone: "blue" },
    { title: "Saved addresses", description: "Manage your service locations", href: "#addresses", icon: MapPin, tone: "orange" },
    { title: "My bookings", description: "Track current and previous services", href: "#bookings", icon: CalendarDays, tone: "green" },
  ];

  return (
    <div className="min-h-[calc(100vh-80px)] bg-slate-50/80">
      <div className="section-shell py-8 sm:py-10">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0d3157] via-[#125b91] to-[#1475ad] p-6 text-white shadow-xl shadow-blue-900/10 sm:p-8">
          <div className="pointer-events-none absolute -right-12 -top-24 h-64 w-64 rounded-full border-[34px] border-white/5" />
          <div className="relative flex flex-wrap items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 place-items-center rounded-2xl border border-white/20 bg-white/15 text-xl font-black shadow-inner">
                {(user.firstName?.[0] || "K").toUpperCase()}{(user.lastName?.[0] || "").toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-blue-100">Welcome to your dashboard</p>
                <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{fullName}</h1>
                <p className="mt-1 text-sm text-blue-100">+91 {user.phone.replace("+91", "")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-blue-50">
              <ShieldCheck className="h-4 w-4" /> Your account
            </div>
          </div>
          <p className="relative mt-6 max-w-xl text-sm leading-6 text-blue-100">
            Manage your profile, service addresses and bookings from one simple place.
          </p>
        </div>

        {setup && <div className="mt-5 flex items-start gap-3 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"><CheckCircle2 className="h-5 w-5 shrink-0" /><div><p className="font-bold">{s.profile.welcomeTitle}</p><p className="mt-0.5">{s.profile.welcomeBody}</p></div></div>}
        {booked && <div className="mt-5 flex items-start gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800"><CheckCircle2 className="h-5 w-5 shrink-0" /><div><p className="font-bold">{s.booking.success}</p><p className="mt-0.5">{s.profile.bookedNote}</p></div></div>}

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {shortcuts.map((item) => {
            const Icon = item.icon;
            const iconTone = item.tone === "orange" ? "bg-orange-50 text-orange-600" : item.tone === "green" ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600";
            return (
              <Link key={item.href} href={item.href} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-900/5">
                <div className="flex items-start justify-between"><span className={`grid h-11 w-11 place-items-center rounded-xl ${iconTone}`}><Icon className="h-5 w-5" /></span><ArrowUpRight className="h-4 w-4 text-slate-300 transition group-hover:text-blue-600" /></div>
                <h2 className="mt-4 font-bold text-slate-900">{item.title}</h2>
                <p className="mt-1 text-sm text-slate-500">{item.description}</p>
              </Link>
            );
          })}
        </div>

        <div className="mt-7 grid items-start gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="space-y-4 lg:sticky lg:top-24">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="px-2 pb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Account menu</p>
              <ProfileMenu />
            </div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-blue-900"><WalletCards className="h-4 w-4" /> Need help?</div>
              <p className="mt-1 text-xs leading-5 text-blue-800/70">Our support team is here if you need help with your account or bookings.</p>
              <Link href="/help" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-blue-700">Help & support <ArrowUpRight className="h-3 w-3" /></Link>
            </div>
          </aside>
          <main className="min-w-0 space-y-6">
            <section id="profile" className="scroll-mt-28"><ProfileDetails key={user.phone} /></section>
            <section id="addresses" className="scroll-mt-28"><AddressBook /></section>
            <section id="bookings" className="scroll-mt-28"><MyBookings key={tab ?? "current"} initialTab={tab} /></section>
          </main>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { s } = useLang();
  return <Suspense fallback={<div className="py-24 text-center text-sm text-slate-400">{s.common.loading}</div>}><ProfileContent /></Suspense>;
}
