"use client";

import { useCallback, useEffect, useState } from "react";

type Evidence = { index: number; name: string; mimeType: string; size: number; url: string };
type Complaint = {
  id: string; customer?: string; customerPhone?: string; provider?: string; issue?: string;
  booking?: string; status?: string; adminResponse?: string; createdAt?: number; evidence?: Evidence[];
};

export default function CustomerComplaintsClient() {
  const [rows, setRows] = useState<Complaint[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/admin/complaints", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load complaints");
      setRows(data.complaints || []);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load complaints"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function respond(row: Complaint) {
    const response = (responses[row.id] ?? row.adminResponse ?? "").trim();
    const status = statuses[row.id] ?? row.status ?? "Open";
    if (response.length < 3) { setError("Please enter a customer-facing response."); return; }
    setBusy(row.id); setError(""); setNotice("");
    try {
      const res = await fetch("/api/admin/complaints", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complaintId: row.id, status, response }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send response");
      setNotice(`Response sent to ${row.customer || "customer"}.`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not send response"); }
    finally { setBusy(""); }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-navy">Customer Complaints</h1>
          <p className="mt-1 text-sm text-slate-500">Review customer evidence, update ticket status and send a reply.</p>
        </div>
        <button onClick={() => void load()} className="rounded-xl border px-4 py-2 text-sm font-semibold">Refresh</button>
      </header>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
      {loading ? <p className="text-sm text-slate-500">Loading complaints…</p> : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-slate-500">No customer complaints yet.</div>
      ) : rows.map((row) => (
        <article key={row.id} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{row.id}</p>
              <h2 className="mt-1 text-base font-extrabold text-navy">{row.customer || "Customer"} · {row.customerPhone || "No phone"}</h2>
              <p className="mt-1 text-xs text-slate-500">Booking: {row.booking || "—"} · Provider: {row.provider || "—"} · {row.createdAt ? new Date(row.createdAt).toLocaleString("en-IN") : "Date unavailable"}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{row.status || "Open"}</span>
          </div>
          <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{row.issue}</p>
          {!!row.evidence?.length && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-600">Evidence ({row.evidence.length})</p>
              <div className="flex flex-wrap gap-3">
                {row.evidence.map((file) => file.mimeType.startsWith("image/") ? (
                  <a key={file.index} href={file.url} target="_blank" rel="noreferrer" className="block">
                    <img src={file.url} alt={file.name} className="h-24 w-28 rounded-lg border object-cover" />
                    <span className="mt-1 block max-w-28 truncate text-xs text-blue-700">{file.name}</span>
                  </a>
                ) : (
                  <a key={file.index} href={file.url} target="_blank" rel="noreferrer" className="rounded-lg border px-3 py-2 text-xs font-semibold text-blue-700">{file.name} · Open PDF</a>
                ))}
              </div>
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-[180px_1fr]">
            <label className="text-xs font-bold text-slate-600">Ticket status
              <select value={statuses[row.id] ?? row.status ?? "Open"} onChange={(e) => setStatuses((s) => ({ ...s, [row.id]: e.target.value }))} className="mt-1 h-10 w-full rounded-lg border px-3 text-sm">
                {["Open", "In Review", "Escalated", "Resolved"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold text-slate-600">Reply to customer
              <textarea value={responses[row.id] ?? row.adminResponse ?? ""} onChange={(e) => setResponses((s) => ({ ...s, [row.id]: e.target.value }))} rows={3} maxLength={2000} placeholder="Write an update or resolution for the customer…" className="mt-1 w-full rounded-lg border p-3 text-sm" />
            </label>
          </div>
          <div className="flex justify-end">
            <button disabled={busy === row.id} onClick={() => void respond(row)} className="rounded-xl bg-navy px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy === row.id ? "Sending…" : "Save status & send reply"}</button>
          </div>
        </article>
      ))}
    </main>
  );
}
