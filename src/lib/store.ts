/**
 * Data layer.
 *
 * Every function below works against Firestore when Firebase credentials are
 * present in `.env.local`, and against localStorage otherwise (dev mode), so
 * the whole flow runs before a backend exists. Collections used:
 *   users/{phone}   addresses (subcollection)   bookings
 */

import { getFirebaseDb, isFirebaseConfigured } from "./firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import type { Address, Booking, User } from "./types";

const K = {
  users: "kaamdaar.users",
  addresses: "kaamdaar.addresses",
  bookings: "kaamdaar.bookings",
  session: "kaamdaar.session",
} as const;

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode */
  }
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function makeReferralCode(phone: string): string {
  const tail = phone.replace(/\D/g, "").slice(-4);
  return `KDM${tail}`;
}

/* ------------------------------- session ------------------------------- */

export function loadSession(): User | null {
  return read<User | null>(K.session, null);
}

export function saveSession(user: User) {
  write(K.session, user);
}

export function clearSession() {
  if (typeof window !== "undefined") window.localStorage.removeItem(K.session);
}

/* -------------------------------- users -------------------------------- */

export async function findUserByPhone(phone: string): Promise<User | null> {
  if (isFirebaseConfigured) {
    const snap = await getDoc(doc(getFirebaseDb(), "users", phone));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as User) : null;
  }
  return read<User[]>(K.users, []).find((u) => u.phone === phone) ?? null;
}

export async function createUser(phone: string): Promise<User> {
  const user: User = {
    id: phone,
    phone,
    firstName: "",
    lastName: "",
    email: "",
    referralCode: makeReferralCode(phone),
    createdAt: Date.now(),
  };
  if (isFirebaseConfigured) {
    await setDoc(doc(getFirebaseDb(), "users", phone), { ...user });
    return user;
  }
  const users = read<User[]>(K.users, []);
  write(K.users, [...users.filter((u) => u.phone !== phone), user]);
  return user;
}

export async function updateUser(id: string, patch: Partial<User>): Promise<User | null> {
  if (isFirebaseConfigured) {
    await updateDoc(doc(getFirebaseDb(), "users", id), patch as Record<string, unknown>);
    const snap = await getDoc(doc(getFirebaseDb(), "users", id));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as User) : null;
  }
  const users = read<User[]>(K.users, []);
  const next = users.map((u) => (u.id === id ? { ...u, ...patch } : u));
  write(K.users, next);
  const found = next.find((u) => u.id === id) ?? null;
  if (found) saveSession(found);
  return found;
}

/* ------------------------------ addresses ------------------------------ */

export async function listAddresses(userId: string): Promise<Address[]> {
  if (isFirebaseConfigured) {
    const snap = await getDocs(collection(getFirebaseDb(), "users", userId, "addresses"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Address);
  }
  const all = read<Record<string, Address[]>>(K.addresses, {});
  return all[userId] ?? [];
}

export async function saveAddress(userId: string, address: Address): Promise<Address[]> {
  if (isFirebaseConfigured) {
    const ref = address.id
      ? doc(getFirebaseDb(), "users", userId, "addresses", address.id)
      : doc(collection(getFirebaseDb(), "users", userId, "addresses"));
    await setDoc(ref, { ...address, id: ref.id }, { merge: true });
    return listAddresses(userId);
  }
  const all = read<Record<string, Address[]>>(K.addresses, {});
  const list = all[userId] ?? [];
  const id = address.id || uid("addr");
  const saved = { ...address, id };
  const next = list.some((a) => a.id === id)
    ? list.map((a) => (a.id === id ? saved : a))
    : [...list, saved];
  all[userId] = next;
  write(K.addresses, all);
  return next;
}

export async function deleteAddress(userId: string, addressId: string): Promise<Address[]> {
  if (isFirebaseConfigured) {
    await getDoc(doc(getFirebaseDb(), "users", userId, "addresses", addressId)); // touch for parity
    const { deleteDoc } = await import("firebase/firestore");
    await deleteDoc(doc(getFirebaseDb(), "users", userId, "addresses", addressId));
    return listAddresses(userId);
  }
  const all = read<Record<string, Address[]>>(K.addresses, {});
  const next = (all[userId] ?? []).filter((a) => a.id !== addressId);
  all[userId] = next;
  write(K.addresses, all);
  return next;
}

/* ------------------------------- bookings ------------------------------ */

export async function createBooking(booking: Omit<Booking, "id">): Promise<Booking> {
  if (isFirebaseConfigured) {
    const ref = await addDoc(collection(getFirebaseDb(), "bookings"), booking);
    return { ...booking, id: ref.id };
  }
  const all = read<Booking[]>(K.bookings, []);
  const created: Booking = { ...booking, id: uid("bk") };
  write(K.bookings, [created, ...all]);
  return created;
}

export async function listBookings(userId: string): Promise<Booking[]> {
  if (isFirebaseConfigured) {
    const q = query(collection(getFirebaseDb(), "bookings"), where("userId", "==", userId));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Booking)
      .sort((a, b) => b.createdAt - a.createdAt);
  }
  return read<Booking[]>(K.bookings, [])
    .filter((b) => b.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt);
}