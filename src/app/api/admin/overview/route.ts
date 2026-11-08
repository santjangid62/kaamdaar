/** GET /api/admin/overview — auth-wrapped dashboard aggregates (real data). */
import { NextResponse } from "next/server";
import { isAuthed } from "../../../../lib/admin/auth";
import { getOverview } from "../../../../server/adminStats";

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getOverview());
}