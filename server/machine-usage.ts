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
  'bwusageBytes' | 'bwlimitBytes' | 'updatedAt' | 'nextResetAt' | 'xuiUsedBytes'
>;

/** A snapshot that carries no reset info is discarded after a full billing cycle + slack. */
const SNAPSHOT_MAX_AGE_WITHOUT_RESET_MS = 32 * 24 * 60 * 60 * 1000;

/**
 * A proxy relays every byte through two network legs (client↔server and server↔target).
 * DMIT bills both at the network interface; 3X-UI's per-client counters only see the
 * client leg, so DMIT ≈ 2× the 3X-UI client-sum. Used to estimate real usage from 3X-UI
 * when there is no per-snapshot calibration. Clamped to keep a noisy baseline sane.
 */
const DEFAULT_XUI_TO_REAL_FACTOR = 2;
const MIN_XUI_FACTOR = 1;
const MAX_XUI_FACTOR = 4;

/**
 * Single source of truth for the machine-level traffic gauge shown across the admin
 * console (dashboard / nodes / inbounds / traffic), the user portal, and subscription
 * decorations.
 *
 * DMIT's network-layer billing is authoritative but only updates when the LAX NIC sync
 * agent posts. 3X-UI is live but undercounts (it only sees the client leg, ≈ half of
 * DMIT). So `max(dmit, client-sum)` would pin the gauge to the last DMIT snapshot forever
 * (the client-sum can never exceed it) and freeze it between syncs.
 *
 * Instead we re-anchor at the DMIT value and advance by the 3X-UI GROWTH since the
 * snapshot, scaled by the DMIT/3X-UI ratio calibrated from that same snapshot's captured
 * client-sum (`xuiUsedBytes`):
 *   used = dmit + max(0, xuiNow − xuiAtSnapshot) × (dmit / xuiAtSnapshot)
 * This is exact at sync time, climbs at DMIT's real rate between syncs, and self-corrects
 * on every fresh sync. Legacy snapshots with no captured baseline fall back to
 * `max(dmit, xuiNow × 2)` using the default proxy factor.
 *
 * A snapshot from a PREVIOUS billing window (past its nextResetAt, or older than a full
 * cycle when no reset info was captured) is discarded entirely; the gauge then estimates
 * from the live 3X-UI sum × the proxy factor, so a long absence from the DMIT panel can
 * never pin last month's number on screen.
 *
 * The fallback deliberately does NOT use the raw inbound aggregate
 * (`inbound.up + inbound.down`): that counter is not touched by the monthly reset.
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
      usedBytes: Math.round(xuiUsed * DEFAULT_XUI_TO_REAL_FACTOR),
      // The bandwidth cap is not window-dependent, so a stale snapshot may still
      // provide the total when no inbound carries a configured limit.
      totalBytes: xuiTotal > 0 ? xuiTotal : safeNonNegativeInt(dmit?.bwlimitBytes ?? 0),
      source: 'xui',
      updatedAt: null,
    };
  }

  const anchor = safeNonNegativeInt(dmit.bwusageBytes);
  const xuiAtSnapshot = dmit.xuiUsedBytes;

  let usedBytes: number;
  if (xuiAtSnapshot != null && xuiAtSnapshot > 0) {
    // Calibrated re-anchor: advance the DMIT value by scaled 3X-UI growth since the sync.
    const factor = Math.min(Math.max(anchor / xuiAtSnapshot, MIN_XUI_FACTOR), MAX_XUI_FACTOR);
    const growth = Math.max(0, xuiUsed - xuiAtSnapshot);
    usedBytes = Math.round(anchor + growth * factor);
  } else {
    // Legacy snapshot without a captured baseline: estimate via the default proxy factor.
    usedBytes = Math.max(anchor, Math.round(xuiUsed * DEFAULT_XUI_TO_REAL_FACTOR));
  }

  return {
    usedBytes,
    totalBytes: safeNonNegativeInt(dmit.bwlimitBytes),
    source: 'dmit',
    updatedAt: dmit.updatedAt,
  };
}
