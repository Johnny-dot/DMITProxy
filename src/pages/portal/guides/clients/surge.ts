import type { ClientGuideDef } from '../types';
import { SURGE_GUIDE_SOURCE_URL, SURGE_SCREENSHOTS } from '../../SubscriptionTabData';

export const surgeGuide: ClientGuideDef = {
  byPlatform: {
    ios: {
      recommendedFormat: 'surge',
      noteKey: 'guides.surge.ios.note',
      sourceLabelKey: 'guides.surge.ios.sourceLabel',
      sourceUrl: SURGE_GUIDE_SOURCE_URL,
      steps: [
        {
          tone: 'launch',
          titleKey: 'guides.surge.ios.step0.title',
          descriptionKey: 'guides.surge.ios.step0.description',
          helperKey: 'guides.surge.ios.step0.helper',
          visualLabel: 'Import entry',
          visualLabelKey: 'guides.surge.ios.step0.visualLabel',
          visualItemsKey: 'guides.surge.ios.step0.visualItems',
          ctaLabelKey: 'guides.surge.ios.step0.ctaLabel',
          screenshot: {
            src: SURGE_SCREENSHOTS.dropdownMenu,
            altKey: 'guides.surge.ios.step0.screenshotAlt',
          },
        },
        {
          tone: 'import',
          titleKey: 'guides.surge.ios.step1.title',
          descriptionKey: 'guides.surge.ios.step1.description',
          helperKey: 'guides.surge.ios.step1.helper',
          visualLabel: 'New profile',
          visualLabelKey: 'guides.surge.ios.step1.visualLabel',
          visualItemsKey: 'guides.surge.ios.step1.visualItems',
          ctaLabelKey: 'guides.surge.ios.step1.ctaLabel',
          screenshot: {
            src: SURGE_SCREENSHOTS.downloadConfiguration,
            altKey: 'guides.surge.ios.step1.screenshotAlt',
          },
        },
        {
          tone: 'import',
          titleKey: 'guides.surge.ios.step2.title',
          descriptionKey: 'guides.surge.ios.step2.description',
          helperKey: 'guides.surge.ios.step2.helper',
          visualLabel: 'Subscription URL',
          visualLabelKey: 'guides.surge.ios.step2.visualLabel',
          visualItemsKey: 'guides.surge.ios.step2.visualItems',
          ctaLabelKey: 'guides.surge.ios.step2.ctaLabel',
          screenshot: {
            src: SURGE_SCREENSHOTS.pasteLink,
            altKey: 'guides.surge.ios.step2.screenshotAlt',
          },
        },
        {
          tone: 'connect',
          titleKey: 'guides.surge.ios.step3.title',
          descriptionKey: 'guides.surge.ios.step3.description',
          helperKey: 'guides.surge.ios.step3.helper',
          visualLabel: 'Profile file',
          visualLabelKey: 'guides.surge.ios.step3.visualLabel',
          visualItemsKey: 'guides.surge.ios.step3.visualItems',
          ctaLabelKey: 'guides.surge.ios.step3.ctaLabel',
          screenshot: {
            src: SURGE_SCREENSHOTS.configurationFile,
            altKey: 'guides.surge.ios.step3.screenshotAlt',
          },
        },
        {
          tone: 'connect',
          titleKey: 'guides.surge.ios.step4.title',
          descriptionKey: 'guides.surge.ios.step4.description',
          helperKey: 'guides.surge.ios.step4.helper',
          visualLabel: 'Connect',
          visualLabelKey: 'guides.surge.ios.step4.visualLabel',
          visualItemsKey: 'guides.surge.ios.step4.visualItems',
          ctaLabelKey: 'guides.surge.ios.step4.ctaLabel',
          screenshot: {
            src: SURGE_SCREENSHOTS.startConnection,
            altKey: 'guides.surge.ios.step4.screenshotAlt',
          },
        },
      ],
    },
  },
};
