/** DELETE /api/users/:id/addresses/:addressId */
import { NextResponse } from "next/server";
import { get, remove, ready } from "../../../../../../server/db";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; addressId: string }> },
) {
  await ready();
  const { id, addressId } = await ctx.params;
  const addr = await get<{ userId: string }>("addresses", addressId);
  if (!addr || addr.userId !== id) {
    return NextResponse.json({ error: "Address not found" }, { status: 404 });
  }
  await remove("addresses", addressId);
  const { all } = await import("../../../../../../server/db");
  const rows = await all<{ userId: string }>("addresses");
  return NextResponse.json({ addresses: rows.filter((a) => a.userId === id) });
}
