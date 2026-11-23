import { NextResponse } from "next/server";
import { get, ready } from "../../../../../../../server/db";
import { isAuthed } from "../../../../../../../lib/admin/auth";

type Complaint = { id: string; attachments?: Array<{ name: string; mimeType: string; data: string }> };

export async function GET(_req: Request, ctx: { params: Promise<{ id: string; index: string }> }) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ready();
  const { id, index } = await ctx.params;
  const position = Number(index);
  if (!Number.isInteger(position) || position < 0 || position > 2) {
    return NextResponse.json({ error: "Evidence not found" }, { status: 404 });
  }
  const complaint = await get<Complaint>("complaints", id);
  const evidence = complaint?.attachments?.[position];
  if (!evidence) return NextResponse.json({ error: "Evidence not found" }, { status: 404 });
  const bytes = Buffer.from(evidence.data, "base64");
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": evidence.mimeType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `inline; filename="${evidence.name.replace(/["\\\\]/g, "_")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
