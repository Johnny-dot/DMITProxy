import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const MB = 1024 * 1024;

async function freshStore() {
  vi.resetModules();
  const dbModule = await import('./db.js');
  dbModule.db.exec('DELETE FROM dmit_traffic');
  return await import('./dmit-traffic-store.js');
}

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('dmit-traffic-store', () => {
  it('upserts a row and reads it back as bytes', async () => {
    const store = await freshStore();
    store.upsertDmitTraffic({
      serviceId: 168117,
      bwusageMb: 712482,
      bwlimitMb: 1024000,
      bwusageInMb: 355266,
      bwusageOutMb: 357216,
      usagePercentage: 69.58,
      source: 'tampermonkey',
      now: 1000,
    });

    const snap = store.getDmitTrafficSnapshot(168117);
    expect(snap).not.toBeNull();
    expect(snap!.serviceId).toBe(168117);
    expect(snap!.bwusageBytes).toBe(712482 * MB);
    expect(snap!.bwlimitBytes).toBe(1024000 * MB);
    expect(snap!.updatedAt).toBe(1000);
    expect(snap!.source).toBe('tampermonkey');
  });

  it('UPSERT overwrites the existing row on same service_id', async () => {
    const store = await freshStore();
    store.upsertDmitTraffic({
      serviceId: 168117,
      bwusageMb: 100,
      bwlimitMb: 1024000,
      source: 'tampermonkey',
      now: 1,
    });
    store.upsertDmitTraffic({
      serviceId: 168117,
      bwusageMb: 200,
      bwlimitMb: 1024000,
      source: 'manual',
      now: 2,
    });
    const snap = store.getDmitTrafficSnapshot(168117);
    expect(snap!.bwusageBytes).toBe(200 * MB);
    expect(snap!.source).toBe('manual');
    expect(snap!.updatedAt).toBe(2);
  });

  it('returns null when the service_id has no row', async () => {
    const store = await freshStore();
    expect(store.getDmitTrafficSnapshot(999999)).toBeNull();
  });

  it('caches reads for 30s and invalidates on write', async () => {
    const store = await freshStore();
    store.upsertDmitTraffic({
      serviceId: 168117,
      bwusageMb: 100,
      bwlimitMb: 1024000,
      source: 'tampermonkey',
      now: 1,
    });
    const first = store.getDmitTrafficSnapshot(168117);
    expect(first!.bwusageBytes).toBe(100 * MB);

    // Mutate the DB outside the store API so a cache hit would return stale data.
    const { db } = await import('./db.js');
    db.prepare('UPDATE dmit_traffic SET bwusage_mb = 500 WHERE service_id = ?').run(168117);

    const cached = store.getDmitTrafficSnapshot(168117);
    expect(cached!.bwusageBytes).toBe(100 * MB); // cache still warm

    // A write through the store invalidates the cache.
    store.upsertDmitTraffic({
      serviceId: 168117,
      bwusageMb: 300,
      bwlimitMb: 1024000,
      source: 'manual',
      now: 2,
    });
    const fresh = store.getDmitTrafficSnapshot(168117);
    expect(fresh!.bwusageBytes).toBe(300 * MB);
  });

  it('persists billing day fields (next_reset_day / auto_applied_billing_day)', async () => {
    const store = await freshStore();
    store.upsertDmitTraffic({
      serviceId: 168117,
      bwusageMb: 100,
      bwlimitMb: 1024000,
      nextResetDay: 3,
      nextResetAt: 1780358400000,
      source: 'tampermonkey',
      now: 1,
    });
    expect(store.getDmitTrafficSnapshot(168117)!.nextResetDay).toBe(3);
    expect(store.getDmitTrafficSnapshot(168117)!.nextResetAt).toBe(1780358400000);
    expect(store.getDmitTrafficSnapshot(168117)!.autoAppliedBillingDay).toBeNull();

    store.markAutoAppliedBillingDay(168117, 3);
    expect(store.getDmitTrafficSnapshot(168117)!.autoAppliedBillingDay).toBe(3);
  });
});
