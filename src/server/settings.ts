/** Settings lookups used by API routes (defaults match DB_DESIGN.md). */
import { get, ready } from "./db";

export async function commissionRate(): Promise<number> {
  await ready();
  const row = await get<{ value: string }>("settings", "commission_rate");
  const value = Number(row?.value ?? "10");
  return Number.isFinite(value) && value > 0 ? value : 10;
}

export async function minWallet(): Promise<number> {
  await ready();
  const row = await get<{ value: string }>("settings", "min_wallet");
  const value = Number(row?.value ?? "200");
  return Number.isFinite(value) && value >= 0 ? value : 200;
}
