"use client";

import { useEffect, useState } from "react";

type Provider = { id: string; name: string; phone?: string };
type Payment = {
  id: string; providerId: string; providerName: string; phone: string;
  amount: number; method: "cash" | "upi"; status: "pending" | "verified" | "rejected";
  otp: string; demo: true; upiId: string; createdAt: number;
};

export default function ProviderPaymentsClient() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [providerId, setProviderId] = useState("");
  const [method, setMethod] = useState<"cash" | "upi">("cash");
  const [otp, setOtp] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const [p, pay] = await Promise.all([
      fetch("/api/admin/data/providers", { cache: "no-store" }),
      fetch("/api/admin/provider-payments", { cache: "no-store" }),
    ]);
    if (p.ok) setProviders(((await p.json()).rows ?? []) as Provider[]);
    if (pay.ok) setPayments(((await pay.json()).payments ?? []) as Payment[]);
  }
  useEffect(() => { void load(); }, []);

  async function create() {
    if (!providerId) { setMessage("Please select a provider."); return; }
    setBusy(true); setMessage("");
    try {
      const res = await fetch("/api/admin/provider-payments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId, method }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create payment request");
      setMessage("Demo payment request created. OTP is visible below to Admin only.");
      await load();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Request failed"); }
    finally { setBusy(false); }
  }

  async function act(payment: Payment, action: "verify" | "reject") {
    setBusy(true); setMessage("");
    try {
      const res = await fetch("/api/admin/provider-payments", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: payment.id, action, otp: otp[payment.id] ?? "" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not update payment");
      setMessage(action === "verify" ? "Demo payment verified and ₹500 credited to provider wallet." : "Payment request rejected.");
      await load();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Request failed"); }
    finally { setBusy(false); }
  }

  return <div className="space-y-5">
    <div>
      <h1 className="text-2xl font-extrabold text-navy">Provider Joining Payments</h1>
      <p className="mt-1 text-sm text-slate-500">₹500 joining fee · Demo mode · UPI is a placeholder and does not collect real money.</p>
    </div>
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
      Testing only: this flow does not verify a bank/UPI transaction. Do not use it to collect real payments.
    </div>
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-bold text-navy">Create payment request</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_180px_auto]">
        <select value={providerId} onChange={e => setProviderId(e.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm">
          <option value="">Select provider</option>
          {providers.map(p => <option key={p.id} value={p.id}>{p.name} · {p.phone ?? "No phone"}</option>)}
        </select>
        <select value={method} onChange={e => setMethod(e.target.value as "cash" | "upi")} className="h-11 rounded-xl border border-slate-200 px-3 text-sm">
          <option value="cash">Cash</option><option value="upi">UPI (demo)</option>
        </select>
        <button disabled={busy} onClick={() => void create()} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Create ₹500 request</button>
      </div>
    </div>
    {message && <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-700">{message}</p>}
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["Provider","Method","Amount","Demo OTP (Admin only)","UPI ID","Status","Action"].map(x=><th key={x} className="px-4 py-3">{x}</th>)}</tr></thead>
        <tbody>{payments.map(p=><tr key={p.id} className="border-t border-slate-100">
          <td className="px-4 py-3"><b>{p.providerName}</b><div className="text-xs text-slate-400">{p.phone}</div></td>
          <td className="px-4 py-3 uppercase">{p.method}</td><td className="px-4 py-3">₹{p.amount}</td>
          <td className="px-4 py-3 font-mono font-bold tracking-widest">{p.otp}</td><td className="px-4 py-3">{p.upiId}</td>
          <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{p.status}</span></td>
          <td className="px-4 py-3">{p.status === "pending" ? <div className="flex items-center gap-2">
            <input value={otp[p.id] ?? ""} onChange={e=>setOtp(s=>({...s,[p.id]:e.target.value}))} placeholder="Enter OTP" maxLength={6} className="w-24 rounded-lg border px-2 py-2 font-mono"/>
            <button disabled={busy} onClick={()=>void act(p,"verify")} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Verify</button>
            <button disabled={busy} onClick={()=>void act(p,"reject")} className="rounded-lg border px-3 py-2 text-xs">Reject</button>
          </div> : "—"}</td>
        </tr>)}</tbody>
      </table>
      {payments.length === 0 && <p className="p-8 text-center text-sm text-slate-400">No provider payment requests yet.</p>}
    </div>
  </div>;
}
