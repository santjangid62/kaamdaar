"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check, Loader2 } from "lucide-react";
import { useApp } from "./AppProvider";
import { useLang } from "../lib/i18n";
import { updateUser } from "../lib/store";
import { isValidEmail, isValidName } from "../lib/validation";

export default function ProfileDetails() {
  const { user, signIn, ready } = useApp();
  const { s } = useLang();
  const [form, setForm] = useState(() => ({
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    email: user?.email ?? "",
  }));
  const [photo, setPhoto] = useState<string | undefined>(user?.photo);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    setForm({ firstName: user.firstName ?? "", lastName: user.lastName ?? "", email: user.email ?? "" });
    setPhoto(user.photo);
  }, [user]);

  if (!ready || !user) return null;

  function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setSaveError("Please choose a valid image file."); return; }
    if (file.size > 8 * 1024 * 1024) { setSaveError("Please choose an image smaller than 8 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const image = new window.Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 640 / Math.max(image.width, image.height));
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) { setSaveError("Could not process this image."); return; }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        setPhoto(canvas.toDataURL("image/jpeg", 0.82));
        setSaveError(null);
      };
      image.onerror = () => setSaveError("Could not read this image.");
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function save(): Promise<boolean> {
    const next: Record<string, string> = {};
    if (!isValidName(form.firstName)) next.firstName = s.validation.invalidName;
    if (!isValidName(form.lastName)) next.lastName = s.validation.invalidName;
    if (form.email.trim() && !isValidEmail(form.email)) next.email = s.validation.invalidEmail;
    setErrors(next);
    if (Object.keys(next).length > 0) return false;
    setBusy(true);
    setSaveError(null);
    setSaved(false);
    try {
      const updated = await updateUser(user!.id, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        photo,
      });
      signIn(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      return true;
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Profile could not be saved. Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const initials =
    `${form.firstName?.[0] ?? ""}${form.lastName?.[0] ?? ""}`.toUpperCase() || user.phone.slice(-2);

  return (
    <section className="card p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-slate-900">{s.profile.basic}</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {s.profile.completion} {user.firstName && user.email ? "100%" : user.firstName ? "75%" : "50%"}
        </span>
      </div>

      <div className="mt-5 flex items-center gap-4">
        <button
          type="button"
          onClick={() => editing && fileRef.current?.click()}
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
            {user.firstName ? `${user.firstName} ${user.lastName}`.trim() : s.profile.completeNow}
          </p>
          <p className="text-sm text-slate-500">+91 {user.phone.replace("+91", "")}</p>
          <p className="mt-0.5 text-xs text-slate-400">{s.profile.tapPhoto}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">{s.profile.firstName}</span>
          <input
            className={`field ${errors.firstName ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}`}
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            disabled={!editing}
            placeholder="Aditi"
          />
          {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName}</p>}
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">{s.profile.lastName}</span>
          <input
            className={`field ${errors.lastName ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}`}
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            disabled={!editing}
            placeholder="Sharma"
          />
          {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName}</p>}
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">{s.profile.mobile}</span>
          <input className="field bg-slate-50 text-slate-500" value={user.phone} readOnly />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">
            {s.profile.email}
          </span>
          <input
            className={`field ${errors.email ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}`}
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            disabled={!editing}
            placeholder="you@example.com"
          />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
        </label>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={async () => { if (!editing) { setEditing(true); setSaved(false); return; } if (await save()) setEditing(false); }}
          disabled={busy || (editing && (!form.firstName.trim() || !form.lastName.trim()))}
          className="btn-primary"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? <Check className="h-4 w-4" /> : null}
          {editing ? "Save" : "Edit"}
        </button>
        {!form.firstName.trim() && (
          <span className="text-xs text-slate-400">{s.profile.required}</span>
        )}
        {saveError && <p role="alert" className="text-sm font-medium text-red-600">{saveError}</p>}
        {saved && (
          <span className="flex items-center gap-1 text-sm font-medium text-green-600">
            <Check className="h-4 w-4" /> {s.profile.saved}
          </span>
        )}
      </div>
    </section>
  );
}
