import { createHmac, timingSafeEqual } from "node:crypto";

const PHONE_RE = /^\+91[6-9]\d{9}$/;

export function normalizeIndianPhone(value: string): string {
  const raw = (value ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  let ten = "";
  if (digits.length === 10) {
    ten = digits;
  } else if (digits.length === 12 && digits.startsWith("91")) {
    ten = digits.slice(2);
  } else {
    return "";
  }
  const normalized = `+91${ten}`;
  return PHONE_RE.test(normalized) ? normalized : "";
}

/**
 * QA-only signed bearer token. This is deliberately separate from Firebase
 * tokens and is accepted only while the server QA switch and secret exist.
 * Vercel config scopes that switch and secret to the named Preview branch.
 */
export function createQaMobileToken(phone: string, role: "customer" | "provider"): string {
  const secret = process.env.QA_MOBILE_AUTH_SECRET;
  if (process.env.QA_MOBILE_AUTH_ENABLED !== "true" || !secret) {
    throw new Error("QA mobile authentication is disabled");
  }
  const payload = Buffer.from(JSON.stringify({
    phone, uid: `qa:${role}:${phone}`, role,
    iss: "kaamdaar-qa-mobile", exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60,
  })).toString("base64url");
  const unsigned = `qa1.${payload}`;
  const signature = createHmac("sha256", secret).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
}

function verifyQaMobileToken(token: string): { phone: string; uid: string } | null {
  const secret = process.env.QA_MOBILE_AUTH_SECRET;
  if (process.env.QA_MOBILE_AUTH_ENABLED !== "true" || !secret || !token.startsWith("qa1.")) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const unsigned = `${parts[0]}.${parts[1]}`;
  const expected = createHmac("sha256", secret).update(unsigned).digest();
  let actual: Buffer;
  try { actual = Buffer.from(parts[2], "base64url"); } catch { return null; }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
      phone?: string; uid?: string; iss?: string; exp?: number;
    };
    const phone = normalizeIndianPhone(payload.phone ?? "");
    if (payload.iss !== "kaamdaar-qa-mobile" || !payload.uid ||
        !phone || typeof payload.exp !== "number" || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return { phone, uid: payload.uid };
  } catch { return null; }
}

/**
 * Validates a Firebase Phone Auth ID token with Google's Identity Toolkit.
 * Application identity and profile data remain in MongoDB.
 */
export async function verifyFirebasePhoneToken(idToken: string): Promise<{ phone: string; uid: string }> {
  if (!idToken?.trim()) throw new Error("Firebase verification token is required");
  const qaIdentity = verifyQaMobileToken(idToken);
  if (qaIdentity) return qaIdentity;
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
  const payload = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
    users?: Array<{ phoneNumber?: string; phone_number?: string; localId?: string }>;
  };
  if (!response.ok) {
    // Surface Google's safe error code (never the API key or ID token) so
    // production diagnostics distinguish disabled Identity Toolkit, key
    // restrictions, invalid tokens and expired sessions.
    const code = (payload.error?.message ?? "UNKNOWN").replace(/[^A-Z0-9_]/gi, "").slice(0, 80);
    throw new Error(`Firebase phone verification failed (${response.status}: ${code})`);
  }
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
  try {
    return await verifyFirebasePhoneToken(match[1]);
  } catch {
    return null;
  }
}
