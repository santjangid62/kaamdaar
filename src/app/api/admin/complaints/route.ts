import { NextResponse } from "next/server";
import { all, get, insert, patch, ready, uid } from "../../../../server/db";
import { isAuthed } from "../../../../lib/admin/auth";

type Complaint = {
  id: string; customerId?: string; customer?: string; customerPhone?: string;
  provider?: string; issue?: string; booking?: string; status?: string;
  adminResponse?: string; attachments?: Array<{ name: string; mimeType: string; size: number; data: string }>;
  replies?: Array<{ by: string; message: string; createdAt: number }>; createdAt?: number;
};

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ready();
  const rows = await all<Complaint>("complaints");
  return NextResponse.json({
    complaints: rows.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)).map((row) => ({
      ...row,
      evidence: (row.attachments ?? []).map((file, index) => ({
        index, name: file.name, mimeType: file.mimeType, size: file.size,
        url: `/api/admin/complaints/${encodeURIComponent(row.id)}/evidence/${index}`,
      })),
      attachments: undefined,
    })),
  });
}

export async function PATCH(req: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ready();
  let body: { complaintId?: string; status?: string; response?: string };
  try { body = await req.json() as typeof body; }
  catch { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }
  const id = String(body.complaintId ?? "").trim();
  const status = String(body.status ?? "In Review");
  const response = String(body.response ?? "").trim().slice(0, 2000);
  if (!id || !["Open", "In Review", "Escalated", "Resolved"].includes(status)) {
    return NextResponse.json({ error: "Complaint and valid status are required" }, { status: 422 });
  }
  if (response.length < 3) return NextResponse.json({ error: "Please enter a customer-facing response." }, { status: 422 });
  const complaint = await get<Complaint>("complaints", id);
  if (!complaint) return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
  const now = Date.now();
  const replies = [...(complaint.replies ?? []), { by: "admin", message: response, createdAt: now }];
  const updated = await patch<Complaint>("complaints", id, {
    status, adminResponse: response, replies, respondedAt: now, updatedAt: now,
  });
  if (!updated) return NextResponse.json({ error: "Could not update complaint" }, { status: 500 });
  if (complaint.customerId) {
    await insert("notifications", {
      id: uid("ntf"), type: "customer_complaint_response",
      title: "Kaamdaar Support replied to your complaint",
      message: response, userId: complaint.customerId, userName: complaint.customer || "Customer",
      phone: complaint.customerPhone || "", complaintId: id, platform: "Customer support",
      readAt: null, createdAt: now,
    });
  }
  return NextResponse.json({ ok: true, complaint: updated });
}
