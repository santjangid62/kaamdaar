"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarCheck,
  Clock,
  Gift,
  LifeBuoy,
  MapPin,
  UserRound,
} from "lucide-react";
import { useApp } from "../../components/AppProvider";
import { useLang } from "../../lib/i18n";
import MyBookings from "../../components/MyBookings";
import { listBookings } from "../../lib/store";
import type { Booking } from "../../lib/types";

const QUICK_HREFS = ["/profile", "/services", "/refer", "/help"];
const QUICK_ICONS = [UserRound, CalendarCheck, Gift, LifeBuoy];

/**
 * Signed-in landing page: returning users come here after OTP verification
 * (new users go to /profile to complete their details instead).
 */
export default function DashboardPage() {
  const router = useRouter();
  const { user, ready, location } = useApp();
  const { s } = useLang();
  const [bookings, setBookings] = useState<Booking[]>([]);

  // A visitor who deep-links here while signed out goes to login; a visitor
  // who was signed in and then logged out goes home (never bounced back to
  // the login screen they just left).
  const hadUser = useRef(false);

  useEffect(() => {
    if (user) {
      hadUser.current = true;
      return;
    }
    if (ready) router.replace(hadUser.current ? "/" : "/login?next=/dashboard");
  }, [ready, user, router]);

  useEffect(() => {
    if (user) void listBookings(user.id).then(setBookings);
  }, [user]);

  if (!ready || !user) return null;

  const active = bookings.filter(
    (b) => b.status === "accepted" || b.status === "in_progress",
  ).length;
  const upcoming = bookings.filter((b) => b.status === "scheduled").length;
  const done = bookings.filter(
    (b) => b.status === "completed" || b.status === "cancelled",
  ).length;

  const stats = [
    { value: active, label: s.dashboard.active, icon: Clock },
    { value: upcoming, label: s.dashboard.upcoming, icon: CalendarCheck },
    { value: done, label: s.dashboard.completed, icon: ArrowRight },
  ];

  return (
    <div className="section-shell py-10">
      {/* greeting */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            {s.dashboard.welcome} {user.firstName || user.phone.slice(-4)}
          </h1>
          <p className="mt-1.5 flex items-center gap-1.5 text-slate-500">
            <MapPin className="h-4 w-4 text-flame-600" />
            {location?.label ?? s.dashboard.setLoc}
          </p>
        </div>
        <Link href="/services" className="btn-accent">
          {s.dashboard.bookCta} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* stats */}
      <div className="mt-7 grid gap-4 sm:grid-cols-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="card flex items-center gap-4 p-5">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-600">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-2xl font-extrabold text-slate-900">
                  {s.value}
                </p>
                <p className="text-sm text-slate-500">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* quick links */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {s.dashboard.quick.map((label, i) => {
          const Icon = QUICK_ICONS[i];
          return (
            <Link
              key={label}
              href={QUICK_HREFS[i]}
              className="card flex items-center gap-2.5 px-4 py-3.5 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
            >
              <Icon className="h-4 w-4 text-flame-600" />
              {label}
            </Link>
          );
        })}
      </div>

      {/* bookings */}
      <div className="mt-8">
        <MyBookings />
      </div>
    </div>
  );
}