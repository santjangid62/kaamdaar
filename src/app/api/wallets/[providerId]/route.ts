/**
 * GET  /api/wallets/:providerId — balance + recent ledger.
 * POST /api/wallets/:providerId — { kind: "commission" | "recharge", amount, note }
 *       commission: debited for a completed service (what admin/booking flow calls)
 *       recharge:   top-up when balance is below the ₹500 minimum
 */
import { NextResponse } from "next/server";
import { all, ready } from "../../../../server/db";
import { debitCommission, getWallet, rechargeWallet, type WalletTxn } from "../../../../server/wallet";

// live balance — the Provider app refreshes it after every job
export const instant = false;

export async function GET(_req: Request, ctx: { params: Promise<{ providerId: string }> }) {
  await ready();
  const { providerId } = await ctx.params;
  const wallet = await getWallet(providerId);
  const txns = (await all<WalletTxn>("walletTxns"))
    .filter((t) => t.providerId === providerId)
    .sort((a, b) => b.createdAt - a.createdAt);
  return NextResponse.json({ wallet, txns });
}

export async function POST(req: Request, ctx: { params: Promise<{ providerId: string }> }) {
  await ready();
  const { providerId } = await ctx.params;
  let body: { kind?: string; amount?: number; note?: string; provider?: string; service?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) {
    return NextResponse.json({ error: "A positive amount is required" }, { status: 422 });
  }

  if (body.kind === "recharge") {
    const wallet = await rechargeWallet(providerId, amount);
    return NextResponse.json({ wallet });
  }
  if (body.kind === "commission") {
    const wallet = await debitCommission(providerId, amount, body.note ?? "10% commission", {
      provider: body.provider,
      service: body.service,
    });
    return NextResponse.json({ wallet });
  }
  return NextResponse.json({ error: "kind must be commission or recharge" }, { status: 422 });
}
