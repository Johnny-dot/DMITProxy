import type {
  GuidePlatform,
  GuideScreenshotHighlight,
  GuideTone,
  ClientGuide,
} from '../SubscriptionTabData';
import type { SubscriptionFormat, ClientCard } from '../types';

export type ClientId = ClientCard['id'];

export interface StepDef {
  tone: GuideTone;
  titleKey: string;
  descriptionKey: string;
  helperKey: string;
  visualLabel: string;
  visualItemsKey: string;
  ctaLabelKey: string;
  screenshot?: { src: string; altKey: string };
  screenshotHighlights?: GuideScreenshotHighlight[];
}

export interface PlatformGuideDef {
  recommendedFormat: SubscriptionFormat;
  noteKey: string;
  steps: StepDef[];
  sourceLabelKey?: string;
  sourceUrl?: string;
}

export interface ClientGuideDef {
  byPlatform: Partial<Record<GuidePlatform, PlatformGuideDef>>;
}

export const MINIMAL_FALLBACK_GUIDE: ClientGuide = {
  recommendedFormat: 'universal',
  note: '',
  steps: [],
};
