import { describe, expect, it } from 'vitest';
import {
  appendAnnouncementHistoryEntry,
  ensureAnnouncementHistoryEntry,
  isAnnouncementNotificationId,
  normalizeAnnouncementHistoryEntries,
  parseAnnouncementHistory,
  removeAnnouncementHistoryEntry,
} from './announcement-history.js';

describe('announcement history helpers', () => {
  it('parses and sorts stored history entries', () => {
    const history = parseAnnouncementHistory(
      JSON.stringify([
        { id: 'admin-announcement:1000', message: 'Older', createdAt: 1000 },
        { id: 'admin-announcement:2000', message: 'Newer', createdAt: 2000 },
      ]),
    );

    expect(history.map((entry) => entry.message)).toEqual(['Newer', 'Older']);
  });

  it('seeds a legacy current announcement without duplicating the same message and timestamp', () => {
    const history = ensureAnnouncementHistoryEntry([], 'Maintenance window', 1_710_000_000_000);
    const next = ensureAnnouncementHistoryEntry(history, 'Maintenance window', 1_710_000_000_000);

    expect(next).toHaveLength(1);
    expect(next[0].message).toBe('Maintenance window');
  });

  it('appends a new announcement and recognizes history ids', () => {
    const history = appendAnnouncementHistoryEntry([], 'Newest update', 1_710_000_100_000);

    expect(history).toHaveLength(1);
    expect(isAnnouncementNotificationId(history[0].id)).toBe(true);
  });

  it('removes a specific announcement from history', () => {
    const history = appendAnnouncementHistoryEntry([], 'Newest update', 1_710_000_100_000);
    const next = removeAnnouncementHistoryEntry(history, history[0].id);

    expect(next).toEqual([]);
  });

  it('normalizes unsorted history entries', () => {
    const normalized = normalizeAnnouncementHistoryEntries([
      { id: 'admin-announcement:1000', message: 'Older', createdAt: 1000 },
      { id: 'admin-announcement:2000', message: 'Newer', createdAt: 2000 },
      { id: 'admin-announcement:2000', message: 'Newer', createdAt: 2000 },
    ]);

    expect(normalized.map((entry) => entry.message)).toEqual(['Newer', 'Older']);
  });
});
