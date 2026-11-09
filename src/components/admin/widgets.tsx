"use client";

/** Dashboard widgets — metric cards, lists, tables, map, status. */
import {
  Activity,
  ArrowUpRight,
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Star,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type {
  Metric,
  LiveRow,
  CategorySlice,
  AreaRow,
  ReviewRow,
  ProviderRow,
  AreaServiceRow,
  ProviderServiceRow,
  Row,
} from "../../lib/admin/types";
import { Donut } from "./charts";

/* ── shared bits ────────────────────────────────────────────────── */
export function WidgetCard({
  title,
  right,
  children,
  className = "",
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_-22px_rgba(15,23,42,0.32)] transition-shadow duration-200 hover:shadow-[0_14px_38px_-24px_rgba(15,23,42,0.38)] sm:p-6 ${className}`}>
      <header className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-extrabold tracking-tight text-navy">{title}</h3>
        {right}
      </header>
      {children}
    </section>
  );
}

export function ViewAll({ label = "View All" }: { label?: string }) {
  return (
    <button type="button" className="flex items-center gap-0.5 text-xs font-semibold text-blue-600 hover:underline">
      {label} <ArrowUpRight className="h-3.5 w-3.5" />
    </button>
  );
}

const TONE: Record<string, string> = {
  green: "bg-emerald-50 text-emerald-700",
  sky: "bg-sky-50 text-sky-700",
  orange: "bg-orange-50 text-orange-700",
  blue: "bg-blue-50 text-blue-700",
  grey: "bg-slate-100 text-slate-600",
  red: "bg-red-50 text-red-600",
};

export function StatusPill({ status, tone }: { status: string; tone?: string }) {
  const key = tone ?? (TONE[status] ? status : "grey");
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${TONE[key] ?? TONE.grey}`}>
      {status}
    </span>
  );
}

/* ── metric cards ───────────────────────────────────────────────── */
const METRIC_ICONS = [Users, UserCheck, CalendarCheck, CheckCircle2, Wallet];
const METRIC_STYLES = [
  "bg-blue-50 text-blue-600",
  "bg-emerald-50 text-emerald-600",
  "bg-orange-50 text-orange-600",
  "bg-violet-50 text-violet-600",
  "bg-red-50 text-red-600",
];

