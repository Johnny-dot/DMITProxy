import type { GuidePlatform, GuideTone, ClientGuide } from '../SubscriptionTabData';
import type { SubscriptionFormat, ClientCard } from '../types';

export type ClientId = ClientCard['id'];

export interface StepDef {
  tone: GuideTone;
  titleKey: string;
  descriptionKey: string;
  helperKey: string;
  /** Hardcoded English UI label; overridden by visualLabelKey when locale-specific labels are needed */
  visualLabel: string;
  /** When present, resolved from locale instead of using the hardcoded visualLabel */
  visualLabelKey?: string;
  visualItemsKey: string;
  ctaLabelKey: string;
  screenshot?: { src: string; altKey: string };
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

export const MINIMAL_FALLBACK_GUIDE: ClientGuide = Object.freeze({
  recommendedFormat: 'universal' as const,
  note: '',
  steps: Object.freeze([]) as never[],
});
