import { describe, expect, it } from 'vitest';

import { formatBuildTime } from './AppVersionFooter';

describe('formatBuildTime', () => {
  it('formats the build timestamp down to the minute', () => {
    expect(formatBuildTime('2026-05-17T11:15:24.000Z', 'sv-SE')).toMatch(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/,
    );
  });

  it('returns an empty string for invalid timestamps', () => {
    expect(formatBuildTime('not-a-date', 'zh-CN')).toBe('');
  });
});
