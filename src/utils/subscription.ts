const SUB_BASE = (import.meta.env.VITE_SUB_URL ?? '').replace(/\/+$/, '');
const SUB_TEMPLATE = (import.meta.env.VITE_SUB_URL_TEMPLATE ?? '').trim();

type SubscriptionFormat = 'universal' | 'clash' | 'v2ray' | 'singbox';

function appendQuery(url: string, key: string, value: string): string {
  const join = url.includes('?') ? '&' : '?';
  return `${url}${join}${key}=${encodeURIComponent(value)}`;
}

export function buildSubscriptionUrl(
  subId: string,
  format: SubscriptionFormat = 'universal',
): string {
  const token = encodeURIComponent(subId.trim());
  if (!token) return '';

  let baseLink = '';
  if (SUB_TEMPLATE.includes('{subId}')) {
    baseLink = SUB_TEMPLATE.replace('{subId}', token);
  } else if (SUB_BASE) {
    baseLink = `${SUB_BASE}/sub/${token}`;
  }

  if (!baseLink) return '';

  if (format === 'clash') return appendQuery(baseLink, 'flag', 'clash');
  if (format === 'v2ray') return appendQuery(baseLink, 'flag', 'v2ray');
  if (format === 'singbox') return appendQuery(baseLink, 'flag', 'sing-box');
  return baseLink;
}
