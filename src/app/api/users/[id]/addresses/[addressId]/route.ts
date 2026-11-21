/** DELETE /api/users/:id/addresses/:addressId */
import { NextResponse } from "next/server";
import { all, get, remove, ready } from "../../../../../../server/db";
import { firebaseIdentityFromRequest, normalizeIndianPhone } from "../../../../../../server/firebase-auth";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; addressId: string }> },
) {
  await ready();
  const identity = await firebaseIdentityFromRequest(_req);
  if (!identity || identity.role !== "customer") {
    return NextResponse.json({ error: "A valid Customer device session is required" }, { status: 401 });
  }
  const { id, addressId } = await ctx.params;
  const users = await all<{ id: string; phone?: string }>("users");
  const owner = users.find((user) => user.id === id && normalizeIndianPhone(user.phone ?? "") === identity.phone);
  if (!owner) return NextResponse.json({ error: "You can only delete your own saved addresses" }, { status: 403 });
  const addr = await get<{ userId: string }>("addresses", addressId);
  if (!addr || addr.userId !== id) {
    return NextResponse.json({ error: "Address not found" }, { status: 404 });
  }
  await remove("addresses", addressId);
  const { all } = await import("../../../../../../server/db");
  const rows = await all<{ userId: string }>("addresses");
  return NextResponse.json({ addresses: rows.filter((a) => a.userId === id) });
}
