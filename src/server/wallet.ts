/**
 * Wallet helper used by API routes: read a provider's balance, apply the
 * 10% commission debit / a recharge, and append to the ledger.
 */
import { get, upsert, uid } from "./db";

export const MIN_WALLET_BALANCE = 200;
// New providers start at zero; money is credited only after verified payment.\nexport const DEFAULT_WALLET_BALANCE = 0;

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
  commission?: number;
  amount: number; // negative = debit
  balanceAfter: number;
  kind: "commission" | "recharge";
  note: string;
  createdAt: number;
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
  const wallet = await getWallet(providerId);
  const balance = Math.max(0, wallet.balance - amount);
  await upsert("wallets", providerId, { providerId, balance, updatedAt: Date.now() });
  await addTxn({ providerId, balanceAfter: balance, kind: "commission", amount: -amount, note, ...extra });
  return { ...wallet, balance };
}

export async function rechargeWallet(providerId: string, amount: number): Promise<WalletRow> {
  const wallet = await getWallet(providerId);
  const balance = wallet.balance + amount;
  await upsert("wallets", providerId, { providerId, balance, updatedAt: Date.now() });
  await addTxn({ providerId, balanceAfter: balance, kind: "recharge", amount, note: "Wallet recharge" });
  return { ...wallet, balance };
}
