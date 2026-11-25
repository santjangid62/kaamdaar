import { NextResponse } from "next/server";
import { all, ready, type Collection } from "../../../../../../server/db";
import { bearerToken, verifyMobileSuperAdminToken } from "../../../../../../lib/super-admin/mobile-auth";

const OWNER_READABLE_COLLECTIONS: Collection[] = [
  "users", "providers", "bookings", "services", "categories", "subcategories",
  "reviews", "complaints", "banners", "faqs", "pages", "campaigns",
  "notifications", "payouts", "wallets", "walletTxns", "providerPayments",
  "adminUsers", "auditLogs", "settings",
];

export async function GET(
  req: Request,
  ctx: { params: Promise<{ collection: string }> },
) {
  if (!verifyMobileSuperAdminToken(bearerToken(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { collection: requested } = await ctx.params;
  if (!OWNER_READABLE_COLLECTIONS.includes(requested as Collection)) {
    return NextResponse.json({ error: "This data module is not available." }, { status: 404 });
  }

  await ready();
  const rows = await all(requested as Collection);
  const url = new URL(req.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || 100)));
  const query = (url.searchParams.get("q") || "").trim().toLowerCase();
  const filtered = query
    ? rows.filter((row) => JSON.stringify(row).toLowerCase().includes(query))
    : rows;
  const sorted = filtered.sort((a, b) => {
    const aTime = Number(a.updatedAt ?? a.createdAt ?? 0);
    const bTime = Number(b.updatedAt ?? b.createdAt ?? 0);
    return bTime - aTime;
  });

  return NextResponse.json(
    { collection: requested, total: filtered.length, rows: sorted.slice(0, limit) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
