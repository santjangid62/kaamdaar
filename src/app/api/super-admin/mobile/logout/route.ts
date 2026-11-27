import { NextResponse } from "next/server";
import { bearerToken, revokeMobileSuperAdminToken } from "../../../../../lib/super-admin/mobile-auth";

export async function POST(req: Request) {
  await revokeMobileSuperAdminToken(bearerToken(req));
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
