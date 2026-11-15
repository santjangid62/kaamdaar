"use client";

/**
 * Generic section view backed by the database: header, KPI strip, searchable
 * table with pagination, and real Add / Edit / Delete mutations against
 * /api/admin/data/:collection when the section is editable.
 */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Pencil, Plus, Search, Trash2, X, Sparkles, RefreshCw } from "lucide-react";
import type { Field, SectionDef } from "../../lib/admin/types";
import { useApp } from "../AppProvider";
import { BookingTable, Pager } from "./widgets";

const PAGE_SIZE = 10;

type FormState = Record<string, string>;

function initialForm(def: SectionDef, row?: Record<string, string | number>): FormState {
  const state: FormState = {};
  for (const f of def.fields ?? []) {
    const value = row?.[f.key];
    if (value === undefined || value === null) {
      state[f.key] = "";
    } else if (f.type === "list" && Array.isArray(value)) {
      state[f.key] = (value as unknown as string[]).join("\n");
    } else {
      state[f.key] = String(value);
    }
  }
  return state;
}

function toPayload(def: SectionDef, form: FormState): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const f of def.fields ?? []) {
    if (f.readonly) continue;
    const raw = (form[f.key] ?? "").trim();
    if (f.type === "number") {
      const n = Number(raw);
      // leave empty numbers out — the server applies its default (e.g. order)
      if (raw === "" || !Number.isFinite(n)) continue;
      payload[f.key] = n;
    } else if (f.type === "toggle") {
      payload[f.key] = raw === "true" || raw === "on";
    } else if (f.type === "list") {
      payload[f.key] = raw
        .split("\n")
        .map((line) => line.trim().replace(/^[•\-]\s*/, ""))
        .filter(Boolean);
    } else if (f.key === "services") {
      payload[f.key] = raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : [];
    } else {
      payload[f.key] = raw;
    }
  }
  return payload;
}

function FieldInput({ field, value, onChange }: { field: Field; value: string; onChange: (v: string) => void }) {
  if (field.type === "toggle") {
    return (
      <button
        type="button"
        onClick={() => onChange(value === "true" ? "false" : "true")}
        className={`flex h-10 w-full items-center gap-2 rounded-xl border px-3 text-sm font-semibold ${
          value === "true" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-500"
        }`}
      >
        <span className={`h-4 w-7 rounded-full p-0.5 transition ${value === "true" ? "bg-emerald-500" : "bg-slate-300"}`}>
          <span className={`block h-3 w-3 rounded-full bg-white transition ${value === "true" ? "translate-x-3" : ""}`} />
        </span>
        {value === "true" ? "On" : "Off"}
      </button>
    );
  }
  if (field.type === "select") {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400"
      >
        <option value="">{field.required ? "— select —" : "— none —"}</option>
        {(field.options ?? []).map((o) => {
          const opt = typeof o === "string" ? { value: o, label: o } : o;
          return (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          );
        })}
      </select>
    );
  }
  if (field.type === "textarea" || field.type === "list") {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={field.type === "list" ? 4 : 3}
        placeholder={field.type === "list" ? "Ek point per line…" : undefined}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
      />
    );
  }
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      readOnly={field.readonly}
      inputMode={field.type === "number" ? "numeric" : undefined}
      className={`h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-400 ${
        field.readonly ? "bg-slate-100 text-slate-500" : "bg-white"
      }`}
    />
  );
}

