export interface AnnouncementHistoryEntry {
  id: string;
  message: string;
  createdAt: number;
}

export const ANNOUNCEMENT_HISTORY_KEY = 'announcementHistory';
export const ANNOUNCEMENT_CURRENT_CREATED_AT_KEY = 'announcementCurrentCreatedAt';
export const ANNOUNCEMENT_NOTIFICATION_ID_PREFIX = 'admin-announcement';
const MAX_ANNOUNCEMENT_HISTORY_ITEMS = 12;

function normalizeCreatedAt(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return value > 1_000_000_000_000 ? Math.floor(value) : Math.floor(value * 1000);
}

function normalizeEntry(input: unknown): AnnouncementHistoryEntry | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;

  const payload = input as Record<string, unknown>;
  const message = typeof payload.message === 'string' ? payload.message.trim() : '';
  const createdAt = normalizeCreatedAt(payload.createdAt);

  if (!message || createdAt === null) return null;

  const storedId =
    typeof payload.id === 'string' && payload.id.trim() ? payload.id.trim() : undefined;

  return {
    id: storedId ?? buildAnnouncementNotificationId(createdAt),
    message,
    createdAt,
  };
}

function dedupeAndSort(entries: AnnouncementHistoryEntry[]): AnnouncementHistoryEntry[] {
  const seen = new Set<string>();

  return entries
    .sort((left, right) => right.createdAt - left.createdAt)
    .filter((entry) => {
      const dedupeKey = `${entry.createdAt}:${entry.message}`;
      if (seen.has(dedupeKey)) return false;
      seen.add(dedupeKey);
      return true;
    })
    .slice(0, MAX_ANNOUNCEMENT_HISTORY_ITEMS);
}

function toAnnouncementHistoryEntry(
  message: string,
  createdAt: number,
  id?: string,
): AnnouncementHistoryEntry | null {
  const trimmedMessage = message.trim();
  const normalizedCreatedAt = normalizeCreatedAt(createdAt);

  if (!trimmedMessage || normalizedCreatedAt === null) return null;

  return {
    id: id?.trim() || buildAnnouncementNotificationId(normalizedCreatedAt),
    message: trimmedMessage,
    createdAt: normalizedCreatedAt,
  };
}

export function buildAnnouncementNotificationId(createdAt: number): string {
  return `${ANNOUNCEMENT_NOTIFICATION_ID_PREFIX}:${createdAt}`;
}

export function isAnnouncementNotificationId(id: string): boolean {
  return (
    id === ANNOUNCEMENT_NOTIFICATION_ID_PREFIX ||
    id.startsWith(`${ANNOUNCEMENT_NOTIFICATION_ID_PREFIX}:`)
  );
}

export function parseAnnouncementHistory(raw: string | undefined): AnnouncementHistoryEntry[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return dedupeAndSort(parsed.map(normalizeEntry).filter(Boolean) as AnnouncementHistoryEntry[]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[announcement-history] failed to parse stored JSON: ${message}`);
    return [];
  }
}

export function normalizeAnnouncementHistoryEntries(
  entries: AnnouncementHistoryEntry[],
): AnnouncementHistoryEntry[] {
  return dedupeAndSort(
    entries.map((entry) => normalizeEntry(entry)).filter(Boolean) as AnnouncementHistoryEntry[],
  );
}

export function ensureAnnouncementHistoryEntry(
  history: AnnouncementHistoryEntry[],
  message: string,
  createdAt: number,
): AnnouncementHistoryEntry[] {
  const nextEntry = toAnnouncementHistoryEntry(message, createdAt);

  if (!nextEntry) {
    return dedupeAndSort([...history]);
  }

  const exists = history.some(
    (entry) => entry.createdAt === nextEntry.createdAt && entry.message === nextEntry.message,
  );
  if (exists) return dedupeAndSort([...history]);

  return dedupeAndSort([nextEntry, ...history]);
}

export function appendAnnouncementHistoryEntry(
  history: AnnouncementHistoryEntry[],
  message: string,
  createdAt: number,
): AnnouncementHistoryEntry[] {
  const nextEntry = toAnnouncementHistoryEntry(message, createdAt);

  if (!nextEntry) {
    return dedupeAndSort([...history]);
  }

  return dedupeAndSort([nextEntry, ...history]);
}

export function removeAnnouncementHistoryEntry(
  history: AnnouncementHistoryEntry[],
  id: string,
): AnnouncementHistoryEntry[] {
  const normalizedId = id.trim();
  if (!normalizedId) return dedupeAndSort([...history]);
  return dedupeAndSort(history.filter((entry) => entry.id !== normalizedId));
}
