import { describe, expect, it } from 'vitest';
import { isNodeQualityStale, NODE_QUALITY_STALE_AFTER_MS } from './nodeQuality';

describe('isNodeQualityStale', () => {
  const now = Date.UTC(2026, 9, 26, 3, 0);

  it('treats a July check as stale in October', () => {
    expect(isNodeQualityStale(Date.UTC(2026, 6, 16, 0, 0), now)).toBe(true);
  });

  it('keeps a check from the last day fresh', () => {
    expect(isNodeQualityStale(now - NODE_QUALITY_STALE_AFTER_MS + 1000, now)).toBe(false);
  });

  it('does not call a missing check stale', () => {
    expect(isNodeQualityStale(null, now)).toBe(false);
  });
});
