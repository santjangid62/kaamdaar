import { NextResponse } from "next/server";
import { all, ready } from "../../../../server/db";
import { isAuthed } from "../../../../lib/admin/auth";
import type { Booking, BookingEvent, Provider, User } from "../../../../lib/types";

type LogRow = {
  id: string; at: number; actor: string; action: string; module: string;
  title: string; description: string; reference: string; severity: "info" | "success" | "warning" | "danger";
};

const agoSafe = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;

export async function GET(req: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ready();
  const url = new URL(req.url);
  const limit = Math.min(1000, Math.max(50, Number(url.searchParams.get("limit") || 500)));
  const [bookings, users, providers, notifications, reviews, walletTxns, payouts, providerPayments, complaints, auditLogs] = await Promise.all([
    all<Booking>("bookings"), all<User>("users"), all<Provider>("providers"),
    all<Record<string, unknown>>("notifications"), all<Record<string, unknown>>("reviews"),
    all<Record<string, unknown>>("walletTxns"), all<Record<string, unknown>>("payouts"),
    all<Record<string, unknown>>("providerPayments"), all<Record<string, unknown>>("complaints"), all<Record<string, unknown>>("auditLogs"),
  ]);
  const rows: LogRow[] = [];
  for (const b of bookings) {
    for (const e of (b.events ?? []) as BookingEvent[]) rows.push({
      id: e.id, at: e.at, actor: e.actor, action: e.type, module: "Bookings",
      title: e.title, description: [b.serviceName, e.detail].filter(Boolean).join(" · "),
      reference: b.id, severity: e.type === "cancelled" ? "warning" : e.type === "completed" || e.type === "paid" ? "success" : "info",
    });
  }
  const addRecords = (items: Array<Record<string, unknown>>, module: string, label: string, actor: string) => {
    for (const item of items) {
      const id = String(item.id ?? "");
      const created = agoSafe(item.createdAt);
      const updated = agoSafe(item.updatedAt);
      const name = String(item.title ?? item.name ?? item.serviceName ?? item.q ?? item.id ?? label);
      if (created) rows.push({ id: `${module}-created-${id}`, at: created, actor, action: "created", module, title: `${label} created`, description: name, reference: id, severity: "success" });
      if (updated > created + 1000) rows.push({ id: `${module}-updated-${id}-${updated}`, at: updated, actor: "admin", action: "updated", module, title: `${label} updated`, description: name, reference: id, severity: "info" });
    }
  };
  addRecords(users as unknown as Array<Record<string, unknown>>, "Customers", "Customer", "customer");
  addRecords(providers as unknown as Array<Record<string, unknown>>, "Providers", "Provider", "provider");
  addRecords(notifications, "Notifications", "Notification", "system");
  addRecords(reviews, "Reviews", "Review", "customer");
  addRecords(walletTxns, "Wallet", "Wallet transaction", "system");
  addRecords(payouts, "Payouts", "Payout", "admin");
  addRecords(providerPayments, "Provider Payments", "Provider payment", "system");
  addRecords(complaints, "Support", "Complaint", "customer");
  for (const log of auditLogs) rows.push({
    id: String(log.id), at: agoSafe(log.at), actor: String(log.actor ?? "admin"),
    action: String(log.action ?? "activity"), module: String(log.module ?? "System"),
    title: String(log.title ?? "System activity"), description: String(log.description ?? ""),
    reference: String(log.reference ?? ""), severity: (log.severity as LogRow["severity"]) ?? "info",
  });
  rows.sort((a, b) => b.at - a.at);
  const selected = rows.slice(0, limit);
  const counts = {
    total: rows.length,
    bookings: rows.filter(r => r.module === "Bookings").length,
    customers: rows.filter(r => r.module === "Customers").length,
    providers: rows.filter(r => r.module === "Providers").length,
    finance: rows.filter(r => ["Wallet", "Payouts", "Provider Payments"].includes(r.module)).length,
    warnings: rows.filter(r => r.severity === "warning" || r.severity === "danger").length,
  };
  return NextResponse.json({ rows: selected, counts, generatedAt: Date.now(), limit });
}
