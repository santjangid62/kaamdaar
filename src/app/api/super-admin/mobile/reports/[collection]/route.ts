import { NextResponse } from "next/server";
import { all, ready, type Collection } from "../../../../../server/db";
import { bearerToken, verifyMobileSuperAdminToken } from "../../../../../lib/super-admin/mobile-auth";

const ALLOWED: Collection[] = ["users","providers","bookings","services","categories","complaints","providerPayments","wallets","walletTxns","payouts","adminUsers","auditLogs"];
const PRIVATE = /password|token|secret|otp|hash|credential|authorization|attachments|privatekey|session|dataurl/i;
function clean(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([k]) => !PRIVATE.test(k) && k !== "_id").map(([k,v]) => [k,clean(v)]));
  return value;
}
function csvCell(value: unknown): string {
  const raw = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  return '"' + raw.replace(/"/g,'""').replace(/[\r\n]+/g," ") + '"';
}
export async function GET(req: Request, ctx: { params: Promise<{ collection: string }> }) {
  if (!(await verifyMobileSuperAdminToken(bearerToken(req)))) return NextResponse.json({error:"Unauthorized"},{status:401});
  const { collection } = await ctx.params;
  if (!ALLOWED.includes(collection as Collection)) return NextResponse.json({error:"Report not available"},{status:404});
  await ready();
  const rows = (await all(collection as Collection)).map(row => clean(row) as Record<string, unknown>);
  const columns = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const csv = [columns.map(csvCell).join(","), ...rows.map(row => columns.map(key => csvCell(row[key])).join(","))].join("\r\n");
  return new Response("\uFEFF"+csv,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="kaamdaar-${collection}-${new Date().toISOString().slice(0,10)}.csv"`,"Cache-Control":"no-store"}});
}
