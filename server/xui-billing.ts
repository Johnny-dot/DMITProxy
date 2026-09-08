import { db } from './db.js';
import { resetInboundTrafficCounters, XuiMutationUncertainError } from './xui-admin.js';
import { createHash } from 'node:crypto';
import { getXuiTarget } from './xui.js';

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

function scopeKey() {
  return createHash('sha256').update(JSON.stringify(getXuiTarget())).digest('hex');
}
const inFlightJobs = new Set<string>();

interface ResetJob {
  cycle_date: string;
  aggregate_done: number;
  attempt_count: number;
  next_attempt_at: number;
}

export interface BillingResetJobSummary {
  inboundId: number;
  cycleDate: string;
  billingDay: number;
  aggregateDone: number;
  attemptCount: number;
  nextAttemptAt: number;
  lastError: string | null;
  requiresReview: number;
  completedAt: number | null;
  cancelledAt: number | null;
  inFlight: boolean;
}

export function listBillingResetJobs(): BillingResetJobSummary[] {
  const scope = scopeKey();
  const rows = db
    .prepare(
      `SELECT inbound_id AS inboundId, cycle_date AS cycleDate, billing_day AS billingDay,
    aggregate_done AS aggregateDone, attempt_count AS attemptCount, next_attempt_at AS nextAttemptAt,
    last_error AS lastError, requires_review AS requiresReview, completed_at AS completedAt, cancelled_at AS cancelledAt
    FROM xui_billing_reset_jobs WHERE scope_key = ? ORDER BY cycle_date DESC, inbound_id LIMIT 100`,
    )
    .all(scope) as Array<Omit<BillingResetJobSummary, 'inFlight'>>;
  return rows.map((row) => ({
    ...row,
    inFlight: inFlightJobs.has(`${scope}:${row.inboundId}:${row.cycleDate}`),
  }));
}

export function reviewBillingReset(
  inboundId: number,
  cycleDate: string,
  decision: 'retry' | 'aggregate-done' | 'complete',
): boolean {
  return db.transaction(() => {
    const scope = scopeKey();
    if (inFlightJobs.has(`${scope}:${inboundId}:${cycleDate}`)) return false;
    const job = db
      .prepare(
        `SELECT billing_day FROM xui_billing_reset_jobs WHERE scope_key=? AND inbound_id=? AND cycle_date=?
      AND requires_review=1 AND completed_at IS NULL AND cancelled_at IS NULL`,
      )
      .get(scope, inboundId, cycleDate) as { billing_day: number } | undefined;
    if (!job) return false;
    db.prepare(
      `UPDATE xui_billing_reset_jobs SET requires_review=0,next_attempt_at=0,
      aggregate_done=CASE WHEN ? THEN 1 ELSE aggregate_done END, completed_at=?
      WHERE scope_key=? AND inbound_id=? AND cycle_date=?`,
    ).run(
      decision !== 'retry' ? 1 : 0,
      decision === 'complete' ? Date.now() : null,
      scope,
      inboundId,
      cycleDate,
    );
    if (decision === 'complete' && getBillingConfig(inboundId)?.billingDay === job.billing_day)
      markResetStmt.run(cycleDate, inboundId);
    return true;
  })();
}

function cancelPendingResets(inboundId: number) {
  db.prepare(
    `UPDATE xui_billing_reset_jobs SET cancelled_at = ?
    WHERE inbound_id = ? AND completed_at IS NULL AND cancelled_at IS NULL`,
  ).run(Date.now(), inboundId);
}

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
  db.transaction(() => {
    const previous = getBillingConfig(inboundId);
    if (previous && previous.billingDay !== day) cancelPendingResets(inboundId);
    upsertStmt.run(inboundId, day);
  })();
}

