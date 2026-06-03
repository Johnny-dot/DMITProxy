import { describe, expect, it } from 'vitest';
import { computeMachineUsage } from './machine-usage.js';

const GB = 1024 ** 3;
const MB = 1024 * 1024;

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
  it('prefers DMIT real values when a snapshot is present', () => {
    const r = computeMachineUsage([inbound(1000 * GB, [{ up: 10 * GB, down: 20 * GB }])], {
      bwusageBytes: Math.trunc(4.16 * GB),
      bwlimitBytes: 1000 * GB,
      updatedAt: 12345,
    });
    expect(r.source).toBe('dmit');
    expect(r.usedBytes).toBe(Math.trunc(4.16 * GB));
    expect(r.totalBytes).toBe(1000 * GB);
    expect(r.updatedAt).toBe(12345);
  });

  it('DMIT snapshot is authoritative even when client stats are large (the original bug)', () => {
    // 3X-UI client-sum would say 300 GB; DMIT says 5 GB — DMIT wins.
    const r = computeMachineUsage([inbound(1000 * GB, [{ up: 300 * GB, down: 0 }])], {
      bwusageBytes: 5 * GB,
      bwlimitBytes: 1000 * GB,
      updatedAt: 1,
    });
    expect(r.usedBytes).toBe(5 * GB);
    expect(r.source).toBe('dmit');
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
