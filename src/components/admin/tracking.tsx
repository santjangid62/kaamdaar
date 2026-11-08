"use client";

/**
 * Admin live-tracking + audit widgets.
 *
 * The map reuses the same Leaflet map the customer tracking screen uses, so the
 * Admin sees exactly what the customer sees: the Pro's last reported GPS point
 * and the customer's address pin. Freshness is shown explicitly ("12 s ago")
 * because a stale ping must never look like live movement.
 */
import Link from "next/link";
import { Navigation, RadioTower, ScrollText, Satellite } from "lucide-react";
import DispatchMap from "../DispatchMap";
import type { ActivityRow, TrackingRow } from "../../lib/admin/types";

const ACTOR_STYLE: Record<string, string> = {
  customer: "bg-blue-50 text-blue-700",
  provider: "bg-emerald-50 text-emerald-700",
  admin: "bg-violet-50 text-violet-700",
  system: "bg-slate-100 text-slate-600",
};

function Dot({ tone }: { tone: string }) {
  const map: Record<string, string> = {
    green: "bg-emerald-500",
    sky: "bg-sky-500",
    orange: "bg-orange-500",
    blue: "bg-blue-500",
    red: "bg-red-500",
    grey: "bg-slate-400",
  };
  return <span className={`h-2 w-2 shrink-0 rounded-full ${map[tone] ?? map.grey}`} />;
}

/* ── live Pro tracking map ──────────────────────────────────────── */
export function LiveTrackMap({ row }: { row: TrackingRow | null }) {
  if (!row || !row.point || !row.destination) {
    return (
      <div className="grid h-[300px] place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 text-center">
        <div className="max-w-xs px-4">
          <Satellite className="mx-auto h-7 w-7 text-slate-400" />
          <p className="mt-2 text-sm font-semibold text-slate-500">
            No Pro is sending GPS right now.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            The map fills in the moment a Pro accepts a job and the Provider app reports its
            position.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <DispatchMap
        key={row.bookingId}
        className="h-[300px] w-full overflow-hidden rounded-2xl"
        center={row.point}
        user={row.destination}
        providers={[
          {
            id: row.providerId || "pro",
            point: row.point,
            rating: 0,
            name: row.provider,
            moving: row.status === "On the Way",
          },
        ]}
        radiusKm={0.6}
      />
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
        <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
          <RadioTower className="h-3 w-3" /> {row.provider}
        </span>
        <span>{row.area}</span>
        <span>
          {row.distanceKm != null ? `${row.distanceKm} km to the customer` : "distance unknown"}
        </span>
        <span>· position {row.pingAge}</span>
      </p>
    </div>
  );
}

/* ── who is where, right now ────────────────────────────────────── */
export function TrackingTable({ rows }: { rows: TrackingRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-[12.5px]">
        <thead>
          <tr className="border-b border-slate-100 text-left text-[10px] uppercase tracking-wide text-slate-400">
            <th className="pb-2 font-semibold">Pro</th>
            <th className="pb-2 font-semibold">Service / Customer</th>
            <th className="pb-2 font-semibold">Status</th>
            <th className="pb-2 text-right font-semibold">To go</th>
            <th className="pb-2 text-right font-semibold">Last ping</th>
            <th className="pb-2 font-semibold">Stage</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.bookingId}>
              <td className="py-2">
                <span className="flex items-center gap-2 font-semibold text-navy">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-orange-50 text-[9px] font-bold text-orange-600">
                    {r.provider
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  {r.provider}
                </span>
                <span className="ml-8 block text-[10px] font-medium text-slate-400">{r.code}</span>
              </td>
              <td className="py-2">
                <span className="block font-medium text-slate-700">{r.service}</span>
                <span className="block text-[11px] text-slate-400">
                  {r.customer} · {r.area}
                </span>
              </td>
              <td className="py-2">
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11.5px] font-semibold text-slate-600">
                  <Dot tone={r.tone} /> {r.status}
                </span>
              </td>
              <td className="py-2 text-right font-bold text-navy">
                {r.distanceKm != null ? `${r.distanceKm} km` : "—"}
              </td>
              <td className="py-2 text-right text-[11px] font-medium text-slate-500">
                {r.hasGps ? r.pingAge : "no GPS yet"}
              </td>
              <td className="py-2">
                <span className="flex flex-wrap items-center gap-1">
                  {r.navigation && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                      <Navigation className="h-2.5 w-2.5" /> nav {r.navigation}
                    </span>
                  )}
                  {r.arrived && (
                    <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
                      arrived {r.arrived}
                    </span>
                  )}
                  {r.started && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      work {r.started}
                    </span>
                  )}
                  {!r.navigation && !r.arrived && !r.started && (
                    <span className="text-[10px] text-slate-400">assigned</span>
                  )}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── audit trail ────────────────────────────────────────────────── */
export function ActivityLog({ rows, showBooking = true }: { rows: ActivityRow[]; showBooking?: boolean }) {
  if (rows.length === 0) {
    return (
      <div className="grid place-items-center rounded-xl border border-dashed border-slate-300 py-10 text-center">
        <ScrollText className="h-6 w-6 text-slate-400" />
        <p className="mt-2 max-w-xs text-sm text-slate-400">
          Nothing logged yet — every booking action is recorded here as it happens.
        </p>
      </div>
    );
  }
  return (
    <ol className="relative space-y-2.5 pl-4">
      <span className="absolute left-[3px] top-1 bottom-1 w-px bg-slate-200" aria-hidden />
      {rows.map((r) => (
        <li key={r.id} className="relative">
          <span className="absolute -left-4 top-1.5 h-2 w-2 rounded-full bg-white ring-2 ring-slate-300" />
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide ${ACTOR_STYLE[r.actor] ?? ACTOR_STYLE.system}`}
            >
              {r.actor}
            </span>
            <span className="text-[12.5px] font-semibold text-navy">{r.title}</span>
            <span className="text-[10.5px] text-slate-400">{r.time}</span>
            {showBooking && (
              <Link
                href={`/admin/live-bookings`}
                className="ml-auto text-[10.5px] font-semibold text-blue-600 hover:underline"
              >
                {r.booking}
              </Link>
            )}
          </div>
          {r.detail && (
            <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
              {r.detail}
              <span className="text-slate-400">
                {" · "}
                {r.service} · {r.provider}
              </span>
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
