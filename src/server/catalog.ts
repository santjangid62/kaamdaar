/** Server-side catalogue reads (used by pages and the assistant API). */
import { all, ready } from "./db";
import type { PriceUnit, Service } from "../lib/types";

export type ServiceRow = Service & { active?: boolean; order?: number; parent?: string };

const UNITS: PriceUnit[] = ["per task", "per hour", "per visit"];

/**
 * Admin-created rows can miss optional fields (older records, partial forms).
 * Normalise once, on read, so every consumer — cards, detail page, booking
 * rail, assistant — always gets a complete Service.
 */
export function normalizeService(raw: Partial<ServiceRow> & { id: string }): ServiceRow {
  const price = Number(raw.price);
  return {
    ...raw,
    id: raw.id,
    name: raw.name?.trim() || raw.id,
    category: raw.category?.trim() || "General",
    tagline: raw.tagline ?? "",
    description: raw.description ?? "",
    includes: Array.isArray(raw.includes) ? raw.includes : [],
    excludes: Array.isArray(raw.excludes) ? raw.excludes : [],
    duration: raw.duration?.trim() || "—",
    price: Number.isFinite(price) && price > 0 ? price : 0,
    unit: UNITS.includes(raw.unit as PriceUnit) ? (raw.unit as PriceUnit) : "per task",
    popular: Boolean(raw.popular),
    slots: Array.isArray(raw.slots) && raw.slots.length > 0 ? raw.slots : undefined,
    icon: raw.icon || undefined,
    image: raw.image || undefined,
    active: raw.active !== false,
    order: raw.order ?? 0,
    parent: raw.parent ?? "",
  };
}

export async function getServices(includeHidden = false): Promise<ServiceRow[]> {
  await ready();
  const rows = await all<ServiceRow>("services");
  return rows
    .map((s) => normalizeService(s))
    .filter((s) => includeHidden || s.active !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function getServiceById(id: string): Promise<ServiceRow | null> {
  await ready();
  const { get } = await import("./db");
  const row = await get<ServiceRow>("services", id);
  return row ? normalizeService(row) : null;
}

export async function getServiceCategories(): Promise<string[]> {
  const services = await getServices();
  const set = new Set(services.map((s) => s.category).filter(Boolean));
  const cats = await all<{ name: string; active: boolean }>("categories");
  cats.filter((c) => c.active).forEach((c) => set.add(c.name));
  return [...set];
}
