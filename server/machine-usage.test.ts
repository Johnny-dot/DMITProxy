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
  it('uses the DMIT anchor when it is ahead of the client-sum (fresh sync)', () => {
    // Network-layer accounting includes protocol overhead, so right after a sync the
    // DMIT number is the larger one and wins.
    const r = computeMachineUsage(
      [inbound(1000 * GB, [{ up: 10 * GB, down: 20 * GB }])],
      {
        bwusageBytes: Math.trunc(31.6 * GB),
        bwlimitBytes: 1000 * GB,
        updatedAt: NOW - 1000,
        nextResetAt: NOW + 10 * DAY,
      },
      NOW,
    );
    expect(r.source).toBe('dmit');
    expect(r.usedBytes).toBe(Math.trunc(31.6 * GB));
    expect(r.totalBytes).toBe(1000 * GB);
    expect(r.updatedAt).toBe(NOW - 1000);
  });

  it('keeps advancing with the 3X-UI client-sum between syncs (no frozen gauge)', () => {
    // Synced days ago at 5 GB; clients have since pushed the live sum to 7 GB. The
    // gauge must keep moving instead of pinning the stale anchor.
    const r = computeMachineUsage(
      [inbound(1000 * GB, [{ up: 3 * GB, down: 4 * GB }])],
      {
        bwusageBytes: 5 * GB,
        bwlimitBytes: 1000 * GB,
        updatedAt: NOW - 7 * DAY,
        nextResetAt: NOW + 20 * DAY,
      },
      NOW,
    );
    expect(r.source).toBe('dmit');
    expect(r.usedBytes).toBe(7 * GB);
    expect(r.totalBytes).toBe(1000 * GB);
    expect(r.updatedAt).toBe(NOW - 7 * DAY);
  });

  it('discards a snapshot from a previous billing window (past nextResetAt)', () => {
    // DMIT reset since the last sync: last month's 979 GB must not stick around.
    const r = computeMachineUsage(
      [inbound(1000 * GB, [{ up: 1 * GB, down: 2 * GB }])],
      {
        bwusageBytes: 979 * GB,
        bwlimitBytes: 1000 * GB,
        updatedAt: NOW - 9 * DAY,
        nextResetAt: NOW - 1 * DAY,
      },
      NOW,
    );
    expect(r.source).toBe('xui');
    expect(r.usedBytes).toBe(3 * GB);
    expect(r.totalBytes).toBe(1000 * GB);
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
      },
      NOW,
    );
    expect(stale.source).toBe('xui');
    expect(stale.usedBytes).toBe(1 * GB);

    const fresh = computeMachineUsage(
      [inbound(1000 * GB, [{ up: 1 * GB, down: 0 }])],
      {
        bwusageBytes: 500 * GB,
        bwlimitBytes: 1000 * GB,
        updatedAt: NOW - 1 * DAY,
        nextResetAt: null,
      },
      NOW,
    );
    expect(fresh.source).toBe('dmit');
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
      },
      NOW,
    );
    expect(r.source).toBe('xui');
    expect(r.totalBytes).toBe(1000 * GB);
  });

  it('falls back to client-sum + inbound.total when no DMIT snapshot (resets monthly)', () => {
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
    expect(r.usedBytes).toBe(1 * GB + 2 * GB + 500 * MB);
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
    expect(r.usedBytes).toBe(4 * GB);
    expect(r.totalBytes).toBe(1000 * GB);
  });

  it('does NOT use the raw inbound aggregate (up/down ignored in fallback)', () => {
    // An inbound whose aggregate up/down is huge but whose client stats are tiny must
    // report the tiny client-sum — this is the whole point of the unification.
    const ib = inbound(1000 * GB, [{ up: 1 * GB, down: 0 }]) as unknown as {
      up: number;
      down: number;
    };
    ib.up = 303 * GB; // stale aggregate that never reset
    ib.down = 0;
    const r = computeMachineUsage([ib as never], null);
    expect(r.usedBytes).toBe(1 * GB); // client-sum, not 303 GB
  });
});