export default function SectionClient({ def }: { def: SectionDef }) {
  const router = useRouter();
  const { refreshCatalog } = useApp();
  const [liveRows, setLiveRows] = useState(def.rows);
  const [liveKpis, setLiveKpis] = useState(def.kpis ?? []);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<{ mode: "add" | "edit"; row?: Record<string, string | number> } | null>(null);
  const [form, setForm] = useState<FormState>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const refreshCustomers = async () => {
    if (!def.collection) return;
    setRefreshing(true);
    try {
      const res = await fetch(`/api/admin/${def.title.toLowerCase().replace(/\s+/g, "-")}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json() as { rows?: SectionDef["rows"]; kpis?: SectionDef["kpis"] };
      if (Array.isArray(data.rows)) setLiveRows(data.rows);
      if (Array.isArray(data.kpis)) setLiveKpis(data.kpis);
      setLastSynced(new Date());
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!def.collection) return;
    void refreshCustomers();
    const timer = window.setInterval(() => void refreshCustomers(), 15000);
    const onFocus = () => void refreshCustomers();
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [def.collection, def.title]);

  const editable = Boolean(def.collection && !def.readOnly && def.fields?.length);
  const canAdd = editable && !def.noAdd;
  const canDelete = editable && !def.noDelete;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return liveRows;
    return liveRows.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(needle)));
  }, [liveRows, q]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  function openAdd() {
    // sensible defaults for new rows: visibility toggles on, others off
    setForm({
      ...initialForm(def),
      ...(def.fields ?? []).reduce<FormState>((acc, f) => {
        if (f.type === "toggle") acc[f.key] = f.key === "active" ? "true" : "false";
        else if (f.default !== undefined) acc[f.key] = f.default;
        return acc;
      }, {}),
    });
    setError(null);
    setModal({ mode: "add" });
  }

  function openEdit(row: Record<string, string | number>) {
    setForm(initialForm(def, row));
    setError(null);
    setModal({ mode: "edit", row });
  }

  function captureProviderLocation() {
    if (!navigator.geolocation) {
      setError("This browser does not support location capture. Enter latitude and longitude manually.");
      return;
    }
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => setForm((s) => ({
        ...s,
        lat: String(position.coords.latitude),
        lng: String(position.coords.longitude),
      })),
      (err) => setError(err.code === err.PERMISSION_DENIED
        ? "Location permission denied. Allow location access or enter coordinates manually."
        : "Could not get current location. Try again or enter coordinates manually."),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  async function submit() {
    if (!def.collection || !modal) return;
    const missing = (def.fields ?? []).find(
      (f) => f.required && !f.readonly && !(form[f.key] ?? "").trim(),
    );
    if (missing) {
      setError(`“${missing.label}” is required — ${missing.help ?? "please fill it in"}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = toPayload(def, form);
      const base = `/api/admin/data/${def.collection}`;
      if (modal.mode === "add") {
        const res = await fetch(base, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Create failed");
        setNotice(`Added to ${def.title}`);
      } else {
        const id = String(modal.row?.id ?? "");
        const res = await fetch(`${base}/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Update failed");
        setNotice(`Updated ${def.title}`);
      }
      setModal(null);
      if (def.collection === "settings") await refreshCatalog();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeRow(row: Record<string, string | number>) {
    if (!def.collection) return;
    const label = String(row.name ?? row.title ?? row.key ?? row.id);
    if (!window.confirm(`Delete “${label}”? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/data/${def.collection}/${encodeURIComponent(String(row.id))}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      setNotice(`Deleted “${label}”`);
      if (def.collection === "settings") await refreshCatalog();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  const bulkScope =
    def.title === "Categories" ? "categories" :
    def.title === "Services" ? "services" :
    def.title === "Sub Services" ? "sub-services" : null;

  async function bulkDeleteCatalogue() {
    if (!bulkScope) return;
    const typed = window.prompt(`This will permanently delete all ${def.title.toLowerCase()} from the catalogue. Type DELETE to continue.`);
    if (typed !== "DELETE") return;
    setBulkBusy(true); setError(null); setNotice(null);
    try {
      const res = await fetch("/api/admin/catalog/bulk-delete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: bulkScope, confirm: "DELETE CATALOGUE" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Bulk delete failed");
      setNotice(`Removed ${data.deleted.categories} categories and ${data.deleted.services} services/sub-services. Booking history was preserved.`);
      await refreshCustomers();
      if (def.collection === "categories" || def.collection === "services") await refreshCatalog();
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Bulk delete failed"); }
    finally { setBulkBusy(false); }
  }

  const actionCol: import("../../lib/admin/types").Column = { key: "__actions", label: "" };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-navy">{def.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{def.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder={`Search ${def.title.toLowerCase()}...`}
              className="w-40 bg-transparent text-xs outline-none placeholder:text-slate-400 sm:w-56"
            />
          </label>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </button>
          {canAdd && (
            <button
              type="button"
              onClick={openAdd}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          )}
          {bulkScope && (
            <button type="button" onClick={() => void bulkDeleteCatalogue()} disabled={bulkBusy || liveRows.length === 0}
              className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50">
              <Trash2 className="h-3.5 w-3.5" /> {bulkBusy ? "Removing…" : `Delete all ${def.title}`}
            </button>
          )}
        </div>
      </div>

      {def.collection && <div className="flex justify-end"><button type="button" onClick={() => void refreshCustomers()} disabled={refreshing} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600"><RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`}/> {lastSynced ? `Synced ${lastSynced.toLocaleTimeString("en-IN")}` : "Refresh list"}</button></div>}\n\n      {(notice || error) && (
        <p
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            error ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {error ?? notice}
          <button type="button" className="ml-2 underline" onClick={() => { setNotice(null); setError(null); }}>
            dismiss
          </button>
        </p>
      )}

      {liveKpis && liveKpis.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          {liveKpis.map((k) => (
            <div key={k.label} className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold text-slate-500">{k.label}</p>
              <p className="mt-1 text-xl font-extrabold text-navy">{k.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">
            {q ? `No matches for “${q}”.` : "Nothing here yet — records appear as the platform is used."}
          </p>
        ) : (
          <BookingTable
            rows={rows}
            columns={[...def.columns, ...(editable ? [actionCol] : [])]}
            actions={
              editable
                ? (row) => (
                    <span className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeRow(row)}
                        style={canDelete ? undefined : { display: "none" }}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  )
                : undefined
            }
          />
        )}
        <div className="mt-2 border-t border-slate-100 pt-3">
          <Pager total={filtered.length} shown={PAGE_SIZE} page={current} onPageChange={setPage} />
        </div>
      </div>

      {/* add / edit modal */}
      {modal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setModal(null)}>
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-navy">
                {modal.mode === "add" ? `Add ${def.title.replace(/s$/, "")}` : `Edit ${def.title.replace(/s$/, "")}`}
              </h2>
              <button type="button" onClick={() => setModal(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(def.fields ?? []).map((f) => (
                <label
                  key={f.key}
                  className={f.full || f.type === "textarea" || f.type === "list" ? "sm:col-span-2" : ""}
                >
                  <span className="mb-1 block text-xs font-semibold text-slate-500">
                    {f.label}
                    {f.required && <span className="ml-0.5 text-red-500">*</span>}
                  </span>
                  <div className="space-y-1"><FieldInput field={f} value={form[f.key] ?? ""} onChange={(v) => setForm((s) => ({ ...s, [f.key]: v }))} />{def.collection === "providers" && f.key === "lat" && <button type="button" onClick={captureProviderLocation} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-semibold text-blue-700">Use current GPS location (fills both coordinates)</button>}{(["textarea","list"].includes(f.type ?? "") || /description|tagline|include|exclude|answer|title|question/i.test(f.key)) && <button type="button" disabled={!!generating} onClick={() => void (async () => { setGenerating(f.key); setError(null); try { const r = await fetch("/api/ai/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ section: def.title, field: f.label, fieldKey: f.key, serviceName: form.name || form.title || form.q || "", category: form.category || "", context: form.description || "", language: "simple English", format: f.type === "list" ? "list" : "text" }) }); const d = await r.json() as { content?: string; error?: string }; if (!r.ok || !d.content) throw new Error(d.error || "AI generation failed"); setForm(s => ({ ...s, [f.key]: d.content! })); } catch (e) { setError(e instanceof Error ? e.message : "AI generation failed"); } finally { setGenerating(null); } })()} className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[11px] font-semibold text-violet-700 disabled:opacity-50"><Sparkles className="h-3 w-3"/>{generating === f.key ? "Generating…" : "AI Generate"}</button>}</div>
                  {f.help && (
                    <span className="mt-1 block text-[11px] leading-4 text-slate-400">{f.help}</span>
                  )}
                </label>
              ))}
            </div>

            {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setModal(null)} className="btn-ghost">
                Cancel
              </button>
              <button type="button" onClick={() => void submit()} disabled={busy} className="btn-primary">
                {busy ? "Saving…" : modal.mode === "add" ? "Create" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
