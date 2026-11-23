"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, RefreshCw, X } from "lucide-react";

type RequestRow = { bookingId: string; service: string; customerName: string; customerPhone: string; providerName: string; reason: string; requestedAt: number; bookingStatus: string };

export default function CancellationRequestsPage() {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const res = await fetch("/api/admin/cancellation-requests", { cache: "no-store" }); const data = await res.json(); if (!res.ok) throw new Error(data.error || "Could not load requests"); setRows(data.requests || []); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load requests"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function decide(row: RequestRow, decision: "approved" | "rejected") {
    setBusy(row.bookingId); setError("");
    try { const res = await fetch("/api/admin/cancellation-requests", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId: row.bookingId, decision, note: note[row.bookingId] || "" }) }); const data = await res.json(); if (!res.ok) throw new Error(data.error || "Review failed"); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Review failed"); }
    finally { setBusy(""); }
  }
  return <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Bookings</p><h1 className="text-2xl font-bold text-slate-900">Provider Cancellation Requests</h1><p className="mt-1 text-sm text-slate-500">Review the reason before approving or rejecting. Rejected requests leave the booking active.</p></div><button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm"><RefreshCw size={16}/> Refresh</button></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {loading ? <p className="py-10 text-center text-slate-500">Loading requests…</p> : rows.length === 0 ? <div className="rounded-2xl border border-dashed p-10 text-center text-slate-500">No pending provider cancellation requests.</div> : <div className="grid gap-4">{rows.map(row => <section key={row.bookingId} className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-semibold text-slate-900">{row.service}</h2><p className="text-xs text-slate-500">Booking {row.bookingId} · {new Date(row.requestedAt).toLocaleString("en-IN")}</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{row.bookingStatus}</span></div>
      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2"><p><b>Provider:</b> {row.providerName}</p><p><b>Customer:</b> {row.customerName} ({row.customerPhone})</p></div>
      <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm"><b>Cancellation reason</b><p className="mt-1 whitespace-pre-wrap">{row.reason}</p></div>
      <label className="mt-3 block text-sm font-medium text-slate-700">Admin review note (optional)<textarea value={note[row.bookingId] || ""} onChange={e => setNote(old => ({ ...old, [row.bookingId]: e.target.value }))} className="mt-1 min-h-20 w-full rounded-xl border p-3" maxLength={500}/></label>
      <div className="mt-4 flex flex-wrap gap-2"><button disabled={!!busy} onClick={() => void decide(row, "approved")} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Check size={16}/> Approve & cancel</button><button disabled={!!busy} onClick={() => void decide(row, "rejected")} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50"><X size={16}/> Reject request</button></div>
    </section>)}</div>}
  </main>;
}
