"use client";

import { useState } from "react";
import { UploadCloud, CheckCircle2, AlertCircle, FileSpreadsheet } from "lucide-react";

type Result = { categories: number; subcategories: number; services: number };

export default function CatalogImportClient() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  function downloadTemplate() {
    const headers = ["category_id","category_name_en","category_name_hi","category_order","service_id","service_name_en","service_name_hi","service_price","service_duration_minutes","service_unit","service_tagline","service_description_en","service_description_hi","service_order","sub_service_id","sub_service_name_en","sub_service_name_hi","sub_service_price","sub_service_duration_minutes","sub_service_unit","sub_service_tagline","sub_service_description_en"];
    const sample = ["hair-beauty","Hair & Beauty","हेयर और ब्यूटी","1","haircut","Hair Cutting","हेयर कटिंग","299","45","per task","Professional haircut","Hair cutting service","बाल काटने की सेवा","1","kids-haircut","Kids Haircut","बच्चों के बाल कटिंग","149","20","per task","Gentle haircut for kids","Haircut add-on for children"];
    const csv = [headers, sample].map(row => row.map(v => `"${v.replace(/"/g, '""')}"`).join(",")).join("\\r\\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "kaamdaar-catalogue-template.csv"; a.click(); URL.revokeObjectURL(url);
  }

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
      <p className="mt-2 text-sm text-slate-600">CSV template download karein, category → main service → sub-service rows fill karein aur upload karein. Same IDs update honge; baaki catalogue delete nahi hoga.</p>
    </div>
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
        <FileSpreadsheet className="h-8 w-8 text-emerald-600"/>
        <div><p className="font-bold text-slate-900">Kaamdaar catalogue CSV</p><p className="text-xs text-slate-500">One row per service/sub-service</p></div>
        </div>
        <button type="button" onClick={downloadTemplate} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700">Download CSV Template</button>
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
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
      <strong>CSV format:</strong> category_id + category_name_en/hi, service_id + service_name_en/hi + price + duration_minutes. Optional sub_service_id/name/price/duration columns create selectable add-ons under that parent service. Repeat the same category/service IDs on rows that belong together. Use unique IDs (letters, numbers, hyphens). Duration is entered in minutes.
    </div>
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <strong>Important:</strong> Import is non-destructive. It only inserts or updates rows whose IDs are present in the CSV. It never clears the existing catalogue or customer bookings. Confirm prices, time and service descriptions before activating.
    </div>
  </div>;
}
