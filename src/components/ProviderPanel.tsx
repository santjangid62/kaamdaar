"use client";

/**
 * Pro mode — an in-app demo of the future Flutter Provider app.
 *
 * From here you act as the nearby Pro: accept an incoming request (first
 * accept wins and withdraws it from everyone else), enter the start OTP the
 * user shows you, mark "Work Completed", and watch the 10% commission drop
 * from the wallet (minimum balance ₹500).
 */
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Wallet as WalletIcon,
  CheckCircle2,
  Loader2,
  Lock,
  Receipt,
  Wrench,
  X,
} from "lucide-react";
import { fill, useLang } from "../lib/i18n";
import {
  getWallet,
  MIN_WALLET_BALANCE,
  rechargeWallet,
  updateBooking,
  type Wallet,
} from "../lib/store";
import { commissionOf } from "../lib/dispatch";
import type { Booking } from "../lib/types";

export interface PanelCandidate {
  id: string;
  name: string;
  service: string;
  distanceKm: number;
}

interface Props {
  open: boolean;
  onToggle: () => void;
  /** live booking (track page) — panel actions operate on it */
  booking?: Booking | null;
  /** in-flight dispatch id (dispatch page) */
  bookingId?: string | null;
  /** the Pro this browser is acting as before an accept */
  candidate?: PanelCandidate | null;
  onAccept?: (providerId: string) => void;
  /** called after the panel mutates the booking so the host can refresh */
  onChanged?: () => void;
}

