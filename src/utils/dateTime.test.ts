import { describe, expect, it } from 'vitest';
import { formatDateTime } from './dateTime';

describe('formatDateTime', () => {
  it('formats timestamps as YYYY-MM-DD HH:mm', () => {
    expect(formatDateTime(Date.UTC(2026, 6, 16, 8, 5))).toBe('2026-07-16 08:05');
  });

  it('accepts unix seconds', () => {
    expect(formatDateTime(Date.UTC(2026, 6, 16, 8, 5) / 1000)).toBe('2026-07-16 08:05');
  });

  it('returns an empty string when there is no timestamp', () => {
    expect(formatDateTime(null)).toBe('');
    expect(formatDateTime(0)).toBe('');
  });
});
