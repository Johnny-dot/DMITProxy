const DAY_MS = 86_400_000;

/**
 * Parse DMIT's `auto_min_days_until_due` condition value into a float number of days.
 * The value arrives as a localized string such as `"8.57 天"` (or `"8.57 days"`).
 * Returns null when the input is missing or unparseable.
 */
export function parseDaysUntilReset(text: string | null | undefined): number | null {
  if (typeof text !== 'string') return null;
  // First numeric token. Guard against a leading minus so a malformed "-1 天"
  // doesn't silently become 1 via the digit-only capture.
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const days = Number.parseFloat(match[0]);
  return Number.isFinite(days) && days >= 0 ? days : null;
}

/**
 * Convert "days until reset" into a concrete next-reset instant + UTC day-of-month.
 *
 * DMIT's monthly traffic reset happens at 00:00 UTC on the billing day, but DMIT only
 * reports the remaining time to ~2 decimal places (e.g. `"8.57 天"`). Naively taking
 * `getUTCDate()` of `now + days` lands a few minutes BEFORE the true midnight boundary
 * and reads the PREVIOUS calendar day — e.g. the captured `8.57` at 2026-05-25 10:13:39Z
 * yields 2026-06-02 23:54Z → day 2, when the real reset day is the 3rd. It also makes the
 * derived day jitter across the date boundary as `now` advances between syncs, producing
 * spurious billing-day "mismatch" warnings.
 *
 * We snap the computed instant to the nearest UTC midnight, recovering the true reset day
 * robustly (DMIT's ~14-minute reporting granularity is far inside the ±12h snap window).
 */
export function deriveNextReset(
  daysUntilReset: number | null,
  nowMs: number,
): { nextResetAt: number | null; nextResetDay: number | null } {
  if (daysUntilReset == null || !Number.isFinite(daysUntilReset) || daysUntilReset < 0) {
    return { nextResetAt: null, nextResetDay: null };
  }
  const raw = nowMs + daysUntilReset * DAY_MS;
  const snapped = Math.round(raw / DAY_MS) * DAY_MS; // nearest UTC midnight
  return { nextResetAt: snapped, nextResetDay: new Date(snapped).getUTCDate() };
}
