"use client";

import { useState } from "react";
import type { Address, GeoResult, Service, User } from "../lib/types";

type Slot = { start: string; end: string; availableProviderCount: number };

export default function KaamdaarBookingFlow({ user, services, location, lang }: {
  user: User | null; services: Service[]; location: GeoResult | null; lang: "hi" | "en";
}) {
  const [step, setStep] = useState<"service" | "mode" | "date" | "slot" | "address" | "confirm" | "done">("service");
  const [serviceId, setServiceId] = useState("");
  const [mode, setMode] = useState<"instant" | "scheduled">("instant");
  const [date, setDate] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slot, setSlot] = useState("ASAP");
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [address, setAddress] = useState<Address | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [bookingId, setBookingId] = useState("");
  const hi = lang === "hi";
  const selectedService = services.find((service) => service.id === serviceId);

  async function loadAddresses() {
    if (!user) { setError(hi ? "बुकिंग के लिए पहले लॉगिन करें।" : "Please log in before booking."); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(user.id)}/addresses`, { credentials: "same-origin", cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load saved addresses");
      const list = (data.addresses ?? []) as Address[];
      setAddresses(list);
      setAddress(list.find((item) => item.isDefault) ?? list[0] ?? null);
      setStep("address");
    } catch (e) { setError(e instanceof Error ? e.message : "Address lookup failed"); }
    finally { setBusy(false); }
  }

  async function loadSlots() {
    if (!location) { setError(hi ? "पहले अपनी Jaipur location allow करें।" : "Please allow your Jaipur location first."); return; }
    setBusy(true); setError("");
    try {
      const params = new URLSearchParams({ serviceId, date, lat: String(location.lat), lng: String(location.lng) });
      const response = await fetch(`/api/booking-slots?${params.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load available slots");
      const actual = (data.slots ?? []) as Slot[];
      setSlots(actual);
      setStep("slot");
      if (!actual.length) setError(hi ? "इस तारीख को कोई provider slot उपलब्ध नहीं है। दूसरी तारीख चुनें।" : "No provider slots are available on this date. Choose another date.");
    } catch (e) { setError(e instanceof Error ? e.message : "Slot lookup failed"); }
    finally { setBusy(false); }
  }

  async function createBooking() {
    if (!user || !selectedService || !address) return;
    if (!address.lat || !address.lng) { setError(hi ? "इस saved address में map location नहीं है। Profile में address location update करें।" : "This saved address has no map pin. Update its location in your profile first."); return; }
    if (!location && !(address.lat && address.lng)) { setError(hi ? "सेवा location आवश्यक है।" : "A service location is required."); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/bookings", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId, address, mode, date, slot,
          originPoint: { lat: address.lat, lng: address.lng },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Booking could not be created");
      setBookingId(String(data.booking?.id ?? ""));
      setStep("done");
    } catch (e) { setError(e instanceof Error ? e.message : "Booking failed"); }
    finally { setBusy(false); }
  }

  if (step === "done") return <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{hi ? "आपकी booking request भेज दी गई है।" : "Your booking request has been sent."} {bookingId && <strong className="block">Booking ID: {bookingId}</strong>} <span className="block text-xs">{hi ? "Provider confirmation का इंतज़ार करें।" : "Please wait for a provider to respond."}</span></div>;

  return <section className="mx-3 mb-3 rounded-2xl border border-blue-200 bg-white p-3 text-sm">
    <div className="mb-2 flex items-center justify-between"><strong>{hi ? "Kaamdaar Bot · Booking" : "Kaamdaar Bot · Booking"}</strong><button type="button" className="text-xs text-slate-500" onClick={() => { setStep("service"); setError(""); }}>{hi ? "रीसेट" : "Reset"}</button></div>
    {step === "service" && <><p className="mb-2">{hi ? "कौन-सी सेवा चाहिए?" : "Which service do you need?"}</p><div className="grid max-h-36 grid-cols-2 gap-2 overflow-y-auto">{services.filter(s => s.availableInArea !== false).map(s => <button key={s.id} onClick={() => { setServiceId(s.id); setStep("mode"); }} className="rounded-lg border p-2 text-left hover:border-blue-500">{hi && s.nameHi ? s.nameHi : s.name}<span className="block text-xs text-slate-500">₹{s.price} · {s.duration}</span></button>)}</div></>}
    {step === "mode" && <><p className="mb-2">{hi ? "कब सेवा चाहिए?" : "When do you need the service?"}</p><div className="flex gap-2"><button onClick={() => { setMode("instant"); setDate(new Date().toLocaleDateString("en-CA")); setSlot("ASAP"); void loadAddresses(); }} className="flex-1 rounded-lg border p-2">{hi ? "अभी बुक करें" : "Book now"}</button><button onClick={() => { setMode("scheduled"); setStep("date"); }} className="flex-1 rounded-lg border p-2">{hi ? "Schedule करें" : "Schedule"}</button></div></>}
    {step === "date" && <><label className="mb-2 block">{hi ? "तारीख चुनें" : "Choose a date"}</label><input type="date" min={new Date().toLocaleDateString("en-CA")} value={date} onChange={e => setDate(e.target.value)} className="mb-2 w-full rounded-lg border p-2"/><button disabled={!date || busy} onClick={() => void loadSlots()} className="w-full rounded-lg bg-blue-600 p-2 font-semibold text-white disabled:opacity-50">{hi ? "वास्तविक slots देखें" : "Check live slots"}</button></>}
    {step === "slot" && <><p className="mb-2">{hi ? "उपलब्ध provider slots" : "Available provider slots"}</p>{slots.map(s => <button key={s.start} onClick={() => { setSlot(s.start); void loadAddresses(); }} className="mb-1 flex w-full justify-between rounded-lg border p-2 text-left hover:border-blue-500"><span>{s.start} – {s.end}</span><span className="text-xs text-emerald-700">{s.availableProviderCount} {hi ? "provider" : "providers"}</span></button>)}</>}
    {step === "address" && <><p className="mb-2">{hi ? "सेवा का पता चुनें" : "Choose service address"}</p>{addresses.length ? addresses.map(a => <button key={a.id} onClick={() => { setAddress(a); setStep("confirm"); }} className="mb-1 w-full rounded-lg border p-2 text-left">{a.label}{a.isDefault ? " · Default" : ""}<span className="block text-xs text-slate-500">{a.line1}, {a.city} {a.pincode}</span></button>) : <p>{hi ? "कोई saved address नहीं मिला। Profile में address जोड़कर फिर कोशिश करें।" : "No saved address found. Add one in your profile and try again."}</p>}</>}
    {step === "confirm" && selectedService && address && <><p>{hi ? "Booking details जाँचें:" : "Review your booking:"}</p><div className="my-2 rounded-lg bg-slate-50 p-2 text-xs"><strong>{selectedService.name}</strong><br/>{mode === "instant" ? (hi ? "अभी" : "Now") : date + " · " + slot}<br/>{address.label}: {address.line1}, {address.city}<br/>{hi ? "दिखाया गया शुरुआती रेट" : "Displayed starting rate"}: ₹{selectedService.price}</div><p className="mb-2 text-xs text-slate-500">{hi ? "अंतिम कीमत server catalogue से तय होगी। Confirm करने पर provider dispatch request बनेगी।" : "Final amount is calculated by the server catalogue. Confirming sends the provider dispatch request."}</p><button disabled={busy} onClick={() => void createBooking()} className="w-full rounded-lg bg-emerald-600 p-2 font-semibold text-white disabled:opacity-50">{hi ? "हाँ, booking confirm करें" : "Yes, confirm booking"}</button></>}
    {busy && <p className="mt-2 text-xs text-slate-500">{hi ? "कृपया प्रतीक्षा करें…" : "Please wait…"}</p>}
    {error && <p role="alert" className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">{error}</p>}
  </section>;
}
