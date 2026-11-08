/**
 * GET /api/admin/:section — section rows for external clients.
 * Reads the same live builder the admin pages use (auth required).
 */
import { NextResponse } from "next/server";
import { isAuthed } from "../../../../lib/admin/auth";
import { buildSection } from "../../../../server/sections";

export async function GET(_req: Request, ctx: { params: Promise<{ section: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { section } = await ctx.params;
  const def = await buildSection(section);
  if (!def) return NextResponse.json({ error: `Unknown section: ${section}` }, { status: 404 });
  return NextResponse.json({
    title: def.title,
    description: def.description,
    columns: def.columns,
    rows: def.rows,
    kpis: def.kpis ?? [],
    total: def.rows.length,
    generatedAt: new Date().toISOString(),
  });
}