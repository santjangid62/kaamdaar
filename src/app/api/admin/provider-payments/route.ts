import { NextResponse } from "next/server";
import { all, get, insert, patch, ready, uid } from "../../../../server/db";
import { isAuthed } from "../../../../lib/admin/auth";
import { getWallet, rechargeWallet, type WalletTxn } from "../../../../server/wallet";

type ProviderPayment = {
  id: string;
  providerId: string;
  providerName: string;
  phone: string;
  amount: number;
  method: "cash" | "upi";
  status: "pending" | "verified" | "rejected";
  otp: string;
  demo: true;
  upiId: string;
  createdAt: number;
  verifiedAt?: number;
};

const JOINING_FEE = 500;
const DEMO_UPI_ID = "kaamdaar.demo@upi";

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ready();
  const payments = await all<ProviderPayment>("providerPayments");
  return NextResponse.json({
    mode: "demo",
    warning: "Demo only. No real money is collected. OTP is visible to Admin for testing.",
    payments: payments.sort((a, b) => b.createdAt - a.createdAt),
  });
}

export async function POST(req: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ready();
  let body: { providerId?: string; method?: "cash" | "upi" };
  try { body = await req.json() as typeof body; }
  catch { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }

  const providerId = String(body.providerId ?? "").trim();
  const method = body.method;
  if (!providerId || (method !== "cash" && method !== "upi")) {
    return NextResponse.json({ error: "providerId and cash/upi method are required" }, { status: 422 });
  }
  const provider = await get<{ id: string; name?: string; phone?: string }>("providers", providerId);
  if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  const existing = (await all<ProviderPayment>("providerPayments"))
    .find((p) => p.providerId === providerId && p.status === "pending");
  if (existing) return NextResponse.json({ payment: existing, mode: "demo" });

  const payment = await insert("providerPayments", {
    id: uid("ppay"),
    providerId,
    providerName: provider.name ?? "Provider",
    phone: provider.phone ?? "",
    amount: JOINING_FEE,
    method,
    status: "pending",
    otp: String(Math.floor(100000 + Math.random() * 900000)),
    demo: true,
    upiId: DEMO_UPI_ID,
    createdAt: Date.now(),
  });
  return NextResponse.json({
    payment,
    mode: "demo",
    message: "Demo request created. UPI ID is a placeholder and cannot collect real money.",
  }, { status: 201 });
}

export async function PATCH(req: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ready();
  let body: { paymentId?: string; otp?: string; action?: "verify" | "reject" };
  try { body = await req.json() as typeof body; }
  catch { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }

  const paymentId = String(body.paymentId ?? "");
  const payment = await get<ProviderPayment>("providerPayments", paymentId);
  if (!payment) return NextResponse.json({ error: "Payment request not found" }, { status: 404 });
  if (payment.status !== "pending") return NextResponse.json({ error: "Payment request is already closed" }, { status: 409 });

  if (body.action === "reject") {
    const updated = await patch<ProviderPayment>("providerPayments", paymentId, { status: "rejected" });
    return NextResponse.json({ payment: updated });
  }
  if (body.action !== "verify" || String(body.otp ?? "") !== payment.otp) {
    return NextResponse.json({ error: "Correct Admin-visible demo OTP is required" }, { status: 422 });
  }

  const existingCredit = (await all<WalletTxn>("walletTxns"))
    .some((txn) => txn.paymentId === payment.id && txn.kind === "recharge");
  if (!existingCredit) {
    await rechargeWallet(payment.providerId, payment.amount, payment.id);
  }
  const updated = await patch<ProviderPayment>("providerPayments", paymentId, {
    status: "verified",
    verifiedAt: Date.now(),
  });
  return NextResponse.json({
    payment: updated,
    wallet: await getWallet(payment.providerId),
    mode: "demo",
  });
}
