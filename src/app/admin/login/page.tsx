"use client";

/**
 * Admin Dashboard sign-in — email + password against ADMIN_EMAIL /
 * ADMIN_PASSWORD (dev defaults shown on the card). On success the server
 * sets an httpOnly session cookie and we land on /admin.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import Year from "../../../components/Year";
import { useEffect, useState } from "react";
import { AlertCircle, Loader2, Lock, LogIn, Mail, ShieldCheck } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);

  // already signed in? go straight to the dashboard
  useEffect(() => {
    let alive = true;
    fetch("/api/admin/login")
      .then((r) => (r.ok ? r.json() : { authed: false }))
      .then((d: { authed?: boolean }) => {
        if (alive && d.authed) {
          setAuthed(true);
          router.replace("/admin");
        } else if (alive) {
          setAuthed(false);
        }
      })
      .catch(() => alive && setAuthed(false));
    return () => {
      alive = false;
    };
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Password is required.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Login failed. Please try again.");
        return;
      }
      router.replace("/admin");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0f172a] px-4 py-10">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-flame/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-[480px] w-[480px] rounded-full bg-blue-600/25 blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="mb-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/kaamdaar-icon.png" alt="Kaamdaar" className="mx-auto h-14 w-14 rounded-2xl shadow-lg" />
          <h1 className="mt-4 text-2xl font-extrabold text-white">Kaamdaar Admin</h1>
          <p className="mt-1 text-sm text-slate-400">
            Back-office access — bookings, providers, finance &amp; CMS
          </p>
        </div>

        <form
          onSubmit={submit}
          noValidate
          className="rounded-2xl border border-white/10 bg-white p-7 shadow-[0_30px_60px_-25px_rgba(0,0,0,0.6)]"
        >
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">Email address</span>
            <div className="flex items-center rounded-xl border border-slate-200 bg-white transition focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
              <Mail className="ml-3.5 h-4 w-4 shrink-0 text-slate-400" />
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => {
                  setError(null);
                  setEmail(e.target.value);
                }}
                placeholder="admin@kaamdaar.com"
                className="w-full rounded-r-xl px-3 py-3 text-sm outline-none"
              />
            </div>
          </label>

          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">Password</span>
            <div className="flex items-center rounded-xl border border-slate-200 bg-white transition focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
              <Lock className="ml-3.5 h-4 w-4 shrink-0 text-slate-400" />
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setError(null);
                  setPassword(e.target.value);
                }}
                placeholder="••••••••••"
                className="w-full rounded-r-xl px-3 py-3 text-sm outline-none"
              />
            </div>
          </label>

          {error && (
            <p className="mt-4 flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || authed === null}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-flame px-5 py-3 text-sm font-bold text-navy transition hover:bg-flame-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            Sign in to Dashboard
          </button>

          <p className="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-[11px] leading-4 text-slate-500">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
            Dev credentials: <b className="text-slate-700">admin@kaamdaar.com</b> /{" "}
            <b className="text-slate-700">Kaamdaar@123</b> — override with ADMIN_EMAIL,
            ADMIN_PASSWORD and ADMIN_SESSION_SECRET in .env.local before going live.
          </p>
        </form>

        <p className="mt-5 text-center text-xs text-slate-500">
          © <Year /> Kaamdaar · Back to{" "}
          <Link href="/" className="font-semibold text-flame-400 hover:underline">
            customer website
          </Link>
        </p>
      </div>
    </div>
  );
}
