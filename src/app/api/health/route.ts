import { NextResponse } from "next/server";
import { healthCheck } from "../../../server/db";
import { isAdminAuthConfigured } from "../../../lib/admin/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [database] = await Promise.all([healthCheck()]);
  const firebaseAuth = Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET &&
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID &&
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  );

  let firebaseMessaging = false;
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (raw) {
      const account = JSON.parse(raw) as {
        project_id?: string;
        client_email?: string;
        private_key?: string;
      };
      firebaseMessaging = Boolean(
        (process.env.FIREBASE_PROJECT_ID || account.project_id) &&
        account.client_email &&
        account.private_key?.includes("BEGIN PRIVATE KEY"),
      );
    }
  } catch {
    firebaseMessaging = false;
  }

  const adminAuth = isAdminAuthConfigured();
  const checks = { database, firebaseAuth, firebaseMessaging, adminAuth };
  const ready = database.ok && firebaseAuth && firebaseMessaging && adminAuth;
  return NextResponse.json(
    {
      status: ready ? "ready" : "not_ready",
      checks,
      checkedAt: new Date().toISOString(),
    },
    { status: ready ? 200 : 503 },
  );
}
