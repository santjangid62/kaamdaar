/**
 * Data layer — the browser's API client.
 *
 * Every function here calls the backend (/api/…) that writes to the real
 * database (see DB_DESIGN.md). Session stays in localStorage because it is
 * pure client state; everything else — users, addresses, bookings, wallets —
 * is server data. The exported names match the previous localStorage layer so
 * pages did not need to change.
 */

import type { Address, Booking, User } from "./types";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

/* ------------------------------- session ------------------------------- */
/** Session is client-only state; the user row itself lives on the server. */

const SESSION_KEY = "kaamdaar.session";

export function loadSession(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function saveSession(user: User) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } catch {
    /* quota / private mode */
  }
}

export function clearSession() {
  if (typeof window !== "undefined") window.localStorage.removeItem(SESSION_KEY);
}

/* -------------------------------- users -------------------------------- */

/**
 * After OTP verification: returns the existing account, or creates it
 * (backend registration). The `isNew` flag decides profile-setup redirect.
 */
export async function resolveUser(phone: string, platform: "web" | "mobile_app" = "web"): Promise<{ user: User; isNew: boolean }> {
  return api<{ user: User; isNew: boolean }>("/api/users/resolve", {
    method: "POST",
    body: JSON.stringify({ phone, platform }),
  });
}

/** Fetch the freshest copy of a user by phone (null when deleted/blocked). */
export async function fetchUser(phone: string): Promise<User | null> {
  try {
    const res = await fetch(`/api/users/resolve?phone=${encodeURIComponent(phone)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { user: User | null };
    return data.user;
  } catch {
    return null;
  }
}

/** Kept for compatibility — registration now happens in resolveUser. */
export async function createUser(phone: string): Promise<User> {
  const { user } = await resolveUser(phone);
  return user;
}

/** Look a user up without creating one. */
export async function findUserByPhone(phone: string): Promise<User | null> {
  return fetchUser(phone);
}

export async function updateUser(id: string, patch: Partial<User>): Promise<User> {
  const data = await api<{ user: User }>(`/api/users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  if (!data.user) throw new Error("Profile update returned no saved user");
  return data.user;
}

/* ------------------------------ addresses ------------------------------ */

export async function listAddresses(userId: string): Promise<Address[]> {
  try {
    const data = await api<{ addresses: Address[] }>(
      `/api/users/${encodeURIComponent(userId)}/addresses`,
    );
    return data.addresses;
  } catch {
    return [];
  }
}

export async function saveAddress(userId: string, address: Address): Promise<Address[]> {
  const data = await api<{ addresses: Address[] }>(
    `/api/users/${encodeURIComponent(userId)}/addresses`,
    { method: "POST", body: JSON.stringify(address) },
  );
  return data.addresses;
}

export async function deleteAddress(userId: string, addressId: string): Promise<Address[]> {
  const data = await api<{ addresses: Address[] }>(
    `/api/users/${encodeURIComponent(userId)}/addresses/${encodeURIComponent(addressId)}`,
    { method: "DELETE" },
  );
  return data.addresses;
}

/* ------------------------------- bookings ------------------------------ */

export async function createBooking(booking: Omit<Booking, "id">): Promise<Booking> {
  const data = await api<{ booking: Booking }>("/api/bookings", {
    method: "POST",
    body: JSON.stringify(booking),
  });
  return data.booking;
}

export async function listBookings(userId: string): Promise<Booking[]> {
  try {
    const data = await api<{ bookings: Booking[] }>(
      `/api/bookings?userId=${encodeURIComponent(userId)}`,
    );
    return data.bookings;
  } catch {
    return [];
  }
}

/** Patch a booking through the dispatch lifecycle (server-validated). */
export async function updateBooking(
  userId: string,
  id: string,
  patch: Partial<Booking>,
): Promise<Booking | null> {
  try {
    const data = await api<{ booking: Booking | null }>(
      `/api/bookings/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify({ userId, patch }) },
    );
    return data.booking;
  } catch {
    return null;
  }
}

/* ------------------------------- wallets ------------------------------- */

export interface WalletTx {
  id: string;
  at: number;
  kind: "commission" | "recharge";
  amount: number; // negative = commission debit
  note: string;
  balanceAfter: number;
}

export interface Wallet {
  providerId: string;
  balance: number;
  txns: WalletTx[];
}

/** Every Pro must keep at least this much in the wallet (company rule). */
export const MIN_WALLET_BALANCE = 500;
export const DEFAULT_WALLET_BALANCE = 1000;

export async function getWallet(providerId: string): Promise<Wallet> {
  try {
    const data = await api<{
      wallet: { providerId: string; balance: number };
      txns: Array<WalletTx & { createdAt: number }>;
    }>(`/api/wallets/${encodeURIComponent(providerId)}`);
    return {
      providerId,
      balance: data.wallet.balance,
      txns: data.txns.map((t) => ({
        id: t.id,
        at: t.createdAt ?? 0,
        kind: t.kind,
        amount: t.amount,
        note: t.note,
        balanceAfter: t.balanceAfter,
      })),
    };
  } catch {
    return { providerId, balance: DEFAULT_WALLET_BALANCE, txns: [] };
  }
}

/** 10% company commission, debited the moment a paid service closes. */
export async function debitCommission(
  providerId: string,
  commission: number,
  note: string,
): Promise<Wallet> {
  await api<{ wallet: { balance: number } }>(`/api/wallets/${encodeURIComponent(providerId)}`, {
    method: "POST",
    body: JSON.stringify({ kind: "commission", amount: commission, note }),
  });
  return getWallet(providerId);
}

/** Top-up used when the balance drops below the ₹500 minimum. */
export async function rechargeWallet(providerId: string, amount: number): Promise<Wallet> {
  await api<{ wallet: { balance: number } }>(`/api/wallets/${encodeURIComponent(providerId)}`, {
    method: "POST",
    body: JSON.stringify({ kind: "recharge", amount }),
  });
  return getWallet(providerId);
}