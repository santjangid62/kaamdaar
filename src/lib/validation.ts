/**
 * Form validators for every input that collects user data — login, profile,
 * addresses and any future form. Rules follow real Indian formats:
 * mobile numbers as allocated by TRAI, PIN codes as assigned by India Post.
 */

/** 10-digit Indian mobile number. Must start 6/7/8/9 — anything else is rejected. */
export function isValidIndianMobile(digits: string): boolean {
  return /^[6-9]\d{9}$/.test(digits.replace(/\D/g, ""));
}

/** Normalize any phone input to the +91 form the auth layer expects. */
export function toE164Indian(input: string): string {
  const d = input.replace(/\D/g, "").slice(-10);
  return `+91${d}`;
}

/** Pretty 10-digit grouping: 98765 43210. */
export function formatMobile(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 10);
  return d.length > 5 ? `${d.slice(0, 5)} ${d.slice(5)}` : d;
}

/**
 * Indian PIN code prefixes actually assigned by India Post (postal circles).
 * 6-digit PINs exist only under these leading pairs; 9x is Army Post Office
 * and is not a deliverable civilian address.
 */
const VALID_PIN_PREFIXES = new Set([
  "11", "12", "13", "14", "15", "16", "17", "18", "19",
  "20", "21", "22", "23", "24", "25", "26", "27", "28",
  "30", "31", "32", "33", "34",
  "36", "37", "38", "39",
  "40", "41", "42", "43", "44",
  "45", "46", "47", "48", "49",
  "50", "51", "52", "53", "54",
  "56", "57", "58", "59",
  "60", "61", "62", "63", "64",
  "67", "68", "69",
  "70", "71", "72", "73", "74",
  "75", "76", "77",
  "78", "79",
  "80", "81", "82", "83", "84", "85",
]);

/**
 * Valid Indian PIN code: exactly 6 digits whose leading two digits belong to
 * a real postal circle. Catches both malformed input (123, 1234567) and
 * well-formed but non-existent PINs (999999, 290001).
 */
export function isValidIndianPin(pin: string): boolean {
  const p = pin.replace(/\D/g, "");
  if (!/^\d{6}$/.test(p)) return false;
  return VALID_PIN_PREFIXES.has(p.slice(0, 2));
}

/** Optional email — only enforced when the user actually types one. */
export function isValidEmail(email: string): boolean {
  const e = email.trim();
  if (!e) return false;
  if (e.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
}

/** Human names: letters (Latin + Devanagari), spaces, hyphens, apostrophes, dots. */
export function isValidName(name: string): boolean {
  const n = name.trim();
  if (n.length < 2 || n.length > 60) return false;
  return /^[\p{L}][\p{L}\s'.-]*$/u.test(n);
}

/** Free-text city / locality: letters, numbers, spaces, common punctuation. */
export function isValidPlaceName(value: string): boolean {
  const v = value.trim();
  if (v.length < 2 || v.length > 80) return false;
  return /^[\p{L}\p{N}\s',.&()-]+$/u.test(v);
}

/** PIN or mobile error message key to show under the field. */
export type ValidatorKey = "invalidMobile" | "invalidPin" | "invalidEmail" | "invalidName" | "invalidPlace";
