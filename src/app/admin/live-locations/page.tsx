"use client";

import { useEffect, useState } from "react";
import { MapPin, RefreshCw, Navigation, Users } from "lucide-react";

type Point = { lat: number; lng: number; accuracy?: number };
type LiveBooking = {
  id: string;
  serviceName: string;
  status: string;
  phone: string;
  providerName: string;
  address?: { label?: string; city?: string; line1?: string };
  customerLivePoint: Point | null;
  customerPingAt: number | null;
  providerLivePoint: Point | null;
  providerPingAt: number | null;
};

function mapUrl(point: Point) {
  return `https://www.google.com/maps/search/?api=1&query=${point.lat},${point.lng}`;
}
function freshness(at: number | null) {
  if (!at) return "Location not received yet";
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  return seconds < 60 ? `Updated ${seconds}s ago` : `Updated ${Math.floor(seconds / 60)}m ago`;
}

export default function AdminLiveLocationsPage() {
  const [bookings, setBookings] = useState<LiveBooking[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch("/api/admin/live-locations", { cache: "no-store" });
        if (!response.ok) throw new Error(response.status === 401 ? "Admin login required." : "Unable to load live locations.");
        const data = (await response.json()) as { bookings?: LiveBooking[] };
        if (active) { setBookings(data.bookings ?? []); setError(""); }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Network error");
      } finally {
        if (active) setLoading(false);
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">Kaamdaar Admin</p>
            <h1 className="mt-1 text-2xl font-black text-slate-900">Live customer & provider locations</h1>
            <p className="mt-1 text-sm text-slate-500">Active bookings refresh automatically every 5 seconds.</p>
          </div>
          <div className="rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm">
            <Users className="mr-2 inline h-4 w-4" /> {bookings.length} active bookings
          </div>
        </div>
        {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {loading && <p className="py-8 text-center text-slate-500">Loading live bookings…</p>}
        {!loading && !error && bookings.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">No active bookings right now.</div>}
        <div className="space-y-4">
          {bookings.map((booking) => (
            <article key={booking.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold text-slate-900">{booking.serviceName}</h2>
                  <p className="mt-1 text-xs text-slate-500">Booking {booking.id} · {booking.status.replaceAll("_", " ")}</p>
                  <p className="mt-1 text-xs text-slate-500">Customer {booking.phone || "—"} · Provider {booking.providerName || "Not assigned"}</p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{booking.address?.label || "Service address"}{booking.address?.city ? `, ${booking.address.city}` : ""}</span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <section className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                  <div className="flex items-center gap-2 font-bold text-emerald-800"><MapPin className="h-4 w-4" /> Customer live location</div>
                  {booking.customerLivePoint ? <>
                    <p className="mt-2 text-xs text-slate-600">{booking.customerLivePoint.lat.toFixed(6)}, {booking.customerLivePoint.lng.toFixed(6)}</p>
                    <p className="mt-1 text-xs text-slate-500">{freshness(booking.customerPingAt)}</p>
                    <a className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-emerald-800 underline" href={mapUrl(booking.customerLivePoint)} target="_blank" rel="noreferrer">Open customer on map <Navigation className="h-4 w-4" /></a>
                  </> : <p className="mt-2 text-xs text-slate-500">Waiting for customer GPS permission and first location update.</p>}
                </section>
                <section className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                  <div className="flex items-center gap-2 font-bold text-blue-800"><MapPin className="h-4 w-4" /> Provider live location</div>
                  {booking.providerLivePoint ? <>
                    <p className="mt-2 text-xs text-slate-600">{booking.providerLivePoint.lat.toFixed(6)}, {booking.providerLivePoint.lng.toFixed(6)}</p>
                    <p className="mt-1 text-xs text-slate-500">{freshness(booking.providerPingAt)}</p>
                    <a className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-blue-800 underline" href={mapUrl(booking.providerLivePoint)} target="_blank" rel="noreferrer">Open provider on map <Navigation className="h-4 w-4" /></a>
                  </> : <p className="mt-2 text-xs text-slate-500">Provider location not received yet.</p>}
                </section>
              </div>
            </article>
          ))}
        </div>
        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400"><RefreshCw className="h-3.5 w-3.5" /> Auto-refresh is active · Customer GPS is shared only while a booking is active.</p>
      </div>
    </main>
  );
}
