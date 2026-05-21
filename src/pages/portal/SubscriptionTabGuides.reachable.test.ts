import { describe, expect, it } from 'vitest';
import { buildClientGuide, decorateGuideWithRealScreenshots } from './SubscriptionTabGuides';
import { getPlatformLabel } from './SubscriptionTabData';

const PLATFORM_REGRESSION_CASES: Array<{
  clientId: 'clashVerge' | 'singBox' | 'exclave';
  platform: 'linux' | 'android';
}> = [
  { clientId: 'clashVerge', platform: 'linux' },
  { clientId: 'singBox', platform: 'linux' },
  { clientId: 'exclave', platform: 'android' },
];

describe('subscription guide platform regressions', () => {
  for (const { clientId, platform } of PLATFORM_REGRESSION_CASES) {
    for (const isZh of [true, false]) {
      it(`${clientId} × ${platform} × ${isZh ? 'zh' : 'en'} stays stable`, () => {
        const label = getPlatformLabel(platform, isZh);
        const generic = buildClientGuide(clientId, platform, label, isZh);
        const final = decorateGuideWithRealScreenshots(generic, clientId, platform, isZh);
        expect(final).toMatchSnapshot();
      });
    }
  }
});
