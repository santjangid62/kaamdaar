"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Smartphone, KeyRound, RefreshCw } from "lucide-react";

type TestAuth = { enabled: boolean; otp: string | null; phones: string[]; note: string };

export default function TestLoginPage() {
  const [data, setData] = useState<TestAuth | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/test-auth", { cache: "no-store" });
      if (!res.ok) throw new Error(res.status === 401 ? "Admin session expired." : "Could not load testing settings.");
      setData(await res.json());
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  return <div className="mx-auto max-w-3xl space-y-5">
    <header className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-700"><ShieldCheck /></span><div><h1 className="text-2xl font-black text-slate-900">Test Login / OTP Panel</h1><p className="text-sm text-slate-500">Temporary testing access for approved demo accounts</p></div></div>
    </header>
    {loading && <p className="rounded-xl bg-white p-5 text-sm text-slate-500">Loading testing configuration…</p>}
    {error && <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {data && <>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between"><h2 className="font-bold text-slate-900">Testing mode</h2><span className={data.enabled ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700" : "rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700"}>{data.enabled ? "ENABLED" : "DISABLED"}</span></div>
        <p className="mt-2 text-sm text-slate-500">{data.note}</p>
        {data.enabled && <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4"><div className="flex items-center gap-2 text-xs font-semibold text-blue-700"><KeyRound size={15}/> Shared test OTP</div><p className="mt-2 font-mono text-3xl font-black tracking-[0.2em] text-slate-900">{data.otp}</p></div>
          <div className="rounded-xl border border-slate-200 p-4"><div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><Smartphone size={15}/> Allowed test numbers</div><p className="mt-2 text-2xl font-black text-slate-900">{data.phones.length}</p></div>
        </div>}
      </section>
      {data.enabled && <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="mb-3 font-bold text-slate-900">Allowlisted mobile numbers</h2><ul className="space-y-2">{data.phones.map((p) => <li key={p} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 font-mono text-sm text-slate-700"><Smartphone size={14}/>{p}</li>)}</ul></section>}
    </>}
    <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><RefreshCw size={15}/> Refresh</button>
  </div>;
}
