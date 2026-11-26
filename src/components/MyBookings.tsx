"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, CalendarDays, Clock, IndianRupee, MapPin, Repeat, Zap, X } from "lucide-react";
import { useApp } from "./AppProvider";
import { fill, useLang } from "../lib/i18n";
import { refreshBookings, selectBookingPaymentMethod } from "../lib/store";
import type { Booking, BookingTab } from "../lib/types";

type CustomerBookingTab = BookingTab | "cancelled";

function bucket(status: Booking["status"]): CustomerBookingTab {
  if (status === "cancelled") return "cancelled";
  if (status === "completed") return "previous";
  if (status === "scheduled") return "upcoming";
  return "current";
}

function tabLabels(s: (typeof import("../lib/strings").en)["bookings"]): Record<CustomerBookingTab, string> {
  return {
    current: s.tabs[0],
    upcoming: s.tabs[1],
    previous: s.tabs[2],
    cancelled: "Cancelled",
  };
}

const STATUS_STYLE: Record<Booking["status"], string> = {
  dispatched: "bg-amber-50 text-amber-700",
  accepted: "bg-blue-50 text-blue-700",
  scheduled: "bg-amber-50 text-amber-700",
  enroute: "bg-indigo-50 text-indigo-700",
  arrived: "bg-indigo-50 text-indigo-700",
  in_progress: "bg-indigo-50 text-indigo-700",
  pending_confirm: "bg-purple-50 text-purple-700",
  completed: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-600",
};

const LIVE_STATUSES = new Set<Booking["status"]>([
  "accepted",
  "enroute",
  "arrived",
  "in_progress",
  "pending_confirm",
]);

