export interface SubscriptionNodeCard {
  id: string;
  flag: string;
  name: string;
  usedLabel: string | null;
  limitLabel: string | null;
  /** 0–1 when both used and limit are present. */
  usedRatio: number | null;
}

const DECORATION_NAME = /^(重置|到期|个人|他人|机器)｜/;
const FLAG_PATTERN = /\p{Regional_Indicator}{2}/u;
const USED_PATTERN = /已用\s*([\d.]+)\s*([KMGT])\s*\/\s*([\d.]+)\s*([KMGT])/i;
const MONTHLY_PATTERN = /([\d.]+)\s*([KMGT])\s*\/\s*月/i;
const UNIT: Record<string, number> = { K: 1e3, M: 1e6, G: 1e9, T: 1e12 };

function decodeBase64Utf8(value: string): string | null {
  try {
    const compact = value.replace(/\s+/g, '');
    if (compact.length < 8 || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(compact)) return null;
    const normalized = compact.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function decodeBase64Json(value: string): Record<string, unknown> | null {
  try {
    const text = decodeBase64Utf8(value.split('#')[0] ?? value);
    return text ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Universal subscriptions are base64. Raw link lists are left as-is. */
function subscriptionText(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return '';
  if (/(^|\n)\s*[a-z0-9]+:\/\//i.test(trimmed)) return trimmed;
  const decoded = decodeBase64Utf8(trimmed);
  if (decoded && /[a-z0-9]+:\/\//i.test(decoded)) return decoded;
  return trimmed;
}

function linkName(line: string): string {
  if (line.startsWith('vmess://')) {
    const config = decodeBase64Json(line.slice('vmess://'.length).split('#')[0] ?? '');
    return String(config?.ps ?? '').trim();
  }
  const hash = line.indexOf('#');
  if (hash < 0) return '';
  const raw = line.slice(hash + 1);
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
}

function amount(value: string, unit: string): number | null {
  const quantity = Number(value);
  const scale = UNIT[unit.toUpperCase()];
  if (!Number.isFinite(quantity) || quantity < 0 || !scale) return null;
  return quantity * scale;
}

function label(value: string, unit: string): string {
  return `${value}${unit.toUpperCase()}`;
}

export function parseSubscriptionNodeCards(body: string): SubscriptionNodeCard[] {
  const cards: SubscriptionNodeCard[] = [];
  const seen = new Set<string>();
  for (const rawLine of subscriptionText(body).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.includes('prism_info=')) continue;
    const fullName = linkName(line);
    if (!fullName || DECORATION_NAME.test(fullName)) continue;
    const flagMatch = fullName.match(FLAG_PATTERN);
    const flag = flagMatch?.[0] ?? '';
    const usedMatch = fullName.match(USED_PATTERN);
    const monthlyMatch = usedMatch ? null : fullName.match(MONTHLY_PATTERN);
    const usedBytes = usedMatch ? amount(usedMatch[1], usedMatch[2]) : null;
    const limitBytes = usedMatch
      ? amount(usedMatch[3], usedMatch[4])
      : monthlyMatch
        ? amount(monthlyMatch[1], monthlyMatch[2])
        : null;
    let name = flag ? fullName.replace(FLAG_PATTERN, ' ') : fullName;
    name = name.replace(USED_PATTERN, '').replace(MONTHLY_PATTERN, '');
    name = name
      .replace(/\s*｜\s*/g, '｜')
      .replace(/^[｜\s]+|[｜\s]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const id = fullName;
    if (seen.has(id)) continue;
    seen.add(id);
    cards.push({
      id,
      flag,
      name: name || fullName,
      usedLabel: usedMatch ? label(usedMatch[1], usedMatch[2]) : null,
      limitLabel: usedMatch
        ? label(usedMatch[3], usedMatch[4])
        : monthlyMatch
          ? label(monthlyMatch[1], monthlyMatch[2])
          : null,
      usedRatio:
        usedBytes != null && limitBytes != null && limitBytes > 0
          ? Math.min(usedBytes / limitBytes, 1)
          : null,
    });
  }
  return cards;
}
