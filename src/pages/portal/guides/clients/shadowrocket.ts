import type { ClientGuideDef } from '../types';
import { SHADOWROCKET_GUIDE_SOURCE_URL, SHADOWROCKET_SCREENSHOTS } from '../../SubscriptionTabData';

export const shadowrocketGuide: ClientGuideDef = {
  byPlatform: {
    ios: {
      recommendedFormat: 'universal',
      noteKey: 'guides.shadowrocket.ios.note',
      sourceLabelKey: 'guides.shadowrocket.ios.sourceLabel',
      sourceUrl: SHADOWROCKET_GUIDE_SOURCE_URL,
      steps: [
        {
          tone: 'import',
          titleKey: 'guides.shadowrocket.ios.step0.title',
          descriptionKey: 'guides.shadowrocket.ios.step0.description',
          helperKey: 'guides.shadowrocket.ios.step0.helper',
          visualLabel: 'Add subscription',
          visualLabelKey: 'guides.shadowrocket.ios.step0.visualLabel',
          visualItemsKey: 'guides.shadowrocket.ios.step0.visualItems',
          ctaLabelKey: 'guides.shadowrocket.ios.step0.ctaLabel',
          screenshot: {
            src: SHADOWROCKET_SCREENSHOTS.addSubscription,
            altKey: 'guides.shadowrocket.ios.step0.screenshotAlt',
          },
        },
        {
          tone: 'connect',
          titleKey: 'guides.shadowrocket.ios.step1.title',
          descriptionKey: 'guides.shadowrocket.ios.step1.description',
          helperKey: 'guides.shadowrocket.ios.step1.helper',
          visualLabel: 'Connect node',
          visualLabelKey: 'guides.shadowrocket.ios.step1.visualLabel',
          visualItemsKey: 'guides.shadowrocket.ios.step1.visualItems',
          ctaLabelKey: 'guides.shadowrocket.ios.step1.ctaLabel',
          screenshot: {
            src: SHADOWROCKET_SCREENSHOTS.connectNode,
            altKey: 'guides.shadowrocket.ios.step1.screenshotAlt',
          },
        },
        {
          tone: 'connect',
          titleKey: 'guides.shadowrocket.ios.step2.title',
          descriptionKey: 'guides.shadowrocket.ios.step2.description',
          helperKey: 'guides.shadowrocket.ios.step2.helper',
          visualLabel: 'Auto update',
          visualLabelKey: 'guides.shadowrocket.ios.step2.visualLabel',
          visualItemsKey: 'guides.shadowrocket.ios.step2.visualItems',
          ctaLabelKey: 'guides.shadowrocket.ios.step2.ctaLabel',
          screenshot: {
            src: SHADOWROCKET_SCREENSHOTS.autoUpdate,
            altKey: 'guides.shadowrocket.ios.step2.screenshotAlt',
          },
        },
      ],
    },
    macos: {
      recommendedFormat: 'universal',
      noteKey: 'guides.shadowrocket.macos.note',
      sourceLabelKey: 'guides.shadowrocket.macos.sourceLabel',
      sourceUrl: SHADOWROCKET_GUIDE_SOURCE_URL,
      steps: [
        {
          tone: 'import',
          titleKey: 'guides.shadowrocket.macos.step0.title',
          descriptionKey: 'guides.shadowrocket.macos.step0.description',
          helperKey: 'guides.shadowrocket.macos.step0.helper',
          visualLabel: 'Add subscription',
          visualLabelKey: 'guides.shadowrocket.macos.step0.visualLabel',
          visualItemsKey: 'guides.shadowrocket.macos.step0.visualItems',
          ctaLabelKey: 'guides.shadowrocket.macos.step0.ctaLabel',
          screenshot: {
            src: SHADOWROCKET_SCREENSHOTS.addSubscription,
            altKey: 'guides.shadowrocket.macos.step0.screenshotAlt',
          },
        },
        {
          tone: 'connect',
          titleKey: 'guides.shadowrocket.macos.step1.title',
          descriptionKey: 'guides.shadowrocket.macos.step1.description',
          helperKey: 'guides.shadowrocket.macos.step1.helper',
          visualLabel: 'Connect node',
          visualLabelKey: 'guides.shadowrocket.macos.step1.visualLabel',
          visualItemsKey: 'guides.shadowrocket.macos.step1.visualItems',
          ctaLabelKey: 'guides.shadowrocket.macos.step1.ctaLabel',
          screenshot: {
            src: SHADOWROCKET_SCREENSHOTS.connectNode,
            altKey: 'guides.shadowrocket.macos.step1.screenshotAlt',
          },
        },
        {
          tone: 'connect',
          titleKey: 'guides.shadowrocket.macos.step2.title',
          descriptionKey: 'guides.shadowrocket.macos.step2.description',
          helperKey: 'guides.shadowrocket.macos.step2.helper',
          visualLabel: 'Auto update',
          visualLabelKey: 'guides.shadowrocket.macos.step2.visualLabel',
          visualItemsKey: 'guides.shadowrocket.macos.step2.visualItems',
          ctaLabelKey: 'guides.shadowrocket.macos.step2.ctaLabel',
          screenshot: {
            src: SHADOWROCKET_SCREENSHOTS.autoUpdate,
            altKey: 'guides.shadowrocket.macos.step2.screenshotAlt',
          },
        },
      ],
    },
  },
};
