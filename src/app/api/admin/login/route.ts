import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  checkCredentials,
  createSessionToken,
  isAuthed,
} from "../../../../lib/admin/auth";

/** GET — quick session check used by the login screen to skip a re-login. */
export async function GET() {
  return NextResponse.json({ authed: await isAuthed() });
}

export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = (await req.json()) as { email?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = body.email ?? "";
  const password = body.password ?? "";

  if (!email.trim() || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  if (!checkCredentials(email, password)) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, email: email.trim().toLowerCase() });
  res.cookies.set(ADMIN_COOKIE, createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}