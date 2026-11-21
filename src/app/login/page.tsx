"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  Check,
  Loader2,
  MapPin,
  ShieldCheck,
  Smartphone,
  Wallet,
} from "lucide-react";
import { useApp } from "../../components/AppProvider";
import { fill, useLang } from "../../lib/i18n";
import { isFirebaseConfigured } from "../../lib/firebase";
import { completeWebPairing, sendOtp, verifyOtp } from "../../lib/auth-service";
import type { User } from "../../lib/types";
import { isValidIndianMobile, toE164Indian } from "../../lib/validation";

type Step = "phone" | "otp" | "pairing";

function LoginFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const { signIn, user } = useApp();
  const { s } = useLang();
  // set right before our own redirect so the generic "already signed in"
  // effect below never overrides it
  const handledRedirect = useRef(false);

  const [step, setStep] = useState<Step>("phone");
  const [digits, setDigits] = useState("");
  const [code, setCode] = useState("");
  const [pairCode, setPairCode] = useState("");
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [pendingIsNew, setPendingIsNew] = useState(false);
  const [deviceRequired, setDeviceRequired] = useState(false);
  const [existingDevice, setExistingDevice] = useState<Awaited<ReturnType<typeof verifyOtp>>["existingDevice"]>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const otpAttempted = useRef("");

  useEffect(() => {
    if (user && !handledRedirect.current) router.replace(next);
  }, [user, next, router]);

  const phone = toE164Indian(digits);
  const brand = s.login.brand;

  async function runSend(raw: string) {
    setError(null);
    if (!isValidIndianMobile(raw)) {
      setError(s.login.invalidPhone);
      return;
    }
    setBusy(true);
    try {
      await sendOtp(toE164Indian(raw));
      setCode("");
      otpAttempted.current = "";
      setStep("otp");
    } catch (error) {
      setError(error instanceof Error ? error.message : s.login.sendFail);
    } finally {
      setBusy(false);
    }
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    void runSend(digits);
  }

  async function runVerify(otp: string) {
    setError(null);
    setBusy(true);
    try {
      const result = await verifyOtp(phone, otp);
      if (result.pairingRequired) {
        setPendingUser(result.user);
        setPendingIsNew(result.isNew);
        setDeviceRequired(result.deviceRequired);
        setExistingDevice(result.existingDevice);
        setPairCode("");
        setStep("pairing");
        setBusy(false);
        return;
      }
      handledRedirect.current = true;
      signIn(result.user);
      // returning users land on their dashboard, first-timers complete their
      // profile before browsing
      router.replace(result.isNew ? "/profile?setup=1" : "/dashboard");
    } catch (error) {
      otpAttempted.current = "";
      setError(error instanceof Error ? error.message : s.login.verifyFail);
      setBusy(false);
    }
  }

  async function runPairing(rawCode: string) {
    setError(null);
    if (!pendingUser || rawCode.trim().length !== 6) {
      setError("Enter the six-digit code shown in the Kaamdaar app.");
      return;
    }
    setBusy(true);
    try {
      await completeWebPairing(phone, rawCode.trim(), "customer");
      handledRedirect.current = true;
      signIn(pendingUser);
      router.replace(pendingIsNew ? "/profile?setup=1" : "/dashboard");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Browser pairing failed.");
      setBusy(false);
    }
  }

  function handlePairingSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    void runPairing(pairCode);
  }

  function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const otp = code.trim();
    if (otp.length !== 6) {
      setError(s.login.invalidOtp);
      return;
    }
    if (busy || otpAttempted.current === otp) return;
    otpAttempted.current = otp;
    void runVerify(otp);
  }

  // 6 OTP digits → verify automatically, no button press
  function onOtpChange(value: string) {
    setError(null);
    const otp = value.replace(/\D/g, "").slice(0, 6);
    setCode(otp);
    if (otp.length === 6 && !busy && otpAttempted.current !== otp) {
      otpAttempted.current = otp;
      void runVerify(otp);
    }
  }

  const features = [
    { icon: BadgeCheck, text: brand.f1 },
    { icon: MapPin, text: brand.f2 },
    { icon: Wallet, text: brand.f3 },
  ];

  return (
    <div className="min-h-screen overflow-hidden bg-[#f4f7fb] lg:grid lg:grid-cols-[0.92fr_1.08fr]">
      {/* ── Brand panel ─────────────────────────────────────────── */}
      <aside className="relative isolate overflow-hidden bg-[#0b1f3a] px-6 py-8 text-white sm:px-10 lg:flex lg:min-h-screen lg:flex-col lg:justify-between lg:px-14 lg:py-14 xl:px-20">
        <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-navy via-navy-800 to-blue-900" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-20 mask-[linear-gradient(to_bottom,black,transparent_80%)]"
          style={{
            backgroundImage: "radial-gradient(circle, #8ab6e0 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-flame/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-blue-500/30 blur-3xl" />

        <div className="relative flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/kaamdaar-logo-white.png"
              alt="Kaamdaar"
              className="h-9 w-auto sm:h-11"
            />
          </Link>
          <span className="hidden rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-flame-400 sm:inline-flex">
            {brand.trust}
          </span>
        </div>

        <div className="relative mx-auto mt-10 w-full max-w-xl lg:my-auto lg:mt-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-flame px-3 py-1 text-xs font-bold uppercase tracking-wide text-navy">
            <Smartphone className="h-3.5 w-3.5" /> {s.login.onlyPhone}
          </span>
          <h1 className="mt-6 text-4xl font-black leading-[1.04] tracking-[-0.045em] sm:text-5xl xl:text-6xl">
            <span className="bg-linear-to-r from-white via-white to-flame-200 bg-clip-text text-transparent">
              {brand.title}
            </span>
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-blue-100/85 sm:text-lg sm:leading-8">
            {brand.sub}
          </p>

          <ul className="mt-9 grid gap-3 sm:grid-cols-1">
            {features.map((f) => (
              <li
                key={f.text}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3.5 text-sm font-medium text-white/90 shadow-[0_12px_30px_-24px_rgba(0,0,0,0.65)] backdrop-blur-md transition duration-200 hover:border-flame-400/40 hover:bg-white/10 sm:text-[15px]"
              >
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-flame text-navy">
                  <f.icon className="h-4 w-4" />
                </span>
                {f.text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative mt-10 hidden text-xs text-white/40 lg:block">
          © {new Date().getFullYear()} Kaamdaar · {s.login.terms} · {s.login.privacy}
        </p>
      </aside>

      {/* ── Form panel ──────────────────────────────────────────── */}
      <main className="relative flex items-center justify-center bg-[radial-gradient(ellipse_at_top_right,rgba(18,97,160,0.07),transparent_42%),linear-gradient(180deg,#f8faff_0%,#ffffff_48%,#f1f6fc_100%)] px-4 py-10 sm:px-8 lg:px-12 lg:py-14 xl:px-16">
        <div className="w-full max-w-[34rem]">
          {/* step indicator */}
          <div className="mb-7 flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/75 p-3 shadow-[0_10px_30px_-26px_rgba(11,31,58,0.35)] backdrop-blur sm:p-4">
            {[
              { key: "phone", label: brand.step1, n: 1 },
              { key: "otp", label: brand.step2, n: 2 },
              { key: "pairing", label: "Pair App", n: 3 },
            ].map((st, i) => {
              const active = step === st.key;
              const done = st.key === "phone" ? step !== "phone" : st.key === "otp" && step === "pairing";
              return (
                <div key={st.key} className="flex flex-1 items-center gap-3">
                  {i > 0 && (
                    <span
                      className={`hidden h-px flex-1 sm:block ${done || active ? "bg-flame" : "bg-slate-200"}`}
                    />
                  )}
                  <div className="flex items-center gap-3.5">
                    <span
                      className={`grid h-9 w-9 place-items-center rounded-full text-sm font-extrabold shadow-sm transition-all duration-300 ${
                        active
                          ? "bg-flame text-navy"
                          : done
                            ? "bg-blue-600 text-white"
                            : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {done ? <Check className="h-3.5 w-3.5" /> : st.n}
                    </span>
                    <span
                      className={`text-xs font-bold sm:text-sm ${active ? "text-navy" : "text-slate-400"}`}
                    >
                      {st.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="relative overflow-hidden rounded-[1.75rem] border border-white bg-white p-6 shadow-[0_35px_90px_-42px_rgba(11,31,58,0.38)] ring-1 ring-slate-200/80 sm:p-8 lg:p-9">
            <span className="pointer-events-none absolute inset-x-8 -top-px h-px bg-linear-to-r from-transparent via-flame/60 to-transparent" />
            <div className="flex items-center gap-2">
              <Image
                src="/kaamdaar-icon.png"
                alt="Kaamdaar"
                width={40}
                height={40}
                className="h-12 w-12 rounded-2xl shadow-sm ring-1 ring-slate-100 sm:h-14 sm:w-14"
                priority
              />
              <div>
                <h2 className="text-2xl font-black tracking-tight text-navy sm:text-[1.75rem]">
                  {step === "phone" ? s.login.title : step === "otp" ? s.login.verify : "Pair this browser"}
                </h2>
                <p className="mt-0.5 text-sm font-medium text-slate-500 sm:text-base">
                  {step === "phone" ? s.login.onlyPhone : step === "otp" ? fill(s.login.sentTo, { phone }) : `Enter the code from the Kaamdaar app for ${phone}`}
                </p>
              </div>
            </div>

            {step === "phone" ? (
              <form onSubmit={handleSend} className="mt-8 space-y-5">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold tracking-tight text-navy sm:text-base">
                    {s.login.mobile}
                  </span>
                  <div
                    className={`flex h-[4.5rem] items-stretch overflow-hidden rounded-2xl border-2 bg-white shadow-[0_8px_24px_-20px_rgba(11,31,58,0.35)] transition-all duration-200 focus-within:-translate-y-px focus-within:ring-4 ${
                      error
                        ? "border-red-300 focus-within:border-red-400 focus-within:ring-red-100"
                        : "border-slate-200 hover:border-slate-300 focus-within:border-flame focus-within:ring-flame-100"
                    }`}
                  >
                    <span className="grid shrink-0 place-items-center border-r border-slate-200 bg-slate-50/90 px-5 text-base font-extrabold text-navy">
                      +91
                    </span>
                    <input
                      autoFocus
                      inputMode="numeric"
                      autoComplete="tel-national"
                      value={digits}
                      onChange={(e) => { setError(null); setDigits(e.target.value.replace(/\D/g, "").slice(0, 10)); }}
                      placeholder="98765 43210"
                      aria-invalid={Boolean(error)}
                      className="phone-number-input min-w-0 flex-1 border-0 bg-transparent px-4 text-lg font-bold tracking-wide text-navy outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 placeholder:font-medium placeholder:text-slate-300 sm:text-xl"
                    />
                    <span className="grid shrink-0 place-items-center border-l border-slate-100 px-3.5 text-xs font-bold tabular-nums text-slate-400">
                      {digits.length}/10
                    </span>
                  </div>
                  <span className="mt-2.5 block text-xs font-medium text-slate-400 sm:text-sm">{s.login.mobileHint}</span>
                </label>

                {error && (
                  <p className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
                    <ShieldCheck className="h-4 w-4 shrink-0" /> {error}
                  </p>
                )}

                <button type="submit" disabled={busy || digits.length !== 10} className="btn-primary w-full justify-center py-3.5">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}Send OTP</button>

                <p className="border-t border-slate-100 pt-4 text-xs leading-6 text-slate-500 sm:text-sm">
                  <ShieldCheck className="mr-1.5 inline h-4 w-4 -translate-y-px text-green-600" />
                  {s.login.termsLine.before}
                  <Link href="/terms" className="text-blue-600 underline">
                    {s.login.terms}
                  </Link>
                  {s.login.termsLine.mid}
                  <Link href="/privacy" className="text-blue-600 underline">
                    {s.login.privacy}
                  </Link>
                  {s.login.termsLine.after}
                </p>
              </form>
            ) : step === "otp" ? (
              <form onSubmit={handleVerify} className="mt-6 space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                    {s.login.otpLabel}
                  </span>
                  <input
                    autoFocus
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(e) => onOtpChange(e.target.value)}
                    placeholder="••••••"
                    className="h-16 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-center font-mono text-[26px] font-bold tracking-[0.55em] text-navy shadow-inner outline-none transition placeholder:tracking-[0.55em] placeholder:text-slate-300 focus:border-flame focus:bg-white focus:shadow-none focus:ring-4 focus:ring-flame-100"
                  />
                </label>

                {error && (
                  <p className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
                    <ShieldCheck className="h-4 w-4 shrink-0" /> {error}
                  </p>
                )}

                <div
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-3 text-xs font-semibold transition ${
                    busy ? "bg-flame-50 text-flame-600" : "bg-offwhite text-slate-500"
                  }`}
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                      {s.login.verifying}
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4 shrink-0 text-green-600" />
                      {s.login.otpAutoHint}
                    </>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setStep("phone");
                      setCode("");
                      setError(null);
                      otpAttempted.current = "";
                    }}
                    className="text-slate-500 hover:text-blue-600"
                  >
                    {s.login.changeNumber}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await sendOtp(phone);
                        setError(null);
                        otpAttempted.current = "";
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="font-semibold text-blue-600 hover:underline"
                  >
                    {s.login.resend}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handlePairingSubmit} className="mt-6 space-y-4">
                {deviceRequired ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                    No active Customer App device was found for this number. First sign in to the Kaamdaar Customer App on this phone, then return here and verify again.
                  </div>
                ) : (
                  <>
                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
                      This account is active on <strong>{existingDevice?.deviceName ?? "the authorized app device"}</strong>. Pair only on that same phone: open the Customer App → Profile → Pair Web Browser, then enter its one-time code. The code expires in five minutes and can only be used once.
                      <div className="mt-2 text-xs text-blue-800">
                        Login: {existingDevice?.loginAt ? new Date(existingDevice.loginAt).toLocaleString() : "Unknown"} · Last seen: {existingDevice?.lastSeenAt ? new Date(existingDevice.lastSeenAt).toLocaleString() : "Unknown"} · Location: {existingDevice?.location?.label ?? "Unavailable"}
                      </div>
                    </div>
                    <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700">6-digit app pairing code</span>
                  <input
                    autoFocus
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={pairCode}
                    onChange={(e) => { setError(null); setPairCode(e.target.value.replace(/\D/g, "").slice(0, 6)); }}
                    placeholder="••••••"
                    className="h-16 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-center font-mono text-[26px] font-bold tracking-[0.55em] text-navy shadow-inner outline-none transition placeholder:tracking-[0.55em] placeholder:text-slate-300 focus:border-flame focus:bg-white focus:shadow-none focus:ring-4 focus:ring-flame-100"
                  />
                </label>
                {error && (
                  <p className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
                    <ShieldCheck className="h-4 w-4 shrink-0" /> {error}
                  </p>
                )}
                    <button type="submit" disabled={busy || pairCode.length !== 6} className="btn-primary w-full justify-center py-3.5">
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                      Pair and continue
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => { setStep("phone"); setPairCode(""); setPendingUser(null); setExistingDevice(null); setDeviceRequired(false); setError(null); }}
                  className="w-full pt-2 text-sm font-semibold text-slate-500 hover:text-blue-600"
                >
                  Use another mobile number
                </button>
              </form>
            )}
          </div>

          <p className="mt-6 text-center text-sm font-medium leading-6 text-slate-500">{brand.newUser}</p>

          <p className="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-slate-400">
            <Smartphone className="h-4 w-4" />
            {isFirebaseConfigured ? s.login.secureNote : s.login.devNote}
          </p>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-sm text-slate-400">Loading…</div>}>
      <LoginFlow />
    </Suspense>
  );
}
