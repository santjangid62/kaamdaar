"use client";

import { useEffect, useState } from "react";
import { Loader2, MapPin, Plus, Star, Trash2 } from "lucide-react";
import { useApp } from "./AppProvider";
import { deleteAddress, listAddresses, saveAddress } from "../lib/store";
import { browserLocation, reverseGeocode } from "../lib/geo";
import type { Address } from "../lib/types";

const empty = { label: "Home", line1: "", line2: "", city: "", pincode: "" };

export default function AddressBook() {
  const { user } = useApp();
  const [list, setList] = useState<Address[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (user) void listAddresses(user.id).then(setList);
  }, [user]);

  async function detect() {
    setBusy(true);
    try {
      const point = await browserLocation();
      const geo = await reverseGeocode(point);
      setForm((f) => ({
        ...f,
        line1: f.line1 || geo.label.split(",")[0],
        city: f.city || geo.city,
      }));
      setCoords({ lat: geo.lat, lng: geo.lng });
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    if (!user || !form.line1 || !form.city) return;
    setBusy(true);
    try {
      const next = await saveAddress(user.id, {
        id: "",
        label: form.label || "Home",
        line1: form.line1,
        line2: form.line2,
        city: form.city,
        pincode: form.pincode,
        lat: coords?.lat,
        lng: coords?.lng,
        isDefault: list.length === 0,
      });
      setList(next);
      setForm(empty);
      setCoords(null);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!user) return;
    setList(await deleteAddress(user.id, id));
  }

  async function makeDefault(addr: Address) {
    if (!user) return;
    // rewrite every row so exactly one address is marked default
    let next: Address[] = [];
    for (const a of list) {
      next = await saveAddress(user.id, { ...a, isDefault: a.id === addr.id });
    }
    setList(next);
  }

  if (!user) return null;

  return (
    <section className="card p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-slate-900">Saved addresses</h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 text-sm font-semibold text-blue-600 hover:underline"
        >
          <Plus className="h-4 w-4" /> Add address
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {list.length === 0 && !open && (
          <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
            No addresses saved yet. Add Home, Office or any place you book for.
          </p>
        )}

        {list.map((a) => (
          <div key={a.id} className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
                {a.label}
                {a.isDefault && (
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-blue-700">
                    Default
                  </span>
                )}
              </p>
              <p className="truncate text-sm text-slate-500">
                {a.line1}
                {a.line2 ? `, ${a.line2}` : ""}, {a.city}
                {a.pincode ? ` – ${a.pincode}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {!a.isDefault && (
                <button
                  type="button"
                  onClick={() => void makeDefault(a)}
                  title="Make default"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600"
                >
                  <Star className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => void remove(a.id)}
                title="Delete"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {open && (
        <div className="mt-4 rounded-xl bg-slate-50 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className="field"
              placeholder="Label (Home / Office / Other)"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
            />
            <input
              className="field"
              placeholder="City"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
            <input
              className="field sm:col-span-2"
              placeholder="Flat, building, street"
              value={form.line1}
              onChange={(e) => setForm({ ...form, line1: e.target.value })}
            />
            <input
              className="field"
              placeholder="Area / landmark (optional)"
              value={form.line2}
              onChange={(e) => setForm({ ...form, line2: e.target.value })}
            />
            <input
              className="field"
              placeholder="Pincode"
              value={form.pincode}
              onChange={(e) => setForm({ ...form, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => void detect()} className="btn-ghost py-2 text-xs" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
              Use current location
            </button>
            <button
              type="button"
              onClick={() => void add()}
              disabled={busy || !form.line1 || !form.city}
              className="btn-primary py-2 text-xs"
            >
              Save address
            </button>
            <button type="button" onClick={() => setOpen(false)} className="py-2 text-xs text-slate-500">
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}