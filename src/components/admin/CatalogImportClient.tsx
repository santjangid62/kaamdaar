"use client";

import { useState } from "react";
import { UploadCloud, CheckCircle2, AlertCircle, FileSpreadsheet } from "lucide-react";

type Result = { categories: number; subcategories: number; services: number };

export default function CatalogImportClient() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  async function importFile() {
    if (!file) { setError("Please select the catalogue CSV file first."); return; }
    setBusy(true); setError(""); setResult(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/admin/catalog/import", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Import failed");
      setResult(data.imported);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally { setBusy(false); }
  }

  return <div className="mx-auto max-w-4xl space-y-6">
    <div>
      <p className="text-sm font-semibold uppercase tracking-wider text-orange-600">Catalogue management</p>
      <h1 className="mt-1 text-2xl font-extrabold text-slate-900">Import Excel Catalogue</h1>
      <p className="mt-2 text-sm text-slate-600">Upload the converted CSV to import categories, subcategories and editable demo service listings into the connected database.</p>
    </div>
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <FileSpreadsheet className="h-8 w-8 text-emerald-600"/>
        <div><p className="font-bold text-slate-900">Kaamdaar catalogue CSV</p><p className="text-xs text-slate-500">Expected: 120 categories and 1,207 rows</p></div>
      </div>
      <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center hover:border-blue-400">
        <UploadCloud className="h-9 w-9 text-slate-500"/>
        <span className="mt-2 text-sm font-semibold text-slate-800">{file ? file.name : "Choose catalogue CSV"}</span>
        <span className="mt-1 text-xs text-slate-500">CSV format only</span>
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={e => {setFile(e.target.files?.[0] ?? null);setResult(null);setError("");}}/>
      </label>
      <button type="button" onClick={importFile} disabled={!file || busy} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
        <UploadCloud className="h-4 w-4"/>{busy ? "Importing catalogue…" : "Import catalogue"}
      </button>
    </div>
    {error && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0"/>{error}</div>}
    {result && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
      <div className="flex items-center gap-2 font-bold text-emerald-800"><CheckCircle2 className="h-5 w-5"/>Catalogue imported successfully</div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        {Object.entries(result).map(([label,count])=><div key={label} className="rounded-lg bg-white p-3"><div className="text-2xl font-extrabold text-slate-900">{count}</div><div className="text-xs capitalize text-slate-500">{label}</div></div>)}
      </div>
      <p className="mt-4 text-xs text-emerald-800">Demo prices, durations and descriptions are placeholders. Review every service before enabling real customer bookings.</p>
    </div>}
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <strong>Important:</strong> This import is safe to repeat for the Excel-generated IDs and will update those catalogue records. It does not delete customers, bookings, providers or unrelated admin-created records. All imported prices and descriptions are marked as demo placeholders.
    </div>
  </div>;
}
