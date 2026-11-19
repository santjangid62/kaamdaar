/**
 * Kaamdaar server-side database.
 *
 * One repository API, two storage engines:
 *  - MongoDB (Atlas) whenever `MONGODB_URI` is set.
 *  - A file-backed JSON store (`.data/db.json`) when it is absent.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { MongoClient, type Db, type Document } from "mongodb";

export type Collection =
  | "users" | "addresses" | "bookings" | "providers" | "services" | "categories" | "subcategories"
  | "reviews" | "complaints" | "banners" | "faqs" | "pages" | "campaigns" | "notifications"
  | "payouts" | "wallets" | "walletTxns" | "providerPayments" | "loginOtps" | "adminUsers" | "auditLogs" | "settings";
export const COLLECTIONS: Collection[] = [
  "users", "addresses", "bookings", "providers", "services", "categories", "subcategories",
  "reviews", "complaints", "banners", "faqs", "pages", "campaigns", "notifications",
  "payouts", "wallets", "walletTxns", "providerPayments", "loginOtps", "adminUsers", "auditLogs", "settings",
];
export type Store = Partial<Record<Collection, Record<string, Doc>>> & { seeded?: boolean };
export type Doc = Record<string, unknown> & { id: string };
const MONGODB_URI = process.env.MONGODB_URI?.trim() || "";
function databaseName(uri: string): string {
  if (process.env.MONGODB_DB?.trim()) return process.env.MONGODB_DB.trim();
  try { const probe = new URL(uri.replace(/^mongodb(\\+srv)?:\\/\\//, "https://")); return decodeURIComponent(probe.pathname.replace(/^\\//, "")).split("?")[0] || "kaamdaar"; }
  catch { return "kaamdaar"; }
}
const MONGODB_DB = MONGODB_URI ? databaseName(MONGODB_URI) : "kaamdaar";
const META_COLLECTION = "meta";
const REQUIRED_SITE_SETTINGS = ["site_name", "site_tagline", "site_description", "brand_navy", "brand_blue", "brand_orange", "brand_background", "home_hero_title_en", "home_hero_subtitle_en", "home_hero_title_hi", "home_hero_subtitle_hi"];
function err(message: string, cause?: unknown): never { throw new Error(`[db] ${message}`, { cause }); }
export function uid(prefix: string): string { return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`; }
export function usingMongo(): boolean { return Boolean(MONGODB_URI); }
type MongoGlobal = { kaamdaarMongo?: Promise<MongoClient> };
const mongoGlobal = globalThis as unknown as MongoGlobal;
function mongoClient(): Promise<MongoClient> {
  if (!mongoGlobal.kaamdaarMongo) mongoGlobal.kaamdaarMongo = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 10_000, maxPoolSize: 10, retryWrites: true }).connect().catch((e) => { mongoGlobal.kaamdaarMongo = undefined; throw new Error("[db] MongoDB connect failed — check MONGODB_URI and Atlas Network Access", { cause: e }); });
  return mongoGlobal.kaamdaarMongo;
}
async function mongoDb(): Promise<Db> { return (await mongoClient()).db(MONGODB_DB); }
function stripId<T>(doc: Document | null): T | null { if (!doc) return null; const { _id, ...rest } = doc; void _id; return rest as T; }
function withId<T extends Record<string, unknown>>(doc: T, id: string, createdAt: number, updatedAt: number): Document { return { ...doc, _id: id, id, createdAt, updatedAt }; }
const mongoEngine = {
  async all<T = Doc>(col: Collection): Promise<T[]> { const docs = await (await mongoDb()).collection(col).find({}).toArray(); return docs.map((d) => stripId<T>(d) as T); },
  async get<T = Doc>(col: Collection, id: string): Promise<T | null> { const c = (await mongoDb()).collection(col); return stripId<T>(await c.findOne({ _id: id } as Document) ?? await c.findOne({ id } as Document)); },
  async insert<T extends Record<string, unknown>>(col: Collection, doc: T): Promise<T & { id: string }> { const id = typeof doc.id === "string" && doc.id ? doc.id : uid(col.slice(0, 3)); const now = Date.now(); const raw = withId(doc, id, now, now); try { await (await mongoDb()).collection(col).insertOne(raw); } catch (e) { if ((e as { code?: number }).code === 11000) err(`duplicate id ${id} in ${col}`); throw e; } return stripId<T & { id: string }>(raw) as T & { id: string }; },
  async patch<T = Doc>(col: Collection, id: string, changes: Record<string, unknown>): Promise<T | null> { const { id: ignored, createdAt, _id, ...safe } = changes; void ignored; void createdAt; void _id; const c = (await mongoDb()).collection(col); const options = { returnDocument: "after" as const, includeResultMetadata: false }; const res = await c.findOneAndUpdate({ _id: id } as Document, { $set: { ...safe, updatedAt: Date.now() } }, options) ?? await c.findOneAndUpdate({ id } as Document, { $set: { ...safe, updatedAt: Date.now() } }, options); return stripId<T>(res as Document | null); },
  async upsert<T extends Record<string, unknown>>(col: Collection, id: string, doc: T): Promise<T & { id: string }> { const now = Date.now(); const { createdAt, ...fields } = doc; void createdAt; await (await mongoDb()).collection(col).updateOne({ _id: id } as Document, { $set: { ...fields, id, updatedAt: now }, $setOnInsert: { createdAt: now } }, { upsert: true }); return (await mongoEngine.get<T & { id: string }>(col, id)) ?? ({ ...doc, id } as T & { id: string }); },
  async remove(col: Collection, id: string): Promise<boolean> {
    const c = (await mongoDb()).collection(col);
    // Current repository rows use string _id values. Older imports may have
    // an ObjectId _id and a separate string `id`; delete both shapes safely.
    const byMongoId = await c.deleteOne({ _id: id } as Document);
    if (byMongoId.deletedCount > 0) return true;
    const byAppId = await c.deleteOne({ id } as Document);
    return byAppId.deletedCount > 0;
  },
  async count(col: Collection): Promise<number> { return (await mongoDb()).collection(col).countDocuments(); },
  async reset(col: Collection): Promise<void> { await (await mongoDb()).collection(col).deleteMany({}); },
  async seed(): Promise<void> {
    const db = await mongoDb(); const meta = db.collection(META_COLLECTION); const flag = await meta.findOne({ _id: "seeded" } as Document);
    if (flag) { const [services, admins, settings, version] = await Promise.all([db.collection("services").countDocuments(), db.collection("adminUsers").countDocuments(), db.collection("settings").countDocuments({ _id: { $in: REQUIRED_SITE_SETTINGS } } as Document), db.collection("settings").countDocuments({ _id: "catalog_schema_version" } as Document)]); if (services > 0 && admins > 0 && settings === REQUIRED_SITE_SETTINGS.length && version > 0) return; }
    await import("./seed"); if (seeders.length === 0) return;
    const store: Store = {}; for (const col of COLLECTIONS) { const docs = await db.collection(col).find({}).toArray(); const map: Record<string, Doc> = {}; for (const d of docs) { const doc = stripId<Doc>(d); if (doc) map[doc.id ?? String(d._id)] = doc; } store[col] = map; }
    let next: Store = { ...store, seeded: true }; for (const fn of seeders) next = await fn(next);
    for (const col of COLLECTIONS) { const docs = Object.values(next[col] ?? {}); if (!docs.length) continue; const ops = docs.map((d) => { const { id, ...fields } = d; const key = id ?? uid(col.slice(0, 3)); return { updateOne: { filter: { _id: key } as Document, update: { $set: { ...fields, id: key } } as Document, upsert: true } }; }); await db.collection(col).bulkWrite(ops, { ordered: false }); }
    await meta.updateOne({ _id: "seeded" } as Document, { $set: { at: Date.now() } }, { upsert: true });
  },
};
const DATA_DIR = process.env.VERCEL ? path.join("/tmp", "kaamdaar-data") : path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");
async function readStore(): Promise<Store> { try { return JSON.parse(await fs.readFile(DB_FILE, "utf8")) as Store; } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return {}; return err("could not parse .data/db.json — delete the file to re-seed", e); } }
let queue: Promise<void> = Promise.resolve();
async function replaceFile(tmp: string, target: string): Promise<void> { for (let attempt = 0; attempt < 5; attempt++) { try { await fs.rename(tmp, target); return; } catch (e) { const code = (e as NodeJS.ErrnoException).code; if (code !== "EPERM" && code !== "EACCES" && code !== "EBUSY") throw e; await new Promise((r) => setTimeout(r, 25 * (attempt + 1))); } } const payload = await fs.readFile(tmp, "utf8"); await fs.writeFile(target, payload, "utf8"); await fs.rm(tmp, { force: true }); }
async function writeStore(store: Store): Promise<void> { const run = async () => { await fs.mkdir(DATA_DIR, { recursive: true }); const tmp = `${DB_FILE}.${process.pid}.tmp`; await fs.writeFile(tmp, JSON.stringify(store, null, 2), "utf8"); await replaceFile(tmp, DB_FILE); }; queue = queue.then(run, run); await queue; }
const fileEngine = {
  async all<T = Doc>(col: Collection): Promise<T[]> { return Object.values((await readStore())[col] ?? {}) as T[]; },
  async get<T = Doc>(col: Collection, id: string): Promise<T | null> { return (((await readStore())[col] ?? {})[id] as T) ?? null; },
  async insert<T extends Record<string, unknown>>(col: Collection, doc: T): Promise<T & { id: string }> { const store = await readStore(); const list = (store[col] ??= {}); const id = typeof doc.id === "string" && doc.id ? doc.id : uid(col.slice(0, 3)); if (list[id]) err(`duplicate id ${id} in ${col}`); const now = Date.now(); const created = { ...doc, id, createdAt: now, updatedAt: now } as T & { id: string }; list[id] = created as Doc; await writeStore(store); return created; },
  async patch<T = Doc>(col: Collection, id: string, changes: Record<string, unknown>): Promise<T | null> { const store = await readStore(); const list = (store[col] ??= {}); const current = list[id]; if (!current) return null; const next = { ...current, ...changes, id, updatedAt: Date.now() }; list[id] = next; await writeStore(store); return next as T; },
  async upsert<T extends Record<string, unknown>>(col: Collection, id: string, doc: T): Promise<T & { id: string }> { const store = await readStore(); const list = (store[col] ??= {}); const now = Date.now(); const existing = list[id]; const next = { ...(existing ?? {}), ...doc, id, createdAt: existing?.createdAt ?? now, updatedAt: now }; list[id] = next as Doc; await writeStore(store); return next as T & { id: string }; },
  async remove(col: Collection, id: string): Promise<boolean> { const store = await readStore(); const list = store[col]; if (!list || !list[id]) return false; delete list[id]; await writeStore(store); return true; },
  async count(col: Collection): Promise<number> { return Object.keys((await readStore())[col] ?? {}).length; },
  async reset(col: Collection): Promise<void> { const store = await readStore(); store[col] = {}; await writeStore(store); },
  async seed(): Promise<void> { const store = await readStore(); const hasSiteSettings = REQUIRED_SITE_SETTINGS.every((id) => Boolean(store.settings?.[id])); const hasCatalogueVersion = Boolean(store.settings?.catalog_schema_version); if (store.seeded && store.services && hasSiteSettings && hasCatalogueVersion && store.adminUsers) return; await import("./seed"); let next: Store = { ...store, seeded: true }; for (const fn of seeders) next = await fn(next); await writeStore(next); },
};
type Engine = typeof fileEngine; const engine: Engine = MONGODB_URI ? (mongoEngine as Engine) : fileEngine;
export async function all<T = Doc>(col: Collection): Promise<T[]> { return engine.all<T>(col); }
export async function get<T = Doc>(col: Collection, id: string): Promise<T | null> { return engine.get<T>(col, id); }
export async function find<T = Doc>(col: Collection, pred: (doc: T) => boolean): Promise<T[]> { return (await all<T>(col)).filter(pred); }
export async function findOne<T = Doc>(col: Collection, pred: (doc: T) => boolean): Promise<T | null> { return (await all<T>(col)).find(pred) ?? null; }
export async function insert<T extends Record<string, unknown>>(col: Collection, doc: T): Promise<T & { id: string }> { return engine.insert<T>(col, doc); }
export async function patch<T = Doc>(col: Collection, id: string, changes: Record<string, unknown>): Promise<T | null> { return engine.patch<T>(col, id, changes); }
export async function upsert<T extends Record<string, unknown>>(col: Collection, id: string, doc: T): Promise<T & { id: string }> { return engine.upsert<T>(col, id, doc); }
export async function remove(col: Collection, id: string): Promise<boolean> { return engine.remove(col, id); }
export async function count(col: Collection): Promise<number> { return engine.count(col); }
export async function resetCollection(col: Collection): Promise<void> { return engine.reset(col); }

/** Atomically reserve a dispatched booking for one notified provider. */
export async function claimDispatchedBooking(id: string, providerId: string, now: number): Promise<boolean> {
  if (MONGODB_URI) { const c = (await mongoDb()).collection<Document>("bookings"); const filter = { status: "dispatched", providerId: "", notifiedIds: providerId, offerExpiresAt: { $gt: now } } as Document; const update = { $set: { status: "accepted", providerId, acceptedAt: now, notifiedIds: [], updatedAt: now } }; const options = { returnDocument: "after" as const, includeResultMetadata: false }; const claimed = await c.findOneAndUpdate({ ...filter, _id: id } as never, update, options) ?? await c.findOneAndUpdate({ ...filter, id } as never, update, options); return Boolean(claimed); }
  let claimed = false; const run = async () => { const store = await readStore(); const current = store.bookings?.[id] as (Doc & { status?: string; providerId?: string; notifiedIds?: string[]; offerExpiresAt?: number }) | undefined; if (!current || current.status !== "dispatched" || (current.providerId ?? "") !== "" || !(current.notifiedIds ?? []).includes(providerId) || typeof current.offerExpiresAt !== "number" || current.offerExpiresAt <= now) return; store.bookings ??= {}; store.bookings[id] = { ...current, status: "accepted", providerId, acceptedAt: now, notifiedIds: [], updatedAt: now }; await fs.mkdir(DATA_DIR, { recursive: true }); const tmp = `${DB_FILE}.${process.pid}.claim.tmp`; await fs.writeFile(tmp, JSON.stringify(store, null, 2), "utf8"); await replaceFile(tmp, DB_FILE); claimed = true; }; queue = queue.then(run, run); await queue; return claimed;
}
/** Atomically reserve a provider for one active booking. */
export async function claimProviderBooking(providerId: string, bookingId: string): Promise<boolean> {
  if (MONGODB_URI) { const c = (await mongoDb()).collection<Document>("providers"); const filter = { $or: [{ activeBookingId: { $exists: false } }, { activeBookingId: null }, { activeBookingId: "" }] } as Document; const update = { $set: { activeBookingId: bookingId, availabilityStatus: "busy", availabilityUpdatedAt: Date.now() } }; const options = { returnDocument: "after" as const, includeResultMetadata: false }; return Boolean(await c.findOneAndUpdate({ ...filter, _id: providerId } as never, update, options) ?? await c.findOneAndUpdate({ ...filter, id: providerId } as never, update, options)); }
  let claimed = false; const run = async () => { const store = await readStore(); const provider = store.providers?.[providerId] as (Doc & { activeBookingId?: string }) | undefined; if (!provider || (provider.activeBookingId && provider.activeBookingId !== bookingId)) return; store.providers ??= {}; store.providers[providerId] = { ...provider, activeBookingId: bookingId, availabilityStatus: "busy", availabilityUpdatedAt: Date.now() }; await fs.mkdir(DATA_DIR, { recursive: true }); const tmp = `${DB_FILE}.${process.pid}.provider-claim.tmp`; await fs.writeFile(tmp, JSON.stringify(store, null, 2), "utf8"); await replaceFile(tmp, DB_FILE); claimed = true; }; queue = queue.then(run, run); await queue; return claimed;
}
export async function releaseProviderBooking(providerId: string, bookingId: string): Promise<void> {
  if (MONGODB_URI) { const c = (await mongoDb()).collection<Document>("providers"); await c.updateOne({ _id: providerId, activeBookingId: bookingId } as Document, { $set: { activeBookingId: "", availabilityStatus: "available", availabilityUpdatedAt: Date.now() } }); await c.updateOne({ id: providerId, activeBookingId: bookingId } as Document, { $set: { activeBookingId: "", availabilityStatus: "available", availabilityUpdatedAt: Date.now() } }); return; }
  const store = await readStore(); const provider = store.providers?.[providerId] as (Doc & { activeBookingId?: string }) | undefined; if (!provider || provider.activeBookingId !== bookingId) return; store.providers![providerId] = { ...provider, activeBookingId: "", availabilityStatus: "available", availabilityUpdatedAt: Date.now() }; await writeStore(store);
}

let seeders: Array<(store: Store) => Promise<Store> | Store> = [];
export function registerSeeder(fn: (store: Store) => Promise<Store> | Store): void { seeders.push(fn); }
let readyPromise: Promise<void> | null = null;
export async function ready(): Promise<void> { if (!readyPromise) readyPromise = engine.seed().catch((e) => { readyPromise = null; throw e; }); await readyPromise; }
export async function healthCheck(): Promise<{ ok: boolean; engine: "mongo" | "file"; database: string; error?: string }> {
  try { if (MONGODB_URI) { const db = await mongoDb(); await db.command({ ping: 1 }); return { ok: true, engine: "mongo", database: MONGODB_DB }; } await fs.access(DB_FILE).catch(() => undefined); return { ok: true, engine: "file", database: "local" }; }
  catch (e) { return { ok: false, engine: MONGODB_URI ? "mongo" : "file", database: MONGODB_DB, error: e instanceof Error ? e.message : "Database check failed" }; }
}
