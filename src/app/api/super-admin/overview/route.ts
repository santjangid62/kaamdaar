import { NextResponse } from "next/server";
import { all, ready } from "../../../../server/db";
import { isAuthed } from "../../../../lib/admin/auth";

type Row = Record<string, unknown>;
const n = (v: unknown) => typeof v === "number" && Number.isFinite(v) ? v : 0;
const dateOf = (v: unknown) => n(v) || (typeof v === "string" ? Date.parse(v) || 0 : 0);

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ready();
  const names = ["users","providers","bookings","services","categories","adminUsers","reviews","complaints","payouts","wallets","walletTxns","providerPayments","notifications","auditLogs","banners","pages","faqs","campaigns"] as const;
  const values = await Promise.all(names.map((name) => all<Row>(name)));
  const data = Object.fromEntries(names.map((name, i) => [name, values[i]])) as Record<(typeof names)[number], Row[]>;
  const bookings = data.bookings;
  const completed = bookings.filter((b) => b.status === "completed");
  const cancelled = bookings.filter((b) => b.status === "cancelled");
  const revenue = completed.reduce((s, b) => s + n(b.amount), 0);
  const commission = completed.reduce((s, b) => s + n(b.commission), 0);
  const live = bookings.filter((b) => ["dispatched","accepted","enroute","arrived","in_progress","pending_confirm"].includes(String(b.status)));
  const byService = new Map<string,{name:string; bookings:number; revenue:number}>();
  for (const b of bookings) {
    const name = String(b.serviceName ?? "Unassigned");
    const cur = byService.get(name) ?? {name,bookings:0,revenue:0};
    cur.bookings++;
    if (b.status === "completed") cur.revenue += n(b.amount);
    byService.set(name,cur);
  }
  const byCity = new Map<string,number>();
  for (const b of bookings) {
    const address = b.address && typeof b.address === "object" ? b.address as Row : {};
    const city = String(address.city ?? address.label ?? "Unknown");
    byCity.set(city,(byCity.get(city) ?? 0)+1);
  }
  const byDay = new Map<string,{day:string; total:number; completed:number; cancelled:number; revenue:number}>();
  const now = Date.now();
  for (let i=29;i>=0;i--) {
    const d = new Date(now-i*86400000);
    const key = d.toISOString().slice(0,10);
    byDay.set(key,{day:key,total:0,completed:0,cancelled:0,revenue:0});
  }
  for (const b of bookings) {
    const ts = dateOf(b.createdAt);
    const key = ts ? new Date(ts).toISOString().slice(0,10) : "";
    const row = byDay.get(key);
    if (!row) continue;
    row.total++;
    if (b.status === "completed") { row.completed++; row.revenue += n(b.amount); }
    if (b.status === "cancelled") row.cancelled++;
  }
  const onlineProviders = data.providers.filter((p) => String(p.status).toLowerCase() === "online").length;
  const pendingKyc = data.providers.filter((p) => ["pending","Pending"].includes(String(p.kycStatus))).length;
  const pendingPayments = data.providerPayments.filter((p) => !["verified","paid","Paid"].includes(String(p.status))).length;
  const pendingComplaints = data.complaints.filter((p) => !["resolved","Resolved","closed"].includes(String(p.status))).length;
  const pendingPayouts = data.payouts.filter((p) => !["paid","Paid"].includes(String(p.status))).length;
  const activeAdmins = data.adminUsers.filter((a) => String(a.status).toLowerCase() !== "blocked" && String(a.status).toLowerCase() !== "inactive").length;
  const recent = [...data.auditLogs].sort((a,b)=>dateOf(b.at)-dateOf(a.at)).slice(0,8);
  const recentBookings = [...bookings].sort((a,b)=>dateOf(b.createdAt)-dateOf(a.createdAt)).slice(0,8);
  return NextResponse.json({
    generatedAt: now,
    metrics: {
      customers:data.users.length, providers:data.providers.length, onlineProviders,
      bookings:bookings.length, completed:completed.length, cancelled:cancelled.length,
      revenue, commission, live:live.length, activeAdmins,
      completionRate:bookings.length ? Math.round(completed.length/bookings.length*1000)/10 : 0,
      cancellationRate:bookings.length ? Math.round(cancelled.length/bookings.length*1000)/10 : 0,
    },
    queues:{pendingKyc,pendingPayments,pendingComplaints,pendingPayouts},
    charts:{daily:[...byDay.values()],services:[...byService.values()].sort((a,b)=>b.bookings-a.bookings).slice(0,8),cities:[...byCity.entries()].map(([city,count])=>({city,count})).sort((a,b)=>b.count-a.count).slice(0,8)},
    recentBookings,recentActivity:recent,
    counts:Object.fromEntries(names.map((name)=>[name,data[name].length])),
  });
}
