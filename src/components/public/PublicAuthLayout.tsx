import React from 'react';
import { Button } from '@/src/components/ui/Button';
import { ThemeToggle } from '@/src/components/ui/ThemeToggle';
import { useI18n } from '@/src/context/I18nContext';

interface PublicAuthLayoutProps {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  compactMobile?: boolean;
}

function BrandBadge({ compact = false }: { compact?: boolean }) {
  const { language } = useI18n();
  const isZh = language === 'zh-CN';
  return (
    <div
      className={`glass-pill inline-flex items-center gap-3 ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}
    >
      <div
        className={`surface-inline flex items-center justify-center ${compact ? 'h-10 w-10' : 'h-12 w-12'}`}
      >
        <img src="/logo.svg" alt="Prism" className={compact ? 'h-6 w-6' : 'h-7 w-7'} />
      </div>
      <div className="min-w-0 space-y-1">
        <span className="section-kicker block">Prism</span>
        <span
          className={`${compact ? 'block truncate text-xs' : 'text-sm'} text-[var(--text-secondary)]`}
        >
          {compact ? (isZh ? '订阅' : 'Subscription') : isZh ? '订阅链接' : 'Subscription link'}
        </span>
      </div>
    </div>
  );
}

function CompactLiquidBackdrop() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 mx-auto max-w-[460px] overflow-hidden sm:hidden"
      aria-hidden="true"
    >
      <img
        src="/auth-liquid-c2-bg.png"
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-top opacity-90"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.02)_34%,rgba(255,255,255,0.12)_52%,rgba(215,224,238,0.30)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-[45svh] bg-gradient-to-b from-transparent via-[rgba(255,255,255,0.16)] to-[rgba(247,250,255,0.42)]" />
    </div>
  );
}

function ControlCluster({
  compactMobile,
  isZh,
  setLanguage,
  t,
}: {
  compactMobile: boolean;
  isZh: boolean;
  setLanguage: (language: 'zh-CN' | 'en-US') => void;
  t: (key: string) => string;
}) {
  return (
    <div
      className={
        compactMobile
          ? 'flex shrink-0 items-center gap-2'
          : 'glass-pill flex items-center gap-2 p-2'
      }
    >
      <Button
        type="button"
        variant="outline"
        size={compactMobile ? 'icon' : 'sm'}
        className={compactMobile ? 'h-12 w-12 px-0 shadow-[var(--shadow-soft)]' : 'h-11 px-4'}
        onClick={() => setLanguage(isZh ? 'en-US' : 'zh-CN')}
        data-testid="public-language-toggle"
      >
        {isZh ? t('common.en') : t('common.zh')}
      </Button>
      <ThemeToggle
        testId="public-theme-toggle"
        className={compactMobile ? 'h-12 w-12 shadow-[var(--shadow-soft)]' : undefined}
      />
    </div>
  );
}

export function PublicAuthLayout({
  eyebrow,
  title,
  description,
  children,
  compactMobile = false,
}: PublicAuthLayoutProps) {
  const { language, setLanguage, t } = useI18n();
  const isZh = language === 'zh-CN';

  return (
    <div
      className={`user-surface relative min-h-svh overflow-hidden px-4 sm:px-6 lg:px-10 ${compactMobile ? 'flex flex-col items-center py-3 sm:block sm:py-5' : 'py-5'}`}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8rem] top-[-6rem] h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,_rgba(255,255,255,0.74)_0%,_rgba(255,255,255,0)_70%)] blur-2xl" />
        <div className="absolute right-[-8rem] top-[8%] h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle,_rgba(107,148,255,0.3)_0%,_rgba(107,148,255,0)_70%)] blur-3xl" />
        <div className="absolute bottom-[-10rem] left-[24%] h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,_rgba(74,207,186,0.22)_0%,_rgba(74,207,186,0)_70%)] blur-3xl" />
      </div>

      <div className={`relative z-20 w-full ${compactMobile ? 'shrink-0' : ''}`}>
        <div
          className={
            compactMobile
              ? 'flex w-full items-center justify-between gap-3 sm:justify-end'
              : 'flex justify-end'
          }
        >
          {compactMobile ? (
            <div className="min-w-0 sm:hidden">
              <BrandBadge compact />
            </div>
          ) : null}
          <ControlCluster
            compactMobile={compactMobile}
            isZh={isZh}
            setLanguage={setLanguage}
            t={t}
          />
        </div>
      </div>

      {compactMobile ? <CompactLiquidBackdrop /> : null}

      <div
        className={`relative mx-auto max-w-[460px] lg:hidden ${compactMobile ? 'hidden space-y-4 py-5 sm:block' : 'space-y-4 py-5'}`}
      >
        <BrandBadge compact={compactMobile} />
        <div className="surface-panel space-y-3 p-6">
          <p className="section-kicker">{eyebrow}</p>
          <h1 className="text-[1.9rem] font-semibold tracking-normal text-[var(--text-primary)]">
            {title}
          </h1>
          <p className="text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
        </div>
      </div>

      <main
        className={`relative z-10 mx-auto flex w-full max-w-[460px] flex-col justify-center lg:min-h-[calc(100svh-6.5rem)] lg:max-w-md lg:py-8 ${compactMobile ? 'flex-1 items-center pb-[max(1rem,env(safe-area-inset-bottom))] pt-8 sm:flex-none sm:py-2' : 'py-2'}`}
      >
        <div className="mb-8 hidden flex-col items-center text-center lg:flex">
          <img src="/logo.svg" alt="" className="h-10 w-10" />
          <p className="mt-4 text-lg font-semibold text-[var(--text-primary)]">Prism</p>
          <p className="mt-1 max-w-sm text-sm text-[var(--text-secondary)]">{description}</p>
        </div>

        <section className="relative w-full">
          <div
            className={`user-hero surface-card ${compactMobile ? 'w-full overflow-hidden p-6 sm:p-8' : 'p-6 sm:p-8'}`}
          >
            {children}
          </div>
        </section>
      </main>
    </div>
  );
}
