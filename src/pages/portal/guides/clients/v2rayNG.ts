import type { ClientGuideDef } from '../types';
import { V2RAYNG_GUIDE_SOURCE_URL, V2RAYNG_SCREENSHOTS } from '../../SubscriptionTabData';

export const v2rayNGGuide: ClientGuideDef = {
  byPlatform: {
    android: {
      recommendedFormat: 'universal',
      noteKey: 'guides.v2rayNG.android.note',
      sourceLabelKey: 'guides.v2rayNG.android.sourceLabel',
      sourceUrl: V2RAYNG_GUIDE_SOURCE_URL,
      steps: [
        {
          tone: 'launch',
          titleKey: 'guides.v2rayNG.android.step0.title',
          descriptionKey: 'guides.v2rayNG.android.step0.description',
          helperKey: 'guides.v2rayNG.android.step0.helper',
          visualLabel: 'Subscription settings',
          visualLabelKey: 'guides.v2rayNG.android.step0.visualLabel',
          visualItemsKey: 'guides.v2rayNG.android.step0.visualItems',
          ctaLabelKey: 'guides.v2rayNG.android.step0.ctaLabel',
          screenshot: {
            src: V2RAYNG_SCREENSHOTS.openSubscription,
            altKey: 'guides.v2rayNG.android.step0.screenshotAlt',
          },
        },
        {
          tone: 'import',
          titleKey: 'guides.v2rayNG.android.step1.title',
          descriptionKey: 'guides.v2rayNG.android.step1.description',
          helperKey: 'guides.v2rayNG.android.step1.helper',
          visualLabel: 'Add subscription',
          visualLabelKey: 'guides.v2rayNG.android.step1.visualLabel',
          visualItemsKey: 'guides.v2rayNG.android.step1.visualItems',
          ctaLabelKey: 'guides.v2rayNG.android.step1.ctaLabel',
          screenshot: {
            src: V2RAYNG_SCREENSHOTS.addSubscription,
            altKey: 'guides.v2rayNG.android.step1.screenshotAlt',
          },
        },
        {
          tone: 'connect',
          titleKey: 'guides.v2rayNG.android.step2.title',
          descriptionKey: 'guides.v2rayNG.android.step2.description',
          helperKey: 'guides.v2rayNG.android.step2.helper',
          visualLabel: 'Update subscription',
          visualLabelKey: 'guides.v2rayNG.android.step2.visualLabel',
          visualItemsKey: 'guides.v2rayNG.android.step2.visualItems',
          ctaLabelKey: 'guides.v2rayNG.android.step2.ctaLabel',
          screenshot: {
            src: V2RAYNG_SCREENSHOTS.updateSubscription,
            altKey: 'guides.v2rayNG.android.step2.screenshotAlt',
          },
        },
        {
          tone: 'connect',
          titleKey: 'guides.v2rayNG.android.step3.title',
          descriptionKey: 'guides.v2rayNG.android.step3.description',
          helperKey: 'guides.v2rayNG.android.step3.helper',
          visualLabel: 'Node list',
          visualLabelKey: 'guides.v2rayNG.android.step3.visualLabel',
          visualItemsKey: 'guides.v2rayNG.android.step3.visualItems',
          ctaLabelKey: 'guides.v2rayNG.android.step3.ctaLabel',
          screenshot: {
            src: V2RAYNG_SCREENSHOTS.proxyList,
            altKey: 'guides.v2rayNG.android.step3.screenshotAlt',
          },
        },
        {
          tone: 'connect',
          titleKey: 'guides.v2rayNG.android.step4.title',
          descriptionKey: 'guides.v2rayNG.android.step4.description',
          helperKey: 'guides.v2rayNG.android.step4.helper',
          visualLabel: 'VPN permission',
          visualLabelKey: 'guides.v2rayNG.android.step4.visualLabel',
          visualItemsKey: 'guides.v2rayNG.android.step4.visualItems',
          ctaLabelKey: 'guides.v2rayNG.android.step4.ctaLabel',
          screenshot: {
            src: V2RAYNG_SCREENSHOTS.startProxy,
            altKey: 'guides.v2rayNG.android.step4.screenshotAlt',
          },
        },
      ],
    },
  },
};
