"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Loader2, MapPin, Repeat, Zap } from "lucide-react";
import { useApp } from "../../../../components/AppProvider";
import { trackBookingConfirmed } from "../../../../lib/analytics";
import { getService, PROVIDERS } from "../../../../lib/seed";
import { listAddresses, saveAddress, createBooking } from "../../../../lib/store";
import { browserLocation, reverseGeocode } from "../../../../lib/geo";
import type { Address, BookingMode } from "../../../../lib/types";

const SLOTS = [
  "8:00 AM – 9:00 AM",
  "10:00 AM – 11:00 AM",
  "12:00 PM – 1:00 PM",
  "3:00 PM – 4:00 PM",
  "5:00 PM – 6:00 PM",
  "7:00 PM – 8:00 PM",
];

const MODES: Array<{ id: BookingMode; label: string; hint: string; icon: typeof Zap }> = [
  { id: "instant", label: "Instant", hint: "Pro arrives in ~15 min", icon: Zap },
  { id: "scheduled", label: "Scheduled", hint: "Pick a date & slot", icon: CalendarDays },
  { id: "recurring", label: "Recurring", hint: "Repeat weekly", icon: Repeat },
];

function tomorrow(offsetDays = 1) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function BookFlow() {
  const params = useParams<{ serviceId: string; providerId: string }>();
  const router = useRouter();
  const { user, ready } = useApp();

  const service = getService(params.serviceId);
  const provider = PROVIDERS.find((p) => p.id === params.providerId);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState("");
  const [mode, setMode] = useState<BookingMode>("scheduled");
  const [date, setDate] = useState(tomorrow());
  const [slot, setSlot] = useState(SLOTS[0]);
  const [durationChoice, setDurationChoice] = useState<string | null>(null);
  const duration = durationChoice ?? service?.slots?.[1] ?? service?.slots?.[0] ?? "";
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [addingAddress, setAddingAddress] = useState(false);
  const [newAddr, setNewAddr] = useState({ label: "Home", line1: "", city: "", pincode: "" });

  useEffect(() => {
    if (ready && !user) router.replace(`/login?next=/book/${params.serviceId}/${params.providerId}`);
  }, [ready, user, router, params.serviceId, params.providerId]);

  useEffect(() => {
    if (user) void listAddresses(user.id).then((list) => {
      setAddresses(list);
      const def = list.find((a) => a.isDefault) ?? list[0];
      if (def) setAddressId(def.id);
    });
  }, [user]);

  const amount = useMemo(() => {
    if (!service) return 0;
    const DURATION_HOURS: Record<string, number> = {
      "30 minutes": 0.5,
      "1 hour": 1,
      "1.5 hours": 1.5,
      "2 hours": 2,
      "3 hours": 3,
    };
    if (service.unit === "per hour" && service.slots?.length) {
      return Math.round(service.price * (DURATION_HOURS[duration] ?? 1));
    }
    return service.price;
  }, [service, duration]);

  if (!service || !provider) {
    return (
      <div className="section-shell py-16 text-center">
        <h1 className="text-xl font-bold">Booking details not found.</h1>
        <Link href="/services" className="btn-primary mt-4">Browse services</Link>
      </div>
    );
  }

  if (!ready || !user) {
    return (
      <div className="section-shell flex justify-center py-24 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const selectedAddress = addresses.find((a) => a.id === addressId);
  const canConfirm = Boolean(selectedAddress) && !busy;

  async function fillAddressFromLocation() {
    try {
      const point = await browserLocation();
      const geo = await reverseGeocode(point);
      setNewAddr((p) => ({
        ...p,
        line1: p.line1 || geo.label,
        city: p.city || geo.city,
      }));
    } catch {
      /* ignore */
    }
  }

  async function handleConfirm() {
    if (!user || !service || !provider || !selectedAddress) return;
    setBusy(true);
    try {
      const booking = await createBooking({
        userId: user.id,
        phone: user.phone,
        serviceId: service.id,
        serviceName: service.name,
        providerId: provider.id,
        providerName: provider.name,
        address: selectedAddress,
        mode,
        date: mode === "instant" ? new Date().toISOString().slice(0, 10) : date,
        slot: mode === "instant" ? "Arriving in ~15 min" : slot,
        duration: service.slots ? duration : service.duration,
        amount,
        status: mode === "instant" ? "accepted" : "scheduled",
        createdAt: Date.now(),
      });
      trackBookingConfirmed({
        serviceId: booking.serviceId,
        mode: booking.mode,
        amountInr: booking.amount,
      });
      router.push(
        `/profile?tab=${mode === "instant" ? "current" : "upcoming"}&booked=1`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleAddAddress() {
    if (!user || !newAddr.line1 || !newAddr.city) return;
    const saved = await saveAddress(user.id, {
      id: "",
      label: newAddr.label,
      line1: newAddr.line1,
      city: newAddr.city,
      pincode: newAddr.pincode,
      isDefault: addresses.length === 0,
    });
    setAddresses(saved);
    setAddressId(saved[saved.length - 1].id);
    setAddingAddress(false);
    setNewAddr({ label: "Home", line1: "", city: "", pincode: "" });
  }

  return (
    <div className="section-shell py-10">
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Confirm your booking</h1>
      <p className="mt-1.5 text-slate-500">{service.name} with {provider.name}</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* address */}
          <section className="card p-5">
            <h2 className="flex items-center gap-2 font-bold text-slate-900">
              <MapPin className="h-4 w-4 text-blue-600" /> Service address
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {addresses.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAddressId(a.id)}
                  className={
                    addressId === a.id
                      ? "rounded-xl border-2 border-blue-600 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700"
                      : "rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:border-blue-300"
                  }
                >
                  <span className="block font-semibold">{a.label}</span>
                  <span className="block text-xs font-normal text-slate-500">
                    {a.line1}, {a.city}
                  </span>
                </button>
              ))}
              {addresses.length === 0 && !addingAddress && (
                <p className="text-sm text-slate-500">No saved address yet.</p>
              )}
              {!addingAddress && (
                <button
                  type="button"
                  onClick={() => setAddingAddress(true)}
                  className="rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-medium text-blue-600 hover:border-blue-400"
                >
                  + Add address
                </button>
              )}
            </div>

            {addingAddress && (
              <div className="mt-4 rounded-xl bg-slate-50 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    className="field"
                    placeholder="Label (Home / Office)"
                    value={newAddr.label}
                    onChange={(e) => setNewAddr({ ...newAddr, label: e.target.value })}
                  />
                  <input
                    className="field"
                    placeholder="City"
                    value={newAddr.city}
                    onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })}
                  />
                  <input
                    className="field sm:col-span-2"
                    placeholder="Flat, building, street"
                    value={newAddr.line1}
                    onChange={(e) => setNewAddr({ ...newAddr, line1: e.target.value })}
                  />
                  <input
                    className="field"
                    placeholder="Pincode"
                    value={newAddr.pincode}
                    onChange={(e) =>
                      setNewAddr({ ...newAddr, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })
                    }
                  />
                  <button
                    type="button"
                    onClick={() => void fillAddressFromLocation()}
                    className="btn-ghost text-xs"
                  >
                    Use current location
                  </button>
                </div>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => void handleAddAddress()} className="btn-primary py-2">
                    Save address
                  </button>
                  <button type="button" onClick={() => setAddingAddress(false)} className="btn-ghost py-2">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* mode */}
          <section className="card p-5">
            <h2 className="font-bold text-slate-900">When do you need it?</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {MODES.map((m) => {
                const Icon = m.icon;
                const active = mode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    className={
                      active
                        ? "rounded-xl border-2 border-blue-600 bg-blue-50 p-3 text-left"
                        : "rounded-xl border border-slate-200 p-3 text-left hover:border-blue-300"
                    }
                  >
                    <Icon className={`h-4 w-4 ${active ? "text-blue-600" : "text-slate-400"}`} />
                    <span className="mt-1.5 block text-sm font-bold text-slate-900">{m.label}</span>
                    <span className="block text-xs text-slate-500">{m.hint}</span>
                  </button>
                );
              })}
            </div>

            {mode !== "instant" && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700">Date</span>
                  <input
                    type="date"
                    min={mode === "recurring" ? tomorrow() : tomorrow()}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="field"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                    {mode === "recurring" ? "Weekly slot" : "Time slot"}
                  </span>
                  <select value={slot} onChange={(e) => setSlot(e.target.value)} className="field">
                    {SLOTS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {service.slots && (
              <label className="mt-4 block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">Duration</span>
                <select value={duration} onChange={(e) => setDurationChoice(e.target.value)} className="field">
                  {service.slots.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            )}

            <label className="mt-4 block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                Instructions for the Pro (optional)
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="e.g. Please start with the kitchen first."
                className="field resize-none"
              />
            </label>
          </section>
        </div>

        {/* summary */}
        <aside>
          <div className="card sticky top-24 p-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Order summary</h2>
            <div className="mt-4 space-y-3 text-sm">
              <Row label="Service" value={service.name} />
              <Row label="Provider" value={provider.name} />
              <Row
                label="Address"
                value={selectedAddress ? `${selectedAddress.line1}, ${selectedAddress.city}` : "Select above"}
              />
              <Row
                label="Schedule"
                value={
                  mode === "instant"
                    ? "Instant · ~15 min"
                    : `${mode === "recurring" ? "Weekly · " : ""}${date} · ${slot}`
                }
              />
              {service.slots && <Row label="Duration" value={duration} />}
              <Row label="Base price" value={`₹${amount}`} />
              <div className="flex items-center justify-between border-t border-dashed border-slate-200 pt-3">
                <span className="font-bold text-slate-900">Total payable</span>
                <span className="text-xl font-extrabold text-slate-900">₹{amount}</span>
              </div>
            </div>

            <button
              type="button"
              disabled={!canConfirm}
              onClick={() => void handleConfirm()}
              className="btn-accent mt-5 w-full"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {selectedAddress ? "Confirm booking" : "Select an address"}
            </button>
            <p className="mt-3 text-center text-xs text-slate-400">
              You are booking as {user.firstName ? `${user.firstName} ` : ""}
              {user.phone}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function BookPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-sm text-slate-400">Loading…</div>}>
      <BookFlow />
    </Suspense>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value}</span>
    </div>
  );
}
