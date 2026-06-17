import { db } from './db.js';

const MB = 1024 * 1024;
const CACHE_TTL_MS = 30_000;

export type DmitTrafficSource = 'tampermonkey' | 'manual';

export interface DmitTrafficUpsertInput {
  serviceId: number;
  bwusageMb: number;
  bwlimitMb: number;
  bwusageInMb?: number | null;
  bwusageOutMb?: number | null;
  usagePercentage?: number | null;
  nextResetDay?: number | null;
  nextResetAt?: number | null;
  /** 3X-UI client-sum (MB) at the moment of this snapshot — calibrates inter-sync advancement. */
  xuiUsedMb?: number | null;
  source: DmitTrafficSource;
  now?: number;
}

export interface DmitTrafficSnapshot {
  serviceId: number;
  bwusageBytes: number;
  bwlimitBytes: number;
  bwusageInBytes: number | null;
  bwusageOutBytes: number | null;
  usagePercentage: number | null;
  nextResetDay: number | null;
  nextResetAt: number | null;
  autoAppliedBillingDay: number | null;
  xuiUsedBytes: number | null;
  updatedAt: number;
  source: DmitTrafficSource;
}

interface Row {
  service_id: number;
  bwusage_mb: number;
  bwlimit_mb: number;
  bwusage_in_mb: number | null;
  bwusage_out_mb: number | null;
  usage_percentage: number | null;
  next_reset_day: number | null;
  next_reset_at: number | null;
  auto_applied_billing_day: number | null;
  xui_used_mb: number | null;
  updated_at: number;
  source: DmitTrafficSource;
}

const selectStmt = db.prepare(
  `SELECT service_id, bwusage_mb, bwlimit_mb, bwusage_in_mb, bwusage_out_mb,
          usage_percentage, next_reset_day, next_reset_at, auto_applied_billing_day,
          xui_used_mb, updated_at, source
     FROM dmit_traffic WHERE service_id = ?`,
);

const upsertStmt = db.prepare(
  `INSERT INTO dmit_traffic (
     service_id, bwusage_mb, bwlimit_mb, bwusage_in_mb, bwusage_out_mb,
     usage_percentage, next_reset_day, next_reset_at, xui_used_mb, updated_at, source
   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
   ON CONFLICT(service_id) DO UPDATE SET
     bwusage_mb = excluded.bwusage_mb,
     bwlimit_mb = excluded.bwlimit_mb,
     bwusage_in_mb = excluded.bwusage_in_mb,
     bwusage_out_mb = excluded.bwusage_out_mb,
     usage_percentage = excluded.usage_percentage,
     next_reset_day = excluded.next_reset_day,
     next_reset_at = excluded.next_reset_at,
     xui_used_mb = excluded.xui_used_mb,
     updated_at = excluded.updated_at,
     source = excluded.source`,
);

const markAutoAppliedStmt = db.prepare(
  `UPDATE dmit_traffic SET auto_applied_billing_day = ? WHERE service_id = ?`,
);

const cache = new Map<number, { snapshot: DmitTrafficSnapshot | null; expiresAt: number }>();

function rowToSnapshot(row: Row | undefined): DmitTrafficSnapshot | null {
  if (!row) return null;
  return {
    serviceId: row.service_id,
    bwusageBytes: row.bwusage_mb * MB,
    bwlimitBytes: row.bwlimit_mb * MB,
    bwusageInBytes: row.bwusage_in_mb == null ? null : row.bwusage_in_mb * MB,
    bwusageOutBytes: row.bwusage_out_mb == null ? null : row.bwusage_out_mb * MB,
    usagePercentage: row.usage_percentage,
    nextResetDay: row.next_reset_day,
    nextResetAt: row.next_reset_at,
    autoAppliedBillingDay: row.auto_applied_billing_day,
    xuiUsedBytes: row.xui_used_mb == null ? null : row.xui_used_mb * MB,
    updatedAt: row.updated_at,
    source: row.source,
  };
}

export function getDmitTrafficSnapshot(serviceId: number): DmitTrafficSnapshot | null {
  const now = Date.now();
  const cached = cache.get(serviceId);
  if (cached && cached.expiresAt > now) return cached.snapshot;

  const row = selectStmt.get(serviceId) as Row | undefined;
  const snapshot = rowToSnapshot(row);
  cache.set(serviceId, { snapshot, expiresAt: now + CACHE_TTL_MS });
  return snapshot;
}

export function upsertDmitTraffic(input: DmitTrafficUpsertInput): void {
  const updatedAt = input.now ?? Date.now();
  upsertStmt.run(
    input.serviceId,
    input.bwusageMb,
    input.bwlimitMb,
    input.bwusageInMb ?? null,
    input.bwusageOutMb ?? null,
    input.usagePercentage ?? null,
    input.nextResetDay ?? null,
    input.nextResetAt ?? null,
    input.xuiUsedMb ?? null,
    updatedAt,
    input.source,
  );
  cache.delete(input.serviceId);
}

export function markAutoAppliedBillingDay(serviceId: number, day: number): void {
  markAutoAppliedStmt.run(day, serviceId);
  cache.delete(serviceId);
}

export function invalidateDmitTrafficCache(): void {
  cache.clear();
}
