import { describe, expect, it } from 'vitest';
import { deriveNextReset, parseDaysUntilReset } from './dmit-reset.js';

const DAY_MS = 86_400_000;

describe('parseDaysUntilReset', () => {
  it('parses the captured DMIT chinese format', () => {
    expect(parseDaysUntilReset('8.57 天')).toBe(8.57);
  });

  it('parses an english variant', () => {
    expect(parseDaysUntilReset('8.57 days')).toBe(8.57);
  });

  it('parses an integer day count', () => {
    expect(parseDaysUntilReset('9 天')).toBe(9);
  });

  it('parses zero', () => {
    expect(parseDaysUntilReset('0 天')).toBe(0);
  });

  it('returns null for unparseable / missing input', () => {
    expect(parseDaysUntilReset('—')).toBeNull();
    expect(parseDaysUntilReset('')).toBeNull();
    expect(parseDaysUntilReset(null)).toBeNull();
    expect(parseDaysUntilReset(undefined)).toBeNull();
  });

  it('rejects a negative day count rather than capturing the digits', () => {
    expect(parseDaysUntilReset('-1 天')).toBeNull();
  });
});

describe('deriveNextReset', () => {
  it('REGRESSION: captured 8.57天 at 2026-05-25 10:13:39Z resolves to day 3, not 2', () => {
    // Real captured data: DMIT reset is "每月 3 日 UTC". The naive
    // `new Date(now + 8.57d).getUTCDate()` lands at 2026-06-02 23:54Z -> day 2 (WRONG).
    const now = Date.UTC(2026, 4, 25, 10, 13, 39);
    const { nextResetAt, nextResetDay } = deriveNextReset(8.57, now);
    expect(nextResetDay).toBe(3);
    // snapped instant is exactly UTC midnight of the 3rd
    expect(nextResetAt).toBe(Date.UTC(2026, 5, 3, 0, 0, 0, 0));
  });

  it('snaps a value that lands just BEFORE midnight up to the correct day', () => {
    // now + days = 2026-06-02 23:54Z -> nearest midnight is 2026-06-03 00:00Z
    const now = Date.UTC(2026, 5, 2, 23, 54, 0);
    expect(deriveNextReset(0, now).nextResetDay).toBe(3);
  });

  it('snaps a value that lands just AFTER midnight back to the correct day', () => {
    // now + days = 2026-06-03 00:06Z -> nearest midnight is still 2026-06-03 00:00Z
    const now = Date.UTC(2026, 5, 3, 0, 6, 0);
    expect(deriveNextReset(0, now).nextResetDay).toBe(3);
  });

  it('handles a near-full-cycle remaining', () => {
    const now = Date.UTC(2026, 5, 4, 12, 0, 0);
    const { nextResetDay } = deriveNextReset(29.5, now); // -> ~2026-07-04 00:00Z
    expect(nextResetDay).toBe(4);
  });

  it('always returns a midnight-aligned nextResetAt', () => {
    const now = Date.UTC(2026, 4, 25, 10, 13, 39);
    const { nextResetAt } = deriveNextReset(8.57, now);
    expect(nextResetAt! % DAY_MS).toBe(0);
  });

  it('returns nulls for missing / invalid day counts', () => {
    const now = Date.UTC(2026, 4, 25, 0, 0, 0);
    expect(deriveNextReset(null, now)).toEqual({ nextResetAt: null, nextResetDay: null });
    expect(deriveNextReset(Number.NaN, now)).toEqual({ nextResetAt: null, nextResetDay: null });
    expect(deriveNextReset(-1, now)).toEqual({ nextResetAt: null, nextResetDay: null });
  });
});
