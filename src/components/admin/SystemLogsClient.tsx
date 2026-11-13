"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Download, RefreshCw, Search, ShieldCheck } from "lucide-react";

type LogRow = {
  id: string; at: number; actor: string; action: string; module: string;
  title: string; description: string; reference: string; severity: "info" | "success" | "warning" | "danger";
};
type Payload = { rows: LogRow[]; counts: { total: number; bookings: number; customers: number; providers: number; finance: number; warnings: number }; generatedAt: number };

const actorLabel: Record<string, string> = { customer: "Customer", provider: "Provider", admin: "Admin", system: "System" };
const severityClass: Record<string, string> = {
  info: "bg-blue-50 text-blue-700", success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700", danger: "bg-red-50 text-red-700",
};

export default function SystemLogsClient() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [module, setModule] = useState("all");
  const [actor, setActor] = useState("all");
  const [range, setRange] = useState("all");

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/logs?limit=1000", { cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 401 ? "Admin session expired. Please sign in again." : "Could not load system logs.");
      setData(await response.json() as Payload);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load logs."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 30000); return () => window.clearInterval(timer); }, []);

  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoff = range === "today" ? new Date().setHours(0, 0, 0, 0) : range === "7d" ? now - 7 * 86400000 : range === "30d" ? now - 30 * 86400000 : 0;
    const q = query.trim().toLowerCase();
    return (data?.rows ?? []).filter(row =>
      (!cutoff || row.at >= cutoff) &&
      (module === "all" || row.module === module) &&
      (actor === "all" || row.actor === actor) &&
      (!q || [row.title, row.description, row.reference, row.module, row.action, row.actor].join(" ").toLowerCase().includes(q))
    );
  }, [data, query, module, actor, range]);

  function exportCsv() {
    const columns = ["at", "actor", "module", "action", "title", "description", "reference"];
    const csv = [columns.join(","), ...filtered.map(row => columns.map(key => {
      const value = key === "at" ? new Date(row.at).toISOString() : String(row[key as keyof LogRow] ?? "");
      return '"' + value.replaceAll('"', '""') + '"';
    }).join(","))].join("\\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "kaamdaar-system-logs.csv"; anchor.click(); URL.revokeObjectURL(url);
  }

  const stats = data?.counts ?? { total: 0, bookings: 0, customers: 0, providers: 0, finance: 0, warnings: 0 };
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><div className="flex items-center gap-2"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><Activity className="h-5 w-5" /></span><div><h1 className="text-2xl font-extrabold tracking-tight text-navy">System Logs</h1><p className="mt-0.5 text-sm text-slate-500">Central activity dashboard across bookings, users, providers, notifications and finance.</p></div></div></div>
      <div className="flex gap-2">
        <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh</button>
        <button onClick={exportCsv} disabled={!filtered.length} className="inline-flex items-center gap-2 rounded-xl bg-navy px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"><Download className="h-4 w-4" /> Export CSV</button>
      </div>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {[
        ["All events", stats.total, Activity, "text-blue-700 bg-blue-50"],
        ["Booking events", stats.bookings, Activity, "text-indigo-700 bg-indigo-50"],
        ["Customer activity", stats.customers, ShieldCheck, "text-cyan-700 bg-cyan-50"],
        ["Provider activity", stats.providers, ShieldCheck, "text-emerald-700 bg-emerald-50"],
        ["Finance events", stats.finance, Activity, "text-violet-700 bg-violet-50"],
        ["Alerts / warnings", stats.warnings, AlertTriangle, "text-amber-700 bg-amber-50"],
      ] as const).map(([label, value, Icon, style]) => <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-500">{String(label)}</span><span className={`grid h-8 w-8 place-items-center rounded-lg ${String(style)}`}><Icon className="h-4 w-4" /></span></div><p className="mt-2 text-2xl font-extrabold text-navy">{Number(value).toLocaleString("en-IN")}</p></div>)}
    </div>
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_180px_160px_150px]">
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5"><Search className="h-4 w-4 text-slate-400" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search activity, ID, module..." className="w-full text-sm outline-none" /></label>
        <select value={module} onChange={e => setModule(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="all">All modules</option>{["Bookings","Customers","Providers","Notifications","Reviews","Wallet","Payouts","Provider Payments","Support"].map(x => <option key={x}>{x}</option>)}</select>
        <select value={actor} onChange={e => setActor(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="all">All actors</option>{["customer","provider","admin","system"].map(x => <option key={x} value={x}>{actorLabel[x]}</option>)}</select>
        <select value={range} onChange={e => setRange(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="all">All time</option><option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option></select>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-slate-500"><span>{filtered.length.toLocaleString("en-IN")} matching events · newest first</span><span>Auto-refresh: 30 sec</span></div>
    </div>
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="font-bold text-navy">Activity timeline</h2><p className="text-xs text-slate-500">Read-only audit view · timestamps shown in local time</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Latest 1,000</span></div>
      {error ? <div className="p-8 text-center text-sm text-red-600">{error}</div> : loading && !data ? <div className="p-8 text-center text-sm text-slate-500">Loading logs…</div> : filtered.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">No activity matches these filters.</div> :
      <div className="divide-y divide-slate-100">{filtered.map(row => <div key={row.id} className="grid gap-2 px-5 py-4 md:grid-cols-[minmax(0,1fr)_150px_150px] md:items-center">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${severityClass[row.severity]}`}>{row.action}</span><span className="text-sm font-bold text-navy">{row.title}</span><span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{row.module}</span></div><p className="mt-1 truncate text-xs text-slate-500">{row.description || "—"} {row.reference ? `· Ref: ${row.reference}` : ""}</p></div>
        <div className="text-xs font-semibold text-slate-600">{actorLabel[row.actor] ?? row.actor}</div>
        <time className="text-xs text-slate-500 md:text-right">{new Date(row.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</time>
      </div>)}</div>}
    </div>
    <p className="text-xs text-slate-400">Data is compiled from server-recorded booking events and timestamps available in existing system records. Historical actions that were never recorded cannot be reconstructed.</p>
  </div>;
}