export default function ProviderPanel({
  open,
  onToggle,
  booking,
  bookingId,
  candidate,
  onAccept,
  onChanged,
}: Props) {
  const { s } = useLang();
  const d = s.dispatch;
  const [tab, setTab] = useState<"request" | "wallet">("request");
  const [walletState, setWalletState] = useState<Wallet | null>(null);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "upi">("cash");
  const [paymentReference, setPaymentReference] = useState("");

  const proId = booking?.providerId || candidate?.id || null;
  const proName = booking?.providerProfile?.name || candidate?.name || "—";
  const status = booking?.status;

  // ignore stale state left over from a previous Pro identity
  const wallet = walletState && proId && walletState.providerId === proId ? walletState : null;

  useEffect(() => {
    if (!proId) return;
    let active = true;
    void getWallet(proId).then((w) => {
      if (active) setWalletState(w);
    });
    return () => {
      active = false;
    };
  }, [proId]);

  const low = wallet !== null && wallet.balance < MIN_WALLET_BALANCE;

  async function acceptRequest() {
    if (!candidate || !onAccept || low) return;
    setBusy(true);
    try {
      onAccept(candidate.id);
    } finally {
      setBusy(false);
    }
  }

  async function startWork() {
    if (!booking || otp.length !== 6) {
      setError(true);
      return;
    }
    setBusy(true);
    try {
      await updateBooking(booking.userId, booking.id, {
        status: "in_progress",
        startOtp: otp,
      });
      setOtp("");
      setError(false);
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  async function markCompleted() {
    if (!booking) return;
    setBusy(true);
    try {
      await updateBooking(booking.userId, booking.id, {
        status: "pending_confirm",
      });
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  async function verifyCompletion() {
    if (!booking || otp.length !== 6) return;
    setBusy(true);
    try {
      await updateBooking(booking.userId, booking.id, { status: "completed" }, otp);
      setOtp("");
      setError(false);
      onChanged?.();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function collectPayment() {
    if (!booking) return;
    setBusy(true);
    try {
      await updateBooking(booking.userId, booking.id, {
        paymentReported: true,
        paymentMethod,
        paymentReference: paymentMethod === "upi" ? paymentReference.trim() : "",
      } as Partial<Booking>);
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  async function cancelAssignedJob() {
    if (!booking) return;
    const reason = window.prompt("Cancellation reason (required):");
    if (!reason?.trim()) return;
    setBusy(true);
    try {
      await updateBooking(booking.userId, booking.id, { status: "cancelled", cancellationReason: reason.trim() } as Partial<Booking>);
      onChanged?.();
    } finally { setBusy(false); }
  }

  async function doRecharge() {
    if (!proId) return;
    setBusy(true);
    try {
      setWalletState(await rechargeWallet(proId, 500));
    } finally {
      setBusy(false);
    }
  }

  /* ---------------- request tab body ---------------- */
  let requestBody: React.ReactNode = (
    <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
      {d.noActiveRequest}
    </p>
  );

  if (candidate && !booking?.providerId && (!booking || status === "dispatched")) {
    requestBody = (
      <div className="rounded-2xl border border-flame-200 bg-flame-50 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-flame-600">{d.incoming}</p>
        <p className="mt-1 font-bold text-slate-900">{candidate.service}</p>
        <p className="text-sm text-slate-600">
          {fill(s.dispatch.distanceAway, { n: `${candidate.distanceKm.toFixed(1)} km` })}
        </p>
        {low ? (
          <div className="mt-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-red-600">
              <Lock className="h-3.5 w-3.5" /> {d.walletBlocked}
            </p>
            <button type="button" onClick={() => void doRecharge()} disabled={busy} className="btn-accent mt-2 w-full justify-center">
              {d.recharge}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void acceptRequest()}
            disabled={busy}
            className="btn-accent mt-3 w-full justify-center"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {d.acceptRequest}
          </button>
        )}
      </div>
    );
  } else if (booking && (status === "accepted" || status === "enroute")) {
    requestBody = (
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm">
        <p className="font-bold text-blue-900">{booking.serviceName}</p>
        <p className="mt-0.5 text-blue-700">
          {d.onTheWay} · {booking.address.label}
        </p>
        <p className="mt-2 text-xs text-blue-600">{d.sharedLocation}</p>
      </div>
    );
  } else if (booking && status === "arrived") {
    requestBody = (
      <div className="space-y-3">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {d.arrivedSub}
        </div>
        <label className="block text-sm font-bold text-slate-800">
          {d.enterStartOtp}
          <input
            value={otp}
            onChange={(e) => {
              setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
              setError(false);
            }}
            inputMode="numeric"
            placeholder="••••••"
            className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] outline-none focus:border-blue-500"
          />
        </label>
        {error && <p className="text-xs font-semibold text-red-600">{d.wrongStartOtp}</p>}
        <button
          type="button"
          onClick={() => void startWork()}
          disabled={busy || otp.length !== 6}
          className="btn-primary w-full justify-center"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
          {d.startWork}
        </button>
      </div>
    );
  } else if (booking && status === "in_progress") {
    requestBody = (
      <div className="space-y-3">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          {d.workStarted} — {d.workStartedSub}
        </div>
        <button
          type="button"
          onClick={() => void markCompleted()}
          disabled={busy}
          className="btn-primary w-full justify-center"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {d.markCompleted}
        </button>
      </div>
    );
  } else if (booking && status === "pending_confirm") {
    requestBody = (
      <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-800">Customer se completion OTP lein aur verify karein.</p>
        <input
          value={otp}
          onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(false); }}
          inputMode="numeric"
          placeholder="6-digit OTP"
          className="w-full rounded-xl border border-amber-300 bg-white px-4 py-3 text-center font-mono text-xl tracking-[0.35em]"
        />
        {error && <p className="text-xs font-semibold text-red-600">OTP galat hai. Dobara check karein.</p>}
        <button type="button" onClick={() => void verifyCompletion()} disabled={busy || otp.length !== 6} className="btn-primary w-full justify-center">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Verify OTP & Close Job
        </button>
      </div>
    );
  } else if (booking && status === "completed") {
    requestBody = (
      <div className="space-y-3">
        <div className={`rounded-2xl border p-4 text-sm ${booking.paymentStatus === "verified" || booking.paidAt ? "border-green-200 bg-green-50 text-green-800" : booking.paymentStatus === "reported" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
          {booking.paymentStatus === "verified" || booking.paidAt
            ? "Payment Admin dwara verify ho chuka hai."
            : booking.paymentStatus === "reported"
              ? "Payment report Admin ko bhej di gayi hai. Verification pending hai."
              : booking.paymentStatus === "disputed"
                ? "Payment report par Admin ne clarification maangi hai. Support se sampark karein."
                : "Customer se payment receive hone ke baad method select karke report karein. Admin verification ke baad hi payment final hogi."}
        </div>
        {!booking.paidAt && !booking.paymentReportedAt && booking.paymentStatus !== "reported" && (
          <div className="space-y-2">
            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as "cash" | "upi")} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
              <option value="cash">Cash received</option><option value="upi">UPI received</option>
            </select>
            {paymentMethod === "upi" && <input value={paymentReference} onChange={e => setPaymentReference(e.target.value)} placeholder="UPI transaction/reference ID" className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"/>}
            <button type="button" onClick={() => void collectPayment()} disabled={busy || (paymentMethod === "upi" && paymentReference.trim().length < 6)} className="btn-primary w-full justify-center">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Report Payment to Admin
            </button>
          </div>
        )}
        {(booking.paymentStatus === "verified" || booking.paidAt) && wallet && (
          <p className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
            {d.balance}<span className="font-extrabold text-navy">₹{wallet.balance}</span>
          </p>
        )}
      </div>
    );
  }

  if (booking && ["accepted", "scheduled", "enroute", "arrived"].includes(status ?? "")) {
    requestBody = <>{requestBody}
      <button type="button" onClick={() => void cancelAssignedJob()} disabled={busy}
        className="mt-3 w-full rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 disabled:opacity-50">
        Cancel job (reason required)
      </button>
    </>;
  }

  return (
    <>
      {/* floating trigger */}
      <button
        type="button"
        onClick={onToggle}
        className="fixed bottom-5 right-5 z-[1500] flex items-center gap-2 rounded-full bg-navy px-5 py-3 text-sm font-bold text-white shadow-xl ring-2 ring-flame transition hover:scale-105"
      >
        <Wrench className="h-4 w-4 text-flame-400" />
        {d.proMode}
      </button>

      {open && (
        <div className="fixed inset-0 z-[1600]">
          <button
            type="button"
            aria-label={d.close}
            onClick={onToggle}
            className="absolute inset-0 bg-navy/40 backdrop-blur-[2px]"
          />
          <aside className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
              <div>
                <h2 className="flex items-center gap-2 font-extrabold text-slate-900">
                  <Wrench className="h-4 w-4 text-flame-600" /> {d.proMode}
                </h2>
                <p className="text-xs text-slate-500">{d.proModeNote} · {proName}</p>
              </div>
              <button type="button" onClick={onToggle} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="flex gap-1 border-b border-slate-200 px-5 pt-3">
              {(["request", "wallet"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${
                    tab === t ? "border-flame text-flame-600" : "border-transparent text-slate-500"
                  }`}
                >
                  {t === "request" ? d.tabRequest : d.tabWallet}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {tab === "request" ? (
                <div className="space-y-4">
                  {booking && (
                    <div className="rounded-xl border border-slate-200 p-3 text-sm">
                      <p className="font-bold text-slate-900">{booking.serviceName}</p>
                      <p className="mt-0.5 text-slate-500">
                        ₹{booking.amount} · {booking.date} · {booking.slot}
                      </p>
                      {bookingId && !booking.providerId && (
                        <p className="mt-1 text-xs font-semibold text-amber-600">{s.bookings.status.dispatched}</p>
                      )}
                    </div>
                  )}
                  {requestBody}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-navy p-5 text-white">
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-200">
                      <WalletIcon className="h-4 w-4" /> {d.balance}
                    </p>
                    <p className="mt-1 text-3xl font-extrabold">
                      ₹{wallet ? wallet.balance : "—"}
                    </p>
                    <p className="mt-1 text-xs text-blue-200">{d.minBalance}</p>
                    {low && (
                      <button
                        type="button"
                        onClick={() => void doRecharge()}
                        disabled={busy}
                        className="btn-accent mt-3 w-full justify-center"
                      >
                        {d.recharge}
                      </button>
                    )}
                  </div>
                  {low && (
                    <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-600">
                      {d.walletBlocked}
                    </p>
                  )}
                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                      <Receipt className="h-4 w-4" /> {d.commissionCut}
                    </p>
                    <ul className="mt-2 space-y-2">
                      {wallet && wallet.txns.length === 0 && (
                        <li className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-400">
                          —
                        </li>
                      )}
                      {wallet?.txns.map((t) => (
                        <li
                          key={t.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-sm"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-slate-700">
                              {t.kind === "commission"
                                ? fill(d.walletTxnCommission, { note: t.note })
                                : d.walletTxnRecharge}
                            </span>
                            <span className="text-xs text-slate-400">
                              {new Date(t.at).toLocaleString("en-IN", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </span>
                          <span
                            className={`font-extrabold ${t.amount < 0 ? "text-red-600" : "text-green-600"}`}
                          >
                            {t.amount < 0 ? "" : "+"}₹{Math.abs(t.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-flame-600" />
                    {fill(d.paidNote, { amt: 200, method: d.payCash, comm: 20 })}
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}