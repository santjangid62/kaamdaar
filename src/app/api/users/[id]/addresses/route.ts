/**
 * Addresses of a user. POST upserts (existing id updates, new id inserts) and
 * always returns the full list so the UI can replace its state in one step.
 */
import { NextResponse } from "next/server";
import { all, patch, ready, uid } from "../../../../../server/db";
import type { Address } from "../../../../../lib/types";

const PIN_PREFIXES = new Set([
  "11","12","13","14","15","16","17","18","19",
  "20","21","22","23","24","25","26","27","28",
  "30","31","32","33","34","36","37","38","39",
  "40","41","42","43","44","45","46","47","48","49",
  "50","51","52","53","54","56","57","58","59",
  "60","61","62","63","64","67","68","69",
  "70","71","72","73","74","75","76","77","78","79",
  "80","81","82","83","84","85",
]);

async function listFor(userId: string): Promise<Address[]> {
  const rows = await all<Address & { userId: string }>("addresses");
  return rows.filter((a) => a.userId === userId);
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await ready();
  const { id } = await ctx.params;
  return NextResponse.json({ addresses: await listFor(id) });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await ready();
  const { id: userId } = await ctx.params;
  let body: Partial<Address>;
  try {
    body = (await req.json()) as Partial<Address>;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const line1 = (body.line1 ?? "").trim();
  const city = (body.city ?? "").trim();
  const pin = (body.pincode ?? "").replace(/\D/g, "");

  if (line1.length < 3) return NextResponse.json({ error: "Flat / building / street is required" }, { status: 422 });
  if (city.length < 2) return NextResponse.json({ error: "Enter a valid city / area name" }, { status: 422 });
  if (!/^\d{6}$/.test(pin) || !PIN_PREFIXES.has(pin.slice(0, 2))) {
    return NextResponse.json({ error: "Enter a valid 6-digit Indian PIN code" }, { status: 422 });
  }

  const existing = await listFor(userId);
  const addressId = body.id && body.id !== "live" ? body.id : uid("addr");
  const isFirst = existing.length === 0;

  const record: Address & { userId: string } = {
    id: addressId,
    userId,
    label: (body.label ?? "Home").trim() || "Home",
    line1,
    line2: (body.line2 ?? "").trim(),
    city,
    pincode: pin,
    lat: typeof body.lat === "number" ? body.lat : undefined,
    lng: typeof body.lng === "number" ? body.lng : undefined,
    isDefault: body.isDefault ?? isFirst,
  };

  if (existing.some((a) => a.id === addressId)) {
    await patch("addresses", addressId, record as unknown as Record<string, unknown>);
  } else {
    const { insert } = await import("../../../../../server/db");
    if (record.isDefault) {
      for (const a of existing.filter((x) => x.isDefault)) await patch("addresses", a.id, { isDefault: false });
    }
    await insert("addresses", record as unknown as Record<string, unknown>);
  }
  return NextResponse.json({ addresses: await listFor(userId) });
}
