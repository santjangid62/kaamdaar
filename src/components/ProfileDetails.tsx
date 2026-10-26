"use client";

import { useRef, useState } from "react";
import { Camera, Check, Loader2 } from "lucide-react";
import { useApp } from "./AppProvider";
import { updateUser } from "../lib/store";

export default function ProfileDetails() {
  const { user, signIn, ready } = useApp();
  const [form, setForm] = useState(() => ({
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    email: user?.email ?? "",
  }));
  const [photo, setPhoto] = useState<string | undefined>(user?.photo);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!ready || !user) return null;

  function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function save() {
    setBusy(true);
    try {
      const updated = await updateUser(user!.id, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        photo,
      });
      if (updated) signIn(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setBusy(false);
    }
  }

  const initials =
    `${form.firstName?.[0] ?? ""}${form.lastName?.[0] ?? ""}`.toUpperCase() || user.phone.slice(-2);

  return (
    <section className="card p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-slate-900">Basic details</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          Profile completion {user.firstName && user.email ? "100%" : user.firstName ? "75%" : "50%"}
        </span>
      </div>

      <div className="mt-5 flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-blue-600 text-white"
          title="Change photo"
        >
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="Profile" className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center text-2xl font-bold">{initials}</span>
          )}
          <span className="absolute inset-0 grid place-items-center bg-black/40 opacity-0 transition group-hover:opacity-100">
            <Camera className="h-6 w-6" />
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
        <div>
          <p className="text-lg font-bold text-slate-900">
            {user.firstName ? `${user.firstName} ${user.lastName}`.trim() : "Complete your profile"}
          </p>
          <p className="text-sm text-slate-500">+91 {user.phone.replace("+91", "")}</p>
          <p className="mt-0.5 text-xs text-slate-400">
            Tap the photo to upload a profile picture
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">First name *</span>
          <input
            className="field"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            placeholder="Aditi"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Last name *</span>
          <input
            className="field"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            placeholder="Sharma"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Mobile number</span>
          <input className="field bg-slate-50 text-slate-500" value={user.phone} readOnly />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">
            Email <span className="font-normal text-slate-400">(optional)</span>
          </span>
          <input
            className="field"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@example.com"
          />
        </label>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || !form.firstName.trim() || !form.lastName.trim()}
          className="btn-primary"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Save details
        </button>
        {!form.firstName.trim() && (
          <span className="text-xs text-slate-400">First and last name are required</span>
        )}
        {saved && (
          <span className="flex items-center gap-1 text-sm font-medium text-green-600">
            <Check className="h-4 w-4" /> Saved
          </span>
        )}
      </div>
    </section>
  );
}
