/**
 * Wallet helper used by API routes: read a provider's balance, apply the
 * 10% commission debit / a recharge, and append to the ledger.
 */
import { get, insert, upsert, uid } from "./db";

export const MIN_WALLET_BALANCE = 200;
// Legacy providers without a wallet row start at zero; newly added providers receive a one-time onboarding credit via ensureProviderWallet.
export const DEFAULT_WALLET_BALANCE = 0;

export interface WalletRow {
  providerId: string;
  balance: number;
  updatedAt?: number;
}

export interface WalletTxn {
  id: string;
  providerId: string;
  provider?: string;
  service?: string;
  serviceCharge?: number;
  bookingId?: string;
  paymentId?: string;
  commission?: number;
  amount: number; // negative = debit
  balanceAfter: number;
  kind: "commission" | "recharge";
  note: string;
  createdAt: number;
}

/** Create the one-time provider onboarding credit; never repeat it for an existing wallet. */
export async function ensureProviderWallet(providerId: string): Promise<WalletRow> {
  const existing = await get<WalletRow>("wallets", providerId);
  if (existing) return existing;
  const balance = 500;
  try {
    // Insert is atomic on the providerId key: concurrent create requests cannot
    // issue the onboarding credit twice.
    const wallet = await insert<WalletRow & Record<string, unknown>>("wallets", {
      id: providerId,
      providerId,
      balance,
      updatedAt: Date.now(),
    });
    await addTxn({
      providerId,
      balanceAfter: balance,
      kind: "recharge",
      amount: balance,
      note: "Kaamdaar provider onboarding credit",
    });
    return wallet;
  } catch (error) {
    const createdByAnotherRequest = await get<WalletRow>("wallets", providerId);
    if (createdByAnotherRequest) return createdByAnotherRequest;
    throw error;
  }
}

export async function getWallet(providerId: string): Promise<WalletRow> {
  const row = await get<WalletRow>("wallets", providerId);
  if (row) return row;
  // The row must exist before a debit/recharge can patch it — a default that
  // is only returned (never stored) made every later patch a silent no-op.
  return upsert("wallets", providerId, {
    providerId,
    balance: DEFAULT_WALLET_BALANCE,
    updatedAt: Date.now(),
  });
}

export async function addTxn(txn: Omit<WalletTxn, "id" | "createdAt">): Promise<WalletTxn> {
  const { insert } = await import("./db");
  return insert<Record<string, unknown>>("walletTxns", {
    ...txn,
    id: uid("tx"),
    createdAt: Date.now(),
  }) as unknown as Promise<WalletTxn>;
}

export async function debitCommission(
  providerId: string,
  amount: number,
  note: string,
  extra: Partial<WalletTxn> = {},
): Promise<WalletRow> {
  if (!Number.isFinite(amount) || amount <= 0) return getWallet(providerId);
  const wallet = await getWallet(providerId);
  const balance = Math.max(0, wallet.balance - amount);
  const bookingId = typeof extra.bookingId === "string" ? extra.bookingId : "";
  // A booking has exactly one commission ledger entry. Mongo's unique _id
  // makes concurrent Admin verification retries compete for this single claim.
  const txnId = bookingId ? `commission_${bookingId}` : uid("tx");
  try {
    await insert("walletTxns", {
      ...extra,
      id: txnId,
      providerId,
      balanceAfter: balance,
      kind: "commission",
      amount: -amount,
      note,
      createdAt: Date.now(),
    });
  } catch (error) {
    const message = String(error);
    if ((error as { code?: number }).code === 11000 || message.includes("duplicate id")) {
      return getWallet(providerId);
    }
    throw error;
  }
  await upsert("wallets", providerId, { providerId, balance, updatedAt: Date.now() });
  if (wallet.balance > MIN_WALLET_BALANCE && balance <= MIN_WALLET_BALANCE) {
    await insert("notifications", {
      id: uid("ntf"),
      type: "wallet_low",
      title: "Wallet balance low",
      message: `Provider wallet balance is ₹${balance}. Recharge to continue receiving new jobs.`,
      providerId,
      readAt: null,
    });
  }
  return { ...wallet, balance };
}

export async function rechargeWallet(providerId: string, amount: number, paymentId?: string): Promise<WalletRow> {
  const wallet = await getWallet(providerId);
  const balance = wallet.balance + amount;
  await upsert("wallets", providerId, { providerId, balance, updatedAt: Date.now() });
  await addTxn({ providerId, balanceAfter: balance, kind: "recharge", amount, paymentId, note: paymentId ? "Demo joining fee credit" : "Wallet recharge" });
  return { ...wallet, balance };
}
