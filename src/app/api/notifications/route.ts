import { NextResponse } from "next/server";
import { all, ready } from "../../../server/db";
import { firebaseIdentityFromRequest, normalizeIndianPhone } from "../../../server/firebase-auth";
import type { User } from "../../../lib/types";

export async function GET(req: Request) {
  await ready();
  const identity = await firebaseIdentityFromRequest(req);
  if (!identity) return NextResponse.json({ error: "Firebase sign-in is required" }, { status: 401 });
  const users = await all<User>("users");
  const customer = users.find((u) => normalizeIndianPhone(u.phone ?? "") === identity.phone);
  if (!customer) return NextResponse.json({ error: "Customer account not found" }, { status: 404 });
  const rows = await all<Record<string, unknown> & { userId?: string; phone?: string; createdAt?: number }>("notifications");
  const notifications = rows
    .filter((row) => row.userId === customer.id || (row.phone && normalizeIndianPhone(row.phone) === identity.phone))
    .sort((a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0))
    .slice(0, 100);
  return NextResponse.json({ notifications, unread: notifications.filter((row) => !row.readAt).length });
}
