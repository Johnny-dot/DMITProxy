import { describe, expect, it } from 'vitest';
import { CLIENT_META, PLATFORM_OPTIONS, getPlatformLabel } from '../SubscriptionTabData';
import * as OldImpl from '../SubscriptionTabGuides';
import * as NewImpl from './index';

describe('new guides module ≡ old SubscriptionTabGuides', () => {
  for (const clientMeta of CLIENT_META) {
    for (const platformOption of PLATFORM_OPTIONS) {
      const platform = platformOption.key;
      if (!clientMeta.platforms.includes(platform)) continue;
      for (const isZh of [true, false]) {
        it(`${clientMeta.id} × ${platform} × ${isZh ? 'zh' : 'en'}`, () => {
          const label = getPlatformLabel(platform, isZh);
          const oldGeneric = OldImpl.buildClientGuide(clientMeta.id, platform, label, isZh);
          const oldFinal = OldImpl.decorateGuideWithRealScreenshots(
            oldGeneric,
            clientMeta.id,
            platform,
            isZh,
          );
          const newFinal = NewImpl.buildClientGuide(clientMeta.id, platform, label, isZh);
          expect(newFinal).toEqual(oldFinal);
        });
      }
    }
  }
});
