import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

describe('xui-billing pure helpers', () => {
  it('formatDateUTC formats YYYY-MM-DD in UTC regardless of host timezone', async () => {
    const { formatDateUTC } = await import('./xui-billing.js');
    expect(formatDateUTC(new Date(Date.UTC(2026, 0, 5, 12, 0)))).toBe('2026-01-05');
    expect(formatDateUTC(new Date(Date.UTC(2026, 11, 31, 23, 59)))).toBe('2026-12-31');
    expect(formatDateUTC(new Date(Date.UTC(2024, 1, 29)))).toBe('2024-02-29');
    // A moment that's Jan 1 UTC but Dec 31 in local US timezones must still format as 2026-01-01.
    expect(formatDateUTC(new Date(Date.UTC(2026, 0, 1, 0, 30)))).toBe('2026-01-01');
  });

  it('lastDayOfMonthUTC returns correct end-of-month', async () => {
    const { lastDayOfMonthUTC } = await import('./xui-billing.js');
    expect(lastDayOfMonthUTC(2026, 0)).toBe(31); // Jan
    expect(lastDayOfMonthUTC(2026, 1)).toBe(28); // Feb non-leap
    expect(lastDayOfMonthUTC(2024, 1)).toBe(29); // Feb leap
    expect(lastDayOfMonthUTC(2026, 3)).toBe(30); // Apr
    expect(lastDayOfMonthUTC(2026, 11)).toBe(31); // Dec
  });

  describe('shouldResetToday', () => {
    it('triggers when today matches billing day and no prior reset', async () => {
      const { shouldResetToday } = await import('./xui-billing.js');
      expect(shouldResetToday(15, new Date(Date.UTC(2026, 4, 15, 12, 0)), null)).toBe(true);
    });

    it('does not trigger when already reset today', async () => {
      const { shouldResetToday } = await import('./xui-billing.js');
      expect(shouldResetToday(15, new Date(Date.UTC(2026, 4, 15, 12, 0)), '2026-05-15')).toBe(
        false,
      );
    });

    it('does not trigger on non-billing day', async () => {
      const { shouldResetToday } = await import('./xui-billing.js');
      expect(shouldResetToday(15, new Date(Date.UTC(2026, 4, 14, 12, 0)), null)).toBe(false);
      expect(shouldResetToday(15, new Date(Date.UTC(2026, 4, 16, 12, 0)), null)).toBe(false);
    });

    it('falls back to last day of month when billingDay exceeds month length', async () => {
      const { shouldResetToday } = await import('./xui-billing.js');
      // Feb 28 2026 UTC with billing day 31 → triggers
      expect(shouldResetToday(31, new Date(Date.UTC(2026, 1, 28, 0, 0)), null)).toBe(true);
      // Feb 27 2026 with billing day 31 → no
      expect(shouldResetToday(31, new Date(Date.UTC(2026, 1, 27, 0, 0)), null)).toBe(false);
      // Feb 29 2024 (leap) with billing day 31 → triggers on 29, not 28
      expect(shouldResetToday(31, new Date(Date.UTC(2024, 1, 29, 0, 0)), null)).toBe(true);
      expect(shouldResetToday(31, new Date(Date.UTC(2024, 1, 28, 0, 0)), null)).toBe(false);
      // Apr 30 with billing day 31 → triggers
      expect(shouldResetToday(31, new Date(Date.UTC(2026, 3, 30, 0, 0)), null)).toBe(true);
    });

    it('triggers on billing day 28 in Feb non-leap year once, then no-ops same day', async () => {
      const { shouldResetToday } = await import('./xui-billing.js');
      expect(shouldResetToday(28, new Date(Date.UTC(2026, 1, 28)), null)).toBe(true);
      expect(shouldResetToday(28, new Date(Date.UTC(2026, 1, 28)), '2026-02-28')).toBe(false);
    });

    it('last reset from a previous day does not block today', async () => {
      const { shouldResetToday } = await import('./xui-billing.js');
      expect(shouldResetToday(15, new Date(Date.UTC(2026, 4, 15)), '2026-04-15')).toBe(true);
    });

    it('uses UTC day, not local day, so host timezone does not shift the reset date', async () => {
      const { shouldResetToday } = await import('./xui-billing.js');
      // 2026-05-15T23:30 UTC — in UTC+8 this is already 2026-05-16 local, but we should still
      // treat it as billing day 15 (matching DMIT's UTC cycle).
      expect(shouldResetToday(15, new Date(Date.UTC(2026, 4, 15, 23, 30)), null)).toBe(true);
      // 2026-05-14T23:30 UTC — local (UTC+8) would say May 15, but UTC says May 14 → no trigger.
      expect(shouldResetToday(15, new Date(Date.UTC(2026, 4, 14, 23, 30)), null)).toBe(false);
    });
  });
});

