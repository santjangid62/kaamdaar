"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { CheckCircle2, Loader2, MapPin, UserRound } from "lucide-react";
import { useApp } from "../../components/AppProvider";
import ProfileDetails from "../../components/ProfileDetails";
import AddressBook from "../../components/AddressBook";
import MyBookings from "../../components/MyBookings";
import ProfileMenu from "../../components/ProfileMenu";
import type { BookingTab } from "../../lib/types";

const BOOKING_TABS: BookingTab[] = ["current", "upcoming", "previous"];

function ProfileContent() {
  const params = useSearchParams();
  const { user, ready } = useApp();
  const setup = params.get("setup") === "1";
  const booked = params.get("booked") === "1";
  const rawTab = params.get("tab");
  const tab = rawTab && BOOKING_TABS.includes(rawTab as BookingTab) ? (rawTab as BookingTab) : undefined;

  useEffect(() => {
    if (booked) {
      document.getElementById("bookings")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [booked]);

  if (!ready) {
    return (
      <div className="flex justify-center py-24 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-blue-50">
          <UserRound className="h-7 w-7 text-blue-600" />
        </span>
        <h1 className="mt-4 text-2xl font-extrabold text-slate-900">Login to view your profile</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your bookings, addresses and account settings live here.
        </p>
        <Link href="/login?next=/profile" className="btn-primary mt-6">
          Login with phone number
        </Link>
      </div>
    );
  }

  return (
    <div className="section-shell py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">My profile</h1>
          <p className="mt-1 text-slate-500">
            Manage your details, addresses and bookings in one place.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
          +91 {user.phone.replace("+91", "")}
        </span>
      </div>

      {setup && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-green-200 bg-green-50 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
          <div className="text-sm text-green-800">
            <p className="font-bold">Welcome to Kaamdaar!</p>
            <p className="mt-0.5">
              Your number is verified and saved. Add your basic details below so
              we can personalise your bookings — email is optional.
            </p>
          </div>
        </div>
      )}

      {booked && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-flame-100 bg-flame-50 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-flame-600" />
          <div className="text-sm text-blue-800">
            <p className="font-bold">Booking confirmed!</p>
            <p className="mt-0.5">
              Your Pro has been notified. Track it under My bookings below.
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ProfileDetails key={user.phone} />
          <AddressBook />
          <MyBookings key={tab ?? "current"} initialTab={tab} />
        </div>

        <div className="space-y-6">
          <ProfileMenu />
          <section className="card p-6">
            <h2 className="flex items-center gap-2 font-bold text-slate-900">
              <MapPin className="h-4 w-4 text-blue-600" /> Refer & Earn
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Share your code{" "}
              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-bold text-slate-700">
                {user.referralCode}
              </span>{" "}
              with friends and earn credits on their first booking.
            </p>
            <Link href="/refer" className="btn-ghost mt-4 w-full">
              Know more
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-sm text-slate-400">Loading…</div>}>
      <ProfileContent />
    </Suspense>
  );
}