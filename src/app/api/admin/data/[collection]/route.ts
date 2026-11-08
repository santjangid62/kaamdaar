/**
 * GET  /api/admin/data/:collection            → all rows (auth required)
 * POST /api/admin/data/:collection            → create a row (server assigns id)
 *
 * The admin panel talks to this one route for every collection in DB_DESIGN.md.
 */
import { NextResponse } from "next/server";
import { all, COLLECTIONS, insert, ready, type Collection } from "../../../../../server/db";
import { sanitizeRow } from "../../../../../server/sanitize";
import { isAuthed } from "../../../../../lib/admin/auth";

function isCollection(value: string): value is Collection {
  return (COLLECTIONS as string[]).includes(value);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET(_req: Request, ctx: { params: Promise<{ collection: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ready();
  const { collection } = await ctx.params;
  if (!isCollection(collection)) {
    return NextResponse.json({ error: `Unknown collection: ${collection}` }, { status: 404 });
  }
  const rows = await all(collection);
  return NextResponse.json({ collection, rows, total: rows.length });
}

export async function POST(req: Request, ctx: { params: Promise<{ collection: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ready();
  const { collection } = await ctx.params;
  if (!isCollection(collection)) {
    return NextResponse.json({ error: `Unknown collection: ${collection}` }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  delete body.id;
  delete body.createdAt;
  delete body.updatedAt;

  // deny-by-default: only schema-relevant primitives are accepted, and
  // numeric fields (price, order…) must parse to real numbers
  const result = sanitizeRow(body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  const clean = result.clean;
  if (Object.keys(clean).length === 0) {
    return NextResponse.json({ error: "Nothing to create" }, { status: 422 });
  }

  // Catalogue rows get a readable, URL-safe id (the site links to /services/<id>)
  // and sensible first-run defaults so a new row never breaks the frontend.
  if (collection === "services" || collection === "categories") {
    const name = typeof clean.name === "string" ? clean.name : "";
    const existing = await all(collection);
    if (name) {
      const base = slugify(name) || collection.slice(0, 3);
      let id = base;
      let n = 2;
      while (existing.some((r) => r.id === id)) id = `${base}-${n++}`;
      clean.id = id;
    }
    if (collection === "services") {
      clean.includes = Array.isArray(clean.includes) ? clean.includes : [];
      clean.excludes = Array.isArray(clean.excludes) ? clean.excludes : [];
      clean.price = typeof clean.price === "number" ? clean.price : 0;
    }
    // display order defaults to “last” unless the admin picked one
    if (typeof clean.order !== "number") {
      clean.order =
        Math.max(0, ...existing.map((r) => Number((r as { order?: number }).order ?? 0))) + 1;
    }
    if (collection === "categories" && typeof clean.active !== "boolean") {
      clean.active = true;
    }
  }

  const row = await insert(collection, clean);
  return NextResponse.json({ row }, { status: 201 });
}