export function MetricCards({
  cards,
  revenue,
  revenueDelta,
  commission,
}: {
  cards: Metric[];
  revenue?: string;
  revenueDelta?: string;
  commission?: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {cards.map((m, i) => {
        const Icon = METRIC_ICONS[i] ?? Activity;
        return (
          <article
            key={m.key}
            className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_26px_-22px_rgba(15,23,42,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_16px_34px_-22px_rgba(15,23,42,0.35)]"
          >
            <div className="flex items-start justify-between gap-2">
              <span className={`grid h-10 w-10 place-items-center rounded-xl ${METRIC_STYLES[i] ?? METRIC_STYLES[0]}`}>
                <Icon className="h-5 w-5" />
              </span>
              <span
                className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  m.deltaUp ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
                }`}
              >
                {m.deltaUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {m.delta.replace(/[↑↓]\s*/, "")}
              </span>
            </div>
            <p className="mt-3 text-xs font-semibold text-slate-500">{m.label}</p>
            <p className="mt-0.5 text-2xl font-extrabold tracking-tight text-navy">{m.value}</p>
            <p className="mt-1 text-[11px] text-slate-400">{m.note}</p>
          </article>
        );
      })}

      <article className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 via-white to-orange-50/60 p-4 shadow-[0_10px_28px_-20px_rgba(180,83,9,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-22px_rgba(180,83,9,0.35)]">
        <div className="flex items-start justify-between gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-600">
            <Wallet className="h-5 w-5" />
          </span>
        </div>
        <p className="mt-3 text-xs font-semibold text-slate-500">Total Revenue</p>
        <p className="mt-0.5 text-2xl font-extrabold tracking-tight text-navy">{revenue ?? "₹0"}</p>
        <p className="mt-1 text-[11px] text-slate-400">
          {revenueDelta ?? "—"} · Commission: {commission ?? "₹0"}
        </p>
      </article>
    </div>
  );
}

/* ── live bookings ──────────────────────────────────────────────── */
function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export function LiveBookingsList({ rows, compact = false }: { rows: LiveRow[]; compact?: boolean }) {
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
            {initials(r.customer)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-navy">{r.customer}</p>
            <p className="truncate text-[11px] text-slate-500">
              {r.service} · {r.location}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <StatusPill status={r.status} tone={r.statusTone} />
            {!compact && <span className="text-[10px] text-slate-400">{r.time}</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ── categories donut ───────────────────────────────────────────── */
export function CategoryBreakdown({
  slices,
  total,
}: {
  slices: CategorySlice[];
  total: number;
}) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex justify-center">
        <Donut
          slices={slices.map((s) => ({ name: s.name, pct: s.pct, color: s.color }))}
          centerValue={total.toLocaleString("en-IN")}
          centerLabel="Total Bookings"
        />
      </div>
      <ul className="w-full space-y-2">
        {slices.map((s) => (
          <li key={s.name} className="flex items-center gap-2 text-[12px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="flex-1 truncate font-semibold text-navy">{s.name}</span>
            <span className="text-slate-400">{s.pct}%</span>
            <span className="w-14 text-right font-bold text-navy">({s.count.toLocaleString("en-IN")})</span>
          </li>
        ))}
      </ul>
      <span className="sr-only">{total}</span>
    </div>
  );
}

/* ── top services with tabs ─────────────────────────────────────── */
export function TopServices({
  rows,
  by,
  onBy,
}: {
  rows: Array<{ rank: number; name: string; metric: string; growth: string }>;
  by: "bookings" | "revenue" | "rating";
  onBy: (v: "bookings" | "revenue" | "rating") => void;
}) {
  const tabs: Array<typeof by> = ["bookings", "revenue", "rating"];
  return (
    <div>
      <div className="mb-3 flex items-center gap-1">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onBy(t)}
            className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${
              by === t ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            By {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <table className="w-full text-[13px]">
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.rank}>
              <td className="w-6 py-2 font-bold text-slate-400">{r.rank}</td>
              <td className="py-2 font-semibold text-navy">{r.name}</td>
              <td className="py-2 text-right font-bold text-navy">{r.metric}</td>
              <td className="w-14 py-2 text-right text-xs font-bold text-emerald-600">{r.growth}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── bookings-by-location map widget ────────────────────────────── */
export function LocationMap({ areas, city = "Jaipur" }: { areas: AreaRow[]; city?: string }) {
  return (
    <div className="relative h-[240px] overflow-hidden rounded-xl border border-slate-200 bg-[#eef2f7]">
      {/* stylised streets */}
      <svg viewBox="0 0 400 240" className="absolute inset-0 h-full w-full" aria-hidden>
        <rect width="400" height="240" fill="#eef2f7" />
        <g stroke="#dbe3ec" strokeWidth="10" fill="none">
          <path d="M-10,70 L410,58" />
          <path d="M-10,150 L410,168" />
          <path d="M70,-10 L58,250" />
          <path d="M210,-10 L226,250" />
          <path d="M330,-10 L318,250" />
        </g>
        <g stroke="#e3e9f1" strokeWidth="4" fill="none">
          <path d="M-10,110 L410,102" />
          <path d="M-10,205 L410,215" />
          <path d="M140,-10 L148,250" />
          <path d="M270,-10 L262,250" />
          <path d="M0,0 L400,240" strokeDasharray="6 8" />
        </g>
        <rect x="150" y="86" width="70" height="52" rx="6" fill="#e6ecf4" />
      </svg>

      {/* heat + pins */}
      {areas.map((a) => (
        <div
          key={a.name}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${a.x}%`, top: `${a.y}%` }}
        >
          <span className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-400/25 blur-md" />
          <span className="relative block h-3.5 w-3.5 rounded-full border-2 border-white bg-flame shadow" />
          <span className="absolute left-1/2 top-5 w-28 -translate-x-1/2 text-center text-[10px] font-bold leading-tight text-navy drop-shadow-sm">
            {a.name}
            <span className="block font-medium text-slate-500">{a.bookings.toLocaleString("en-IN")} bookings</span>
          </span>
        </div>
      ))}

      <span className="absolute left-3 top-3 rounded-md bg-white/90 px-2 py-1 text-[10px] font-bold text-navy shadow">
        📍 {city}
      </span>
      <div className="absolute bottom-3 right-3 flex flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow">
        <button type="button" className="px-2.5 py-1 text-sm font-bold text-slate-600 hover:bg-slate-50" aria-label="Zoom in">+</button>
        <button type="button" className="border-t border-slate-200 px-2.5 py-1 text-sm font-bold text-slate-600 hover:bg-slate-50" aria-label="Zoom out">−</button>
      </div>
    </div>
  );
}

