import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { enUS } from '@/src/i18n/locales/en-US';
import { zhCN } from '@/src/i18n/locales/zh-CN';

export type Language = 'zh-CN' | 'en-US';

interface I18nContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18N_STORAGE_KEY = 'prism:lang';

const dictionaries: Record<Language, Record<string, unknown>> = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

const I18nContext = createContext<I18nContextType | null>(null);

function getInitialLanguage(): Language {
  if (typeof window === 'undefined') return 'en-US';

  const stored = window.localStorage.getItem(I18N_STORAGE_KEY);
  if (stored === 'zh-CN' || stored === 'en-US') return stored;

  return window.navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
}

function resolveByPath(dictionary: Record<string, unknown>, path: string): string | null {
  const result = path.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object') return null;
    return (current as Record<string, unknown>)[segment];
  }, dictionary);
  return typeof result === 'string' ? result : null;
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_full, key: string) => {
    const value = params[key];
    return value === undefined ? `{${key}}` : String(value);
  });
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [languageState, setLanguageState] = useState<Language>(getInitialLanguage);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(I18N_STORAGE_KEY, languageState);
    }
    document.documentElement.lang = languageState;
  }, [languageState]);

  const setLanguage = useCallback((language: Language) => {
    setLanguageState(language);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const selected = resolveByPath(dictionaries[languageState], key);
      const fallback = resolveByPath(dictionaries['en-US'], key);
      return interpolate(selected ?? fallback ?? key, params);
    },
    [languageState],
  );

  const value = useMemo<I18nContextType>(
    () => ({
      language: languageState,
      setLanguage,
      t,
    }),
    [languageState, setLanguage, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider');
  }
  return context;
}
