import { NextResponse } from "next/server";
import { isAuthed } from "../../../../lib/admin/auth";

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const enabled = process.env.TEST_AUTH_ENABLED === "true";
  const phones = enabled
    ? (process.env.TEST_AUTH_PHONES ?? "").split(",").map((v) => v.trim()).filter(Boolean)
    : [];
  return NextResponse.json({
    enabled,
    otp: enabled ? (process.env.TEST_AUTH_OTP || "123456") : null,
    phones,
    note: "Only these allowlisted numbers can use the shared test OTP. Real OTPs are never collected or displayed here.",
  });
}
