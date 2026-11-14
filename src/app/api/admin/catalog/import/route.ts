import { NextResponse } from "next/server";
import { isAuthed } from "../../../../../lib/admin/auth";
import { ready, upsert } from "../../../../../server/db";
import { categoryIconKey } from "../../../../../lib/service-icons";

function parseCsv(input: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell.length || row.length) { row.push(cell.replace(/\r$/, "")); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim()));
}
function slug(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
}
function val(cells: string[], idx: (key: string) => number, key: string) {
  return (cells[idx(key)] ?? "").trim();
}
function num(value: string, fallback: number) {
  const n = Number(value); return Number.isFinite(n) && n >= 0 ? n : fallback;
}
function duration(value: string) {
  const n = num(value, 0); return n ? `${n} min` : "30–45 min";
}

export async function POST(req: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ready();
  const form = await req.formData(); const file = form.get("file");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".csv")) {
    return NextResponse.json({ error: "Please upload a CSV file" }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "CSV must be smaller than 5 MB" }, { status: 413 });
  const rows = parseCsv(await file.text());
  if (rows.length < 2) return NextResponse.json({ error: "CSV has no data rows" }, { status: 400 });
  const headers = rows[0].map((v) => v.trim().toLowerCase());
  const index = (name: string) => headers.indexOf(name);
  const required = ["category_id","category_name_en","service_id","service_name_en","service_price","service_duration_minutes"];
  const missing = required.filter((name) => index(name) < 0);
  if (missing.length) return NextResponse.json({ error: `Missing columns: ${missing.join(", ")}` }, { status: 400 });

  const categories = new Map<string, Record<string, unknown>>();
  const services = new Map<string, Record<string, unknown>>();
  let skipped = 0;
  for (const cells of rows.slice(1)) {
    const categoryId = slug(val(cells,index,"category_id"));
    const categoryName = val(cells,index,"category_name_en");
    const serviceId = slug(val(cells,index,"service_id"));
    const serviceName = val(cells,index,"service_name_en");
    if (!categoryName || !serviceName || !val(cells,index,"category_id") || !val(cells,index,"service_id")) { skipped++; continue; }
    const categoryNameHi = val(cells,index,"category_name_hi");
    const serviceNameHi = val(cells,index,"service_name_hi");
    const categoryKey = `cat-${categoryId}`;
    const mainId = `svc-${serviceId}`;
    categories.set(categoryKey, { id: categoryKey, name: categoryName, nameHi: categoryNameHi, active: val(cells,index,"active").toLowerCase() !== "false", order: num(val(cells,index,"category_order"), categories.size), icon: categoryIconKey(categoryName) });

    const basePrice = num(val(cells,index,"service_price"), 0);
    if (!basePrice) { skipped++; continue; }
    const service = {
      id: mainId, name: serviceName, nameHi: serviceNameHi, category: categoryName,
      categoryHi: categoryNameHi, categoryId: categoryKey, tagline: val(cells,index,"service_tagline"),
      description: val(cells,index,"service_description_en"), descriptionHi: val(cells,index,"service_description_hi"),
      includes: [], excludes: [], price: basePrice, unit: val(cells,index,"service_unit") || "per task",
      duration: duration(val(cells,index,"service_duration_minutes")), durationMinutes: num(val(cells,index,"service_duration_minutes"), 45),
      active: val(cells,index,"active").toLowerCase() !== "false", order: num(val(cells,index,"service_order"), services.size),
      popular: false, icon: categoryIconKey(serviceName, categoryName), source: "admin_csv",
    };
    services.set(mainId, service);

    const subIdRaw = val(cells,index,"sub_service_id");
    const subName = val(cells,index,"sub_service_name_en");
    if (subIdRaw && subName) {
      const subId = `svc-${slug(subIdRaw)}`;
      const subPrice = num(val(cells,index,"sub_service_price"), 0);
      const subMinutes = num(val(cells,index,"sub_service_duration_minutes"), 0);
      if (!subPrice || !subMinutes) { skipped++; continue; }
      services.set(subId, {
        id: subId, name: subName, nameHi: val(cells,index,"sub_service_name_hi"),
        category: categoryName, categoryHi: categoryNameHi, categoryId: categoryKey, parent: mainId,
        tagline: val(cells,index,"sub_service_tagline"),
        description: val(cells,index,"sub_service_description_en"),
        price: subPrice, unit: val(cells,index,"sub_service_unit") || "per task",
        duration: duration(String(subMinutes)), durationMinutes: subMinutes,
        includes: [], excludes: [], active: true, order: services.size, popular: false,
        icon: categoryIconKey(subName, categoryName), source: "admin_csv",
      });
    }
  }
  if (!categories.size || !services.size) return NextResponse.json({ error: "No valid catalogue rows found. Download the template and fill required columns." }, { status: 422 });

  // Upsert only IDs present in this upload. Existing catalogue records not in the file remain untouched.
  for (const category of categories.values()) await upsert("categories", String(category.id), category);
  for (const service of services.values()) await upsert("services", String(service.id), service);
  return NextResponse.json({
    ok: true, mode: "upsert",
    imported: { categories: categories.size, services: services.size, subServices: [...services.values()].filter((s) => Boolean(s.parent)).length, skipped },
    note: "Imported IDs were inserted/updated. Existing rows outside this CSV were preserved; review all prices and durations before publishing.",
  });
}
