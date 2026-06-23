import { Router, type Request, type Response, type NextFunction } from 'express';
import { listBillingConfigs, setBillingDay } from '../xui-billing.js';
import {
  getDmitTrafficSnapshot,
  markAutoAppliedBillingDay,
  upsertDmitTraffic,
} from '../dmit-traffic-store.js';
import { loginAndListInbounds, getXuiCredentials } from '../xui-admin.js';
import { decideBillingDayAction, type BillingDayAction } from '../dmit-billing-sync.js';
import { getDmitServiceId, getDmitSyncToken } from '../dmit-config.js';
import { deriveNextReset, parseDaysUntilReset } from '../dmit-reset.js';
import { getInboundClientUsedBytes } from '../subscription-usage.js';

const router = Router();

function requireSyncToken(req: Request, res: Response, next: NextFunction) {
  const token = getDmitSyncToken();
  if (!token) {
    return res.status(503).json({ error: 'DMIT sync is not configured' });
  }
  const header = req.header('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match || match[1].trim() !== token) {
    return res.status(401).json({ error: 'Invalid sync token' });
  }
  return next();
}

interface SyncBody {
  service_id?: unknown;
  bwusage?: unknown;
  bwlimit?: unknown;
  bwusage_in?: unknown;
  bwusage_out?: unknown;
  usage_percentage?: unknown;
  // Preferred: raw DMIT `auto_min_days_until_due` value (e.g. "8.57 天"). The server
  // parses + derives the reset day so the fragile midnight math is unit-tested, not
  // duplicated in the (untestable) sync client.
  days_until_reset_text?: unknown;
  // Legacy/explicit fallback (still accepted for backward compatibility).
  next_reset_at?: unknown;
  next_reset_day?: unknown;
}

function isNonNegInt(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isFinite(value) && value >= 0 && Number.isInteger(value)
  );
}

function asOptionalNonNegInt(value: unknown): number | null {
  return isNonNegInt(value) ? value : null;
}

function asOptionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asOptionalBillingDay(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  return value >= 1 && value <= 31 ? value : null;
}

function asOptionalFutureMs(value: unknown, now: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  // Allow up to 60 seconds of clock skew in the past, but otherwise must be in the future.
  if (value < now - 60_000) return null;
  return Math.floor(value);
}

router.post('/traffic', requireSyncToken, async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as SyncBody;
  const expectedServiceId = getDmitServiceId();
  if (expectedServiceId == null) {
    return res.status(400).json({ error: 'DMIT_SERVICE_ID is not configured' });
  }
  if (body.service_id !== expectedServiceId) {
    return res.status(400).json({ error: 'service_id does not match DMIT_SERVICE_ID' });
  }
  if (!isNonNegInt(body.bwusage) || !isNonNegInt(body.bwlimit)) {
    return res.status(400).json({ error: 'bwusage and bwlimit must be non-negative integers' });
  }
  if (body.bwlimit === 0) {
    return res.status(400).json({ error: 'bwlimit must be positive' });
  }

  const now = Date.now();
  // Prefer server-side derivation from DMIT's raw "X.XX 天" string (unit-tested,
  // snaps to UTC midnight). Fall back to explicit fields when the text is absent.
  const daysText =
    typeof body.days_until_reset_text === 'string' ? body.days_until_reset_text : null;
  const derived = deriveNextReset(parseDaysUntilReset(daysText), now);
  const nextResetDay = derived.nextResetDay ?? asOptionalBillingDay(body.next_reset_day);
  const nextResetAt = derived.nextResetAt ?? asOptionalFutureMs(body.next_reset_at, now);

  // Capture the concurrent 3X-UI client-sum so machine-usage can advance the gauge
  // between DMIT syncs by the calibrated DMIT/3X-UI ratio (3X-UI only counts the client
  // leg, so it undercounts DMIT's network-layer billing ~2x for a proxy).
  let xuiUsedMb: number | null = null;
  const xuiCreds = getXuiCredentials();
  if (xuiCreds) {
    try {
      const liveInbounds = await loginAndListInbounds(xuiCreds.username, xuiCreds.password);
      const xuiUsedBytes = liveInbounds.reduce(
        (sum, inbound) => sum + getInboundClientUsedBytes(inbound),
        0,
      );
      xuiUsedMb = Math.round(xuiUsedBytes / (1024 * 1024));
    } catch (err) {
      console.warn(
        '[dmit] failed to capture 3X-UI sum for snapshot calibration:',
        err instanceof Error ? err.message : err,
      );
    }
  }

  upsertDmitTraffic({
    serviceId: expectedServiceId,
    bwusageMb: body.bwusage,
    bwlimitMb: body.bwlimit,
    bwusageInMb: asOptionalNonNegInt(body.bwusage_in),
    bwusageOutMb: asOptionalNonNegInt(body.bwusage_out),
    usagePercentage: asOptionalNumber(body.usage_percentage),
    nextResetDay,
    nextResetAt,
    xuiUsedMb,
    source: 'tampermonkey',
    now,
  });

  let billingDayAction: BillingDayAction = 'noop';
  const snapshot = getDmitTrafficSnapshot(expectedServiceId);
  const currentBillingDays = listBillingConfigs().map((c) => c.billingDay);
  const decision = decideBillingDayAction({
    nextResetDay,
    autoAppliedBillingDay: snapshot?.autoAppliedBillingDay ?? null,
    currentBillingDays,
  });

  if (decision.action === 'applied' && decision.applyTo != null) {
    const creds = getXuiCredentials();
    if (creds) {
      try {
        const inbounds = await loginAndListInbounds(creds.username, creds.password);
        const configured = new Set(listBillingConfigs().map((c) => c.inboundId));
        for (const inbound of inbounds) {
          if (configured.has(inbound.id)) continue; // respect manual config
          setBillingDay(inbound.id, decision.applyTo);
        }
        markAutoAppliedBillingDay(expectedServiceId, decision.applyTo);
        billingDayAction = 'applied';
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'Unknown error';
        console.warn(`[dmit] auto-apply billing day failed: ${detail}`);
        billingDayAction = 'noop';
      }
    }
  } else {
    billingDayAction = decision.action;
  }

  return res.json({ ok: true, updated_at: now, billing_day_action: billingDayAction });
});

export default router;
