import { db } from './db.js';
import { resetInboundAllClientTraffics } from './xui-admin.js';

export interface BillingConfig {
  inboundId: number;
  billingDay: number;
  lastResetDate: string | null;
}

const SCHEDULER_TICK_MS = 60 * 60 * 1000;

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

export function startXuiBillingScheduler(): { stop: () => void } {
  const tick = () => {
    runBillingResetTick(new Date()).catch((err) => {
      console.error('[Prism] Billing scheduler tick failed:', err);
    });
  };

  tick();
  const timer = setInterval(tick, SCHEDULER_TICK_MS);
  return {
    stop: () => clearInterval(timer),
  };
}
