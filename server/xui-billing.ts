import { db } from './db.js';
import { resetInboundAllClientTraffics } from './xui-admin.js';

export interface BillingConfig {
  inboundId: number;
  billingDay: number;
  lastResetDate: string | null;
}

const SCHEDULER_RECHECK_MS = 60 * 1000;
const MAX_TIMEOUT_MS = 2_147_483_647;

const selectAllStmt = db.prepare(
  'SELECT inbound_id AS inboundId, billing_day AS billingDay, last_reset_date AS lastResetDate FROM xui_inbound_billing ORDER BY inbound_id',
);
const selectOneStmt = db.prepare(
  'SELECT inbound_id AS inboundId, billing_day AS billingDay, last_reset_date AS lastResetDate FROM xui_inbound_billing WHERE inbound_id = ?',
);
const upsertStmt = db.prepare(
  `INSERT INTO xui_inbound_billing (inbound_id, billing_day) VALUES (?, ?)
   ON CONFLICT(inbound_id) DO UPDATE SET billing_day = excluded.billing_day`,
);
const deleteStmt = db.prepare('DELETE FROM xui_inbound_billing WHERE inbound_id = ?');
const markResetStmt = db.prepare(
  'UPDATE xui_inbound_billing SET last_reset_date = ? WHERE inbound_id = ?',
);

export function listBillingConfigs(): BillingConfig[] {
  return selectAllStmt.all() as BillingConfig[];
}

export function getBillingConfig(inboundId: number): BillingConfig | null {
  return (selectOneStmt.get(inboundId) as BillingConfig | undefined) ?? null;
}

export function setBillingDay(inboundId: number, day: number): void {
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new Error(`Invalid billing day: ${day} (must be integer 1-31)`);
  }
  if (!Number.isInteger(inboundId) || inboundId <= 0) {
    throw new Error(`Invalid inbound id: ${inboundId}`);
  }
  upsertStmt.run(inboundId, day);
}

export function clearBillingDay(inboundId: number): void {
  deleteStmt.run(inboundId);
}

export function formatDateUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function lastDayOfMonthUTC(year: number, monthIndex: number): number {
  // Day 0 of next month = last day of current month (UTC-safe via Date.UTC).
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function shouldResetToday(
  billingDay: number,
  now: Date,
  lastResetDate: string | null,
): boolean {
  const today = formatDateUTC(now);
  if (lastResetDate === today) return false;
  const monthLastDay = lastDayOfMonthUTC(now.getUTCFullYear(), now.getUTCMonth());
  const effectiveDay = Math.min(billingDay, monthLastDay);
  return now.getUTCDate() === effectiveDay;
}

function billingResetAtUTC(year: number, monthIndex: number, billingDay: number): Date {
  const monthLastDay = lastDayOfMonthUTC(year, monthIndex);
  const effectiveDay = Math.min(billingDay, monthLastDay);
  return new Date(Date.UTC(year, monthIndex, effectiveDay, 0, 0, 0, 0));
}

export function getNextBillingResetAtUTC(now: Date, billingDay: number): Date {
  if (!Number.isInteger(billingDay) || billingDay < 1 || billingDay > 31) {
    throw new Error(`Invalid billing day: ${billingDay} (must be integer 1-31)`);
  }

  const thisMonth = billingResetAtUTC(now.getUTCFullYear(), now.getUTCMonth(), billingDay);
  if (thisMonth.getTime() > now.getTime()) return thisMonth;
  return billingResetAtUTC(now.getUTCFullYear(), now.getUTCMonth() + 1, billingDay);
}

export function getNextScheduledBillingResetAtUTC(
  now: Date,
  configs: BillingConfig[] = listBillingConfigs(),
): Date | null {
  if (configs.length === 0) return null;
  return configs.reduce<Date | null>((next, cfg) => {
    const candidate = getNextBillingResetAtUTC(now, cfg.billingDay);
    return next === null || candidate.getTime() < next.getTime() ? candidate : next;
  }, null);
}

export function getBillingSchedulerDelayMs(
  now: Date,
  configs: BillingConfig[] = listBillingConfigs(),
): number {
  const nextResetAt = getNextScheduledBillingResetAtUTC(now, configs);
  if (!nextResetAt) return SCHEDULER_RECHECK_MS;
  const msUntilReset = Math.max(0, nextResetAt.getTime() - now.getTime());
  return Math.min(msUntilReset, SCHEDULER_RECHECK_MS, MAX_TIMEOUT_MS);
}

export async function runBillingResetTick(
  now: Date,
  resetFn: (inboundId: number) => Promise<void> = resetInboundAllClientTraffics,
): Promise<void> {
  const configs = listBillingConfigs();
  const today = formatDateUTC(now);

  for (const cfg of configs) {
    if (!shouldResetToday(cfg.billingDay, now, cfg.lastResetDate)) continue;
    try {
      await resetFn(cfg.inboundId);
      markResetStmt.run(today, cfg.inboundId);
      console.log(
        `[Prism] Billing reset succeeded for inbound ${cfg.inboundId} (day ${cfg.billingDay}) on ${today}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[Prism] Billing reset failed for inbound ${cfg.inboundId} on ${today}: ${msg}`,
      );
    }
  }
}

export function createBillingTickRunner(
  getNow: () => Date = () => new Date(),
  resetFn?: (inboundId: number) => Promise<void>,
): () => Promise<void> {
  let isRunning = false;
  return async () => {
    if (isRunning) {
      console.warn('[Prism] Billing scheduler tick skipped: previous run still in flight');
      return;
    }
    isRunning = true;
    try {
      await runBillingResetTick(getNow(), resetFn);
    } catch (err) {
      console.error('[Prism] Billing scheduler tick failed:', err);
    } finally {
      isRunning = false;
    }
  };
}

export function startXuiBillingScheduler(): { stop: () => void } {
  const tick = createBillingTickRunner();
  let timer: NodeJS.Timeout | null = null;

  const scheduleNext = () => {
    const now = new Date();
    const nextResetAt = getNextScheduledBillingResetAtUTC(now);
    const delay = getBillingSchedulerDelayMs(now);

    timer = setTimeout(async () => {
      if (nextResetAt && nextResetAt.getTime() <= Date.now()) {
        await tick();
      }
      scheduleNext();
    }, delay);
  };

  void tick();
  scheduleNext();

  return {
    stop: () => {
      if (timer) clearTimeout(timer);
    },
  };
}
