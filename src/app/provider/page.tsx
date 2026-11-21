"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  signInWithPhoneNumber, RecaptchaVerifier, type ConfirmationResult,
} from "firebase/auth";
import {
  Bell, BriefcaseBusiness, CalendarX, CheckCircle2, IndianRupee, LogOut,
  RefreshCw, Search, ShieldCheck, Star, Wallet, XCircle, Smartphone,
} from "lucide-react";
import { getFirebaseAuth, isFirebaseConfigured } from "../../lib/firebase";
import type { Booking, Provider } from "../../lib/types";

type WalletData = { wallet: { balance: number }; txns: Array<{
  id: string; amount: number; kind: string; note: string; balanceAfter: number; createdAt: number;
}> };

const ACTIVE = ["accepted", "scheduled", "enroute", "arrived", "in_progress", "pending_confirm"];
const money = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
const date = (n: number) => n ? new Date(n).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body as T;
}

export default function ProviderPortalPage() {
  const [step, setStep] = useState<"phone" | "otp" | "pairing" | "dashboard">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [pairCode, setPairCode] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [recaptcha, setRecaptcha] = useState<RecaptchaVerifier | null>(null);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [tab, setTab] = useState<"overview" | "bookings" | "missed" | "wallet" | "reviews">("overview");
  const [missedPeriod, setMissedPeriod] = useState("today");
  const [missedOutcome, setMissedOutcome] = useState("all");
  const [missedService, setMissedService] = useState("all");
  const [missedSearch, setMissedSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async (p: Provider) => {
    const [b, w] = await Promise.all([
      api<{ bookings: Booking[] }>(`/api/bookings?providerId=${encodeURIComponent(p.id)}`),
      api<WalletData>(`/api/wallets/${encodeURIComponent(p.id)}`),
    ]);
    setBookings(b.bookings || []);
    setWalletData(w);
  }, []);

  const resolveProvider = useCallback(async () => {
    const user = getFirebaseAuth().currentUser;
    if (!user) return;
    const idToken = await user.getIdToken(true);
    const res = await fetch("/api/auth", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify", phone: user.phoneNumber, idToken, role: "provider", platform: "web" }),
    });
    const data = await res.json();
    if (!res.ok || !data.provider) throw new Error(data.error || "Provider account not found.");
    setProvider(data.provider as Provider);
    if (data.pairingRequired) {
      setPairCode("");
      setStep("pairing");
      return;
    }
    setStep("dashboard");
    await refresh(data.provider as Provider);
  }, [refresh]);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    void resolveProvider().catch(() => {});
  }, [resolveProvider]);

  useEffect(() => {
    if (step !== "dashboard" || !provider) return;
    const poll = () => void refresh(provider).catch((e) => setError(e.message));
    const timer = window.setInterval(poll, 6000);
    return () => window.clearInterval(timer);
  }, [step, provider, refresh]);

  const incoming = useMemo(() => bookings.filter(b => b.status === "dispatched" && (b.notifiedIds || []).includes(provider?.id || "")), [bookings, provider]);
  const active = useMemo(() => bookings.find(b => b.providerId === provider?.id && ACTIVE.includes(b.status)), [bookings, provider]);
  const completed = useMemo(() => bookings.filter(b => b.providerId === provider?.id && b.status === "completed"), [bookings, provider]);
  const earnings = completed.filter(b => b.paymentStatus === "verified" || b.paidAt).reduce((sum, b) => sum + (b.amount || 0) - (b.commission || 0), 0);
  const reviews = provider?.reviews || [];
  const missedRecords = useMemo(() => bookings
    .map((booking) => {
      const history = (booking.providerOfferHistory ?? []).find((row) => row.providerId === (provider?.id || ""));
      const outcome = history?.outcome ??
        ((booking.missedProviderIds ?? []).includes(provider?.id || "") ? "missed" :
          (booking.rejectedProviderIds ?? []).includes(provider?.id || "") ? "rejected" : null);
      return outcome ? { booking, outcome, at: history?.at ?? booking.createdAt } : null;
    })
    .filter((row): row is { booking: Booking; outcome: "missed" | "rejected"; at: number } => row !== null),
    [bookings, provider]);
  const missedToday = missedRecords.filter((r) => r.outcome === "missed" &&
    new Date(r.at).toDateString() === new Date().toDateString()).length;
  const missedWeek = missedRecords.filter((r) => r.outcome === "missed" &&
    r.at >= Date.now() - 7 * 24 * 60 * 60 * 1000).length;
  const missedMonth = missedRecords.filter((r) => r.outcome === "missed" &&
    r.at >= Date.now() - 30 * 24 * 60 * 60 * 1000).length;
  const rejectedToday = missedRecords.filter((r) => r.outcome === "rejected" &&
    new Date(r.at).toDateString() === new Date().toDateString()).length;
  const filteredMissedRecords = missedRecords.filter(({ booking, outcome, at }) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const from = missedPeriod === "today" ? today.getTime()
      : missedPeriod === "yesterday" ? yesterday.getTime()
      : missedPeriod === "7days" ? Date.now() - 7 * 86400000
      : missedPeriod === "30days" ? Date.now() - 30 * 86400000 : 0;
    const before = missedPeriod === "yesterday" ? today.getTime() : Number.POSITIVE_INFINITY;
    const periodOk = at >= from && at < before;
    const outcomeOk = missedOutcome === "all" || outcome === missedOutcome;
    const serviceOk = missedService === "all" || booking.serviceName === missedService;
    const q = missedSearch.trim().toLowerCase();
    const searchOk = !q || [booking.id, booking.serviceName, booking.phone, booking.address?.label, booking.address?.line1]
      .some((value) => String(value ?? "").toLowerCase().includes(q));
    return periodOk && outcomeOk && serviceOk && searchOk;
  });

  async function sendCode(e: React.FormEvent) {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      if (!isFirebaseConfigured) throw new Error("Firebase web configuration is missing.");
      const auth = getFirebaseAuth();
      const verifier = recaptcha || new RecaptchaVerifier(auth, "provider-recaptcha", { size: "invisible" });
      setRecaptcha(verifier);
      const result = await signInWithPhoneNumber(auth, `+91${phone.replace(/\D/g, "").slice(-10)}`, verifier);
      setConfirmation(result); setStep("otp");
    } catch (e) {
      setError(e instanceof Error ? e.message : "OTP could not be sent.");
      try { recaptcha?.clear(); } catch {}
      setRecaptcha(null);
    } finally { setBusy(false); }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      if (!confirmation) throw new Error("OTP session expired. Please request a new code.");
      await confirmation.confirm(otp);
      await resolveProvider();
    } catch (e) { setError(e instanceof Error ? e.message : "OTP verification failed."); }
    finally { setBusy(false); }
  }

  async function completePairing(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (pairCode.trim().length !== 6) throw new Error("Enter the six-digit code from the Provider App.");
      const current = getFirebaseAuth().currentUser;
      if (!current) throw new Error("Verify your mobile number again.");
      const idToken = await current.getIdToken(true);
      const response = await fetch("/api/auth/device-pair/complete", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, code: pairCode.trim(), role: "provider" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.paired !== true) throw new Error(data.error || "Browser pairing failed.");
      if (!provider) throw new Error("Provider profile not found.");
      setStep("dashboard");
      await refresh(provider);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Browser pairing failed.");
    } finally {
      setBusy(false);
    }
  }

  async function respondToOffer(booking: Booking, accept: boolean) {
    if (!provider) return;
    setBusy(true); setError(""); setNotice("");
    try {
      let patch: Record<string, unknown>;
      if (accept) {
        if (!navigator.geolocation) {
          throw new Error("Is device/browser mein location support nahi hai. Booking accept karne ke liye Provider App use karein.");
        }
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, (geoError) => {
            const message = geoError.code === geoError.PERMISSION_DENIED
              ? "Location permission allow karein, phir booking accept karein."
              : geoError.code === geoError.TIMEOUT
                ? "Location milne mein der hui. Dobara try karein."
                : "Current location nahi mil saki. Location/GPS on karke dobara try karein.";
            reject(new Error(message));
          }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
        });
        patch = {
          status: "accepted",
          providerId: provider.id,
          providerAcceptPoint: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
          },
        };
      } else {
        patch = { withdrawNotify: provider.id };
      }
      await api(`/api/bookings/${encodeURIComponent(booking.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ patch }),
      });
      await refresh(provider);
      setNotice(accept
        ? "Booking accepted. Ab aage ka poora workflow Provider App mein complete karein."
        : "Booking declined. Yeh offer aapke web inbox se hata diya gaya hai.");
    } catch (e) { setError(e instanceof Error ? e.message : "Booking update failed."); }
    finally { setBusy(false); }
  }

  async function logout() {
    try {
      await fetch("/api/auth/device-session", { method: "POST", credentials: "same-origin" });
    } catch {}
    await getFirebaseAuth().signOut();
    setProvider(null); setBookings([]); setWalletData(null); setStep("phone"); setTab("overview");
  }

  if (step !== "dashboard" || !provider) {
    return <main className="flex min-h-screen items-center justify-center bg-[#0B1F3A] px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-9 flex justify-center">
          <Image
            src="/kaamdaar-logo-white.png"
            alt="Kaamdaar"
            width={220}
            height={76}
            priority
            className="h-auto w-52 object-contain"
          />
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
          {step === "phone" ? (
            <form onSubmit={sendCode} className="space-y-5">
              <label className="block text-sm font-semibold text-slate-800">
                Mobile Number
                <div className="mt-2 flex overflow-hidden rounded-xl border border-slate-200 focus-within:border-orange-500">
                  <span className="flex items-center border-r border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-600">+91</span>
                  <input
                    value={phone}
                    onChange={e=>setPhone(e.target.value.replace(/\D/g,"").slice(-10))}
                    inputMode="numeric"
                    autoComplete="tel-national"
                    required
                    minLength={10}
                    maxLength={10}
                    placeholder="Enter mobile number"
                    className="min-w-0 flex-1 p-3 text-base outline-none"
                  />
                </div>
              </label>
              <button disabled={busy || phone.length!==10} className="w-full rounded-xl bg-[#FF7A00] p-3.5 font-bold text-[#0B1F3A] transition hover:bg-[#ff9430] disabled:opacity-50">
                {busy?"Sending OTP…":"Continue"}
              </button>
            </form>
          ) : step === "otp" ? (
            <form onSubmit={verifyCode} className="space-y-5">
              <label className="block text-sm font-semibold text-slate-800">
                Enter OTP
                <input
                  value={otp}
                  onChange={e=>setOtp(e.target.value.replace(/\D/g,"").slice(0,6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  minLength={6}
                  maxLength={6}
                  placeholder="6-digit OTP"
                  className="mt-2 w-full rounded-xl border border-slate-200 p-3.5 text-center text-2xl tracking-[0.5em] outline-none focus:border-orange-500"
                />
              </label>
              <button disabled={busy || otp.length!==6} className="w-full rounded-xl bg-[#FF7A00] p-3.5 font-bold text-[#0B1F3A] transition hover:bg-[#ff9430] disabled:opacity-50">
                {busy?"Verifying…":"Verify & Login"}
              </button>
              <button type="button" onClick={()=>{setStep("phone");setConfirmation(null);setOtp("");setError("");}} className="w-full text-sm font-medium text-slate-500 hover:text-slate-800">
                Change mobile number
              </button>
            </form>
          ) : (
            <form onSubmit={completePairing} className="space-y-5">
              <p className="rounded-xl bg-blue-50 p-3 text-sm leading-6 text-blue-900">
                Open the Provider App on this same phone, go to Profile → Pair Web Browser, and enter the one-time code. It expires in five minutes and works once.
              </p>
              <label className="block text-sm font-semibold text-slate-800">
                6-digit app pairing code
                <input
                  value={pairCode}
                  onChange={e => setPairCode(e.target.value.replace(/\\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  minLength={6}
                  maxLength={6}
                  placeholder="Enter pairing code"
                  className="mt-2 w-full rounded-xl border border-slate-200 p-3.5 text-center text-2xl tracking-[0.5em] outline-none focus:border-orange-500"
                />
              </label>
              <button disabled={busy || pairCode.length !== 6} className="w-full rounded-xl bg-[#FF7A00] p-3.5 font-bold text-[#0B1F3A] transition hover:bg-[#ff9430] disabled:opacity-50">
                {busy ? "Pairing…" : "Pair and continue"}
              </button>
              <button type="button" onClick={() => { setStep("phone"); setPairCode(""); setProvider(null); setError(""); }} className="w-full text-sm font-medium text-slate-500 hover:text-slate-800">
                Use another mobile number
              </button>
            </form>
          )}
          <div id="provider-recaptcha"/>
          {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        </div>
      </div>
    </main>;
  }

  const nav = [
    ["overview","Overview"],["bookings","Bookings"],["missed","Missed Bookings"],["wallet","Wallet & Payments"],["reviews","Reviews"],
  ] as const;

  return <main className="min-h-screen bg-slate-100 text-slate-900">
    <header className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
        <div className="flex items-center gap-3"><div className="rounded-xl bg-orange-100 p-2 text-orange-600"><BriefcaseBusiness/></div><div><p className="text-xs font-bold uppercase tracking-widest text-orange-600">Kaamdaar Pro</p><h1 className="font-black">{provider.name}</h1><p className="text-xs text-slate-500">{provider.phone} · {provider.city}</p></div></div>
        <div className="flex items-center gap-2"><span className="hidden rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700 sm:inline-flex"><span className="mr-1">●</span> Live sync</span><button onClick={()=>void refresh(provider)} className="rounded-xl border p-2" title="Refresh"><RefreshCw size={18}/></button><button onClick={()=>void logout()} className="rounded-xl border p-2" title="Logout"><LogOut size={18}/></button></div>
      </div>
    </header>
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[220px_1fr]">
      <aside className="h-fit rounded-2xl bg-white p-3 shadow-sm"><nav className="grid grid-cols-2 gap-2 lg:grid-cols-1">{nav.map(([id,label])=><button key={id} onClick={()=>setTab(id)} className={`rounded-xl px-4 py-3 text-left text-sm font-bold ${tab===id?"bg-slate-900 text-white":"text-slate-600 hover:bg-slate-100"}`}>{label}</button>)}</nav><div className="mt-4 rounded-xl bg-orange-50 p-3 text-xs leading-5 text-orange-900">Web par profile aur financial details sirf view mode mein hain. Booking accept karne ke baad work flow app mein hi chalega.</div></aside>
      <section className="min-w-0 space-y-6">
        {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {notice && <div className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{notice}</div>}
        {incoming.length>0 && <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5"><div className="mb-3 flex items-center gap-2 font-black text-orange-900"><Bell/> New service requests <span className="rounded-full bg-orange-600 px-2 py-0.5 text-xs text-white">{incoming.length}</span></div><div className="grid gap-3 md:grid-cols-2">{incoming.map(b=><article key={b.id} className="rounded-xl bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-2"><h3 className="font-bold">{b.serviceName}</h3><span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-bold text-orange-700">New</span></div><p className="mt-2 text-sm text-slate-600">{b.address?.label || b.address?.line1 || "Jaipur"} · {b.date} · {b.slot}</p><p className="mt-2 text-lg font-black">{money(b.amount)}</p><p className="mt-1 text-xs text-slate-400">Offer expires: {date(b.offerExpiresAt || 0)}</p><div className="mt-4 grid grid-cols-2 gap-2"><button disabled={busy} onClick={()=>void respondToOffer(b,true)} className="flex items-center justify-center gap-2 rounded-lg bg-green-600 p-2.5 text-sm font-bold text-white disabled:opacity-50"><CheckCircle2 size={16}/> Accept</button><button disabled={busy} onClick={()=>void respondToOffer(b,false)} className="flex items-center justify-center gap-2 rounded-lg border border-red-200 p-2.5 text-sm font-bold text-red-700 disabled:opacity-50"><XCircle size={16}/> Reject</button></div></article>)}</div></div>}
        {active && <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5"><p className="font-black text-blue-900">Booking accepted · Continue in Provider App</p><p className="mt-1 text-sm text-blue-800">{active.serviceName} — {active.status.replaceAll("_"," ")}. Web controls are locked for this booking. Open the Provider App for navigation, arrival, OTP, work completion and payment steps.</p></div>}
        {tab==="overview" && <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[[<IndianRupee key="i"/>, "Net earnings", money(earnings)],[<BriefcaseBusiness key="b"/>, "Completed jobs", String(completed.length)],[<Wallet key="w"/>, "Wallet balance", money(walletData?.wallet.balance || 0)],[<Star key="s"/>, "Rating", `${provider.rating || 0} / 5`]].map(([icon,label,value],i)=><div key={i} className="rounded-2xl bg-white p-5 shadow-sm"><div className="mb-3 text-orange-600">{icon}</div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>)}
          </div>
          <div className="grid gap-4 xl:grid-cols-2"><div className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="mb-4 font-black">Recent bookings</h2>{bookings.slice(0,5).map(b=><div key={b.id} className="flex justify-between gap-3 border-t py-3 text-sm"><span><b>{b.serviceName}</b><span className="block text-xs text-slate-400">{date(b.createdAt)}</span></span><span className="text-right font-bold">{b.status.replaceAll("_"," ")}<span className="block">{money(b.amount)}</span></span></div>)}{bookings.length===0&&<p className="text-sm text-slate-400">No bookings yet.</p>}</div><div className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="mb-4 font-black">Provider profile · View only</h2><dl className="grid grid-cols-2 gap-4 text-sm">{[["Name",provider.name],["Mobile",provider.phone||"—"],["Service areas",provider.city],["Experience",`${provider.experience||0} years`],["Verified",provider.verified?"Yes":"Pending"],["Services",(provider.services||[]).join(", ")||"—"]].map(([k,v])=><div key={k}><dt className="text-slate-400">{k}</dt><dd className="mt-1 font-semibold">{v}</dd></div>)}</dl></div></div>
        </>}
        {tab==="bookings" && <div className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="mb-4 text-lg font-black">All bookings</h2>{bookings.map(b=><div key={b.id} className="flex flex-wrap items-center justify-between gap-3 border-t py-4"><div><p className="font-bold">{b.serviceName}</p><p className="text-xs text-slate-500">{date(b.createdAt)} · {b.address?.label || b.address?.line1 || "Jaipur"}</p></div><div className="text-right"><p className="font-bold">{money(b.amount)}</p><p className="text-xs capitalize text-slate-500">{b.status.replaceAll("_"," ")}</p></div></div>)}{bookings.length===0&&<p className="text-sm text-slate-400">No bookings found.</p>}</div>}
        {tab==="missed" && <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Missed today", missedToday, "bg-red-50 text-red-700"],
              ["Missed · 7 days", missedWeek, "bg-orange-50 text-orange-700"],
              ["Missed · 30 days", missedMonth, "bg-slate-100 text-slate-800"],
              ["Rejected today", rejectedToday, "bg-amber-50 text-amber-700"],
            ].map(([label, value, style]) => <div key={String(label)} className={`rounded-2xl p-4 shadow-sm ${style}`}>
              <p className="text-xs font-semibold">{label}</p><p className="mt-1 text-2xl font-black">{value}</p>
            </div>)}
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2"><CalendarX className="text-orange-600"/><h2 className="text-lg font-black">Missed booking history</h2></div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <select value={missedPeriod} onChange={e=>setMissedPeriod(e.target.value)} className="rounded-xl border p-3 text-sm">
                <option value="today">Today</option><option value="yesterday">Yesterday</option><option value="7days">Last 7 days</option><option value="30days">Last 30 days</option><option value="all">All time</option>
              </select>
              <select value={missedOutcome} onChange={e=>setMissedOutcome(e.target.value)} className="rounded-xl border p-3 text-sm">
                <option value="all">All outcomes</option><option value="missed">Missed (no response)</option><option value="rejected">Rejected by me</option>
              </select>
              <select value={missedService} onChange={e=>setMissedService(e.target.value)} className="rounded-xl border p-3 text-sm">
                <option value="all">All services</option>{Array.from(new Set(missedRecords.map(r=>r.booking.serviceName))).sort().map(name=><option key={name} value={name}>{name}</option>)}
              </select>
              <div className="flex items-center gap-2 rounded-xl border px-3"><Search size={16} className="text-slate-400"/><input value={missedSearch} onChange={e=>setMissedSearch(e.target.value)} placeholder="Booking ID, service, mobile…" className="min-w-0 flex-1 py-3 text-sm outline-none"/></div>
            </div>
            <div className="mt-4 space-y-3">
              {filteredMissedRecords.map(({booking,outcome,at})=><article key={booking.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
                <div className="min-w-0"><p className="font-bold">{booking.serviceName}</p><p className="mt-1 text-xs text-slate-500">{booking.id} · {date(at)}</p><p className="mt-1 text-xs text-slate-500">{booking.address?.label || booking.address?.line1 || "Jaipur"} · {booking.phone || "Customer"}</p></div>
                <div className="text-right"><span className={`rounded-full px-3 py-1 text-xs font-bold ${outcome==="missed"?"bg-red-50 text-red-700":"bg-amber-50 text-amber-700"}`}>{outcome==="missed"?"Missed · 40 sec timeout":"Rejected"}</span><p className="mt-2 font-black">{money(booking.amount)}</p></div>
              </article>)}
              {filteredMissedRecords.length===0 && <p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">Selected filters ke liye koi missed booking nahi mili.</p>}
            </div>
          </div>
        </div>}
        {tab==="wallet" && <div className="space-y-4"><div className="rounded-2xl bg-slate-900 p-6 text-white"><p className="text-sm text-slate-300">Available wallet balance</p><p className="mt-2 text-4xl font-black">{money(walletData?.wallet.balance || 0)}</p><p className="mt-2 text-xs text-slate-300">Wallet recharge online abhi configured nahi hai. Recharge ke liye admin/support se contact karein.</p></div><div className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="mb-3 font-black">Payment & wallet history</h2>{(walletData?.txns||[]).map(t=><div key={t.id} className="flex justify-between gap-3 border-t py-3 text-sm"><div><p className="font-semibold">{t.note || t.kind}</p><p className="text-xs text-slate-400">{date(t.createdAt)} · Balance {money(t.balanceAfter)}</p></div><b className={t.amount<0?"text-red-600":"text-green-700"}>{t.amount<0?"−":"+"}{money(Math.abs(t.amount))}</b></div>)}{!walletData?.txns?.length&&<p className="text-sm text-slate-400">No wallet transactions.</p>}</div></div>}
        {tab==="reviews" && <div className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="mb-4 text-lg font-black">Customer reviews</h2>{reviews.map((r,i)=><article key={i} className="border-t py-4"><div className="flex items-center justify-between"><b>{r.author}</b><span className="flex items-center gap-1 text-amber-600"><Star size={15} fill="currentColor"/>{r.rating}/5</span></div><p className="mt-2 text-sm text-slate-600">{r.text || "No written comment."}</p></article>)}{reviews.length===0&&<p className="text-sm text-slate-400">No reviews received yet.</p>}</div>}
        <p className="flex items-center gap-2 text-xs text-slate-400"><Smartphone size={14}/> Work start, navigation, arrival OTP, completion and customer verification are Provider App only. Dashboard refreshes automatically.</p>
      </section>
    </div>
  </main>;
}
