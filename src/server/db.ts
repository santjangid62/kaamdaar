/**
 * Kaamdaar server-side database — file-backed JSON store.
 *
 * Every read goes to disk and every write is serialized, so multiple route
 * bundles in dev never diverge on an in-memory copy. The public surface is a
 * tiny repository API (all/get/insert/patch/remove); swapping the storage
 * engine for Firestore or D1 later means reimplementing these six functions
 * and nothing else — API routes and the admin panel keep their contracts.
 *
 * Collections & documents are described in DB_DESIGN.md at the repo root.
 * The data file lives at `.data/db.json` (git-ignored).
 */
import { promises as fs } from "node:fs";
import path from "node:path";

export type Collection =
  | "users"
  | "addresses"
  | "bookings"
  | "providers"
  | "services"
  | "categories"
  | "reviews"
  | "complaints"
  | "banners"
  | "faqs"
  | "pages"
  | "campaigns"
  | "payouts"
  | "wallets"
  | "walletTxns"
  | "adminUsers"
  | "settings";

export const COLLECTIONS: Collection[] = [
  "users", "addresses", "bookings", "providers", "services", "categories",
  "reviews", "complaints", "banners", "faqs", "pages", "campaigns",
  "payouts", "wallets", "walletTxns", "adminUsers", "settings",
];

export type Store = Partial<Record<Collection, Record<string, Doc>>> & { seeded?: boolean };
export type Doc = Record<string, unknown> & { id: string };

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");

function err(message: string, cause?: unknown): never {
  throw new Error(`[db] ${message}`, { cause });
}

async function readStore(): Promise<Store> {
  try {
    const raw = await fs.readFile(DB_FILE, "utf8");
    return JSON.parse(raw) as Store;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return {};
    return err("could not parse .data/db.json — delete the file to re-seed", e);
  }
}

/** Writes are chained so two concurrent requests never interleave partial files. */
let queue: Promise<void> = Promise.resolve();
/**
 * Replace the data file in one step, so a concurrent read never parses a
 * half-written file. On Windows the destination can be held open for a moment
 * by OneDrive/antivirus, which answers EPERM/EACCES/EBUSY to rename — retry,
 * and as a last resort write through rather than failing the request.
 */
async function replaceFile(tmp: string, target: string): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await fs.rename(tmp, target);
      return;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code !== "EPERM" && code !== "EACCES" && code !== "EBUSY") throw e;
      await new Promise((r) => setTimeout(r, 25 * (attempt + 1)));
    }
  }
  const payload = await fs.readFile(tmp, "utf8");
  await fs.writeFile(target, payload, "utf8");
  await fs.rm(tmp, { force: true });
}

async function writeStore(store: Store): Promise<void> {
  const run = async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmp = `${DB_FILE}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(store, null, 2), "utf8");
    await replaceFile(tmp, DB_FILE);
  };
  queue = queue.then(run, run);
  await queue;
}

export function uid(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

/* ── repository API ─────────────────────────────────────────────── */

export async function all<T = Doc>(col: Collection): Promise<T[]> {
  const store = await readStore();
  return Object.values(store[col] ?? {}) as T[];
}

export async function get<T = Doc>(col: Collection, id: string): Promise<T | null> {
  const store = await readStore();
  return ((store[col] ?? {})[id] as T) ?? null;
}

export async function find<T = Doc>(
  col: Collection,
  pred: (doc: T) => boolean,
): Promise<T[]> {
  return (await all<T>(col)).filter(pred);
}

export async function findOne<T = Doc>(
  col: Collection,
  pred: (doc: T) => boolean,
): Promise<T | null> {
  const store = await readStore();
  return (Object.values(store[col] ?? {}) as T[]).find(pred) ?? null;
}

/** Insert a new document; `id` and timestamps are assigned here. */
export async function insert<T extends Record<string, unknown>>(
  col: Collection,
  doc: T,
): Promise<T & { id: string }> {
  const store = await readStore();
  const list = (store[col] ??= {});
  const id = typeof doc.id === "string" && doc.id ? doc.id : uid(col.slice(0, 3));
  if (list[id]) err(`duplicate id ${id} in ${col}`);
  const now = Date.now();
  const created = { ...doc, id, createdAt: now, updatedAt: now } as T & { id: string };
  list[id] = created as Doc;
  await writeStore(store);
  return created;
}

/** Partial update; returns the merged document or null when missing. */
export async function patch<T = Doc>(
  col: Collection,
  id: string,
  changes: Record<string, unknown>,
): Promise<T | null> {
  const store = await readStore();
  const list = (store[col] ??= {});
  const current = list[id];
  if (!current) return null;
  const next = { ...current, ...changes, id, updatedAt: Date.now() };
  list[id] = next;
  await writeStore(store);
  return next as T;
}

/** Insert-or-update by explicit id (used by upserts such as settings). */
export async function upsert<T extends Record<string, unknown>>(
  col: Collection,
  id: string,
  doc: T,
): Promise<T & { id: string }> {
  const store = await readStore();
  const list = (store[col] ??= {});
  const now = Date.now();
  const existing = list[id];
  const next = { ...(existing ?? {}), ...doc, id, createdAt: existing?.createdAt ?? now, updatedAt: now };
  list[id] = next as Doc;
  await writeStore(store);
  return next as T & { id: string };
}

export async function remove(col: Collection, id: string): Promise<boolean> {
  const store = await readStore();
  const list = store[col];
  if (!list || !list[id]) return false;
  delete list[id];
  await writeStore(store);
  return true;
}

export async function count(col: Collection): Promise<number> {
  const store = await readStore();
  return Object.keys(store[col] ?? {}).length;
}

export async function resetCollection(col: Collection): Promise<void> {
  const store = await readStore();
  store[col] = {};
  await writeStore(store);
}

/* ── seeding ────────────────────────────────────────────────────── */

type Seeder = (store: Store) => Promise<Store> | Store;
const seeders: Seeder[] = [];

/** Register an idempotent seeder; they run once, on first access. */
export function registerSeeder(fn: Seeder): void {
  seeders.push(fn);
}

async function ensureSeeded(): Promise<void> {
  const store = await readStore();
  const requiredSiteSettings = [
    "site_name",
    "site_tagline",
    "site_description",
    "brand_navy",
    "brand_blue",
    "brand_orange",
    "brand_background",
    "home_hero_title_en",
    "home_hero_subtitle_en",
    "home_hero_title_hi",
    "home_hero_subtitle_hi",
  ];
  const hasSiteSettings = requiredSiteSettings.every((id) => Boolean(store.settings?.[id]));
  // Seeders are idempotent. The flag alone is not enough: an older data file
  // can predate a collection (e.g. `services`), so run them again until the
  // core collections exist. An existing-but-empty collection is left alone —
  // that is the Admin panel's own state, not a missing seed.
  if (store.seeded && store.services && hasSiteSettings && store.adminUsers) return;
  // dynamic import: registering side effects must run after this module is
  // fully evaluated (the seeder module imports `registerSeeder` from here)
  await import("./seed");
  let next: Store = { ...store, seeded: true };
  for (const fn of seeders) next = await fn(next);
  await writeStore(next);
}

/** Every API route calls this first — cheap once the flag exists. */
export async function ready(): Promise<void> {
  await ensureSeeded();
}
