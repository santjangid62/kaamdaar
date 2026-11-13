/**
 * Wallet reads are owner-scoped. Commission is applied only by the verified
 * booking lifecycle; recharge is an admin action after payment verification.
 */
import { NextResponse } from "next/server";
import { all, ready } from "../../../../server/db";
import { getWallet, rechargeWallet, type WalletTxn } from "../../../../server/wallet";
import { isAuthed } from "../../../../lib/admin/auth";
import { firebaseIdentityFromRequest, normalizeIndianPhone } from "../../../../server/firebase-auth";
import type { Provider } from "../../../../lib/types";

export const instant = false;

export async function GET(req: Request, ctx: { params: Promise<{ providerId: string }> }) {
  await ready();
  const { providerId } = await ctx.params;
  const admin = await isAuthed();
  if (!admin) {
    const identity = await firebaseIdentityFromRequest(req);
    if (!identity) return NextResponse.json({ error: "Firebase sign-in is required" }, { status: 401 });
    const providers = await all<Provider>("providers");
    const own = providers.find((p) => normalizeIndianPhone(p.phone ?? "") === identity.phone);
    if (!own || own.id !== providerId) {
      return NextResponse.json({ error: "You can only view your own wallet" }, { status: 403 });
    }
  }
  const wallet = await getWallet(providerId);
  const txns = (await all<WalletTxn>("walletTxns"))
    .filter((t) => t.providerId === providerId)
    .sort((a, b) => b.createdAt - a.createdAt);
  return NextResponse.json({ wallet, txns });
}

export async function POST(req: Request, ctx: { params: Promise<{ providerId: string }> }) {
  await ready();
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "Only an administrator can verify and credit a wallet recharge" }, { status: 403 });
  }
  const { providerId } = await ctx.params;
  let body: { kind?: string; amount?: number; paymentId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const amount = Number(body.amount);
  if (body.kind !== "recharge" || !Number.isFinite(amount) || amount <= 0 || amount > 100000) {
    return NextResponse.json({ error: "A verified positive recharge amount is required" }, { status: 422 });
  }
  const wallet = await rechargeWallet(providerId, amount, body.paymentId);
  return NextResponse.json({ wallet });
}
