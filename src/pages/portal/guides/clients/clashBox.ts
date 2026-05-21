import type { ClientGuideDef } from '../types';
import { CLASHBOX_GUIDE_SOURCE_URL, CLASHBOX_SCREENSHOTS } from '../../SubscriptionTabData';

export const clashBoxGuide: ClientGuideDef = {
  byPlatform: {
    harmonyos: {
      recommendedFormat: 'clash',
      noteKey: 'guides.clashBox.harmonyos.note',
      sourceLabelKey: 'guides.clashBox.harmonyos.sourceLabel',
      sourceUrl: CLASHBOX_GUIDE_SOURCE_URL,
      steps: [
        {
          tone: 'launch',
          titleKey: 'guides.clashBox.harmonyos.step0.title',
          descriptionKey: 'guides.clashBox.harmonyos.step0.description',
          helperKey: 'guides.clashBox.harmonyos.step0.helper',
          visualLabel: 'Home screen',
          visualLabelKey: 'guides.clashBox.harmonyos.step0.visualLabel',
          visualItemsKey: 'guides.clashBox.harmonyos.step0.visualItems',
          ctaLabelKey: 'guides.clashBox.harmonyos.step0.ctaLabel',
          screenshot: {
            src: CLASHBOX_SCREENSHOTS.home,
            altKey: 'guides.clashBox.harmonyos.step0.screenshotAlt',
          },
        },
        {
          tone: 'import',
          titleKey: 'guides.clashBox.harmonyos.step1.title',
          descriptionKey: 'guides.clashBox.harmonyos.step1.description',
          helperKey: 'guides.clashBox.harmonyos.step1.helper',
          visualLabel: 'Profile import',
          visualLabelKey: 'guides.clashBox.harmonyos.step1.visualLabel',
          visualItemsKey: 'guides.clashBox.harmonyos.step1.visualItems',
          ctaLabelKey: 'guides.clashBox.harmonyos.step1.ctaLabel',
          screenshot: {
            src: CLASHBOX_SCREENSHOTS.profile,
            altKey: 'guides.clashBox.harmonyos.step1.screenshotAlt',
          },
        },
        {
          tone: 'connect',
          titleKey: 'guides.clashBox.harmonyos.step2.title',
          descriptionKey: 'guides.clashBox.harmonyos.step2.description',
          helperKey: 'guides.clashBox.harmonyos.step2.helper',
          visualLabel: 'Connect',
          visualLabelKey: 'guides.clashBox.harmonyos.step2.visualLabel',
          visualItemsKey: 'guides.clashBox.harmonyos.step2.visualItems',
          ctaLabelKey: 'guides.clashBox.harmonyos.step2.ctaLabel',
          screenshot: {
            src: CLASHBOX_SCREENSHOTS.start,
            altKey: 'guides.clashBox.harmonyos.step2.screenshotAlt',
          },
        },
      ],
    },
  },
};
