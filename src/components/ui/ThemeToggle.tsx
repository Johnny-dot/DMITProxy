import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/src/utils/cn';
import { useTheme } from '@/src/context/ThemeContext';
import { useI18n } from '@/src/context/I18nContext';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className, showLabel = false }: ThemeToggleProps) {
  const { isDark, toggleTheme } = useTheme();
  const { t } = useI18n();

  return (
    <Button
      type="button"
      variant="outline"
      size={showLabel ? 'sm' : 'icon'}
      onClick={toggleTheme}
      className={cn('gap-2', className)}
      aria-label={isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
      title={isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      {showLabel ? (isDark ? t('theme.light') : t('theme.dark')) : null}
    </Button>
  );
}
