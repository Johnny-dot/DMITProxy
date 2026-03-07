import { randomUUID } from 'node:crypto';

export type CommunityPlatform = 'telegram' | 'whatsapp' | 'discord' | 'wechat' | 'custom';

export interface CommunityLink {
  id: string;
  title: string;
  platform: CommunityPlatform;
  url: string;
  summary: string;
  rules: string;
  notes: string;
  qrContent: string;
  active: boolean;
}

const VALID_PLATFORMS = new Set<CommunityPlatform>([
  'telegram',
  'whatsapp',
  'discord',
  'wechat',
  'custom',
]);

function sanitizeCommunityLink(input: unknown): CommunityLink | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;

  const payload = input as Record<string, unknown>;
  const title = typeof payload.title === 'string' ? payload.title.trim().slice(0, 80) : '';
  const url = typeof payload.url === 'string' ? payload.url.trim().slice(0, 2000) : '';
  const summary = typeof payload.summary === 'string' ? payload.summary.trim().slice(0, 240) : '';
  const rules = typeof payload.rules === 'string' ? payload.rules.trim().slice(0, 4000) : '';
  const notes = typeof payload.notes === 'string' ? payload.notes.trim().slice(0, 4000) : '';
  const qrContent =
    typeof payload.qrContent === 'string' ? payload.qrContent.trim().slice(0, 4000) : '';

  if (!title && !url && !summary && !rules && !notes && !qrContent) return null;

  const id = typeof payload.id === 'string' && payload.id.trim() ? payload.id.trim() : randomUUID();
  const platform = VALID_PLATFORMS.has(payload.platform as CommunityPlatform)
    ? (payload.platform as CommunityPlatform)
    : 'custom';

  return {
    id,
    title,
    platform,
    url,
    summary,
    rules,
    notes,
    qrContent,
    active: Boolean(payload.active),
  };
}

export function sanitizeCommunityLinksInput(input: unknown): CommunityLink[] {
  if (!Array.isArray(input)) return [];
  return input
    .slice(0, 12)
    .map((entry) => sanitizeCommunityLink(entry))
    .filter((entry): entry is CommunityLink => entry !== null);
}

export function parseStoredCommunityLinks(value: string | undefined): CommunityLink[] {
  if (!value?.trim()) return [];

  try {
    return sanitizeCommunityLinksInput(JSON.parse(value));
  } catch {
    return [];
  }
}
