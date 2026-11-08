"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { CheckCircle2, Loader2, UserRound } from "lucide-react";
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
        <h1 className="mt-4 text-2xl font-extrabold text-slate-900">
          {s.profile.noProfile}
        </h1>
        <p className="mt-2 text-sm text-slate-500">{s.profile.loginNote}</p>
        <Link href="/login?next=/profile" className="btn-primary mt-6">
          {s.profile.loginCta}
        </Link>
      </div>
    );
  }

  return (
    <div className="section-shell py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            {s.profile.title}
          </h1>
          <p className="mt-1 text-slate-500">{s.profile.manage}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
          +91 {user.phone.replace("+91", "")}
        </span>
      </div>

      {setup && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-green-200 bg-green-50 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
          <div className="text-sm text-green-800">
            <p className="font-bold">{s.profile.welcomeTitle}</p>
            <p className="mt-0.5">{s.profile.welcomeBody}</p>
          </div>
        </div>
      )}

      {booked && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-flame-100 bg-flame-50 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-flame-600" />
          <div className="text-sm text-blue-800">
            <p className="font-bold">{s.booking.success}</p>
            <p className="mt-0.5">{s.profile.bookedNote}</p>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[248px_1fr]">
        <ProfileMenu />

        <div className="space-y-6 min-w-0">
          <section id="profile" className="scroll-mt-24">
            <ProfileDetails key={user.phone} />
          </section>
          <section id="addresses" className="scroll-mt-24">
            <AddressBook />
          </section>
          <MyBookings key={tab ?? "current"} initialTab={tab} />
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { s } = useLang();
  return (
    <Suspense fallback={<div className="py-24 text-center text-sm text-slate-400">{s.common.loading}</div>}>
      <ProfileContent />
    </Suspense>
  );
}