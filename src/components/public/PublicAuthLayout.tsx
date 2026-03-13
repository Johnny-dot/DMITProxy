import React from 'react';
import { PanelsTopLeft, ShieldCheck, Waypoints } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { ThemeToggle } from '@/src/components/ui/ThemeToggle';
import { useI18n } from '@/src/context/I18nContext';

interface PublicAuthLayoutProps {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}

function BrandBadge() {
  return (
    <div className="glass-pill inline-flex items-center gap-3 px-4 py-3">
      <div className="surface-inline flex h-12 w-12 items-center justify-center">
        <img src="/logo.svg" alt="Prism" className="h-7 w-7" />
      </div>
      <div className="space-y-1">
        <span className="section-kicker block">Prism</span>
        <span className="text-sm text-[var(--text-secondary)]">Liquid control center</span>
      </div>
    </div>
  );
}

export function PublicAuthLayout({ eyebrow, title, description, children }: PublicAuthLayoutProps) {
  const { language, setLanguage, t } = useI18n();
  const isZh = language === 'zh-CN';

  const highlights = [
    {
      icon: PanelsTopLeft,
      title: isZh ? '常用操作，一眼找到' : 'Common tasks, easy to find',
      description: isZh
        ? '登录后，常用入口会放在顺手的位置。'
        : 'The links you use most stay close at hand after sign-in.',
    },
    {
      icon: ShieldCheck,
      title: isZh ? '状态清楚，少走弯路' : 'Clear status, fewer detours',
      description: isZh
        ? '哪些已经准备好、下一步该做什么，都能快速看明白。'
        : 'You can see what is ready and what to do next at a glance.',
    },
    {
      icon: Waypoints,
      title: isZh ? '第一次来，也能跟着走' : 'Easy even on the first visit',
      description: isZh
        ? '按提示一步步完成，不用先理解太多术语。'
        : 'Follow the prompts step by step without learning too much jargon first.',
    },
  ];

  return (
    <div className="relative min-h-svh overflow-hidden px-4 py-5 sm:px-6 lg:px-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8rem] top-[-6rem] h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,_rgba(255,255,255,0.74)_0%,_rgba(255,255,255,0)_70%)] blur-2xl" />
        <div className="absolute right-[-8rem] top-[8%] h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle,_rgba(107,148,255,0.3)_0%,_rgba(107,148,255,0)_70%)] blur-3xl" />
        <div className="absolute bottom-[-10rem] left-[24%] h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,_rgba(74,207,186,0.22)_0%,_rgba(74,207,186,0)_70%)] blur-3xl" />
      </div>

      <div className="relative mx-auto flex max-w-[460px] justify-end lg:max-w-7xl">
        <div className="glass-pill flex items-center gap-2 p-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-11 px-4"
            onClick={() => setLanguage(isZh ? 'en-US' : 'zh-CN')}
            data-testid="public-language-toggle"
          >
            {isZh ? t('common.en') : t('common.zh')}
          </Button>
          <ThemeToggle testId="public-theme-toggle" />
        </div>
      </div>

      <div className="relative mx-auto max-w-[460px] space-y-4 py-5 lg:hidden">
        <BrandBadge />
        <div className="surface-panel space-y-3 p-6">
          <p className="section-kicker">{eyebrow}</p>
          <h1 className="text-[1.9rem] font-semibold tracking-[-0.05em] text-[var(--text-primary)]">
            {title}
          </h1>
          <p className="text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
        </div>
      </div>

      <main className="relative mx-auto grid max-w-[460px] gap-6 py-2 lg:max-w-7xl lg:min-h-[calc(100svh-6rem)] lg:grid-cols-[minmax(0,1.2fr)_minmax(380px,460px)] lg:items-center lg:gap-10 lg:py-8">
        <section className="hidden lg:block lg:pr-8">
          <div className="surface-card space-y-8 p-10 xl:p-12">
            <BrandBadge />

            <div className="space-y-5">
              <p className="section-kicker">{eyebrow}</p>
              <h1 className="page-title max-w-3xl">{title}</h1>
              <p className="page-copy max-w-2xl">{description}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {highlights.map((item) => (
                <div key={item.title} className="surface-panel p-5">
                  <div className="glass-pill mb-4 flex h-11 w-11 items-center justify-center">
                    <item.icon className="h-5 w-5 text-[var(--accent)]" />
                  </div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative">
          <div className="surface-card p-6 sm:p-8">{children}</div>
        </section>
      </main>
    </div>
  );
}
