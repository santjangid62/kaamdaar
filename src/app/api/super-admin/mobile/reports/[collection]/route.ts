import { NextResponse } from "next/server";
import { all, ready, type Collection } from "../../../../../../server/db";
import { bearerToken, verifyMobileSuperAdminToken } from "../../../../../../lib/super-admin/mobile-auth";

const ALLOWED: Collection[] = ["users","providers","bookings","services","categories","subcategories","complaints","providerPayments","wallets","walletTxns","payouts","adminUsers","auditLogs","reviews","banners","faqs","pages","campaigns","notifications"];
const PRIVATE = /password|token|secret|otp|hash|credential|authorization|attachments|privatekey|session|dataurl/i;
function clean(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([k]) => !PRIVATE.test(k) && k !== "_id").map(([k,v]) => [k,clean(v)]));
  return value;
}
function csvCell(value: unknown): string {
  const rawValue = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  const raw = /^[=+@\-	]/.test(rawValue) ? "'" + rawValue : rawValue;
  return '"' + raw.replace(/"/g,'""').replace(/[\r\n]+/g," ") + '"';
}
export async function GET(req: Request, ctx: { params: Promise<{ collection: string }> }) {
  if (!(await verifyMobileSuperAdminToken(bearerToken(req)))) return NextResponse.json({error:"Unauthorized"},{status:401});
  const { collection } = await ctx.params;
  if (collection !== "dashboard" && !ALLOWED.includes(collection as Collection)) return NextResponse.json({error:"Report not available"},{status:404});
  await ready();
  let rows: Record<string, unknown>[];
  if (collection === "dashboard") {
    const [users, providers, bookings, complaints, payouts] = await Promise.all([all("users"), all("providers"), all("bookings"), all("complaints"), all("payouts")]);
    const metrics: Array<[string, number]> = [
      ["Customers", users.length], ["Providers", providers.length], ["Bookings", bookings.length],
      ["Completed bookings", bookings.filter((b) => (b as Record<string, unknown>).status === "completed").length],
      ["Cancelled bookings", bookings.filter((b) => (b as Record<string, unknown>).status === "cancelled").length],
      ["Revenue (INR)", bookings.reduce((sum, b) => sum + ((b as Record<string, unknown>).status === "completed" ? Number((b as Record<string, unknown>).amount || 0) : 0), 0)],
      ["Complaints", complaints.length], ["Processing payouts", payouts.filter((p) => (p as Record<string, unknown>).status === "Processing").length],
    ];
    rows = metrics.map(([metric, value]) => ({ metric, value }));
  } else {
    rows = (await all(collection as Collection)).map(row => clean(row) as Record<string, unknown>);
  }
  const columns = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const csv = [columns.map(csvCell).join(","), ...rows.map(row => columns.map(key => csvCell(row[key])).join(","))].join("\r\n");
  return new Response("\uFEFF"+csv,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="kaamdaar-${collection}-${new Date().toISOString().slice(0,10)}.csv"`,"Cache-Control":"no-store"}});
}
