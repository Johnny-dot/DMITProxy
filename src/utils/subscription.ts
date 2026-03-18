const SUB_BASE = (import.meta.env.VITE_SUB_URL ?? '').replace(/\/+$/, '');
const SUB_TEMPLATE = (import.meta.env.VITE_SUB_URL_TEMPLATE ?? '').trim();

type SubscriptionFormat = 'universal' | 'clash' | 'v2ray' | 'singbox' | 'surge' | 'quanx';

/** Formats that DMITProxy converts server-side (3X-UI doesn't support these natively). */
const LOCAL_CONVERTED_FORMATS = new Set<SubscriptionFormat>(['clash', 'singbox', 'surge']);

function appendQuery(url: string, key: string, value: string): string {
  const join = url.includes('?') ? '&' : '?';
  return `${url}${join}${key}=${encodeURIComponent(value)}`;
}

/**
 * Build the URL that the user's subscription link points to for the DMITProxy
 * conversion endpoint.  In production the browser's origin IS the server; in
 * dev mode the Vite proxy forwards `/sub/*` to the backend.
 */
/** Maps internal format names to the query parameter values the backend expects. */
const FORMAT_TO_FLAG: Partial<Record<SubscriptionFormat, string>> = {
  singbox: 'sing-box',
};

function buildLocalSubUrl(subId: string, format: SubscriptionFormat): string {
  const token = encodeURIComponent(subId.trim());
  if (!token) return '';
  const base = `${window.location.origin}/sub/${token}`;
  const flag = FORMAT_TO_FLAG[format] ?? format;
  return appendQuery(base, 'flag', flag);
}

function buildUpstreamSubUrl(subId: string): string {
  const token = encodeURIComponent(subId.trim());
  if (!token) return '';
  if (SUB_TEMPLATE.includes('{subId}')) {
    return SUB_TEMPLATE.replace('{subId}', token);
  }
  if (SUB_BASE) {
    return `${SUB_BASE}/sub/${token}`;
  }
  return '';
}

/**
 * Build a deep-link URL for QR code scanning.
 * Clash clients (FlClash, Clash Verge, etc.) require the clash:// scheme
 * so they can recognise the QR code as a subscription import.
 */
export function buildSubscriptionQrUrl(subId: string, format: SubscriptionFormat): string {
  const httpUrl = buildSubscriptionUrl(subId, format);
  if (!httpUrl) return '';
  if (format === 'clash') {
    return `clash://install-config?url=${encodeURIComponent(httpUrl)}`;
  }
  return httpUrl;
}

export function buildSubscriptionUrl(
  subId: string,
  format: SubscriptionFormat = 'universal',
): string {
  if (!subId.trim()) return '';

  // Formats that need server-side conversion go through DMITProxy's /sub route
  if (LOCAL_CONVERTED_FORMATS.has(format)) {
    return buildLocalSubUrl(subId, format);
  }

  // All other formats go directly to the upstream 3X-UI subscription endpoint
  const baseLink = buildUpstreamSubUrl(subId);
  if (!baseLink) return '';

  if (format === 'v2ray') return appendQuery(baseLink, 'flag', 'v2ray');
  if (format === 'singbox') return appendQuery(baseLink, 'flag', 'sing-box');
  if (format === 'surge') return appendQuery(baseLink, 'flag', 'surge');
  if (format === 'quanx') return appendQuery(baseLink, 'flag', 'quanx');
  return baseLink;
}
