type SubscriptionFormat = 'universal' | 'clash' | 'v2ray' | 'singbox' | 'surge' | 'quanx';

function appendQuery(url: string, key: string, value: string): string {
  const join = url.includes('?') ? '&' : '?';
  return `${url}${join}${key}=${encodeURIComponent(value)}`;
}

/**
 * Build the public Prism subscription URL. In production the app and backend
 * usually share an origin; in dev mode the Vite proxy forwards `/sub/*`.
 */
const FORMAT_TO_FLAG: Partial<Record<SubscriptionFormat, string>> = {
  singbox: 'sing-box',
};

function buildPrismSubUrl(subId: string): string {
  const token = encodeURIComponent(subId.trim());
  if (!token) return '';
  return `${window.location.origin}/sub/${token}`;
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

  const baseLink = buildPrismSubUrl(subId);
  if (!baseLink) return '';
  if (format === 'universal') return baseLink;

  const flag = FORMAT_TO_FLAG[format] ?? format;
  return appendQuery(baseLink, 'flag', flag);
}
