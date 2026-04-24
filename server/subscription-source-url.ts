function appendSubPath(base: string, subId: string): string {
  return `${base.replace(/\/+$/, '')}/sub/${encodeURIComponent(subId)}`;
}

export function buildPublicSubscriptionSourceUrl(subId: string): string | null {
  const trimmedSubId = subId.trim();
  if (!trimmedSubId) return null;

  const template = String(process.env.VITE_SUB_URL_TEMPLATE ?? '').trim();
  if (template.includes('{subId}')) {
    return template.replace('{subId}', encodeURIComponent(trimmedSubId));
  }

  const base = String(process.env.VITE_SUB_URL ?? '').trim();
  if (!base) return null;

  return appendSubPath(base, trimmedSubId);
}
