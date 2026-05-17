import { describe, expect, it } from 'vitest';

import { buildSubscriptionProfileTitleHeader } from './subscription-profile.js';

describe('buildSubscriptionProfileTitleHeader', () => {
  it('encodes Prism as a profile-title header payload', () => {
    expect(buildSubscriptionProfileTitleHeader('Prism')).toBe('base64:UHJpc20=');
  });
});
