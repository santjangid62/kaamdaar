"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, ShieldAlert } from "lucide-react";

type Report = {
  id: string; serviceName: string; amount: number; providerName: string; providerId: string;
  phone: string; paymentMethod?: "cash" | "upi"; paymentReference?: string;
  paymentReportedAt?: number; paymentStatus?: string; userId: string; date: string; slot: string;
};

export default function BookingPaymentConfirmationsClient() {
  const [rows, setRows] = useState<Report[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string,string>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/booking-payments", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load payment reports");
      setRows(data.reports ?? []);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Load failed"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function act(row: Report, action: "verify" | "dispute") {
    if (action === "verify" && !window.confirm(`Verify ₹${row.amount} ${row.paymentMethod?.toUpperCase()} payment for booking ${row.id}?`)) return;
    if (action === "dispute" && !note[row.id]?.trim()) { setMessage("Dispute note is required."); return; }
    setBusy(row.id); setMessage("");
    try {
      const res = await fetch("/api/admin/booking-payments", { method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: row.id, action, note: note[row.id] ?? "" }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update payment");
      setMessage(action === "verify" ? "Payment verified. Provider commission has been applied." : "Payment marked as disputed for follow-up.");
      await load();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Action failed"); }
    finally { setBusy(null); }
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-wider text-orange-600">Finance control</p>
        <h1 className="text-2xl font-extrabold text-navy">Booking Payment Confirmations</h1>
        <p className="mt-1 text-sm text-slate-500">Provider reports payment collection; Admin verifies it before marking the booking paid and applying commission.</p></div>
      <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}/> Refresh</button>
    </div>
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><b>Verification rule:</b> UPI reports should be checked against the bank/UPI statement using the reference ID. Cash reports require an admin cash reconciliation. A provider's tap alone does not make a payment verified.</div>
    {message && <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800">{message}</p>}
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["Booking / Service","Provider","Amount","Method / Reference","Reported at","Admin action"].map(x=><th key={x} className="px-4 py-3">{x}</th>)}</tr></thead>
        <tbody>{rows.map(row=><tr key={row.id} className="border-t border-slate-100 align-top">
          <td className="px-4 py-3"><b>{row.id}</b><div className="text-xs text-slate-500">{row.serviceName}</div><div className="text-xs text-slate-400">{row.date} · {row.slot}</div></td>
          <td className="px-4 py-3"><b>{row.providerName}</b><div className="text-xs text-slate-500">{row.phone}</div></td>
          <td className="px-4 py-3 font-bold">₹{row.amount}</td>
          <td className="px-4 py-3"><b className="uppercase">{row.paymentMethod ?? "—"}</b><div className="max-w-[220px] break-all text-xs text-slate-500">{row.paymentReference || "Cash — reconcile manually"}</div></td>
          <td className="px-4 py-3 text-xs text-slate-500">{row.paymentReportedAt ? new Date(row.paymentReportedAt).toLocaleString("en-IN") : "—"}<div className="mt-1 font-semibold text-amber-700">{row.paymentStatus}</div></td>
          <td className="px-4 py-3">{row.paymentStatus === "reported" ? <div className="space-y-2">
            <input value={note[row.id] ?? ""} onChange={e=>setNote(s=>({...s,[row.id]:e.target.value}))} placeholder="Dispute note (if needed)" className="w-full rounded-lg border px-2 py-2 text-xs"/>
            <div className="flex gap-2"><button onClick={()=>void act(row,"verify")} disabled={!!busy} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><CheckCircle2 className="h-3.5 w-3.5"/> Verify</button>
            <button onClick={()=>void act(row,"dispute")} disabled={!!busy} className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50"><ShieldAlert className="h-3.5 w-3.5"/> Dispute</button></div>
          </div> : <span className="text-xs text-slate-500">Needs follow-up</span>}</td>
        </tr>)}</tbody>
      </table>
      {!loading && rows.length === 0 && <p className="p-10 text-center text-sm text-slate-400">No provider payment reports pending.</p>}
    </div>
  </div>;
}
