export function getDmitServiceId(): number | null {
  const raw = (process.env.DMIT_SERVICE_ID ?? '').trim();
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function getDmitSyncToken(): string | null {
  const raw = (process.env.DMIT_SYNC_TOKEN ?? '').trim();
  return raw.length > 0 ? raw : null;
}
