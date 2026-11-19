import { getFirebaseAuth, isFirebaseConfigured } from "./firebase";
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from "firebase/auth";
import type { User } from "./types";

let confirmation: ConfirmationResult | null = null;
let recaptcha: RecaptchaVerifier | null = null;

async function reportPhoneAuthFailure(phone: string, errorCode: string, errorMessage: string) {
  try {
    await fetch("/api/client-events", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Kaamdaar-Platform": "web" },
      body: JSON.stringify({
        event: "firebase_phone_verification_failed",
        platform: "web",
        phone,
        errorCode,
        errorMessage,
      }),
      keepalive: true,
    });
  } catch {
    // Diagnostic events are best-effort.
  }
}

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

export async function sendOtp(phone: string): Promise<void> {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase Phone Auth is not configured. Add the Firebase web app credentials first.");
  }
  const auth = getFirebaseAuth();
  if (!recaptcha) recaptcha = new RecaptchaVerifier(auth, "kaamdaar-recaptcha", { size: "invisible" });
  try {
    confirmation = await signInWithPhoneNumber(auth, phone, recaptcha);
  } catch (error) {
    confirmation = null;
    try { recaptcha.clear(); } catch { /* verifier may already be cleared */ }
    recaptcha = null;
    const code = error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code ?? "unknown")
      : "unknown";
    const message = error && typeof error === "object" && "message" in error ? String((error as { message?: unknown }).message ?? "") : "";
    void reportPhoneAuthFailure(phone, code, message);

    if (code === "auth/billing-not-enabled") {
      throw new Error(
        "Firebase is blocking SMS OTP because Cloud Billing is not linked to this project. " +
        "For real mobile numbers, the project owner must link a Cloud Billing account. " +
        "For no-SMS testing, add a fictional number (not an existing subscriber number) " +
        "under Firebase Console > Authentication > Phone numbers for testing, using its exact +91 format and test code. " +
        "This is a Firebase project setting, not an app-code error.",
      );
    }
    if (code === "auth/unauthorized-domain") {
      throw new Error(
        "This website domain is not authorized in Firebase Authentication. " +
        "Add the current Kaamdaar domain under Firebase Console > Authentication > Settings > Authorized domains.",
      );
    }
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
  let credential: Awaited<ReturnType<ConfirmationResult["confirm"]>>;
  try {
    credential = await confirmation.confirm(code);
  } catch (error) {
    const codeValue = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code ?? "unknown") : "unknown";
    const message = error && typeof error === "object" && "message" in error ? String((error as { message?: unknown }).message ?? "") : "";
    void reportPhoneAuthFailure(phone, codeValue, message);
    throw error;
  }
  confirmation = null;
  const idToken = await credential.user.getIdToken(true);
  try {
    return await authRequest({
      action: "verify",
      phone,
      idToken,
      platform: "web",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Phone sign-in failed";
    void reportPhoneAuthFailure(phone, "server/phone-verification-failed", message);
    throw error;
  }
}

export function resetOtpFlow() {
  confirmation = null;
  recaptcha?.clear();
  recaptcha = null;
}
