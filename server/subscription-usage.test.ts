import { describe, expect, it } from 'vitest';
import {
  buildSubscriptionDecorations,
  buildSubscriptionUsageSummary,
  getClientUsedBytes,
  getInboundClientUsedBytes,
} from './subscription-usage.js';

const GB = 1024 ** 3;

describe('buildSubscriptionUsageSummary', () => {
  it('derives own, other, and machine-level traffic counters from inbound totals', () => {
    const ownUp = Math.trunc(12.34 * GB);
    const ownDown = Math.trunc(177.34 * GB);
    const totalUp = Math.trunc(132.34 * GB);
    const totalDown = Math.trunc(449.95 * GB);
    const ownUsed = ownUp + ownDown;
    const totalUsed = totalUp + totalDown;
    const machineTotal = 1000 * GB;
    expect(
      buildSubscriptionUsageSummary({
        resetDay: 3,
        expiryTime: Date.UTC(2028, 2, 4, 0, 0, 0),
        ownUp,
        ownDown,
        allClientUp: totalUp,
        allClientDown: totalDown,
        machineTotal,
      }),
    ).toEqual({
      resetDay: 3,
      expiryDate: '2028-03-04',
      ownUp,
      ownDown,
      ownUsed,
      otherUsersUp: totalUp - ownUp,
      otherUsersDown: totalDown - ownDown,
      otherUsersUsed: totalUsed - ownUsed,
      totalUp,
      totalDown,
      totalUsed,
      machineUsed: totalUsed,
      machineRemaining: machineTotal - totalUsed,
      machineTotal,
      machineSource: 'xui',
    });
  });

  it('overrides machineRemaining/machineTotal when DMIT machine fields are provided', () => {
    const ownUp = Math.trunc(12.34 * GB);
    const ownDown = Math.trunc(177.34 * GB);
    const totalUp = Math.trunc(132.34 * GB);
    const totalDown = Math.trunc(449.95 * GB);
    const xuiMachineTotal = 1000 * GB;
    const dmitMachineTotal = 1000 * GB;
    const dmitMachineUsed = Math.trunc(695.32 * GB);

    const summary = buildSubscriptionUsageSummary({
      resetDay: 3,
      expiryTime: null,
      ownUp,
      ownDown,
      allClientUp: totalUp,
      allClientDown: totalDown,
      machineTotal: xuiMachineTotal,
      dmitMachineUsed,
      dmitMachineTotal,
    });

    // own/others remain on 3X-UI numbers
    expect(summary.ownUp).toBe(ownUp);
    expect(summary.ownDown).toBe(ownDown);
    expect(summary.otherUsersUp).toBe(totalUp - ownUp);
    expect(summary.otherUsersDown).toBe(totalDown - ownDown);

    // machine fields come from DMIT
    expect(summary.machineTotal).toBe(dmitMachineTotal);
    expect(summary.machineUsed).toBe(dmitMachineUsed);
    expect(summary.machineRemaining).toBe(dmitMachineTotal - dmitMachineUsed);
    expect(summary.machineSource).toBe('dmit');
  });

  it('falls back to 3X-UI machineTotal when dmitMachineTotal is undefined', () => {
    const summary = buildSubscriptionUsageSummary({
      resetDay: 3,
      expiryTime: null,
      ownUp: 0,
      ownDown: 0,
      allClientUp: 0,
      allClientDown: 0,
      machineTotal: 500 * GB,
    });
    expect(summary.machineTotal).toBe(500 * GB);
    expect(summary.machineRemaining).toBe(500 * GB);
  });

  it('clamps machineRemaining to 0 when DMIT used exceeds DMIT total', () => {
    const summary = buildSubscriptionUsageSummary({
      resetDay: null,
      ownUp: 0,
      ownDown: 0,
      allClientUp: 0,
      allClientDown: 0,
      machineTotal: 0,
      dmitMachineUsed: 1100 * GB,
      dmitMachineTotal: 1000 * GB,
    });
    expect(summary.machineRemaining).toBe(0);
    expect(summary.machineUsed).toBe(1000 * GB);
  });
});

describe('buildSubscriptionDecorations', () => {
  it('formats the summary as subscription decoration labels', () => {
    expect(
      buildSubscriptionDecorations({
        resetDay: 3,
        expiryTime: Date.UTC(2028, 2, 4, 0, 0, 0),
        ownUp: Math.trunc(12.34 * GB),
        ownDown: Math.trunc(177.34 * GB),
        allClientUp: Math.trunc(132.34 * GB),
        allClientDown: Math.trunc(449.95 * GB),
        machineTotal: 1000 * GB,
      }),
    ).toEqual([
      '重置｜每月3日',
      '到期｜2028-03-04',
      '个人｜↑12.3 ↓177.3G',
      '他人｜↑120 ↓272.6G',
      '机器｜剩417.7/1000G',
    ]);
  });

  it('labels machine-level DMIT data separately from 3X-UI per-user data', () => {
    expect(
      buildSubscriptionDecorations({
        resetDay: 3,
        ownUp: Math.trunc(39.14 * GB),
        ownDown: Math.trunc(29.22 * GB),
        allClientUp: Math.trunc(76.95 * GB),
        allClientDown: Math.trunc(293.09 * GB),
        machineTotal: 1000 * GB,
        dmitMachineUsed: Math.trunc(825.05 * GB),
        dmitMachineTotal: 1000 * GB,
      }),
    ).toContain('机器｜剩175/1000G');
  });
});

describe('usage byte helpers', () => {
  it('sums upload and download for one client', () => {
    expect(getClientUsedBytes({ up: 512, down: 1024 })).toBe(1536);
  });

  it('sums all clients attached to an inbound', () => {
    expect(
      getInboundClientUsedBytes({
        clientStats: [
          { email: 'a', up: 1, down: 2, total: 0, expiryTime: 0, enable: true },
          { email: 'b', up: 3, down: 4, total: 0, expiryTime: 0, enable: true },
        ],
      }),
    ).toBe(10);
  });
});
