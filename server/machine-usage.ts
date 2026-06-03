import type { XuiInbound } from './xui-admin.js';
import type { DmitTrafficSnapshot } from './dmit-traffic-store.js';
import { safeNonNegativeInt } from './xui-admin.js';
import { getInboundClientUsedBytes } from './subscription-usage.js';

export type MachineUsageSource = 'dmit' | 'xui';

export interface MachineUsage {
  usedBytes: number;
  totalBytes: number;
  source: MachineUsageSource;
  /** DMIT last-sync time when source === 'dmit'; null for the 3X-UI fallback. */
  updatedAt: number | null;
}

type InboundLike = Pick<XuiInbound, 'clientStats' | 'total'>;
type DmitLike = Pick<DmitTrafficSnapshot, 'bwusageBytes' | 'bwlimitBytes' | 'updatedAt'>;

/**
 * Single source of truth for the machine-level traffic gauge shown across the admin
 * console (dashboard / nodes / inbounds / traffic) and the user portal.
 *
 * Prefers DMIT's network-layer billing number — authoritative and reset monthly at the
 * source. Falls back to the SUM OF 3X-UI per-client counters, which the monthly billing
 * reset (`resetAllClientTraffics`) also zeroes. It deliberately does NOT use the raw
 * inbound aggregate (`inbound.up + inbound.down`): that counter is not touched by the
 * monthly reset, so it drifts away from the billing cycle and is the root cause of the
 * admin-vs-portal mismatch this function exists to eliminate.
 */
export function computeMachineUsage(inbounds: InboundLike[], dmit: DmitLike | null): MachineUsage {
  if (dmit) {
    return {
      usedBytes: safeNonNegativeInt(dmit.bwusageBytes),
      totalBytes: safeNonNegativeInt(dmit.bwlimitBytes),
      source: 'dmit',
      updatedAt: dmit.updatedAt,
    };
  }
  const usedBytes = inbounds.reduce((sum, ib) => sum + getInboundClientUsedBytes(ib), 0);
  const totalBytes = inbounds.reduce((sum, ib) => sum + safeNonNegativeInt(ib.total), 0);
  return { usedBytes, totalBytes, source: 'xui', updatedAt: null };
}
