import { getFirebaseAuth, isFirebaseConfigured } from "./firebase";
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from "firebase/auth";
import type { User } from "./types";

let confirmation: ConfirmationResult | null = null;
let recaptcha: RecaptchaVerifier | null = null;

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
  // OTP login always starts a fresh Firebase verification flow. Protected
  // browser APIs use the paired HttpOnly session cookie, not this Firebase user.
  await auth.signOut();
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
): Promise<{ user: User; isNew: boolean; pairingRequired: boolean; deviceRequired: boolean; existingDevice: { deviceName: string; loginAt: number; lastSeenAt: number; location: { label?: string; latitude?: number; longitude?: number; updatedAt: number } | null } | null }> {
  if (!isFirebaseConfigured || !confirmation) {
    throw new Error("OTP session expired. Request a new code.");
  }
  const credential = await confirmation.confirm(code);
  confirmation = null;
  const idToken = await credential.user.getIdToken(true);
  const data = await authRequest({
    action: "verify",
    phone,
    idToken,
    platform: "web",
  });
  return {
    user: data.user as User,
    isNew: data.isNew === true,
    pairingRequired: data.pairingRequired === true,
    deviceRequired: data.deviceRequired === true,
    existingDevice: data.existingDevice ?? null,
  };
}

/** Pair this browser with the native app already authorized for the same phone. */
export async function completeWebPairing(
  phone: string,
  code: string,
  role: "customer" | "provider" = "customer",
): Promise<void> {
  const current = getFirebaseAuth().currentUser;
  if (!current) throw new Error("Verify your mobile number first.");
  const currentPhone = current.phoneNumber ?? "";
  if (currentPhone.replace(/\D/g, "").slice(-10) !== phone.replace(/\D/g, "").slice(-10)) {
    throw new Error("The verified mobile number does not match this login.");
  }
  const idToken = await current.getIdToken(true);
  const response = await fetch("/api/auth/device-pair/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ idToken, code, role }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.paired !== true) {
    throw new Error(data.error ?? "Browser pairing failed.");
  }
}

export function resetOtpFlow() {
  confirmation = null;
  recaptcha?.clear();
  recaptcha = null;
}
