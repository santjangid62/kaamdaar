"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Loader2, Lock, Phone, ShieldCheck, Smartphone } from "lucide-react";
import { useApp } from "../../components/AppProvider";
import { isFirebaseConfigured } from "../../lib/firebase";
import { sendOtp, verifyOtp } from "../../lib/auth-service";
import { createUser, findUserByPhone } from "../../lib/store";

type Step = "phone" | "otp";

function LoginFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const { signIn, user } = useApp();
  // set right before our own redirect so the generic "already signed in"
  // effect below never overrides it
  const handledRedirect = useRef(false);

  const [step, setStep] = useState<Step>("phone");
  const [digits, setDigits] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && !handledRedirect.current) router.replace(next);
  }, [user, next, router]);

  const phone = `+91${digits}`;

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (digits.length !== 10) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    setBusy(true);
    try {
      const res = await sendOtp(phone);
      setDevCode(res.devCode ?? null);
      setStep("otp");
    } catch {
      setError("Could not send OTP. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (code.trim().length !== 6) {
      setError("Enter the 6-digit OTP.");
      return;
    }
    setBusy(true);
    try {
      const ok = await verifyOtp(phone, code);
      if (!ok) {
        setError("Incorrect OTP. Please check and try again.");
        setBusy(false);
        return;
      }
      let record = await findUserByPhone(phone);
      const isNew = !record;
      if (!record) record = await createUser(phone);
      handledRedirect.current = true;
      signIn(record);
      // returning users land on their dashboard, first-timers complete their
      // profile before browsing
      router.replace(isNew ? "/profile?setup=1" : "/dashboard");
    } catch {
      setError("Verification failed. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <div className="card p-7">
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
            <h1 className="text-xl font-extrabold text-slate-900">
              {step === "phone" ? "Login or Register" : "Verify OTP"}
            </h1>
            <p className="text-sm text-slate-500">
              {step === "phone"
                ? "Only your phone number is needed."
                : `Sent to ${phone}`}
            </p>
          </div>
        </div>

        {devCode && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <span className="font-semibold">Dev mode</span> — Firebase not
            configured, your OTP is{" "}
            <span className="font-mono text-base font-bold tracking-widest">{devCode}</span>
          </div>
        )}

        {step === "phone" ? (
          <form onSubmit={handleSend} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                Mobile number
              </span>
              <div className="flex items-stretch rounded-xl border border-slate-200 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
                <span className="grid place-items-center border-r border-slate-200 bg-slate-50 px-3.5 text-sm font-semibold text-slate-600">
                  +91
                </span>
                <input
                  autoFocus
                  inputMode="numeric"
                  value={digits}
                  onChange={(e) => setDigits(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="98765 43210"
                  className="w-full rounded-r-xl px-3.5 py-2.5 text-sm outline-none"
                />
              </div>
            </label>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
              Send OTP
            </button>

            <p className="flex items-start gap-2 text-xs leading-5 text-slate-500">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
              By continuing you agree to our{" "}
              <Link href="/terms" className="text-blue-600 underline">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-blue-600 underline">
                Privacy Policy
              </Link>
              .
            </p>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                Enter 6-digit OTP
              </span>
              <input
                autoFocus
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••••"
                className="field text-center font-mono text-lg tracking-[0.5em]"
              />
            </label>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button type="submit" disabled={busy} className="btn-accent w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              Verify &amp; continue
            </button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setStep("phone");
                  setCode("");
                  setError(null);
                }}
                className="text-slate-500 hover:text-blue-600"
              >
                Change number
              </button>
              <button
                type="button"
                onClick={async () => {
                  setBusy(true);
                  try {
                    const res = await sendOtp(phone);
                    setDevCode(res.devCode ?? null);
                    setError(null);
                  } finally {
                    setBusy(false);
                  }
                }}
                className="font-semibold text-blue-600 hover:underline"
              >
                Resend OTP
              </button>
            </div>
          </form>
        )}
      </div>

      <p className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-400">
        <Smartphone className="h-4 w-4" />
        {isFirebaseConfigured
          ? "Securing your login with Firebase Phone Auth."
          : "Dev mode: OTP is shown on screen. Add Firebase keys in .env.local to go live."}
      </p>
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
