import React from 'react';
import { Button } from './Button';
import { useI18n } from '@/src/context/I18nContext';
import { cn } from '@/src/utils/cn';

interface LanguageToggleProps {
  className?: string;
  compact?: boolean;
  testIdPrefix?: string;
}

export function LanguageToggle({
  className,
  compact = false,
  testIdPrefix = 'language-toggle',
}: LanguageToggleProps) {
  const { language, setLanguage, t } = useI18n();

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-[color:var(--border-subtle)] bg-[var(--surface-card)] p-1 shadow-sm',
        className,
      )}
    >
      <Button
        type="button"
        variant={language === 'zh-CN' ? 'secondary' : 'ghost'}
        size="sm"
        className={cn('h-8 min-w-11 px-3', compact && 'px-2.5')}
        onClick={() => setLanguage('zh-CN')}
        data-testid={`${testIdPrefix}-zh`}
      >
        {t('common.zh')}
      </Button>
      <Button
        type="button"
        variant={language === 'en-US' ? 'secondary' : 'ghost'}
        size="sm"
        className={cn('h-8 min-w-11 px-3', compact && 'px-2.5')}
        onClick={() => setLanguage('en-US')}
        data-testid={`${testIdPrefix}-en`}
      >
        {t('common.en')}
      </Button>
    </div>
  );
}
