import { zhCN } from '@/src/i18n/locales/zh-CN';
import { enUS } from '@/src/i18n/locales/en-US';
import type { ClientGuide, GuidePlatform } from '../SubscriptionTabData';
import { CLIENT_GUIDE_REGISTRY } from './registry';
import { MINIMAL_FALLBACK_GUIDE, type ClientId, type StepDef } from './types';

function resolveRawKey(locale: Record<string, unknown>, key: string): unknown {
  const parts = key.split('.');
  let current: unknown = locale;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      if (import.meta.env?.DEV) {
        throw new Error(`Missing i18n key: ${key}`);
      }
      return undefined;
    }
  }
  return current;
}

function resolveStringKey(locale: Record<string, unknown>, key: string): string {
  const value = resolveRawKey(locale, key);
  if (typeof value !== 'string') {
    if (import.meta.env?.DEV) {
      throw new Error(`i18n key "${key}" is not a string: ${typeof value}`);
    }
    return key;
  }
  return value;
}

function resolveStringArrayKey(locale: Record<string, unknown>, key: string): string[] {
  const value = resolveRawKey(locale, key);
  if (!Array.isArray(value)) {
    if (import.meta.env?.DEV) {
      throw new Error(`i18n key "${key}" is not an array: ${typeof value}`);
    }
    return [];
  }
  return value as string[];
}

function resolveOptionalStringKey(
  locale: Record<string, unknown>,
  key: string | undefined,
): string | undefined {
  if (!key) return undefined;
  const value = resolveRawKey(locale, key);
  return typeof value === 'string' ? value : undefined;
}

function resolveStep(step: StepDef, locale: Record<string, unknown>) {
  return {
    tone: step.tone,
    title: resolveStringKey(locale, step.titleKey),
    description: resolveStringKey(locale, step.descriptionKey),
    helper: resolveStringKey(locale, step.helperKey),
    visualLabel: step.visualLabelKey
      ? resolveStringKey(locale, step.visualLabelKey)
      : step.visualLabel,
    visualItems: resolveStringArrayKey(locale, step.visualItemsKey),
    ctaLabel: resolveStringKey(locale, step.ctaLabelKey),
    screenshot: step.screenshot
      ? { src: step.screenshot.src, alt: resolveStringKey(locale, step.screenshot.altKey) }
      : undefined,
  };
}

export function buildClientGuide(
  clientId: ClientId,
  platform: GuidePlatform,
  _platformLabel: string,
  isZh: boolean,
): ClientGuide {
  const def = CLIENT_GUIDE_REGISTRY[clientId]?.byPlatform[platform];
  if (!def) return MINIMAL_FALLBACK_GUIDE;
  const locale = (isZh ? zhCN : enUS) as unknown as Record<string, unknown>;
  return {
    recommendedFormat: def.recommendedFormat,
    note: resolveStringKey(locale, def.noteKey),
    steps: def.steps.map((step) => resolveStep(step, locale)),
    sourceLabel: resolveOptionalStringKey(locale, def.sourceLabelKey),
    sourceUrl: def.sourceUrl,
  };
}

// Kept as a no-op pass-through to preserve the public API. Pre-refactor callers
// composed buildClientGuide + decorateGuideWithRealScreenshots; the data-driven
// builder now handles real-screenshot variants directly via the registry, so the
// decorate stage is redundant. Removing this requires updating SubscriptionTab.tsx
// — defer to a follow-up PR.
export function decorateGuideWithRealScreenshots(
  guide: ClientGuide,
  _clientId: ClientId,
  _platform: GuidePlatform,
  _isZh: boolean,
): ClientGuide {
  return guide;
}