describe('xui-billing CRUD + runBillingResetTick', () => {
  const testDataDir = path.resolve(
    '.tmp',
    `vitest-xui-billing-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  const previousDataDir = process.env.DATA_DIR;

  beforeAll(() => {
    process.env.DATA_DIR = testDataDir;
    vi.resetModules();
  });

  afterAll(async () => {
    const dbModule = await import('./db.js');
    try {
      dbModule.db.close();
    } catch {
      // ignore
    }
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
    if (previousDataDir === undefined) {
      delete process.env.DATA_DIR;
    } else {
      process.env.DATA_DIR = previousDataDir;
    }
  });

  it('setBillingDay rejects invalid values', async () => {
    const { setBillingDay } = await import('./xui-billing.js');
    expect(() => setBillingDay(1, 0)).toThrow();
    expect(() => setBillingDay(1, 32)).toThrow();
    expect(() => setBillingDay(1, 1.5)).toThrow();
    expect(() => setBillingDay(1, Number.NaN)).toThrow();
    expect(() => setBillingDay(0, 15)).toThrow();
  });

  it('setBillingDay + listBillingConfigs roundtrip, clearBillingDay removes row', async () => {
    const { setBillingDay, listBillingConfigs, clearBillingDay, getBillingConfig } =
      await import('./xui-billing.js');
    setBillingDay(10, 15);
    setBillingDay(20, 28);
    const configs = listBillingConfigs();
    expect(configs).toHaveLength(2);
    expect(getBillingConfig(10)).toEqual({
      inboundId: 10,
      billingDay: 15,
      lastResetDate: null,
    });
    // upsert updates
    setBillingDay(10, 20);
    expect(getBillingConfig(10)?.billingDay).toBe(20);
    clearBillingDay(10);
    expect(getBillingConfig(10)).toBeNull();
    clearBillingDay(20);
  });

  it('runBillingResetTick only calls reset on matching inbounds, records lastResetDate, idempotent same day', async () => {
    const { setBillingDay, runBillingResetTick, getBillingConfig, clearBillingDay } =
      await import('./xui-billing.js');
    setBillingDay(100, 15);
    setBillingDay(101, 20);

    const resetFn = vi.fn().mockResolvedValue(undefined);
    await runBillingResetTick(new Date(Date.UTC(2026, 4, 15, 12, 0)), resetFn);
    expect(resetFn).toHaveBeenCalledTimes(1);
    expect(resetFn).toHaveBeenCalledWith(100);
    expect(getBillingConfig(100)?.lastResetDate).toBe('2026-05-15');
    expect(getBillingConfig(101)?.lastResetDate).toBeNull();

    // second tick same day is a no-op
    await runBillingResetTick(new Date(Date.UTC(2026, 4, 15, 13, 0)), resetFn);
    expect(resetFn).toHaveBeenCalledTimes(1);

    clearBillingDay(100);
    clearBillingDay(101);
  });

  it('runBillingResetTick leaves lastResetDate unchanged on reset failure (retries next tick)', async () => {
    const { setBillingDay, runBillingResetTick, getBillingConfig, clearBillingDay } =
      await import('./xui-billing.js');
    setBillingDay(200, 10);
    const err = new Error('boom');
    const failing = vi.fn().mockRejectedValue(err);
    await runBillingResetTick(new Date(Date.UTC(2026, 4, 10, 12, 0)), failing);
    expect(failing).toHaveBeenCalledTimes(1);
    expect(getBillingConfig(200)?.lastResetDate).toBeNull();

    // next tick retries
    const succeeding = vi.fn().mockResolvedValue(undefined);
    await runBillingResetTick(new Date(Date.UTC(2026, 4, 10, 13, 0)), succeeding);
    expect(succeeding).toHaveBeenCalledTimes(1);
    expect(getBillingConfig(200)?.lastResetDate).toBe('2026-05-10');

    clearBillingDay(200);
  });

  it('runBillingResetTick honors last-day-of-month fallback for day 31', async () => {
    const { setBillingDay, runBillingResetTick, getBillingConfig, clearBillingDay } =
      await import('./xui-billing.js');
    setBillingDay(300, 31);
    const resetFn = vi.fn().mockResolvedValue(undefined);

    // Feb 27 2026 UTC — no trigger
    await runBillingResetTick(new Date(Date.UTC(2026, 1, 27, 12, 0)), resetFn);
    expect(resetFn).not.toHaveBeenCalled();

    // Feb 28 2026 UTC — triggers (last day fallback)
    await runBillingResetTick(new Date(Date.UTC(2026, 1, 28, 12, 0)), resetFn);
    expect(resetFn).toHaveBeenCalledTimes(1);
    expect(getBillingConfig(300)?.lastResetDate).toBe('2026-02-28');

    clearBillingDay(300);
  });
});
