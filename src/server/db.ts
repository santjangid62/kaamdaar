/**
 * Kaamdaar server-side database.
 *
 * One repository API, two storage engines:
 *  - MongoDB (Atlas) whenever `MONGODB_URI` is set. This is what production
 *    runs on: profiles, customers, bookings and settings survive restarts,
 *    redeploys and cold starts. One Mongo collection per logical collection.
 *  - A file-backed JSON store (`.data/db.json`) when `MONGODB_URI` is absent,
 *    so `npm run dev` still works offline without a cluster.
 *
 * Everything a route needs is exported here — all/get/find/findOne/insert/
 * patch/upsert/remove/count/resetCollection plus ready() — so routes and the
 * admin panel never learn which engine is behind them.
 *
 * Collections & documents are described in DB_DESIGN.md at the repo root.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { MongoClient, type Db, type Document } from "mongodb";

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
  | "notifications"
  | "payouts"
  | "wallets"
  | "walletTxns"
  | "providerPayments"
  | "loginOtps"
  | "adminUsers"
  | "settings";

export const COLLECTIONS: Collection[] = [
  "users", "addresses", "bookings", "providers", "services", "categories",
  "reviews", "complaints", "banners", "faqs", "pages", "campaigns", "notifications",
  "payouts", "wallets", "walletTxns", "providerPayments", "loginOtps", "adminUsers", "settings",
];

export type Store = Partial<Record<Collection, Record<string, Doc>>> & { seeded?: boolean };
export type Doc = Record<string, unknown> & { id: string };

const MONGODB_URI = process.env.MONGODB_URI?.trim() || "";

/** Database name: MONGODB_DB wins, else the path in the URI (`…/kaamdaar`), else "kaamdaar". */
function databaseName(uri: string): string {
  if (process.env.MONGODB_DB?.trim()) return process.env.MONGODB_DB.trim();
  try {
    const probe = new URL(uri.replace(/^mongodb(\+srv)?:\/\//, "https://"));
    const name = decodeURIComponent(probe.pathname.replace(/^\//, "")).split("?")[0];
    return name || "kaamdaar";
  } catch {
    return "kaamdaar";
  }
}

const MONGODB_DB = MONGODB_URI ? databaseName(MONGODB_URI) : "kaamdaar";
const META_COLLECTION = "meta";

/** Settings the site cannot render sensibly without (seeding guard). */
const REQUIRED_SITE_SETTINGS = [
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

function err(message: string, cause?: unknown): never {
  throw new Error(`[db] ${message}`, { cause });
}

export function uid(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

/** True when this process talks to MongoDB (production). */
export function usingMongo(): boolean {
  return Boolean(MONGODB_URI);
}

/* ── MongoDB engine ─────────────────────────────────────────────── */

/**
 * Serverless instances are reused, so the client promise is cached on
 * globalThis: one connection pool per lambda/instance instead of one per
 * request. A failed connect is dropped so the next request retries.
 */
type MongoGlobal = { kaamdaarMongo?: Promise<MongoClient> };
const mongoGlobal = globalThis as unknown as MongoGlobal;

function mongoClient(): Promise<MongoClient> {
  if (!mongoGlobal.kaamdaarMongo) {
    mongoGlobal.kaamdaarMongo = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 10_000,
      maxPoolSize: 10,
      retryWrites: true,
    })
      .connect()
      .catch((e) => {
        mongoGlobal.kaamdaarMongo = undefined;
        throw new Error("[db] MongoDB connect failed — check MONGODB_URI and Atlas Network Access", { cause: e });
      });
  }
  return mongoGlobal.kaamdaarMongo;
}

async function mongoDb(): Promise<Db> {
  return (await mongoClient()).db(MONGODB_DB);
}

/** Mongo keeps the document id in `_id`; the app contract uses `id`. */
function stripId<T>(doc: Document | null): T | null {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  void _id;
  return rest as T;
}

/** Documents live under `_id = id`, with the same fields the file store has. */
function withId<T extends Record<string, unknown>>(doc: T, id: string, createdAt: number, updatedAt: number): Document {
  return { ...doc, _id: id, id, createdAt, updatedAt };
}

const mongoEngine = {
  async all<T = Doc>(col: Collection): Promise<T[]> {
    const docs = await (await mongoDb()).collection(col).find({}).toArray();
    return docs.map((d) => stripId<T>(d) as T);
  },

  async get<T = Doc>(col: Collection, id: string): Promise<T | null> {
    const collection = (await mongoDb()).collection(col);
    // Support legacy/imported rows whose Mongo _id is an ObjectId but whose
    // application-level id field is the stable string identifier.
    const doc = await collection.findOne({ _id: id } as Document)
      ?? await collection.findOne({ id } as Document);
    return stripId<T>(doc);
  },

  async insert<T extends Record<string, unknown>>(col: Collection, doc: T): Promise<T & { id: string }> {
    const id = typeof doc.id === "string" && doc.id ? doc.id : uid(col.slice(0, 3));
    const now = Date.now();
    const raw = withId(doc, id, now, now);
    try {
      await (await mongoDb()).collection(col).insertOne(raw);
    } catch (e) {
      if ((e as { code?: number }).code === 11000) err(`duplicate id ${id} in ${col}`);
      throw e;
    }
    return stripId<T & { id: string }>(raw) as T & { id: string };
  },

  async patch<T = Doc>(col: Collection, id: string, changes: Record<string, unknown>): Promise<T | null> {
    const { id: _ignored, createdAt: _created, _id: _mongoId, ...safe } = changes as Record<string, unknown>;
    void _ignored; void _created; void _mongoId;
    const collection = (await mongoDb()).collection(col);
    const update = { $set: { ...safe, updatedAt: Date.now() } };
    const options = { returnDocument: "after" as const, includeResultMetadata: false };
    const res = await collection.findOneAndUpdate({ _id: id } as Document, update, options)
      ?? await collection.findOneAndUpdate({ id } as Document, update, options);
    return stripId<T>(res as Document | null);
  },

  async upsert<T extends Record<string, unknown>>(col: Collection, id: string, doc: T): Promise<T & { id: string }> {
    const now = Date.now();
    const { createdAt: _created, ...fields } = doc;
    void _created;
    await (await mongoDb()).collection(col).updateOne(
      { _id: id } as Document,
      { $set: { ...fields, id, updatedAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true },
    );
    const saved = await mongoEngine.get<T & { id: string }>(col, id);
    return saved ?? ({ ...doc, id } as T & { id: string });
  },

  async remove(col: Collection, id: string): Promise<boolean> {
    const res = await (await mongoDb()).collection(col).deleteOne({ _id: id } as Document);
    return res.deletedCount > 0;
  },

  async count(col: Collection): Promise<number> {
    return (await mongoDb()).collection(col).countDocuments();
  },

  async reset(col: Collection): Promise<void> {
    await (await mongoDb()).collection(col).deleteMany({});
  },

  async seed(): Promise<void> {
    const db = await mongoDb();
    const meta = db.collection(META_COLLECTION);
    const flag = await meta.findOne({ _id: "seeded" } as Document);
    if (flag) {
      const [services, admins, settings] = await Promise.all([
        db.collection("services").countDocuments(),
        db.collection("adminUsers").countDocuments(),
        db.collection("settings").countDocuments({ _id: { $in: REQUIRED_SITE_SETTINGS } } as Document),
      ]);
      // Same rule as the file store: a data set that predates a collection is
      // re-seeded, an existing-but-empty collection is the admin's own state.
      if (services > 0 && admins > 0 && settings === REQUIRED_SITE_SETTINGS.length) return;
    }

    await import("./seed");
    if (seeders.length === 0) return;

    // Load every collection into the same Store shape the seeders understand.
    const store: Store = {};
    for (const col of COLLECTIONS) {
      const docs = await db.collection(col).find({}).toArray();
      const map: Record<string, Doc> = {};
      for (const d of docs) {
        const doc = stripId<Doc>(d);
        if (doc) map[doc.id ?? String(d._id)] = doc;
      }
      store[col] = map;
    }

    let next: Store = { ...store, seeded: true };
    for (const fn of seeders) next = await fn(next);

    for (const col of COLLECTIONS) {
      const docs = Object.values(next[col] ?? {});
      if (docs.length === 0) continue;
      const ops = docs.map((d) => {
        const { id, ...fields } = d;
        const key = id ?? uid(col.slice(0, 3));
        return {
          updateOne: {
            filter: { _id: key } as Document,
            update: { $set: { ...fields, id: key } } as Document,
            upsert: true,
          },
        };
      });
      await db.collection(col).bulkWrite(ops, { ordered: false });
    }

    await meta.updateOne(
      { _id: "seeded" } as Document,
      { $set: { at: Date.now() } },
      { upsert: true },
    );
  },
};

/* ── file engine (offline dev) ──────────────────────────────────── */

/**
 * Local/self-hosted runs keep the data file in the repo (.data/db.json).
 * Without MONGODB_URI on a serverless host there is no writable disk, so
 * writes go to /tmp: the app works, but that file is per-instance and does
 * not survive a cold start — set MONGODB_URI in production.
 */
const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", "kaamdaar-data")
  : path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");

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

const fileEngine = {
  async all<T = Doc>(col: Collection): Promise<T[]> {
    const store = await readStore();
    return Object.values(store[col] ?? {}) as T[];
  },

  async get<T = Doc>(col: Collection, id: string): Promise<T | null> {
    const store = await readStore();
    return ((store[col] ?? {})[id] as T) ?? null;
  },

  async insert<T extends Record<string, unknown>>(col: Collection, doc: T): Promise<T & { id: string }> {
    const store = await readStore();
    const list = (store[col] ??= {});
    const id = typeof doc.id === "string" && doc.id ? doc.id : uid(col.slice(0, 3));
    if (list[id]) err(`duplicate id ${id} in ${col}`);
    const now = Date.now();
    const created = { ...doc, id, createdAt: now, updatedAt: now } as T & { id: string };
    list[id] = created as Doc;
    await writeStore(store);
    return created;
  },

  async patch<T = Doc>(col: Collection, id: string, changes: Record<string, unknown>): Promise<T | null> {
    const store = await readStore();
    const list = (store[col] ??= {});
    const current = list[id];
    if (!current) return null;
    const next = { ...current, ...changes, id, updatedAt: Date.now() };
    list[id] = next;
    await writeStore(store);
    return next as T;
  },

  async upsert<T extends Record<string, unknown>>(col: Collection, id: string, doc: T): Promise<T & { id: string }> {
    const store = await readStore();
    const list = (store[col] ??= {});
    const now = Date.now();
    const existing = list[id];
    const next = { ...(existing ?? {}), ...doc, id, createdAt: existing?.createdAt ?? now, updatedAt: now };
    list[id] = next as Doc;
    await writeStore(store);
    return next as T & { id: string };
  },

  async remove(col: Collection, id: string): Promise<boolean> {
    const store = await readStore();
    const list = store[col];
    if (!list || !list[id]) return false;
    delete list[id];
    await writeStore(store);
    return true;
  },

  async count(col: Collection): Promise<number> {
    const store = await readStore();
    return Object.keys(store[col] ?? {}).length;
  },

  async reset(col: Collection): Promise<void> {
    const store = await readStore();
    store[col] = {};
    await writeStore(store);
  },

  async seed(): Promise<void> {
    const store = await readStore();
    const hasSiteSettings = REQUIRED_SITE_SETTINGS.every((id) => Boolean(store.settings?.[id]));
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
  },
};

/* ── repository API ─────────────────────────────────────────────── */

type Engine = typeof fileEngine;
const engine: Engine = MONGODB_URI ? (mongoEngine as Engine) : fileEngine;

export async function all<T = Doc>(col: Collection): Promise<T[]> {
  return engine.all<T>(col);
}

export async function get<T = Doc>(col: Collection, id: string): Promise<T | null> {
  return engine.get<T>(col, id);
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
  return (await all<T>(col)).find(pred) ?? null;
}

/** Insert a new document; `id` and timestamps are assigned here. */
export async function insert<T extends Record<string, unknown>>(
  col: Collection,
  doc: T,
): Promise<T & { id: string }> {
  return engine.insert<T>(col, doc);
}

/** Partial update; returns the merged document or null when missing. */
export async function patch<T = Doc>(
  col: Collection,
  id: string,
  changes: Record<string, unknown>,
): Promise<T | null> {
  return engine.patch<T>(col, id, changes);
}

/** Insert-or-update by explicit id (used by upserts such as settings). */
export async function upsert<T extends Record<string, unknown>>(
  col: Collection,
  id: string,
  doc: T,
): Promise<T & { id: string }> {
  return engine.upsert<T>(col, id, doc);
}

export async function remove(col: Collection, id: string): Promise<boolean> {
  return engine.remove(col, id);
}

export async function count(col: Collection): Promise<number> {
  return engine.count(col);
}

export async function resetCollection(col: Collection): Promise<void> {
  return engine.reset(col);
}

/**
 * Atomically reserve a live dispatch for exactly one notified professional.
 * MongoDB provides the production compare-and-set; the file engine serializes
 * competing claims through the same write queue used by local development.
 */
export async function claimDispatchedBooking(
  id: string,
  providerId: string,
  now: number,
): Promise<boolean> {
  if (MONGODB_URI) {
    // Booking documents use string application IDs, not inferred ObjectIds.
    const collection = (await mongoDb()).collection<Document>("bookings");
    const filter = {
      status: "dispatched",
      providerId: "",
      notifiedIds: providerId,
      offerExpiresAt: { $gt: now },
    } as Document;
    const update = {
      $set: {
        status: "accepted",
        providerId,
        acceptedAt: now,
        notifiedIds: [],
        updatedAt: now,
      },
    };
    const options = { returnDocument: "after" as const, includeResultMetadata: false };
    // Booking ids are stored as string _id values by this repository; the
    // MongoDB driver's default Document type otherwise assumes ObjectId.
    const claimed = await collection.findOneAndUpdate({ ...filter, _id: id } as never, update, options)
      ?? await collection.findOneAndUpdate({ ...filter, id } as never, update, options);
    return Boolean(claimed);
  }

  let claimed = false;
  const run = async () => {
    const store = await readStore();
    const current = store.bookings?.[id] as (Doc & {
      status?: string;
      providerId?: string;
      notifiedIds?: string[];
      offerExpiresAt?: number;
    }) | undefined;
    if (
      !current ||
      current.status !== "dispatched" ||
      (current.providerId ?? "") !== "" ||
      !(current.notifiedIds ?? []).includes(providerId) ||
      typeof current.offerExpiresAt !== "number" ||
      current.offerExpiresAt <= now
    ) return;
    store.bookings ??= {};
    store.bookings[id] = {
      ...current,
      status: "accepted",
      providerId,
      acceptedAt: now,
      notifiedIds: [],
      updatedAt: now,
    };
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmp = `${DB_FILE}.${process.pid}.claim.tmp`;
    await fs.writeFile(tmp, JSON.stringify(store, null, 2), "utf8");
    await replaceFile(tmp, DB_FILE);
    claimed = true;
  };
  queue = queue.then(run, run);
  await queue;
  return claimed;
}

/* ── seeding ────────────────────────────────────────────────────── */

type Seeder = (store: Store) => Promise<Store> | Store;
const seeders: Seeder[] = [];

/** Register an idempotent seeder; they run once, on first access. */
export function registerSeeder(fn: Seeder): void {
  seeders.push(fn);
}

/** Every API route calls this first — cheap once the flag exists. */
export async function ready(): Promise<void> {
  await engine.seed();
}
