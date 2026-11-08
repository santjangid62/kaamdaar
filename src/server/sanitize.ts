/**
 * Admin write sanitiser shared by POST and PATCH /api/admin/data/:collection.
 *
 * The admin forms send plain JSON, so a numeric field can arrive as a typed
 * string (e.g. price: "abc"). Without this, such a value would be stored as-is
 * and every ₹/% calculation downstream (frontend cards, commission splits)
 * would render NaN. Rules:
 *   - only primitives and string/number arrays pass through,
 *   - a field that is numeric by name — or numeric in the stored row — is
 *     coerced; a value that cannot become a finite number is rejected with 400.
 */

const NUMERIC_KEY =
  /^(price|amount|balance|rating|order|commission|rate|jobs|reviews|experience|count|pct|percent|wallet|min[A-Za-z]+|max[A-Za-z]+)$/i;

export type SanitizeResult =
  | { ok: true; clean: Record<string, unknown> }
  | { ok: false; error: string };

export function sanitizeRow(
  body: Record<string, unknown>,
  existing?: Record<string, unknown> | null,
): SanitizeResult {
  const clean: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(body)) {
    if (v === null) {
      clean[k] = null;
      continue;
    }
    if (typeof v === "boolean") {
      clean[k] = v;
      continue;
    }
    if (typeof v === "number") {
      if (!Number.isFinite(v)) return { ok: false, error: `“${k}” must be a number` };
      clean[k] = v;
      continue;
    }
    if (Array.isArray(v)) {
      if (!v.every((x) => typeof x === "string" || typeof x === "number")) continue;
      clean[k] = v;
      continue;
    }
    if (typeof v !== "string") continue;

    const wantsNumber = NUMERIC_KEY.test(k) || typeof existing?.[k] === "number";
    if (wantsNumber) {
      const n = Number(v.trim());
      if (v.trim() === "" || !Number.isFinite(n)) {
        return { ok: false, error: `“${k}” must be a number — got “${v}”` };
      }
      clean[k] = n;
      continue;
    }
    clean[k] = v;
  }

  return { ok: true, clean };
}
