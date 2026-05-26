import { localFetch } from './base';

export interface AdminDmitTraffic {
  service_id: number;
  bwusage_mb: number;
  bwlimit_mb: number;
  bwusage_in_mb: number | null;
  bwusage_out_mb: number | null;
  usage_percentage: number | null;
  next_reset_day: number | null;
  next_reset_at: number | null;
  auto_applied_billing_day: number | null;
  updated_at: number;
  source: 'tampermonkey' | 'manual';
  is_stale: boolean;
}

export interface AdminDmitTrafficResponse {
  exists: boolean;
  configured: boolean;
  service_id?: number;
  data?: AdminDmitTraffic;
}

export interface AdminDmitManualInput {
  bwusage: number;
  bwlimit: number;
  bwusage_in?: number;
  bwusage_out?: number;
  usage_percentage?: number;
}

export interface AdminDmitBillingSyncResponse {
  ok: true;
  updated: number;
  billing_day: number;
}

export function getAdminDmitTraffic(): Promise<AdminDmitTrafficResponse> {
  return localFetch<AdminDmitTrafficResponse>('/local/admin/dmit/traffic', {
    fallbackError: 'Failed to load DMIT traffic',
  });
}

export async function postAdminDmitTrafficManual(input: AdminDmitManualInput): Promise<void> {
  await localFetch<{ ok: boolean }>('/local/admin/dmit/traffic/manual', {
    method: 'POST',
    body: JSON.stringify(input),
    fallbackError: 'Failed to save DMIT traffic',
  });
}

export function postAdminDmitBillingSync(): Promise<AdminDmitBillingSyncResponse> {
  return localFetch<AdminDmitBillingSyncResponse>('/local/admin/dmit/billing-day/sync', {
    method: 'POST',
    fallbackError: 'Failed to sync DMIT billing day',
  });
}

/** URL to fetch the rendered Tampermonkey script (admin-only). */
export const ADMIN_DMIT_USERSCRIPT_URL = '/local/admin/dmit/userscript';
