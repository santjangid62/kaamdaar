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
import { sendOtp, verifyOtp } from "../../lib/auth-service";
import { resolveUser } from "../../lib/store";
import { isValidIndianMobile, toE164Indian } from "../../lib/validation";

type Step = "phone" | "otp";

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
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Auto-flow guards: 10 digits → OTP step, 6 OTP digits → verify, both fire
  // without pressing any button; refs keep each attempt single-shot.
  const autoSendTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSentFor = useRef("");
  const otpAttempted = useRef("");

  useEffect(() => {
    if (user && !handledRedirect.current) router.replace(next);
  }, [user, next, router]);

  // don't leak a pending auto-send if the page unmounts mid-typing
  useEffect(
    () => () => {
      if (autoSendTimer.current) clearTimeout(autoSendTimer.current);
    },
    [],
  );

  const phone = toE164Indian(digits);
  const brand = s.login.brand;

  async function runSend(raw: string) {
    setError(null);
    if (!isValidIndianMobile(raw)) {
      setError(s.login.invalidPhone);
      autoSentFor.current = "";
      return;
    }
    setBusy(true);
    try {
      const res = await sendOtp(toE164Indian(raw));
      setDevCode(res.devCode ?? null);
      setCode("");
      otpAttempted.current = "";
      setStep("otp");
    } catch {
      setError(s.login.sendFail);
      autoSentFor.current = ""; // let a retry (auto or manual) fire again
    } finally {
      setBusy(false);
    }
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (autoSendTimer.current) clearTimeout(autoSendTimer.current);
    void runSend(digits);
  }

  async function runVerify(otp: string) {
    setError(null);
    setBusy(true);
    try {
      const ok = await verifyOtp(phone, otp);
      if (!ok) {
        // let the same code be retried after an edit instead of locking the
        // auto-verify guard to a failed attempt
        otpAttempted.current = "";
        setError(s.login.wrongOtp);
        setBusy(false);
        return;
      }
      // backend resolves the account: existing → dashboard, new → profile setup
      const { user: record, isNew } = await resolveUser(phone);
      handledRedirect.current = true;
      signIn(record);
      // returning users land on their dashboard, first-timers complete their
      // profile before browsing
      router.replace(isNew ? "/profile?setup=1" : "/dashboard");
    } catch {
      otpAttempted.current = "";
      setError(s.login.verifyFail);
      setBusy(false);
    }
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

  // 10 valid digits → OTP is sent and the step advances automatically; the
  // short pause lets a last-moment backspace cancel it
  function onPhoneChange(value: string) {
    setError(null);
    const next = value.replace(/\D/g, "").slice(0, 10);
    setDigits(next);
    if (autoSendTimer.current) clearTimeout(autoSendTimer.current);
    if (next.length === 10 && isValidIndianMobile(next) && autoSentFor.current !== next) {
      autoSendTimer.current = setTimeout(() => {
        autoSendTimer.current = null;
        if (autoSentFor.current !== next) {
          autoSentFor.current = next;
          void runSend(next);
        }
      }, 250);
    }
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
    <div className="min-h-screen bg-offwhite lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* ── Brand panel ─────────────────────────────────────────── */}
      <aside className="relative overflow-hidden bg-navy px-6 py-8 text-white sm:px-10 lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-14">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-flame/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-blue-600/30 blur-3xl" />

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

        <div className="relative mt-10 max-w-lg lg:mt-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-flame px-3 py-1 text-xs font-bold uppercase tracking-wide text-navy">
            <Smartphone className="h-3.5 w-3.5" /> {s.login.onlyPhone}
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight sm:text-5xl">
            {brand.title}
          </h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-white/70 sm:text-base">
            {brand.sub}
          </p>

          <ul className="mt-8 space-y-3.5">
            {features.map((f) => (
              <li key={f.text} className="flex items-start gap-3 text-sm text-white/85 sm:text-[15px]">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-flame/20 text-flame-400">
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
      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          {/* step indicator */}
          <div className="mb-6 flex items-center gap-3">
            {[
              { key: "phone", label: brand.step1, n: 1 },
              { key: "otp", label: brand.step2, n: 2 },
            ].map((st, i) => {
              const active = step === st.key;
              const done = st.key === "phone" && step === "otp";
              return (
                <div key={st.key} className="flex flex-1 items-center gap-3">
                  {i > 0 && (
                    <span
                      className={`hidden h-px flex-1 sm:block ${done || active ? "bg-flame" : "bg-slate-200"}`}
                    />
                  )}
                  <div className="flex items-center gap-2">
                    <span
                      className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold transition ${
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
                      className={`text-xs font-semibold sm:text-sm ${active ? "text-navy" : "text-slate-400"}`}
                    >
                      {st.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="card border-0 p-7 shadow-[0_25px_60px_-22px_rgba(11,31,58,0.4)] ring-1 ring-slate-100">
            <div className="flex items-center gap-2">
              <Image
                src="/kaamdaar-icon.png"
                alt="Kaamdaar"
                width={40}
                height={40}
                className="h-10 w-10 rounded-xl"
                priority
              />
              <div>
                <h2 className="text-xl font-extrabold text-navy">
                  {step === "phone" ? s.login.title : s.login.verify}
                </h2>
                <p className="text-sm text-slate-500">
                  {step === "phone" ? s.login.onlyPhone : fill(s.login.sentTo, { phone })}
                </p>
              </div>
            </div>

            {devCode && (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <span className="font-semibold">{s.login.devOtp}</span>{" "}
                <span className="font-mono text-base font-bold tracking-widest">{devCode}</span>
              </div>
            )}

            {step === "phone" ? (
              <form onSubmit={handleSend} className="mt-6 space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                    {s.login.mobile}
                  </span>
                  <div
                    className={`flex h-14 items-stretch overflow-hidden rounded-xl border bg-white transition focus-within:ring-2 ${
                      error
                        ? "border-red-300 focus-within:border-red-400 focus-within:ring-red-100"
                        : "border-slate-200 focus-within:border-flame focus-within:ring-flame-100"
                    }`}
                  >
                    <span className="grid shrink-0 place-items-center border-r border-slate-200 bg-slate-50 px-4 text-sm font-bold text-navy">
                      +91
                    </span>
                    <input
                      autoFocus
                      inputMode="numeric"
                      autoComplete="tel-national"
                      value={digits}
                      onChange={(e) => onPhoneChange(e.target.value)}
                      placeholder="98765 43210"
                      aria-invalid={Boolean(error)}
                      className="min-w-0 flex-1 border-0 bg-transparent px-4 text-base font-semibold tracking-wide outline-none placeholder:font-normal placeholder:text-slate-300"
                    />
                    <span className="grid shrink-0 place-items-center pr-3.5 text-[11px] font-semibold tabular-nums text-slate-400">
                      {digits.length}/10
                    </span>
                  </div>
                  <span className="mt-2 block text-xs text-slate-400">{s.login.mobileHint}</span>
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
                      {s.login.sending}
                    </>
                  ) : (
                    <>
                      <Smartphone className="h-4 w-4 shrink-0 text-blue-500" />
                      {s.login.autoHint}
                    </>
                  )}
                </div>

                <p className="text-xs leading-5 text-slate-500">
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
            ) : (
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
                    className="h-16 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-center font-mono text-2xl font-bold tracking-[0.55em] text-navy outline-none transition placeholder:tracking-[0.55em] placeholder:text-slate-300 focus:border-flame focus:bg-white focus:ring-4 focus:ring-flame-100"
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
                      setDevCode(null);
                      autoSentFor.current = "";
                      otpAttempted.current = "";
                      if (autoSendTimer.current) clearTimeout(autoSendTimer.current);
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
                        const res = await sendOtp(phone);
                        setDevCode(res.devCode ?? null);
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
            )}
          </div>

          <p className="mt-5 text-center text-xs leading-5 text-slate-500">{brand.newUser}</p>

          <p className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-400">
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
