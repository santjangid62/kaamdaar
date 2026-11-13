"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  Clock,
  IndianRupee,
  Loader2,
  MapPin,
  RefreshCcw,
  ShieldCheck,
  Star,
  XCircle,
} from "lucide-react";
import { useApp } from "../../../components/AppProvider";
import DispatchMap, { type MapProviderMarker } from "../../../components/DispatchMap";
import ProviderPanel from "../../../components/ProviderPanel";
import { fill, useLang } from "../../../lib/i18n";
import { DEMO_TRAVEL_MS, commissionOf, lerpPoint } from "../../../lib/dispatch";
import { haversineKm } from "../../../lib/geo";
import { debitCommission, listBookings, updateBooking } from "../../../lib/store";
import type { Booking, GeoPoint, PaymentMethod } from "../../../lib/types";

const STEPS = [
  "dispatched",
  "enroute",
  "arrived",
  "in_progress",
  "pending_confirm",
  "completed",
] as const;

function mmss(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function TrackView() {
  const params = useParams<{ bookingId: string }>();
  const { user, ready, location } = useApp();
  const { s } = useLang();
  const d = s.dispatch;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const arrivedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    const list = await listBookings(user.id);
    setBooking(list.find((b) => b.id === params.bookingId) ?? null);
    setLoaded(true);
  }, [user, params.bookingId]);

  useEffect(() => {
    if (!ready || !user) return;
    void listBookings(user.id).then((list) => {
      setBooking(list.find((b) => b.id === params.bookingId) ?? null);
      setLoaded(true);
    });
  }, [ready, user, params.bookingId]);

  /* live ETA: the Pro's marker rides from its accept point to the user */
  useEffect(() => {
    if (booking?.status !== "enroute" || !booking.enrouteAt) return;
    const enrouteAt = booking.enrouteAt;
    const tick = () => {
      const p = Math.min(1, (Date.now() - enrouteAt) / DEMO_TRAVEL_MS);
      setProgress(p);
      if (p >= 1 && !arrivedRef.current) {
        arrivedRef.current = true;
        void updateBooking(booking.userId, booking.id, {
          status: "arrived",
          arrivedAt: Date.now(),
        }).then(refresh);
      }
    };
    tick();
    const id = window.setInterval(tick, 400);
    return () => window.clearInterval(id);
  }, [booking, refresh]);

  /* elapsed clock while the work runs */
  useEffect(() => {
    if (booking?.status !== "in_progress") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [booking?.status]);

  const origin = useMemo<GeoPoint | null>(() => {
    if (!booking) return null;
    if (booking.originPoint) return booking.originPoint;
    if (typeof booking.address.lat === "number" && typeof booking.address.lng === "number") {
      return { lat: booking.address.lat, lng: booking.address.lng };
    }
    return location ? { lat: location.lat, lng: location.lng } : null;
  }, [booking, location]);

  const activePoint = useMemo<GeoPoint | null>(() => {
    if (!booking || !origin) return null;
    // a real GPS ping from the Provider app always beats the demo animation
    if (booking.livePoint) return booking.livePoint;
    const start = booking.providerPoint;
    if (booking.status === "enroute" && start) return lerpPoint(start, origin, progress);
    if (start) return { lat: origin.lat + 0.0004, lng: origin.lng + 0.0004 };
    return origin;
  }, [booking, origin, progress]);

  const markers: MapProviderMarker[] = useMemo(() => {
    if (!booking || !activePoint) return [];
    return [
      {
        id: booking.providerId || "pro",
        point: activePoint,
        rating: booking.providerProfile?.rating ?? 4.8,
        name: booking.providerProfile?.name ?? "Pro",
        moving: booking.status === "enroute",
      },
    ];
  }, [booking, activePoint]);

  /* ----------------------------- actions ----------------------------- */

  async function cancelBooking() {
    if (!booking) return;
    setBusy(true);
    try {
      await updateBooking(booking.userId, booking.id, { status: "cancelled" });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function verifyComplete() {
    if (!booking) return;
    if (otp !== booking.completeOtp) {
      setOtpError(true);
      return;
    }
    setBusy(true);
    try {
      await updateBooking(booking.userId, booking.id, { status: "completed" }, otp);
      setOtp("");
      setOtpError(false);
      setNote(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function sendBack() {
    if (!booking) return;
    setBusy(true);
    try {
      await updateBooking(booking.userId, booking.id, {
        status: "in_progress",
        completeOtp: undefined,
      });
      setNote(d.sentBack);
      setOtp("");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    if (!booking?.providerId) return;
    setBusy(true);
    try {
      const comm = commissionOf(booking.amount);
      // company rule: 10% commission leaves the Pro's wallet the moment it is paid
      await debitCommission(booking.providerId, comm, booking.serviceName);
      await updateBooking(booking.userId, booking.id, {
        paidAt: Date.now(),
        paymentMethod: method,
        commission: comm,
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  /* ------------------------------ views ------------------------------ */

  if (!ready || (user && !loaded)) {
    return (
      <div className="flex justify-center py-24 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-2xl font-extrabold text-slate-900">{d.loginToBook}</h1>
        <Link href={`/login?next=/track/${params.bookingId}`} className="btn-primary mt-6">
          {s.nav.login}
        </Link>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-lg font-bold text-slate-900">{s.providers.notFound}</p>
        <Link href="/profile?tab=current" className="btn-primary mt-6">
          {d.viewBookings}
        </Link>
      </div>
    );
  }

  const status = booking.status;
  const pro = booking.providerProfile;
  const etaLeft = Math.max(1, Math.ceil((1 - progress) * (booking.etaMinutes ?? 8)));
  const stepIdx =
    status === "accepted"
      ? STEPS.indexOf("enroute")
      : status === "scheduled"
        ? -1
        : STEPS.indexOf(status as (typeof STEPS)[number]);

  // live tracking: real distance from the Pro's last GPS ping, plus the audit
  // trail the server wrote for this job
  const livePoint = booking.livePoint ?? null;
  const liveDistanceKm = livePoint && origin ? haversineKm(livePoint, origin) : null;
  const recentEvents = (booking.events ?? []).slice(-4).reverse();

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            {s.bookings.title}
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            {booking.serviceName}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {booking.date} · {booking.slot} · ₹{booking.amount}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold uppercase text-slate-600">
          {s.bookings.status[status]}
        </span>
      </div>

      {/* stepper */}
      {stepIdx >= 0 && (
        <ol className="mt-4 flex flex-wrap gap-1.5">
          {STEPS.map((st, i) => (
            <li
              key={st}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                i < stepIdx
                  ? "bg-green-50 text-green-700"
                  : i === stepIdx
                    ? "bg-flame text-navy"
                    : "bg-slate-100 text-slate-400"
              }`}
            >
              {i < stepIdx && <CheckCircle2 className="h-3.5 w-3.5" />}
              {s.bookings.status[st]}
            </li>
          ))}
        </ol>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        {/* ---------------- map / live track ---------------- */}
        <div className="space-y-4">
          {origin && (status === "enroute" || status === "arrived" || status === "in_progress" || status === "accepted") ? (
            <DispatchMap
              className="h-[42vh] min-h-[300px] w-full"
              center={origin}
              user={origin}
              providers={markers}
              radiusKm={1.5}
            />
          ) : (
            <div className="card flex items-center gap-3 p-5 text-sm text-slate-500">
              <MapPin className="h-5 w-5 shrink-0 text-flame-600" />
              {booking.address.label}, {booking.address.city}
            </div>
          )}

          {/* ETA banner */}
          {(status === "enroute" || status === "accepted") && (
            <div className="card overflow-hidden p-0">
              <div className="flex items-center gap-3 bg-navy p-4 text-white">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-flame/20">
                  <Clock className="h-5 w-5 text-flame-400" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-blue-100">{d.onTheWay}</p>
                  <p className="text-lg font-extrabold">
                    {fill(d.etaIn, { n: etaLeft })}
                  </p>
                </div>
                <span className="ml-auto rounded-full bg-white/10 px-3 py-1 text-xs font-bold">
                  {d.liveTrack}
                </span>
              </div>
              <div className="px-4 py-3">
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-flame to-amber-400 transition-all"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                  <MapPin className="h-3.5 w-3.5 text-flame-600" /> {d.sharedLocation}
                </p>
                <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                  {liveDistanceKm != null ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 font-bold text-green-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                      Pro is {liveDistanceKm.toFixed(2)} km away · live GPS
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-500">
                      Waiting for the Pro&apos;s GPS
                    </span>
                  )}
                  {booking.navigationStartedAt && (
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700">
                      Navigation started
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* what actually happened on this job (server-written events) */}
          {recentEvents.length > 0 && (
            <div className="card p-4">
              <h2 className="text-sm font-extrabold text-slate-900">Activity</h2>
              <ol className="mt-2 space-y-2">
                {recentEvents.map((ev) => (
                  <li key={ev.id} className="flex items-start gap-2 text-xs text-slate-600">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-flame" />
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold text-slate-800">{ev.title}</span>
                      {ev.detail ? ` — ${ev.detail}` : ""}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-slate-400">
                      {new Date(ev.at).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* in-progress live clock */}
          {status === "in_progress" && booking.startedAt && (
            <div className="card flex items-center gap-3 border-green-200 bg-green-50 p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-green-100">
                <RefreshCcw className="h-5 w-5 animate-spin text-green-700" />
              </span>
              <div>
                <p className="font-extrabold text-green-900">{d.workStarted}</p>
                <p className="text-sm text-green-700">{d.workStartedSub}</p>
              </div>
              <span className="ml-auto font-mono text-xl font-extrabold text-green-800">
                {mmss(now - booking.startedAt)}
              </span>
            </div>
          )}

          {/* cancellation before start */}
          {(status === "enroute" || status === "arrived") && (
            <button
              type="button"
              onClick={() => void cancelBooking()}
              disabled={busy}
              className="btn-ghost w-full justify-center text-red-600"
            >
              <XCircle className="h-4 w-4" /> {d.cancelBooking}
            </button>
          )}
        </div>

        {/* ---------------- right rail cards ---------------- */}
        <div className="space-y-4">
          {/* accepted Pro's profile */}
          {pro && status !== "cancelled" && (
            <div className="card p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-base font-bold text-white">
                  {pro.name
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-slate-900">{pro.name}</h3>
                    {pro.verified && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                        <BadgeCheck className="h-3 w-3" /> {d.verified}
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        pro.policeVerified
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      <ShieldCheck className="h-3 w-3" />
                      {pro.policeVerified ? d.policeVerified : d.notPolice}
                    </span>
                  </div>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                    <span className="flex items-center gap-1 font-bold text-amber-600">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      {pro.rating} · {fill(d.reviewsCount, { n: pro.reviewCount })}
                    </span>
                    <span className="font-bold text-navy">
                      {fill(d.hourlyRate, { n: pro.hourlyRate })}
                    </span>
                    <span>{fill(d.jobsCount, { n: pro.jobs })}</span>
                  </p>
                </div>
              </div>
              {pro.reviews.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {pro.reviews.map((rv) => (
                    <li
                      key={rv.author + rv.text}
                      className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600 ring-1 ring-slate-200"
                    >
                      <span className="flex items-center gap-1.5 font-bold text-slate-800">
                        {rv.author}
                        <span className="flex items-center gap-0.5 font-semibold text-amber-600">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          {rv.rating}
                        </span>
                      </span>
                      <p className="mt-0.5">{rv.text}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* arrived → start OTP */}
          {status === "arrived" && booking.startOtp && (
            <div className="rounded-2xl border-2 border-dashed border-flame-300 bg-flame-50 p-6 text-center">
              <p className="text-sm font-extrabold uppercase tracking-wide text-flame-700">
                {d.otpLabel}
              </p>
              <p className="mt-2 font-mono text-4xl font-extrabold tracking-[0.35em] text-navy">
                {booking.startOtp}
              </p>
              <p className="mt-2 text-xs text-slate-500">{d.arrivedSub}</p>
              <button
                type="button"
                onClick={() => setPanelOpen(true)}
                className="btn-primary mt-4 w-full justify-center"
              >
                {d.proMode}: {d.enterStartOtp}
              </button>
            </div>
          )}

          {/* provider marked completed → user confirms with OTP */}
          {status === "pending_confirm" && (
            <div className="card border-green-200 p-5">
              <h2 className="flex items-center gap-2 font-extrabold text-slate-900">
                <CheckCircle2 className="h-5 w-5 text-green-600" /> {d.confirmTitle}
              </h2>
              <p className="mt-1 text-sm text-slate-500">{d.confirmSub}</p>

              <div className="mt-3 rounded-xl bg-slate-50 p-3 text-center ring-1 ring-slate-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {s.bookings.status.completed} OTP
                </p>
                <p className="font-mono text-3xl font-extrabold tracking-[0.3em] text-navy">
                  {booking.completeOtp}
                </p>
              </div>

              <label className="mt-3 block text-sm font-bold text-slate-800">
                {d.verifyOtp}
                <input
                  value={otp}
                  onChange={(e) => {
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                    setOtpError(false);
                  }}
                  inputMode="numeric"
                  placeholder="••••••"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] outline-none focus:border-green-500"
                />
              </label>
              {otpError && (
                <p className="mt-1 text-xs font-semibold text-red-600">{d.wrongOtp}</p>
              )}

              <button
                type="button"
                onClick={() => void verifyComplete()}
                disabled={busy || otp.length !== 6}
                className="btn-primary mt-3 w-full justify-center"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {d.verifyOtp}
              </button>
              <button
                type="button"
                onClick={() => void sendBack()}
                disabled={busy}
                className="btn-ghost mt-2 w-full justify-center text-red-600"
              >
                <RefreshCcw className="h-4 w-4" /> {d.notDoneYet}
              </button>
              {note && <p className="mt-2 text-xs font-semibold text-amber-600">{note}</p>}
            </div>
          )}

          {/* completed → cash / UPI */}
          {status === "completed" && !booking.paidAt && pro && (
            <div className="card p-5">
              <h2 className="flex items-center gap-2 font-extrabold text-slate-900">
                <IndianRupee className="h-5 w-5 text-flame-600" /> {d.payTitle}
              </h2>
              <p className="mt-1 text-sm text-slate-500">{d.paySub}</p>

              <div className="mt-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <div className="flex items-center justify-between text-sm text-slate-500">
                  <span>{booking.serviceName}</span>
                  <span className="font-bold text-slate-800">₹{booking.amount}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                  <span>{d.commissionCut}</span>
                  <span>−₹{commissionOf(booking.amount)}</span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {(["cash", "upi"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={`rounded-xl border-2 px-4 py-3 text-sm font-bold transition ${
                      method === m
                        ? "border-flame bg-flame-50 text-flame-700"
                        : "border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    {m === "cash" ? d.payCash : d.payUpi}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => void pay()}
                disabled={busy}
                className="btn-accent mt-3 w-full justify-center"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <IndianRupee className="h-4 w-4" />}
                {d.payConfirm}
              </button>
            </div>
          )}

          {/* paid → done */}
          {status === "completed" && booking.paidAt && (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-green-100">
                <CheckCircle2 className="h-7 w-7 text-green-700" />
              </span>
              <h2 className="mt-3 text-xl font-extrabold text-green-900">{d.paidTitle}</h2>
              <p className="mt-1 text-sm text-green-800">
                {fill(d.paidNote, {
                  amt: booking.amount,
                  method: booking.paymentMethod === "upi" ? d.payUpi : d.payCash,
                  comm: booking.commission ?? commissionOf(booking.amount),
                })}
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <Link href="/profile?tab=current&booked=1" className="btn-primary justify-center">
                  {d.viewBookings}
                </Link>
                <Link href="/services" className="btn-ghost justify-center">
                  {s.common.browse}
                </Link>
              </div>
            </div>
          )}

          {/* scheduled for later */}
          {status === "scheduled" && (
            <div className="card p-5 text-center">
              <p className="font-extrabold text-slate-900">{s.bookings.status.scheduled}</p>
              <p className="mt-1 text-sm text-slate-500">
                {fill(d.scheduleNote, { date: booking.date, time: booking.slot })}
              </p>
            </div>
          )}

          {/* dispatched (arrived here directly) */}
          {status === "dispatched" && (
            <div className="card p-5 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-flame-600" />
              <p className="mt-2 font-extrabold text-slate-900">{d.searching}</p>
              <p className="mt-1 text-sm text-slate-500">{d.searchingNote}</p>
              <Link
                href={`/services/${booking.serviceId}/providers?date=${booking.date}&time=${encodeURIComponent(booking.slot)}`}
                className="btn-primary mt-4 justify-center"
              >
                {d.sendRequest}
              </Link>
            </div>
          )}

          {/* cancelled */}
          {status === "cancelled" && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
              <XCircle className="mx-auto h-8 w-8 text-red-500" />
              <p className="mt-2 font-extrabold text-red-700">{d.bookingCancelled}</p>
              <Link href="/services" className="btn-ghost mt-4 justify-center">
                {s.common.browse}
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Pro mode — demo of the Provider app for THIS booking */}
      <ProviderPanel
        open={panelOpen}
        onToggle={() => setPanelOpen((v) => !v)}
        booking={booking}
        onChanged={() => void refresh()}
      />
    </div>
  );
}

export default function TrackPage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 text-center text-sm text-slate-400">Loading…</div>
      }
    >
      <TrackView />
    </Suspense>
  );
}