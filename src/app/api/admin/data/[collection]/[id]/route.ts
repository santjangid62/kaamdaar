/**
 * PATCH /api/admin/data/:collection/:id  → update a row
 * DELETE /api/admin/data/:collection/:id → remove a row
 */
import { NextResponse } from "next/server";
import { COLLECTIONS, get, patch, ready, remove, type Collection } from "../../../../../../server/db";
import { sanitizeRow } from "../../../../../../server/sanitize";
import { isAuthed } from "../../../../../../lib/admin/auth";

function isCollection(value: string): value is Collection {
  return (COLLECTIONS as string[]).includes(value);
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ collection: string; id: string }> },
) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ready();
  const { collection, id } = await ctx.params;
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

  // typed against the stored row: numbers stay numbers, junk is rejected
  const existing = await get(collection, id);
  const result = sanitizeRow(body, existing);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const row = await patch(collection, id, result.clean);
  if (!row) return NextResponse.json({ error: "Row not found" }, { status: 404 });
  return NextResponse.json({ row });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ collection: string; id: string }> },
) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ready();
  const { collection, id } = await ctx.params;
  if (!isCollection(collection)) {
    return NextResponse.json({ error: `Unknown collection: ${collection}` }, { status: 404 });
  }
  const ok = await remove(collection, id);
  if (!ok) return NextResponse.json({ error: "Row not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}