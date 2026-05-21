import type { ClientGuideDef } from '../types';
import { CLASH_META_GUIDE_SOURCE_URL, CLASH_META_SCREENSHOTS } from '../../SubscriptionTabData';

export const clashMetaGuide: ClientGuideDef = {
  byPlatform: {
    android: {
      recommendedFormat: 'clash',
      noteKey: 'guides.clashMeta.android.note',
      sourceLabelKey: 'guides.clashMeta.android.sourceLabel',
      sourceUrl: CLASH_META_GUIDE_SOURCE_URL,
      steps: [
        {
          tone: 'launch',
          titleKey: 'guides.clashMeta.android.step0.title',
          descriptionKey: 'guides.clashMeta.android.step0.description',
          helperKey: 'guides.clashMeta.android.step0.helper',
          visualLabel: 'Profile home',
          visualLabelKey: 'guides.clashMeta.android.step0.visualLabel',
          visualItemsKey: 'guides.clashMeta.android.step0.visualItems',
          ctaLabelKey: 'guides.clashMeta.android.step0.ctaLabel',
          screenshot: {
            src: CLASH_META_SCREENSHOTS.home,
            altKey: 'guides.clashMeta.android.step0.screenshotAlt',
          },
        },
        {
          tone: 'import',
          titleKey: 'guides.clashMeta.android.step1.title',
          descriptionKey: 'guides.clashMeta.android.step1.description',
          helperKey: 'guides.clashMeta.android.step1.helper',
          visualLabel: 'New profile',
          visualLabelKey: 'guides.clashMeta.android.step1.visualLabel',
          visualItemsKey: 'guides.clashMeta.android.step1.visualItems',
          ctaLabelKey: 'guides.clashMeta.android.step1.ctaLabel',
          screenshot: {
            src: CLASH_META_SCREENSHOTS.configuration,
            altKey: 'guides.clashMeta.android.step1.screenshotAlt',
          },
        },
        {
          tone: 'import',
          titleKey: 'guides.clashMeta.android.step2.title',
          descriptionKey: 'guides.clashMeta.android.step2.description',
          helperKey: 'guides.clashMeta.android.step2.helper',
          visualLabel: 'Save profile',
          visualLabelKey: 'guides.clashMeta.android.step2.visualLabel',
          visualItemsKey: 'guides.clashMeta.android.step2.visualItems',
          ctaLabelKey: 'guides.clashMeta.android.step2.ctaLabel',
          screenshot: {
            src: CLASH_META_SCREENSHOTS.saveConfiguration,
            altKey: 'guides.clashMeta.android.step2.screenshotAlt',
          },
        },
        {
          tone: 'connect',
          titleKey: 'guides.clashMeta.android.step3.title',
          descriptionKey: 'guides.clashMeta.android.step3.description',
          helperKey: 'guides.clashMeta.android.step3.helper',
          visualLabel: 'Start proxy',
          visualLabelKey: 'guides.clashMeta.android.step3.visualLabel',
          visualItemsKey: 'guides.clashMeta.android.step3.visualItems',
          ctaLabelKey: 'guides.clashMeta.android.step3.ctaLabel',
          screenshot: {
            src: CLASH_META_SCREENSHOTS.startProxy,
            altKey: 'guides.clashMeta.android.step3.screenshotAlt',
          },
        },
      ],
    },
  },
};
