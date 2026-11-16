import { createHmac, timingSafeEqual } from "node:crypto";

const PHONE_RE = /^\+91[6-9]\d{9}$/;

function testSessionSecret(): string {
  const secret = process.env.TEST_AUTH_SESSION_SECRET ?? process.env.ADMIN_SESSION_SECRET ?? "";
  if (secret.length < 32) throw new Error("A 32-character TEST_AUTH_SESSION_SECRET is required for test sessions");
  return secret;
}
function signTestPayload(payload: string): string {
  return createHmac("sha256", testSessionSecret()).update(payload).digest("base64url");
}
export function createTestAuthSession(phone: string): string {
  const normalized = normalizeIndianPhone(phone);
  if (process.env.TEST_AUTH_ENABLED !== "true" || !normalized) throw new Error("Test authentication is disabled");
  const payload = Buffer.from(JSON.stringify({ iss: "kaamdaar-test-auth", phone: normalized, uid: "test:" + normalized, exp: Date.now() + 12 * 60 * 60 * 1000 })).toString("base64url");
  return "kdm_test." + payload + "." + signTestPayload(payload);
}
function verifyTestAuthSession(token: string): { phone: string; uid: string } | null {
  if (process.env.TEST_AUTH_ENABLED !== "true") return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "kdm_test") return null;
  try {
    const expected = Buffer.from(signTestPayload(parts[1]));
    const actual = Buffer.from(parts[2]);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const data = JSON.parse(Buffer.from(parts[1], "base64url").toString()) as { iss?: string; phone?: string; uid?: string; exp?: number };
    const phone = normalizeIndianPhone(data.phone ?? "");
    const allowed = new Set((process.env.TEST_AUTH_PHONES ?? "").split(",").map(normalizeIndianPhone));
    if (data.iss !== "kaamdaar-test-auth" || !phone || !allowed.has(phone) || data.uid !== "test:" + phone || !data.exp || data.exp <= Date.now()) return null;
    return { phone, uid: data.uid };
  } catch { return null; }
}

export function normalizeIndianPhone(value: string): string {
  const raw = (value ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  let ten = "";
  if (digits.length === 10) {
    ten = digits;
  } else if (digits.length === 12 && digits.startsWith("91")) {
    ten = digits.slice(2);
  } else {
    // Do not reinterpret a foreign country code's last ten digits as +91.
    return "";
  }
  const normalized = `+91${ten}`;
  return PHONE_RE.test(normalized) ? normalized : "";
}

/**
 * Validates a Firebase Phone Auth ID token with Google's Identity Toolkit
 * and returns the verified Indian mobile number. Never trust a phone supplied
 * by the client when authorizing provider-only operations.
 */
export async function verifyFirebasePhoneToken(idToken: string): Promise<{ phone: string; uid: string }> {
  if (!idToken?.trim()) throw new Error("Firebase verification token is required");
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) throw new Error("Firebase server verification is not configured");

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
      cache: "no-store",
    },
  );
  if (!response.ok) throw new Error("Firebase phone verification failed");

  const payload = (await response.json()) as {
    users?: Array<{ phoneNumber?: string; phone_number?: string; localId?: string }>;
  };
  const user = payload.users?.[0];
  const phone = normalizeIndianPhone(user?.phoneNumber ?? user?.phone_number ?? "");
  if (!phone || !user?.localId) {
    throw new Error("Firebase account has no verified Indian mobile number");
  }
  return { phone, uid: user.localId };
}


/** Resolve a verified Firebase identity from a Bearer token on an API request. */
export async function firebaseIdentityFromRequest(
  request: Request,
): Promise<{ phone: string; uid: string } | null> {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) return null;
  const testIdentity = verifyTestAuthSession(match[1]);
  if (testIdentity) return testIdentity;
  try {
    return await verifyFirebasePhoneToken(match[1]);
  } catch {
    return null;
  }
}