export function clearBillingDay(inboundId: number): void {
  db.transaction(() => {
    cancelPendingResets(inboundId);
    deleteStmt.run(inboundId);
  })();
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
  resetFn: typeof resetInboundTrafficCounters = resetInboundTrafficCounters,
): Promise<void> {
  const configs = listBillingConfigs();
  const today = formatDateUTC(now);
  const scope = scopeKey();
  const nowMs = now.getTime();

  for (const cfg of configs) {
    if (shouldResetToday(cfg.billingDay, now, cfg.lastResetDate)) {
      // A new due cycle supersedes an unfinished older cycle. Keep its audit row.
      db.transaction(() => {
        db.prepare(
          `UPDATE xui_billing_reset_jobs SET cancelled_at = ? WHERE scope_key = ? AND inbound_id = ?
          AND cycle_date < ? AND completed_at IS NULL AND cancelled_at IS NULL`,
        ).run(nowMs, scope, cfg.inboundId, today);
        db.prepare(
          `INSERT OR IGNORE INTO xui_billing_reset_jobs(scope_key,inbound_id,cycle_date,billing_day)
          VALUES(?,?,?,?)`,
        ).run(scope, cfg.inboundId, today, cfg.billingDay);
      })();
    }
    const job = db
      .prepare(
        `SELECT cycle_date,aggregate_done,attempt_count,next_attempt_at FROM xui_billing_reset_jobs
      WHERE scope_key=? AND inbound_id=? AND billing_day=? AND cycle_date<=? AND requires_review=0 AND completed_at IS NULL AND cancelled_at IS NULL
      ORDER BY cycle_date DESC LIMIT 1`,
      )
      .get(scope, cfg.inboundId, cfg.billingDay, today) as ResetJob | undefined;
    if (!job || job.next_attempt_at > nowMs) continue;
    const key = `${scope}:${cfg.inboundId}:${job.cycle_date}`;
    if (inFlightJobs.has(key)) continue;
    db.prepare(
      `UPDATE xui_billing_reset_jobs SET attempt_count=attempt_count+1
      WHERE scope_key=? AND inbound_id=? AND cycle_date=?`,
    ).run(scope, cfg.inboundId, job.cycle_date);
    inFlightJobs.add(key);
    try {
      await resetFn(cfg.inboundId, {
        skipAggregate: job.aggregate_done === 1,
        onBeforeWrite: () => {
          const result = db
            .prepare(
              `UPDATE xui_billing_reset_jobs SET requires_review=1,
            last_error='Write in progress; inspect upstream if interrupted'
            WHERE scope_key=? AND inbound_id=? AND cycle_date=? AND completed_at IS NULL AND cancelled_at IS NULL`,
            )
            .run(scope, cfg.inboundId, job.cycle_date);
          if (result.changes !== 1) throw new Error('Billing reset was cancelled before the write');
        },
        onAggregateReset: () => {
          db.prepare(
            `UPDATE xui_billing_reset_jobs SET aggregate_done=1,requires_review=0,last_error=NULL
            WHERE scope_key=? AND inbound_id=? AND cycle_date=?`,
          ).run(scope, cfg.inboundId, job.cycle_date);
          const active = db
            .prepare(
              `SELECT 1 FROM xui_billing_reset_jobs WHERE scope_key=? AND inbound_id=?
            AND cycle_date=? AND cancelled_at IS NULL`,
            )
            .get(scope, cfg.inboundId, job.cycle_date);
          if (!active) throw new Error('Billing reset cancelled after the aggregate step');
        },
      });
      db.transaction(() => {
        db.prepare(
          `UPDATE xui_billing_reset_jobs SET completed_at=?,aggregate_done=1,last_error=NULL,next_attempt_at=0,requires_review=0
          WHERE scope_key=? AND inbound_id=? AND cycle_date=?`,
        ).run(nowMs, scope, cfg.inboundId, job.cycle_date);
        if (getBillingConfig(cfg.inboundId)?.billingDay === cfg.billingDay)
          markResetStmt.run(job.cycle_date, cfg.inboundId);
      })();
      console.log(
        `[Prism] Billing traffic reset succeeded for inbound ${cfg.inboundId}, cycle ${job.cycle_date}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const delay = Math.min(15 * 60_000, 60_000 * 2 ** Math.min(job.attempt_count, 4));
      db.prepare(
        `UPDATE xui_billing_reset_jobs SET last_error=?,next_attempt_at=?,requires_review=?
        WHERE scope_key=? AND inbound_id=? AND cycle_date=?`,
      ).run(
        msg.slice(0, 500),
        nowMs + delay,
        err instanceof XuiMutationUncertainError ? 1 : 0,
        scope,
        cfg.inboundId,
        job.cycle_date,
      );
      console.error(
        `[Prism] Billing reset failed for inbound ${cfg.inboundId} on ${today}: ${msg}`,
      );
    } finally {
      inFlightJobs.delete(key);
    }
  }
}

export function createBillingTickRunner(
  getNow: () => Date = () => new Date(),
  resetFn?: typeof resetInboundTrafficCounters,
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

export function startXuiBillingScheduler(
  options: { getNow?: () => Date; resetFn?: typeof resetInboundTrafficCounters } = {},
): { stop: () => void } {
  const getNow = options.getNow ?? (() => new Date());
  const tick = createBillingTickRunner(getNow, options.resetFn);
  let timer: NodeJS.Timeout | null = null;
  let stopped = false;

  const scheduleNext = () => {
    if (stopped) return;
    const now = getNow();
    const delay = getBillingSchedulerDelayMs(now);

    timer = setTimeout(async () => {
      await tick();
      scheduleNext();
    }, delay);
  };

  void tick();
  scheduleNext();

  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
