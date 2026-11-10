import { NextResponse } from "next/server";
import { all, patch, ready } from "../../../../../server/db";
import { isAuthed } from "../../../../../lib/admin/auth";

type AdminNotification = {
  id: string; type: string; title: string; message: string; userId: string;
  userName: string; phone: string; platform: string; readAt?: number | null; createdAt: number;
};

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ready();
  const rows = (await all<AdminNotification>("notifications"))
    .sort((a, b) => b.createdAt - a.createdAt).slice(0, 30);
  return NextResponse.json({ notifications: rows, unreadCount: rows.filter((row) => !row.readAt).length });
}

export async function PATCH() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ready();
  const rows = await all<AdminNotification>("notifications");
  const unread = rows.filter((row) => !row.readAt);
  await Promise.all(unread.map((row) => patch("notifications", row.id, { readAt: Date.now() })));
  return NextResponse.json({ updated: unread.length });
}
