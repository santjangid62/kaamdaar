const PHONE_RE = /^\+91[6-9]\d{9}$/;

export function normalizeIndianPhone(value: string): string {
  const digits = (value ?? "").replace(/\D/g, "");
  const ten = digits.length > 10 ? digits.slice(-10) : digits;
  return /^\d{10}$/.test(ten) ? `+91${ten}` : "";
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
  if (!phone || !PHONE_RE.test(phone) || !user?.localId) {
    throw new Error("Firebase account has no verified Indian mobile number");
  }
  return { phone, uid: user.localId };
}
