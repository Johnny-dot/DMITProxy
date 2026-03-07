import React from 'react';
import { LogOut } from 'lucide-react';
import { useI18n } from '@/src/context/I18nContext';
import { ThemeToggle } from '@/src/components/ui/ThemeToggle';
import { Button } from '@/src/components/ui/Button';
import { LanguageToggle } from '@/src/components/ui/LanguageToggle';

interface PortalHeaderProps {
  siteName: string;
  currentUsername: string;
  onLogout: () => void;
}

export function PortalHeader({ siteName, currentUsername, onLogout }: PortalHeaderProps) {
  const { t } = useI18n();

  return (
    <header className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
      <div className="surface-card flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="surface-panel flex h-11 w-11 items-center justify-center">
            <img src="/logo.svg" alt="Prism" className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-50">{siteName || 'Prism'}</p>
            <p className="truncate text-xs text-zinc-500">@{currentUsername}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle compact />
          <ThemeToggle />
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onLogout}>
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">{t('portal.signOut')}</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
