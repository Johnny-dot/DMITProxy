import { describe, expect, it } from 'vitest';
import type { ServerStatus } from '@/src/api/xui';
import {
  buildNetworkTrendBars,
  getMachinePressureState,
  formatPortalUptime,
} from './machineStatus';

function serverStatus(overrides: Partial<ServerStatus> = {}): ServerStatus {
  return {
    cpu: 18,
    cpuCores: 4,
    mem: { current: 2 * 1024 ** 3, total: 8 * 1024 ** 3 },
    swap: { current: 0, total: 0 },
    disk: { current: 30 * 1024 ** 3, total: 120 * 1024 ** 3 },
    xray: { state: 'running', version: '1.8.9' },
    uptime: 0,
    loads: [0.1, 0.2, 0.3],
    tcpCount: 12,
    udpCount: 3,
    netIO: { up: 0, down: 0 },
    netTraffic: { sent: 0, recv: 0 },
    ...overrides,
  };
}

describe('portal machine status helpers', () => {
  it('marks high resource usage as pressure even when CPU is quiet', () => {
    expect(
      getMachinePressureState(
        serverStatus({
          cpu: 24,
          mem: { current: 7.3 * 1024 ** 3, total: 8 * 1024 ** 3 },
          disk: { current: 42 * 1024 ** 3, total: 120 * 1024 ** 3 },
        }),
      ),
    ).toMatchObject({
      level: 'danger',
      percent: 91,
    });
  });

  it('keeps upload and download represented in network trend bars', () => {
    expect(
      buildNetworkTrendBars(serverStatus({ netIO: { up: 512 * 1024, down: 2 * 1024 ** 2 } })),
    ).toEqual([
      { key: 'up', value: 512 * 1024, percent: 25 },
      { key: 'down', value: 2 * 1024 ** 2, percent: 100 },
    ]);
  });

  it('formats user-facing uptime without dropping minutes', () => {
    expect(formatPortalUptime(2 * 86400 + 3 * 3600 + 4 * 60, true)).toBe('2天 3小时 4分钟');
    expect(formatPortalUptime(3 * 3600 + 4 * 60, false)).toBe('3h 4m');
  });
});
