"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, MapPin, Plus, Star, Trash2 } from "lucide-react";
import { useApp } from "./AppProvider";
import { useLang } from "../lib/i18n";
import { deleteAddress, listAddresses, saveAddress } from "../lib/store";
import { browserLocation, reverseGeocode } from "../lib/geo";
import {
  isValidIndianPin,
  isValidPlaceName,
} from "../lib/validation";
import type { Address } from "../lib/types";

const empty = { label: "Home", line1: "", line2: "", city: "", pincode: "" };

export default function AddressBook() {
  const { user } = useApp();
  const { s } = useLang();
  const [list, setList] = useState<Address[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [detected, setDetected] = useState(false);
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user) void listAddresses(user.id).then(setList);
  }, [user]);

  async function detect() {
    setBusy(true);
    setErrors((e) => ({ ...e, geo: "" }));
    try {
      const point = await browserLocation();
      const geo = await reverseGeocode(point);
      setForm((f) => ({
        ...f,
        line1: f.line1 || geo.label.split(",")[0],
        pincode: geo.pincode || f.pincode,
        city: f.city || geo.city,
      }));
      setCoords({ lat: geo.lat, lng: geo.lng });
      setDetected(true);
    } catch {
      setErrors((e) => ({ ...e, geo: s.address.detectFail }));
    } finally {
      setBusy(false);
    }
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (form.line1.trim().length < 3) next.line1 = s.address.line1Required;
    if (!isValidPlaceName(form.city)) next.city = s.validation.invalidPlace;
    if (!isValidIndianPin(form.pincode)) next.pincode = s.validation.invalidPin;
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function add() {
    if (!user || !validate()) return;
    if (list.length >= 5) { setMessage("You can save a maximum of 5 addresses."); return; }
    setBusy(true);
    try {
      const next = await saveAddress(user.id, {
        id: "",
        label: form.label.trim() || "Home",
        line1: form.line1.trim(),
        line2: form.line2.trim(),
        city: form.city.trim(),
        pincode: form.pincode,
        lat: coords?.lat,
        lng: coords?.lng,
        isDefault: list.length === 0,
      });
      setList(next);
      setForm(empty);
      setCoords(null);
      setDetected(false);
      setErrors({});
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
        <h2 className="font-bold text-slate-900">{s.address.title}</h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 text-sm font-semibold text-blue-600 hover:underline"
        >
          <Plus className="h-4 w-4" /> {list.length >= 5 ? "5/5 addresses saved" : s.address.add}
        </button>
      </div>

      {message && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{message}</p>}\n      <div className="mt-4 space-y-3">
        {list.length === 0 && !open && (
          <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
            {s.address.empty}
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
                    {s.address.default}
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
                  title={s.address.makeDefault}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600"
                >
                  <Star className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => void remove(a.id)}
                title={s.address.del}
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
              placeholder={s.booking.labelPlaceholder}
              value={form.label}
              maxLength={20}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
            />
            <div>
              <input
                className={`field ${errors.city ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}`}
                placeholder={s.booking.cityLabel}
                value={form.city}
                readOnly
                className="field bg-slate-100 text-slate-600"
              />
              {errors.city && <p className="mt-1 text-xs text-red-600">{errors.city}</p>}
            </div>
            <div className="sm:col-span-2">
              <input
                className={`field ${errors.line1 ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}`}
                placeholder="Area / locality (auto detected)"
                value={form.line1}
                readOnly
                className="field bg-slate-100 text-slate-600"
              />
              {errors.line1 && <p className="mt-1 text-xs text-red-600">{errors.line1}</p>}
            </div>
            <input
              className="field"
              placeholder={s.booking.landmarkLabel}
              value={form.line2}
              onChange={(e) => setForm({ ...form, line2: e.target.value })}
            />
            <div>
              <input
                className={`field ${errors.pincode ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}`}
                placeholder={s.booking.pincodeLabel}
                inputMode="numeric"
                value={form.pincode}
                readOnly
                className="field bg-slate-100 text-slate-600"
                onChange={(e) => {
                  setErrors((prev) => ({ ...prev, pincode: "" }));
                  setForm({ ...form, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) });
                }}
              />
              {errors.pincode ? (
                <p className="mt-1 text-xs text-red-600">{errors.pincode}</p>
              ) : (
                <p className="mt-1 text-[11px] text-slate-400">110001 – 855117</p>
              )}
            </div>
          </div>
          {errors.geo && <p className="mt-2 text-xs text-red-600">{errors.geo}</p>}
          {detected && !errors.geo && (
            <p className="mt-2 flex items-center gap-1 text-xs font-medium text-green-600">
              <Check className="h-3.5 w-3.5" /> {s.address.detectOk}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => void detect()} className="btn-ghost py-2 text-xs" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
              {s.booking.useLocation}
            </button>
            <button
              type="button"
              onClick={() => void add()}
              disabled={busy}
              className="btn-primary py-2 text-xs"
            >
              {s.booking.saveAddr}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="py-2 text-xs text-slate-500">
              {s.booking.cancel}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
