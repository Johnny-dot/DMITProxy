import type { ClientGuideDef } from '../types';

export const exclaveGuide: ClientGuideDef = {
  byPlatform: {
    android: {
      recommendedFormat: 'universal',
      noteKey: 'guides.exclave.android.note',
      steps: [
        {
          tone: 'launch',
          titleKey: 'guides.exclave.android.step0.title',
          descriptionKey: 'guides.exclave.android.step0.description',
          helperKey: 'guides.exclave.android.step0.helper',
          visualLabel: 'Subscription / Profile',
          visualLabelKey: 'guides.exclave.android.step0.visualLabel',
          visualItemsKey: 'guides.exclave.android.step0.visualItems',
          ctaLabelKey: 'guides.exclave.android.step0.ctaLabel',
        },
        {
          tone: 'import',
          titleKey: 'guides.exclave.android.step1.title',
          descriptionKey: 'guides.exclave.android.step1.description',
          helperKey: 'guides.exclave.android.step1.helper',
          visualLabel: 'Import by URL',
          visualLabelKey: 'guides.exclave.android.step1.visualLabel',
          visualItemsKey: 'guides.exclave.android.step1.visualItems',
          ctaLabelKey: 'guides.exclave.android.step1.ctaLabel',
        },
        {
          tone: 'connect',
          titleKey: 'guides.exclave.android.step2.title',
          descriptionKey: 'guides.exclave.android.step2.description',
          helperKey: 'guides.exclave.android.step2.helper',
          visualLabel: 'VPN permission',
          visualLabelKey: 'guides.exclave.android.step2.visualLabel',
          visualItemsKey: 'guides.exclave.android.step2.visualItems',
          ctaLabelKey: 'guides.exclave.android.step2.ctaLabel',
        },
      ],
    },
  },
};
