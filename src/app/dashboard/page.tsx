"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
import MyBookings from "../../components/MyBookings";
import { listBookings } from "../../lib/store";
import type { Booking } from "../../lib/types";

const QUICK = [
  { href: "/profile", label: "My Profile", icon: UserRound },
  { href: "/services", label: "Book a Service", icon: CalendarCheck },
  { href: "/refer", label: "Refer & Earn", icon: Gift },
  { href: "/help", label: "Help & Support", icon: LifeBuoy },
];

/**
 * Signed-in landing page: returning users come here after OTP verification
 * (new users go to /profile to complete their details instead).
 */
export default function DashboardPage() {
  const router = useRouter();
  const { user, ready, location } = useApp();
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    if (ready && !user) router.replace("/login?next=/dashboard");
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
    { value: active, label: "Active now", icon: Clock },
    { value: upcoming, label: "Upcoming", icon: CalendarCheck },
    { value: done, label: "Completed", icon: ArrowRight },
  ];

  return (
    <div className="section-shell py-10">
      {/* greeting */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Welcome back, {user.firstName || "there"}
          </h1>
          <p className="mt-1.5 flex items-center gap-1.5 text-slate-500">
            <MapPin className="h-4 w-4 text-flame-600" />
            {location?.label ?? "Set your location to see nearby Pros"}
          </p>
        </div>
        <Link href="/services" className="btn-accent">
          Book a service <ArrowRight className="h-4 w-4" />
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
        {QUICK.map((q) => {
          const Icon = q.icon;
          return (
            <Link
              key={q.href}
              href={q.href}
              className="card flex items-center gap-2.5 px-4 py-3.5 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
            >
              <Icon className="h-4 w-4 text-flame-600" />
              {q.label}
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