export default function MyBookings({ initialTab }: { initialTab?: BookingTab }) {
  const { user, ready } = useApp();
  const { s } = useLang();
  const d = s.dispatch;
  const TAB_LABEL = tabLabels(s.bookings);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [tab, setTab] = useState<CustomerBookingTab>(initialTab ?? "current");
  const [notice, setNotice] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("default");
  const previousBookings = useRef<Map<string, { status: Booking["status"]; dispatchFailedAt?: number }> | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }
    setNotificationPermission(window.Notification.permission);
  }, []);

  useEffect(() => {
    if (!user) {
      previousBookings.current = null;
      setBookings([]);
      return;
    }
    let active = true;
    const refresh = async () => {
      try {
        const latest = await refreshBookings(user.id);
        if (!active) return;
        const previous = previousBookings.current;
        if (previous) {
          for (const booking of latest) {
            const old = previous.get(booking.id);
            const newlyFailed = Boolean(old && !old.dispatchFailedAt && booking.dispatchFailedAt);
            const statusChanged = Boolean(old && old.status !== booking.status);
            if (newlyFailed || statusChanged) {
              const message = newlyFailed
                ? "No provider is accepting your request right now. Please try again after some time."
                : `${booking.serviceName}: ${s.bookings.status[booking.status]}`;
              setNotice(message);
              if (noticeTimer.current) clearTimeout(noticeTimer.current);
              noticeTimer.current = setTimeout(() => setNotice(null), 7000);
              if ("Notification" in window && Notification.permission === "granted") {
                try {
                  new Notification("Kaamdaar booking update", {
                    body: message,
                    tag: `kaamdaar-booking-${booking.id}`,
                  });
                } catch { /* browser notification may be unavailable in this context */ }
              }
            }
          }
        }
        previousBookings.current = new Map(latest.map((booking) => [booking.id, { status: booking.status, dispatchFailedAt: booking.dispatchFailedAt }]));
        setBookings(latest);
      } catch {
        // Keep the last good booking list during network/auth restoration.
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, [user, s.bookings.status]);

  async function enableNotifications() {
    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === "granted") {
      setNotice("Browser notifications enabled. Booking updates will appear here and as browser alerts.");
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      noticeTimer.current = setTimeout(() => setNotice(null), 7000);
    }
  }

  const grouped = useMemo(() => {
    const g: Record<CustomerBookingTab, Booking[]> = { current: [], upcoming: [], previous: [], cancelled: [] };
    bookings.forEach((b) => g[bucket(b.status)].push(b));
    g.current.sort((a, b) => {
      const aIsLive = Boolean(a.providerId) && LIVE_STATUSES.has(a.status);
      const bIsLive = Boolean(b.providerId) && LIVE_STATUSES.has(b.status);
      if (aIsLive !== bIsLive) return aIsLive ? -1 : 1;
      const aTime = a.enrouteAt ?? a.acceptedAt ?? a.createdAt;
      const bTime = b.enrouteAt ?? b.acceptedAt ?? b.createdAt;
      return bTime - aTime;
    });
    return g;
  }, [bookings]);

  // guard against an unknown tab reaching us from the URL
  const active: CustomerBookingTab = grouped[tab] ? tab : "current";

  if (!ready || !user) return null;

  return (
    <section className="card p-6" id="bookings">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold text-slate-900">{s.bookings.title}</h2>
        <div className="flex items-center gap-3">
          {notificationPermission === "default" && (
            <button type="button" onClick={() => void enableNotifications()} className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50">
              <Bell className="h-3.5 w-3.5" /> Enable notifications
            </button>
          )}
          {notificationPermission === "granted" && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700"><Bell className="h-3.5 w-3.5" /> Notifications on</span>
          )}
          <Link href="/services" className="text-sm font-semibold text-flame-600 hover:underline">
            {s.bookings.newBooking}
          </Link>
        </div>
      </div>
      {notice && (
        <div role="status" aria-live="polite" className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">
          <span className="flex items-center gap-2"><Bell className="h-4 w-4 shrink-0" />{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss notification" className="rounded p-1 hover:bg-blue-100"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="mt-4 flex gap-2 border-b border-slate-100 pb-3">
        {(Object.keys(TAB_LABEL) as CustomerBookingTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={
              active === t
                ? "rounded-full bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white"
                : "rounded-full px-4 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100"
            }
          >
            {TAB_LABEL[t]} ({grouped[t].length})
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {grouped[active].length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
            <p className="font-semibold text-slate-700">
              {fill(s.bookings.none, { tab: TAB_LABEL[active] })}
            </p>
            <Link href="/services" className="btn-primary mt-4">
              {s.bookings.browse}
            </Link>
          </div>
        )}

        {grouped[active].map((b) => {
          const canTrack = active === "current" && ((Boolean(b.providerId) && LIVE_STATUSES.has(b.status)) || (b.status === "dispatched" && !b.dispatchFailedAt));
          const card = (
            <div className={`rounded-xl border border-slate-200 p-4 transition ${canTrack ? "hover:border-blue-400 hover:bg-blue-50/40" : "hover:border-blue-300"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
                  <CalendarDays className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-slate-900">{b.serviceName}</h3>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase ${STATUS_STYLE[b.status]}`}
                  >
                    {b.dispatchFailedAt ? "No provider available" : s.bookings.status[b.status]}
                  </span>
                  {b.mode === "instant" && <Zap className="h-3.5 w-3.5 text-amber-500" />}
                  {b.mode === "recurring" && <Repeat className="h-3.5 w-3.5 text-indigo-500" />}
                </div>
                {b.providerName ? (
                  <p className="mt-1 text-sm text-slate-500">
                    {s.bookings.pro} {b.providerName}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-slate-500">{b.dispatchFailedAt ? "No provider is accepting your request right now. Please try again after some time." : d.searching}</p>
                )}
                </div>
              </div>
              <span className="flex items-center gap-1 font-extrabold text-slate-900">
                <IndianRupee className="h-3.5 w-3.5" />
                {b.amount}
              </span>
            </div>
            <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500 sm:grid-cols-3">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" /> {b.date}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> {b.slot}
              </span>
              <span className="flex items-center gap-1.5 truncate">
                <MapPin className="h-3.5 w-3.5 shrink-0" /> {b.address.label}, {b.address.city}
              </span>
            </div>
            {b.status === "completed" && b.paymentStatus !== "verified" && !b.paymentReportedAt && (
              <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
                <p className="text-sm font-bold text-slate-800">Choose payment method</p>
                <p className="mt-1 text-xs text-slate-600">Select how you will pay the service provider.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(["cash", "upi"] as const).map((method) => (
                    <button key={method} type="button" onClick={async () => {
                      try {
                        await selectBookingPaymentMethod(b.id, method);
                        setBookings((items) => items.map((item) => item.id === b.id ? { ...item, paymentMethod: method } : item));
                        setNotice(`Payment method selected: ${method.toUpperCase()}. Pay the provider directly.`);
                      } catch (error) { setNotice(error instanceof Error ? error.message : "Payment selection failed"); }
                    }} className={`rounded-lg border px-3 py-2 text-xs font-bold ${b.paymentMethod === method ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white text-slate-700"}`}>
                      {method === "cash" ? "Cash" : "UPI"}
                    </button>
                  ))}
                </div>
                {b.paymentMethod && <p className="mt-2 text-xs font-semibold text-blue-800">Selected: {b.paymentMethod.toUpperCase()} · Provider will confirm collection</p>}
              </div>
            )}
            {b.paymentReportedAt && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                Payment collection reported · {b.paymentMethod?.toUpperCase()} · Awaiting Admin verification
              </p>
            )}
            {canTrack && (
              <p className="mt-3 flex items-center justify-end gap-1.5 text-xs font-semibold text-blue-700">
                <MapPin className="h-3.5 w-3.5" /> {d.liveTrack}
              </p>
            )}
            </div>
          );

          return canTrack ? (
            <Link key={b.id} href={`/track/${b.id}`} className="group block rounded-xl focus-visible:outline-blue-600" aria-label={`${b.serviceName}: ${d.liveTrack}`}>
              {card}
            </Link>
          ) : (
            <article key={b.id}>{card}</article>
          );
        })}
      </div>
    </section>
  );
}
