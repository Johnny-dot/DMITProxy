import { randomUUID } from 'node:crypto';

export type SharedResourceKind =
  | 'apple-id'
  | 'chatgpt-account'
  | '1password-family'
  | 'spotify-family'
  | 'google-one-family'
  | 'other';

export type SharedResourceAccess = 'credentials' | 'invite-link' | 'instructions';

export interface SharedResource {
  id: string;
  title: string;
  kind: SharedResourceKind;
  access: SharedResourceAccess;
  summary: string;
  content: string;
  active: boolean;
}

const VALID_KINDS = new Set<SharedResourceKind>([
  'apple-id',
  'chatgpt-account',
  '1password-family',
  'spotify-family',
  'google-one-family',
  'other',
]);

const VALID_ACCESS = new Set<SharedResourceAccess>(['credentials', 'invite-link', 'instructions']);

function sanitizeSharedResource(input: unknown): SharedResource | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;

  const payload = input as Record<string, unknown>;
  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  const summary = typeof payload.summary === 'string' ? payload.summary.trim() : '';
  const content = typeof payload.content === 'string' ? payload.content.trim() : '';

  if (!title && !summary && !content) return null;

  const id = typeof payload.id === 'string' && payload.id.trim() ? payload.id.trim() : randomUUID();
  const kind = VALID_KINDS.has(payload.kind as SharedResourceKind)
    ? (payload.kind as SharedResourceKind)
    : 'other';
  const access = VALID_ACCESS.has(payload.access as SharedResourceAccess)
    ? (payload.access as SharedResourceAccess)
    : 'instructions';

  return {
    id,
    title,
    kind,
    access,
    summary,
    content,
    active: Boolean(payload.active),
  };
}

export function sanitizeSharedResourcesInput(input: unknown): SharedResource[] {
  if (!Array.isArray(input)) return [];
  return input
    .slice(0, 20)
    .map((entry) => sanitizeSharedResource(entry))
    .filter((entry): entry is SharedResource => entry !== null);
}

export function parseStoredSharedResources(value: string | undefined): SharedResource[] {
  if (!value?.trim()) return [];

  try {
    return sanitizeSharedResourcesInput(JSON.parse(value));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[shared-resources] failed to parse stored JSON: ${message}`);
    return [];
  }
}

export function buildLegacyAppleSharedResource(
  title: string,
  content: string,
  active: boolean,
): SharedResource[] {
  const normalizedTitle = title.trim();
  const normalizedContent = content.trim();

  if (!normalizedTitle && !normalizedContent) return [];

  return [
    {
      id: 'legacy-shared-apple-id',
      title: normalizedTitle || 'Shared US Apple ID / download instructions',
      kind: 'apple-id',
      access: 'credentials',
      summary: 'Imported from the legacy shared Apple ID settings.',
      content: normalizedContent,
      active,
    },
  ];
}
