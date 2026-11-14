/** PATCH /api/users/:id — profile update with the same validation as the UI. */
import { NextResponse } from "next/server";
import { all, patch, ready } from "../../../../server/db";
import { firebaseIdentityFromRequest, normalizeIndianPhone } from "../../../../server/firebase-auth";

const NAME = /^[\p{L}][\p{L}\s'.-]*$/u;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await ready();
  const { id } = await ctx.params;
  const identity = await firebaseIdentityFromRequest(req);
  if (!identity) return NextResponse.json({ error: "Firebase sign-in is required" }, { status: 401 });
  const users = await all<{ id: string; phone?: string }>("users");
  const owner = users.find((u) => normalizeIndianPhone(u.phone ?? "") === identity.phone);
  if (!owner || owner.id !== id) {
    return NextResponse.json({ error: "You can only update your own profile" }, { status: 403 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const changes: Record<string, unknown> = {};
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : undefined;
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : undefined;
  const email = typeof body.email === "string" ? body.email.trim() : undefined;

  if (firstName !== undefined) {
    if (firstName.length < 2 || firstName.length > 60 || !NAME.test(firstName)) {
      return NextResponse.json({ error: "First name must be letters only (2–60 characters)" }, { status: 422 });
    }
    changes.firstName = firstName;
  }
  if (lastName !== undefined) {
    if (lastName.length < 2 || lastName.length > 60 || !NAME.test(lastName)) {
      return NextResponse.json({ error: "Last name must be letters only (2–60 characters)" }, { status: 422 });
    }
    changes.lastName = lastName;
  }
  if (email !== undefined) {
    if (email && !EMAIL.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 422 });
    }
    changes.email = email;
  }
  if (typeof body.photo === "string") changes.photo = body.photo;

  const user = await patch("users", id, changes);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json({ user });
}
