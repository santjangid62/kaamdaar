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
 * Validates a Firebase Phone Auth ID token with Google's Identity Toolkit.
 * Application identity and profile data remain in MongoDB.
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
  const payload = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
    users?: Array<{ phoneNumber?: string; phone_number?: string; localId?: string }>;
  };
  if (!response.ok) {
    // Preserve Google's actionable error code without ever logging the API key
    // or the supplied Firebase ID token.
    const code = payload.error?.message || `HTTP_${response.status}`;
    const guidance: Record<string, string> = {
      API_KEY_INVALID: "Firebase server API key is invalid or belongs to a different project",
      INVALID_ID_TOKEN: "Firebase ID token is invalid — sign in again and retry",
      TOKEN_EXPIRED: "Firebase ID token expired — sign in again and retry",
      USER_DISABLED: "This Firebase account is disabled",
      PROJECT_NOT_FOUND: "Firebase project configuration could not be found",
    };
    throw new Error(`Firebase token verification failed (${code}): ${guidance[code] ?? "check the Firebase project API key and Phone Auth configuration"}`);
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
