import { NextResponse } from "next/server";
import { isAuthed } from "../../../../../lib/admin/auth";
import { all, ready, remove, upsert } from "../../../../../server/db";

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
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

function bilingual(value: string) {
  const parts = value.split(/\s+\/\s+/);
  return { en: (parts[0] ?? value).trim(), hi: parts.length > 1 ? parts.slice(1).join(" / ").trim() : "" };
}

function slug(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function POST(req: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ready();
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "CSV file field is required" }, { status: 400 });
  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length < 2) return NextResponse.json({ error: "CSV has no data rows" }, { status: 400 });

  const headers = rows[0].map((v) => v.trim().toLowerCase());
  const index = (name: string) => headers.indexOf(name);
  const required = ["category id", "main category", "subcategory id", "subcategory name"];
  const missing = required.filter((name) => index(name) < 0);
  if (missing.length) return NextResponse.json({ error: `Missing columns: ${missing.join(", ")}` }, { status: 400 });

  const categories = new Map<string, { id: string; name: string; nameHi?: string; active: boolean; order: number }>();
  const subcategories: Array<Record<string, unknown>> = [];
  const services: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();

  for (const cells of rows.slice(1)) {
    const categoryIdRaw = cells[index("category id")]?.trim() ?? "";
    const categoryName = cells[index("main category")]?.trim() ?? "";
    const subcategoryIdRaw = cells[index("subcategory id")]?.trim() ?? "";
    const subcategoryName = cells[index("subcategory name")]?.trim() ?? "";
    if (!categoryIdRaw || !categoryName || !subcategoryIdRaw || !subcategoryName) continue;

    const categoryId = `excel-category-${slug(categoryIdRaw)}`;
    const rowKey = String(cells[index("s.no")]?.trim() || (subcategories.length + 1));
    const subcategoryId = `excel-subcategory-${slug(subcategoryIdRaw)}-${rowKey}`;
    const serviceId = `excel-service-${slug(subcategoryIdRaw)}-${rowKey}`;
    const categoryLabels = bilingual(categoryName);
    categories.set(categoryId, { id: categoryId, name: categoryLabels.en, nameHi: categoryLabels.hi, active: true, order: Number(categoryIdRaw) || categories.size });
    if (seen.has(subcategoryId)) continue;
    seen.add(subcategoryId);

    const order = subcategories.length;
    const serviceLabels = bilingual(subcategoryName);
    const price = 149 + (order % 8) * 50;
    const duration = order % 3 === 0 ? "30–45 min" : order % 3 === 1 ? "45–60 min" : "60–90 min";
    subcategories.push({
      id: subcategoryId, name: serviceLabels.en, nameHi: serviceLabels.hi, categoryId, categoryName: categoryLabels.en, categoryNameHi: categoryLabels.hi,
      active: true, order, source: "excel_catalogue", pricingStatus: "dummy",
    });
    services.push({
      id: serviceId, name: serviceLabels.en, nameHi: serviceLabels.hi,
      category: categoryLabels.en, categoryHi: categoryLabels.hi, categoryId, subcategoryId,
      tagline: `Demo listing for ${serviceLabels.en}`,
      description: `Temporary catalogue description for ${serviceLabels.en}. Please review and replace this text, price and duration from Admin before accepting real bookings.`,
      includes: ["Standard service work (demo — edit before launch)"],
      excludes: ["Items not listed in the final service scope"],
      duration, price, unit: "per task", active: true, order,
      popular: false, parent: subcategoryId, pricingStatus: "dummy", source: "excel_catalogue",
    });
  }

  // Replace the legacy service catalogue: only rows from this CSV remain bookable.
  const existingServices = await all<{ id: string }>("services");
  for (const existing of existingServices) await remove("services", existing.id);
  const existingSubcategories = await all<{ id: string }>("subcategories");
  for (const existing of existingSubcategories) await remove("subcategories", existing.id);
  const existingCategories = await all<{ id: string }>("categories");
  for (const existing of existingCategories) await remove("categories", existing.id);

  for (const category of categories.values()) await upsert("categories", category.id, category);
  for (const subcategory of subcategories) await upsert("subcategories", String(subcategory.id), subcategory);
  for (const service of services) await upsert("services", String(service.id), service);

  return NextResponse.json({
    ok: true,
    imported: { categories: categories.size, subcategories: subcategories.length, services: services.length },
    note: "Prices, durations and descriptions are placeholders. Review them in Admin before accepting bookings.",
  });
}
