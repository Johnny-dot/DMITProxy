import { describe, expect, it } from 'vitest';
import { computeMachineUsage } from './machine-usage.js';

const GB = 1024 ** 3;
const MB = 1024 * 1024;
const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_750_000_000_000;

function inbound(total: number, clients: Array<{ up: number; down: number }>) {
  return {
    total,
    clientStats: clients.map((c, i) => ({
      email: 'c' + i,
      up: c.up,
      down: c.down,
      total: 0,
      expiryTime: 0,
      enable: true,
    })),
  } as never;
}

describe('computeMachineUsage', () => {
  it('reports the DMIT anchor exactly at sync time (no growth yet)', () => {
    // The client-sum captured at the snapshot equals the current client-sum, so growth is 0
    // and the gauge shows the DMIT value verbatim.
    const r = computeMachineUsage(
      [inbound(1000 * GB, [{ up: 10 * GB, down: 20 * GB }])],
      {
        bwusageBytes: Math.trunc(31.6 * GB),
        bwlimitBytes: 1000 * GB,
        updatedAt: NOW - 1000,
        nextResetAt: NOW + 10 * DAY,
        xuiUsedBytes: 30 * GB,
      },
      NOW,
    );
    expect(r.source).toBe('dmit');
    expect(r.usedBytes).toBe(Math.trunc(31.6 * GB));
    expect(r.totalBytes).toBe(1000 * GB);
    expect(r.updatedAt).toBe(NOW - 1000);
  });

  it('advances by 3X-UI growth scaled by the calibrated DMIT/3X-UI ratio', () => {
    // Synced at dmit=10 GB when the client-sum was 5 GB (ratio 2). The client-sum has since
    // grown to 8 GB (+3 GB), so the gauge climbs to 10 + 3×2 = 16 GB — not frozen at 10.
    const r = computeMachineUsage(
      [inbound(1000 * GB, [{ up: 3 * GB, down: 5 * GB }])],
      {
        bwusageBytes: 10 * GB,
        bwlimitBytes: 1000 * GB,
        updatedAt: NOW - 7 * DAY,
        nextResetAt: NOW + 20 * DAY,
        xuiUsedBytes: 5 * GB,
      },
      NOW,
    );
    expect(r.source).toBe('dmit');
    expect(r.usedBytes).toBe(16 * GB);
    expect(r.updatedAt).toBe(NOW - 7 * DAY);
  });

  it('clamps a noisy calibration ratio to a sane maximum', () => {
    // dmit=10 GB but the baseline client-sum was a tiny 1 GB → raw ratio 10, clamped to 4.
    // Growth of 2 GB advances by 2×4 = 8 GB, not 2×10.
    const r = computeMachineUsage(
      [inbound(1000 * GB, [{ up: 3 * GB, down: 0 }])],
      {
        bwusageBytes: 10 * GB,
        bwlimitBytes: 1000 * GB,
        updatedAt: NOW - 2 * DAY,
        nextResetAt: NOW + 20 * DAY,
        xuiUsedBytes: 1 * GB,
      },
      NOW,
    );
    expect(r.usedBytes).toBe(10 * GB + 2 * GB * 4);
  });

  it('advances a legacy snapshot (no baseline) via the default proxy factor', () => {
    // A snapshot recorded before xuiUsedBytes existed: estimate real = client-sum × 2,
    // floored at the DMIT anchor.
    const r = computeMachineUsage(
      [inbound(1000 * GB, [{ up: 2 * GB, down: 2 * GB }])],
      {
        bwusageBytes: 5 * GB,
        bwlimitBytes: 1000 * GB,
        updatedAt: NOW - 3 * DAY,
        nextResetAt: NOW + 20 * DAY,
        xuiUsedBytes: null,
      },
      NOW,
    );
    expect(r.source).toBe('dmit');
    expect(r.usedBytes).toBe(8 * GB); // max(5 GB, 4 GB × 2)
  });

  it('discards a snapshot from a previous billing window (past nextResetAt)', () => {
    const r = computeMachineUsage(
      [inbound(1000 * GB, [{ up: 1 * GB, down: 2 * GB }])],
      {
        bwusageBytes: 979 * GB,
        bwlimitBytes: 1000 * GB,
        updatedAt: NOW - 9 * DAY,
        nextResetAt: NOW - 1 * DAY,
        xuiUsedBytes: 480 * GB,
      },
      NOW,
    );
    expect(r.source).toBe('xui');
    expect(r.usedBytes).toBe(3 * GB * 2); // live client-sum × proxy factor; last month gone
    expect(r.updatedAt).toBeNull();
  });

  it('expires a snapshot without reset info after a full cycle', () => {
    const stale = computeMachineUsage(
      [inbound(1000 * GB, [{ up: 1 * GB, down: 0 }])],
      {
        bwusageBytes: 500 * GB,
        bwlimitBytes: 1000 * GB,
        updatedAt: NOW - 33 * DAY,
        nextResetAt: null,
        xuiUsedBytes: 250 * GB,
      },
      NOW,
    );
    expect(stale.source).toBe('xui');
    expect(stale.usedBytes).toBe(1 * GB * 2);

    const fresh = computeMachineUsage(
      [inbound(1000 * GB, [{ up: 1 * GB, down: 0 }])],
      {
        bwusageBytes: 500 * GB,
        bwlimitBytes: 1000 * GB,
        updatedAt: NOW - 1 * DAY,
        nextResetAt: null,
        xuiUsedBytes: 250 * GB,
      },
      NOW,
    );
    expect(fresh.source).toBe('dmit');
    // The live client-sum (1 GB) is below the captured baseline (250 GB) → growth clamps to
    // 0 → the gauge stays at the anchor rather than going backwards.
    expect(fresh.usedBytes).toBe(500 * GB);
  });

  it('keeps the DMIT bandwidth cap as the total when an expired fallback has no inbound limit', () => {
    const r = computeMachineUsage(
      [inbound(0, [{ up: 1 * GB, down: 0 }])],
      {
        bwusageBytes: 979 * GB,
        bwlimitBytes: 1000 * GB,
        updatedAt: NOW - 9 * DAY,
        nextResetAt: NOW - 1 * DAY,
        xuiUsedBytes: 480 * GB,
      },
      NOW,
    );
    expect(r.source).toBe('xui');
    expect(r.totalBytes).toBe(1000 * GB);
  });

  it('estimates real usage from client-sum × proxy factor when there is no DMIT snapshot', () => {
    const r = computeMachineUsage(
      [
        inbound(1000 * GB, [
          { up: 1 * GB, down: 2 * GB },
          { up: 0, down: 500 * MB },
        ]),
      ],
      null,
    );
    expect(r.source).toBe('xui');
    expect(r.usedBytes).toBe((1 * GB + 2 * GB + 500 * MB) * 2);
    expect(r.totalBytes).toBe(1000 * GB);
    expect(r.updatedAt).toBeNull();
  });

  it('sums across multiple inbounds in the xui fallback', () => {
    const r = computeMachineUsage(
      [
        inbound(500 * GB, [{ up: 1 * GB, down: 1 * GB }]),
        inbound(500 * GB, [{ up: 2 * GB, down: 0 }]),
      ],
      null,
    );
    expect(r.usedBytes).toBe(4 * GB * 2);
    expect(r.totalBytes).toBe(1000 * GB);
  });

  it('does NOT use the raw inbound aggregate (up/down ignored in fallback)', () => {
    // An inbound whose aggregate up/down is huge but whose client stats are tiny must
    // report from the tiny client-sum — this is the whole point of the unification.
    const ib = inbound(1000 * GB, [{ up: 1 * GB, down: 0 }]) as unknown as {
      up: number;
      down: number;
    };
    ib.up = 303 * GB; // stale aggregate that never reset
    ib.down = 0;
    const r = computeMachineUsage([ib as never], null);
    expect(r.usedBytes).toBe(1 * GB * 2); // client-sum × factor, not 303 GB
  });
});
