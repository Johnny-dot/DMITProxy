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
type DmitLike = Pick<
  DmitTrafficSnapshot,
  'bwusageBytes' | 'bwlimitBytes' | 'updatedAt' | 'nextResetAt'
>;

/** A snapshot that carries no reset info is discarded after a full billing cycle + slack. */
const SNAPSHOT_MAX_AGE_WITHOUT_RESET_MS = 32 * 24 * 60 * 60 * 1000;

/**
 * Single source of truth for the machine-level traffic gauge shown across the admin
 * console (dashboard / nodes / inbounds / traffic), the user portal, and subscription
 * decorations.
 *
 * DMIT's network-layer billing number is authoritative, but it only updates when the
 * Tampermonkey userscript runs (i.e. when someone opens the DMIT panel). To avoid the
 * gauge freezing between syncs, the DMIT value is treated as an ANCHOR and the live
 * 3X-UI client-sum keeps it moving: usedBytes = max(dmit, client-sum). This relies on
 * both counters covering the same billing window — the monthly billing reset
 * (`resetAllClientTraffics`) zeroes the client counters on the same day DMIT resets.
 *
 * A snapshot from a PREVIOUS billing window (now past its recorded nextResetAt, or
 * older than a full cycle when no reset info was captured) is discarded entirely and
 * the gauge falls back to the live 3X-UI client-sum, so a long absence from the DMIT
 * panel can never pin last month's number on screen.
 *
 * The fallback deliberately does NOT use the raw inbound aggregate
 * (`inbound.up + inbound.down`): that counter is not touched by the monthly reset, so
 * it drifts away from the billing cycle.
 */
export function computeMachineUsage(
  inbounds: InboundLike[],
  dmit: DmitLike | null,
  now: number = Date.now(),
): MachineUsage {
  const xuiUsed = inbounds.reduce((sum, ib) => sum + getInboundClientUsedBytes(ib), 0);
  const xuiTotal = inbounds.reduce((sum, ib) => sum + safeNonNegativeInt(ib.total), 0);

  const snapshotExpired =
    dmit != null &&
    (dmit.nextResetAt != null
      ? now >= dmit.nextResetAt
      : now - dmit.updatedAt > SNAPSHOT_MAX_AGE_WITHOUT_RESET_MS);

  if (!dmit || snapshotExpired) {
    return {
      usedBytes: xuiUsed,
      // The bandwidth cap is not window-dependent, so a stale snapshot may still
      // provide the total when no inbound carries a configured limit.
      totalBytes: xuiTotal > 0 ? xuiTotal : safeNonNegativeInt(dmit?.bwlimitBytes ?? 0),
      source: 'xui',
      updatedAt: null,
    };
  }

  return {
    usedBytes: Math.max(safeNonNegativeInt(dmit.bwusageBytes), xuiUsed),
    totalBytes: safeNonNegativeInt(dmit.bwlimitBytes),
    source: 'dmit',
    updatedAt: dmit.updatedAt,
  };
}
