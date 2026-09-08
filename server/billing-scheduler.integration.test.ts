import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BillingResetOptions } from './xui-admin.js';

describe('billing scheduler recovery', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-billing-test-'));
  let database: typeof import('./db.js');
  let billing: typeof import('./xui-billing.js');
  beforeEach(async () => {
    database?.db.close();
    vi.resetModules();
    vi.useRealTimers();
    vi.stubEnv('DATA_DIR', directory);
    vi.stubEnv('VITE_3XUI_SERVER', '');
    database = await import('./db.js');
    billing = await import('./xui-billing.js');
    database.db.exec('DELETE FROM xui_billing_reset_jobs; DELETE FROM xui_inbound_billing;');
  });
  afterAll(() => {
    database.db.close();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    const resolved = fs.realpathSync(directory);
    if (
      path.dirname(resolved) === fs.realpathSync(os.tmpdir()) &&
      path.basename(resolved).startsWith('prism-billing-test-')
    )
      fs.rmSync(resolved, { recursive: true });
  });
  it('retries a failed midnight tick, then remains idempotent', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-14T23:59:59Z'));
    billing.setBillingDay(1, 15);
    const reset = vi
      .fn()
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValue(undefined);
    const scheduler = billing.startXuiBillingScheduler({ resetFn: reset });
    await vi.advanceTimersByTimeAsync(1000);
    expect(reset).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(reset).toHaveBeenCalledTimes(2);
    expect(billing.getBillingConfig(1)?.lastResetDate).toBe('2026-05-15');
    await vi.advanceTimersByTimeAsync(180_000);
    expect(reset).toHaveBeenCalledTimes(2);
    scheduler.stop();
  });
  it('persists partial completion across module/database restart and the next UTC day', async () => {
    billing.setBillingDay(2, 15);
    let aggregateCalls = 0;
    const failing = vi.fn(async (_id: number, options?: BillingResetOptions) => {
      if (!options?.skipAggregate) {
        aggregateCalls++;
        options?.onAggregateReset?.();
      }
      throw new Error('client reset refused');
    });
    await billing.runBillingResetTick(new Date('2026-05-15T23:59:59Z'), failing);
    database.db.close();
    vi.resetModules();
    database = await import('./db.js');
    billing = await import('./xui-billing.js');
    const recovering = vi.fn(async (_id: number, options?: BillingResetOptions) => {
      if (!options?.skipAggregate) aggregateCalls++;
    });
    await billing.runBillingResetTick(new Date('2026-05-16T00:02:00Z'), recovering);
    expect(aggregateCalls).toBe(1);
    expect(recovering).toHaveBeenCalledWith(2, expect.objectContaining({ skipAggregate: true }));
    expect(billing.getBillingConfig(2)?.lastResetDate).toBe('2026-05-15');
  });
  it('does not backdate a reset for an existing configuration with no recorded task', async () => {
    billing.setBillingDay(3, 15);
    const reset = vi.fn();
    await billing.runBillingResetTick(new Date('2026-05-16T12:00:00Z'), reset);
    expect(reset).not.toHaveBeenCalled();
  });
  it('does not replay a write if the process exits after persisting its intent', async () => {
    const url = new URL('./xui-billing.ts', import.meta.url).href;
    const script = `const b=await import(${JSON.stringify(url)});b.setBillingDay(9,15);await b.runBillingResetTick(new Date('2026-05-15T00:00:00Z'),async(_id,o)=>{o.onBeforeWrite();process.exit(0)});`;
    const child = spawnSync(
      process.execPath,
      ['--import', 'tsx/esm', '--input-type=module', '-e', script],
      {
        env: { ...process.env, DATA_DIR: directory, VITE_3XUI_SERVER: '' },
        encoding: 'utf8',
        timeout: 10000,
      },
    );
    expect(child.status, child.stderr).toBe(0);
    const reset = vi.fn();
    await billing.runBillingResetTick(new Date('2026-05-16T00:00:00Z'), reset);
    expect(reset).not.toHaveBeenCalled();
    expect(billing.listBillingResetJobs().find((j) => j.inboundId === 9)?.requiresReview).toBe(1);
  });
  it('holds uncertain writes for review and accepts confirmed completion without replay', async () => {
    const { XuiMutationUncertainError } = await import('./xui-admin.js');
    billing.setBillingDay(6, 15);
    const reset = vi.fn().mockRejectedValue(new XuiMutationUncertainError('unknown write result'));
    await billing.runBillingResetTick(new Date('2026-05-15T00:00:00Z'), reset);
    await billing.runBillingResetTick(new Date('2026-05-15T01:00:00Z'), reset);
    expect(reset).toHaveBeenCalledTimes(1);
    expect(billing.reviewBillingReset(6, '2026-05-15', 'complete')).toBe(true);
    await billing.runBillingResetTick(new Date('2026-05-15T02:00:00Z'), reset);
    expect(reset).toHaveBeenCalledTimes(1);
    expect(billing.getBillingConfig(6)?.lastResetDate).toBe('2026-05-15');
  });
  it('cancels pending work when the billing schedule is changed', async () => {
    billing.setBillingDay(4, 15);
    await billing.runBillingResetTick(
      new Date('2026-05-15T00:00:00Z'),
      vi.fn().mockRejectedValue(new Error('offline')),
    );
    billing.setBillingDay(4, 20);
    const reset = vi.fn();
    await billing.runBillingResetTick(new Date('2026-05-16T00:00:00Z'), reset);
    expect(reset).not.toHaveBeenCalled();
  });
  it('does not reschedule after stop while a tick is in flight', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T00:00:00Z'));
    billing.setBillingDay(5, 15);
    let release!: () => void;
    const reset = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const scheduler = billing.startXuiBillingScheduler({ resetFn: reset });
    scheduler.stop();
    release();
    await vi.advanceTimersByTimeAsync(300_000);
    expect(reset).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
