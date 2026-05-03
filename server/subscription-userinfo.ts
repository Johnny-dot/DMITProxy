import type { XuiClientUsage } from './xui-admin.js';

export function buildSubscriptionUserinfoHeader(usage: XuiClientUsage | null): string | null {
  if (!usage) return null;

  const upload = Math.max(0, Math.trunc(usage.up));
  const download = Math.max(0, Math.trunc(usage.down));
  const total = Math.max(0, Math.trunc(usage.total));
  const expire = Math.max(0, Math.trunc(usage.expiryTime / 1000));

  const parts = [`upload=${upload}`, `download=${download}`, `total=${total}`];
  if (expire > 0) parts.push(`expire=${expire}`);

  return parts.join('; ');
}
