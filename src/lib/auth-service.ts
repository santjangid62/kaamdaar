import { getFirebaseAuth, isFirebaseConfigured } from "./firebase";
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from "firebase/auth";
import type { User } from "./types";

let confirmation: ConfirmationResult | null = null;
let recaptcha: RecaptchaVerifier | null = null;
let devCode: string | null = null;
let testModePhone: string | null = null;

export interface SendOtpResult { devCode?: string; }

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
  {
    try {
      const data = await authRequest({ action: "send", phone });
      if (data.testMode === true) {
        testModePhone = phone;
        devCode = String(data.devCode ?? "123456");
        return { devCode };
      }
    } catch {
      // Not an allowlisted test number; continue with real Firebase auth.
    }
  }
  if (isFirebaseConfigured) {
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
  if (process.env.NODE_ENV === "production") {
    throw new Error("Firebase Phone Auth is not configured. Please contact support.");
  }
  const data = await authRequest({ action: "send", phone });
  devCode = String(data.devCode ?? "");
  return { devCode };
}

/** Completes Firebase OTP and asks the server to resolve the verified account. */
export async function verifyOtp(
  phone: string,
  code: string,
): Promise<{ user: User; isNew: boolean }> {
  let idToken: string | undefined;
  if (testModePhone === phone && devCode === code.trim()) {
    testModePhone = null;
    devCode = null;
  } else if (isFirebaseConfigured) {
    if (!confirmation) throw new Error("OTP session expired. Request a new code.");
    const credential = await confirmation.confirm(code);
    confirmation = null;
    idToken = await credential.user.getIdToken(true);
  } else {
    if (process.env.NODE_ENV === "production" || !devCode || devCode !== code.trim()) {
      throw new Error("Incorrect or expired OTP");
    }
    devCode = null;
  }
  return authRequest({
    action: "verify",
    phone,
    ...(idToken ? { idToken } : { code }),
    platform: "web",
  });
}

export function resetOtpFlow() {
  confirmation = null;
  devCode = null;
  testModePhone = null;
  recaptcha?.clear();
  recaptcha = null;
}
