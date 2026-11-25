import { NextResponse } from "next/server";
import { GET as getOverview } from "../../overview/route";
import { bearerToken, verifyMobileSuperAdminToken } from "../../../../../lib/super-admin/mobile-auth";

export async function GET(req: Request) {
  if (!verifyMobileSuperAdminToken(bearerToken(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return getOverview(req);
}
