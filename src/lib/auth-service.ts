import { getFirebaseAuth, isFirebaseConfigured } from "./firebase";
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from "firebase/auth";
import type { User } from "./types";

let confirmation: ConfirmationResult | null = null;
let recaptcha: RecaptchaVerifier | null = null;
export interface SendOtpResult {}

async function authRequest(body: Record<string, unknown>) {
  const response = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Phone verification failed");
  return data;
}

export async function sendOtp(phone: string): Promise<SendOtpResult> {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase Phone Auth is not configured. Add the Firebase web app credentials first.");
  }
  const auth = getFirebaseAuth();
  if (!recaptcha) recaptcha = new RecaptchaVerifier(auth, "kaamdaar-recaptcha", { size: "invisible" });
  try {
    confirmation = await signInWithPhoneNumber(auth, phone, recaptcha);
    return {};
  } catch (error) {
    confirmation = null;
    try { recaptcha.clear(); } catch { /* verifier may already be cleared */ }
    recaptcha = null;
    const code = error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code ?? "unknown")
      : "unknown";
    throw new Error(`Firebase OTP request failed (${code})`);
  }
}

/** Completes Firebase OTP and asks the server to resolve the verified account. */
export async function verifyOtp(
  phone: string,
  code: string,
): Promise<{ user: User; isNew: boolean }> {
  if (!isFirebaseConfigured || !confirmation) {
    throw new Error("OTP session expired. Request a new code.");
  }
  const credential = await confirmation.confirm(code);
  confirmation = null;
  const idToken = await credential.user.getIdToken(true);
  return authRequest({
    action: "verify",
    phone,
    idToken,
    platform: "web",
  });
}

export function resetOtpFlow() {
  confirmation = null;
  recaptcha?.clear();
  recaptcha = null;
}