/* ── reviews ────────────────────────────────────────────────────── */
export function ReviewsList({ rows }: { rows: ReviewRow[] }) {
  return (
    <ul className="space-y-3.5">
      {rows.map((r) => (
        <li key={r.name + r.service} className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
            {initials(r.name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-[13px] font-bold text-navy">{r.name}</p>
              <span className="text-[11px] text-slate-400">{r.service}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-3 w-3 ${i < Math.round(r.score) ? "fill-amber-400 text-amber-400" : "text-slate-200"}`}
                />
              ))}
              <span className="ml-1 rounded bg-slate-100 px-1.5 text-[10px] font-bold text-navy">
                {r.score.toFixed(1)}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{r.text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ── latest bookings table ──────────────────────────────────────── */
export function BookingTable({
  rows,
  columns,
  dense = false,
  actions,
}: {
  rows: Row[];
  columns: Array<{ key: string; label: string; align?: "right" }>;
  dense?: boolean;
  actions?: (row: Row) => React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-[13px]">
        <thead>
          <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
            {columns.map((c) => (
              <th key={c.key} className={`pb-2 font-semibold ${c.align === "right" ? "text-right" : ""}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, i) => (
            <tr key={String(r.id ?? r.invoice ?? r.txn ?? i)} className="hover:bg-slate-50/70">
              {columns.map((c) => {
                if (c.key === "__actions") {
                  return (
                    <td key="__actions" className="py-2.5 text-right">
                      {actions ? actions(r) : null}
                    </td>
                  );
                }
                const v = r[c.key];
                const isStatus = c.key === "status" || c.key === "tone";
                if (c.key === "tone") return null;
                return (
                  <td
                    key={c.key}
                    className={`${dense ? "py-2" : "py-2.5"} text-slate-600 ${c.align === "right" ? "text-right font-semibold" : ""} ${
                      c.key === "id" || c.key === "invoice" || c.key === "txn" || c.key === "name" || c.key === "customer"
                        ? "font-bold text-navy"
                        : ""
                    }`}
                  >
                    {isStatus && typeof v === "string" ? (
                      <StatusPill status={v} tone={typeof r.tone === "string" ? r.tone : undefined} />
                    ) : c.key === "rating" ? (
                      <span className="font-bold text-navy">⭐ {v}</span>
                    ) : (
                      String(v ?? "—")
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── top providers ──────────────────────────────────────────────── */
export function TopProvidersTable({ rows }: { rows: ProviderRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-[13px]">
        <thead>
          <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
            <th className="w-6 pb-2">#</th>
            <th className="pb-2 font-semibold">Provider</th>
            <th className="pb-2 text-right font-semibold">Bookings</th>
            <th className="pb-2 text-right font-semibold">Rating</th>
            <th className="pb-2 text-right font-semibold">Revenue</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((p) => (
            <tr key={p.rank}>
              <td className="py-2 font-bold text-slate-400">{p.rank}</td>
              <td className="py-2">
                <span className="flex items-center gap-2 font-semibold text-navy">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">
                    {initials(p.name)}
                  </span>
                  {p.name}
                </span>
              </td>
              <td className="py-2 text-right font-bold text-navy">{p.bookings}</td>
              <td className="py-2 text-right font-bold text-amber-500">
                {p.rating > 0 ? `⭐ ${p.rating.toFixed(1)}` : "New"}
              </td>
              <td className="py-2 text-right font-bold text-navy">₹{p.revenue.toLocaleString("en-IN")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── system status ──────────────────────────────────────────────── */
export function SystemStatus({ rows }: { rows: Array<{ name: string; uptime: string }> }) {
  // clock text is written after mount so prerendered HTML stays stable
  const stampRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (stampRef.current) {
      stampRef.current.textContent = new Date().toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  }, []);
  return (
    <div>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-600">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> All Systems Operational
      </span>
      <ul className="mt-4 space-y-3">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-2 text-[13px]">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            <span className="flex-1 font-medium text-slate-600">{r.name}</span>
            <span className="font-bold text-navy">{r.uptime}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex items-center gap-1.5 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
        <Clock className="h-3 w-3" /> Last updated: <span ref={stampRef} className="ml-1">…</span>
      </p>
    </div>
  );
}

/* ── pager (section pages) ──────────────────────────────────────── */
export function Pager({
  total,
  shown,
  page,
  onPageChange,
}: {
  total: number;
  shown: number;
  page: number;
  onPageChange: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / shown));
  return (
    <div className="flex items-center justify-between text-xs text-slate-500">
      <span>
        Showing {Math.min(total, shown * page)} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="rounded-md border border-slate-200 p-1.5 disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-2 font-semibold text-navy">
          {page} / {pages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(pages, page + 1))}
          disabled={page === pages}
          className="rounded-md border border-slate-200 p-1.5 disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ── today's ops strip ──────────────────────────────────────── */
export interface StatItem {
  label: string;
  value: string | number;
  tone?: "green" | "sky" | "orange" | "blue" | "grey";
}

const STAT_TONE: Record<string, string> = {
  green: "text-emerald-600",
  sky: "text-sky-600",
  orange: "text-orange-600",
  blue: "text-blue-600",
  grey: "text-navy",
};

export function StatStrip({ items }: { items: StatItem[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {items.map((it) => (
        <div key={it.label} className="rounded-xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-white px-4 py-3 shadow-[0_4px_14px_-12px_rgba(15,23,42,0.3)] transition-colors hover:border-blue-200 hover:bg-blue-50/30">
          <p className={`text-xl font-extrabold tracking-tight ${STAT_TONE[it.tone ?? "grey"]}`}>
            {it.value}
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{it.label}</p>
        </div>
      ))}
    </div>
  );
}

/** Keeps "running right now" honest on a server-rendered page. */
export function AutoRefresh({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = window.setInterval(() => router.refresh(), seconds * 1000);
    return () => window.clearInterval(id);
  }, [router, seconds]);
  return (
    <span className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-500">
      <Activity className="h-3 w-3 text-emerald-500" /> live · every {seconds}s
    </span>
  );
}

/* ── services by area ───────────────────────────────────────── */
export function AreaServiceList({ rows }: { rows: AreaServiceRow[] }) {
  return (
    <ul className="space-y-4">
      {rows.map((a) => (
        <li key={a.area}>
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[13px] font-bold text-navy">
              {a.area}
              {a.city && a.city !== a.area ? `, ${a.city}` : ""}
            </p>
            <span className="shrink-0 text-[11px] font-semibold text-slate-400">
              {a.bookings} bookings · {a.providers} {a.providers === 1 ? "Pro" : "Pros"}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {a.services.map((s) => (
              <span
                key={s.name}
                className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700"
              >
                {s.name} <span className="text-blue-400">×{s.count}</span>
              </span>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ── which Pro delivered which services ─────────────────────── */
export function ProviderServiceList({ rows }: { rows: ProviderServiceRow[] }) {
  return (
    <ul className="space-y-4">
      {rows.map((p) => (
        <li key={p.id} className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">
            {initials(p.name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[13px] font-bold text-navy">{p.name}</p>
              <span className="shrink-0 text-[11px] font-semibold text-slate-400">
                {p.jobs} {p.jobs === 1 ? "job" : "jobs"}
                {p.rating > 0 ? ` · ⭐ ${p.rating.toFixed(1)}` : ""}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {p.services.map((s) => (
                <span
                  key={s.name}
                  className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700"
                >
                  {s.name} <span className="text-emerald-500">×{s.count}</span>
                </span>
              ))}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
