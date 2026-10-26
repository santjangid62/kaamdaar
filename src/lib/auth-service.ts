import {
  getFirebaseAuth,
  isFirebaseConfigured,
} from "./firebase";
import {
  ConfirmationResult,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from "firebase/auth";

/**
 * Phone + OTP verification.
 *
 * Production: Firebase Phone Auth (send OTP to the number, confirm the code).
 * Dev mode (no Firebase credentials): a 6-digit code is generated locally and
 * handed back to the UI so the full login flow can be exercised without a
 * Firebase project. Swap in credentials in `.env.local` and the Firebase path
 * takes over automatically.
 */

const devCodes = new Map<string, string>();
let confirmation: ConfirmationResult | null = null;
let recaptcha: RecaptchaVerifier | null = null;

export interface SendOtpResult {
  /** Dev-mode only: the code to display on screen. */
  devCode?: string;
}

export async function sendOtp(phone: string): Promise<SendOtpResult> {
  if (isFirebaseConfigured) {
    const auth = getFirebaseAuth();
    if (!recaptcha) {
      recaptcha = new RecaptchaVerifier(auth, "kaamdaar-recaptcha", { size: "invisible" });
    }
    confirmation = await signInWithPhoneNumber(auth, phone, recaptcha);
    return {};
  }
  const code = String(Math.floor(100000 + Math.random() * 900000));
  devCodes.set(phone, code);
  return { devCode: code };
}

export async function verifyOtp(phone: string, code: string): Promise<boolean> {
  if (isFirebaseConfigured) {
    if (!confirmation) return false;
    const cred = await confirmation.confirm(code);
    confirmation = null;
    return Boolean(cred.user);
  }
  const expected = devCodes.get(phone);
  if (!expected) return false;
  const ok = expected === code.trim();
  if (ok) devCodes.delete(phone);
  return ok;
}

export function resetOtpFlow() {
  confirmation = null;
  devCodes.clear();
}