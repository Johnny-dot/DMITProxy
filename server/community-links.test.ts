import { describe, expect, it } from 'vitest';
import { sanitizeCommunityLinksInput } from './community-links.js';

describe('sanitizeCommunityLinksInput', () => {
  it('preserves pasted QR image data URLs', () => {
    const result = sanitizeCommunityLinksInput([
      {
        title: 'WeChat Group',
        platform: 'wechat',
        qrContent: 'data:image/png;base64,abc123',
        active: true,
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.qrContent).toBe('data:image/png;base64,abc123');
  });

  it('drops oversized QR image payloads instead of truncating them', () => {
    const oversized = `data:image/png;base64,${'a'.repeat(3 * 1024 * 1024 + 1)}`;
    const result = sanitizeCommunityLinksInput([
      {
        title: 'WeChat Group',
        platform: 'wechat',
        qrContent: oversized,
        active: true,
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.qrContent).toBe('');
  });
});
