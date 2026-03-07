import React from 'react';
import { Dog, LogOut } from 'lucide-react';
import { useI18n } from '@/src/context/I18nContext';
import { ThemeToggle } from '@/src/components/ui/ThemeToggle';
import { Button } from '@/src/components/ui/Button';

interface PortalHeaderProps {
  siteName: string;
  currentUsername: string;
  onLogout: () => void;
}

export function PortalHeader({ siteName, currentUsername, onLogout }: PortalHeaderProps) {
  const { t, language, setLanguage } = useI18n();

  return (
    <header className="border-b border-white/5 bg-zinc-900/50 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 bg-zinc-800 border border-white/10 rounded-lg flex items-center justify-center shrink-0">
          <Dog className="w-5 h-5 text-emerald-500" />
        </div>
        <span className="font-semibold truncate">{siteName || 'ProxyDog'}</span>
        <span className="text-zinc-500 text-sm hidden sm:inline truncate">@{currentUsername}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="h-9 px-2 text-xs"
          onClick={() => setLanguage(language === 'zh-CN' ? 'en-US' : 'zh-CN')}
        >
          {language === 'zh-CN' ? t('common.en') : t('common.zh')}
        </Button>
        <ThemeToggle />
        <button
          onClick={onLogout}
          className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">{t('portal.signOut')}</span>
        </button>
      </div>
    </header>
  );
}
