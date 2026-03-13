import React from 'react';
import { PanelsTopLeft, ShieldCheck, Waypoints } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { ThemeToggle } from '@/src/components/ui/ThemeToggle';
import { useI18n } from '@/src/context/I18nContext';
import { useTheme } from '@/src/context/ThemeContext';

interface PublicAuthLayoutProps {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}

function BrandBadge() {
  return (
    <div className="flex items-center gap-3">
      <div className="surface-panel flex h-12 w-12 items-center justify-center">
        <img src="/logo.svg" alt="Prism" className="h-7 w-7" />
      </div>
      <span className="section-kicker">Prism</span>
    </div>
  );
}

export function PublicAuthLayout({ eyebrow, title, description, children }: PublicAuthLayoutProps) {
  const { language, setLanguage, t } = useI18n();
  const { theme } = useTheme();
  const isZh = language === 'zh-CN';

  const bgStyle =
    theme === 'light'
      ? {
          background:
            'radial-gradient(ellipse 70% 50% at 5% 5%, rgba(99,102,241,0.10) 0%, transparent 70%),' +
            'radial-gradient(ellipse 60% 40% at 95% 95%, rgba(16,185,129,0.09) 0%, transparent 70%),' +
            'var(--page-bg)',
        }
      : {
          background:
            'radial-gradient(ellipse 70% 50% at 5% 5%, rgba(99,102,241,0.18) 0%, transparent 70%),' +
            'radial-gradient(ellipse 60% 40% at 95% 95%, rgba(16,185,129,0.14) 0%, transparent 70%),' +
            'var(--page-bg)',
        };

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
    <div className="min-h-svh px-4 py-5 sm:px-6 lg:px-10" style={bgStyle}>
      <div className="mx-auto flex max-w-[460px] justify-end lg:max-w-7xl">
        <div className="flex items-center gap-2">
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

      <div className="mx-auto max-w-[460px] space-y-4 py-5 lg:hidden">
        <BrandBadge />
        <div className="space-y-3">
          <p className="section-kicker">{eyebrow}</p>
          <h1 className="text-[1.9rem] font-semibold tracking-[-0.05em] text-[var(--text-primary)]">
            {title}
          </h1>
          <p className="text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
        </div>
      </div>

      <main className="mx-auto grid max-w-[460px] gap-6 py-2 lg:max-w-7xl lg:min-h-[calc(100svh-6rem)] lg:grid-cols-[minmax(0,1.2fr)_minmax(380px,460px)] lg:items-center lg:gap-10 lg:py-8">
        <section className="hidden space-y-8 lg:block lg:pr-12">
          <BrandBadge />

          <div className="space-y-5">
            <p className="section-kicker">{eyebrow}</p>
            <h1 className="page-title max-w-3xl">{title}</h1>
            <p className="page-copy max-w-2xl">{description}</p>
          </div>

          <div className="hidden gap-4 sm:grid sm:grid-cols-3">
            {highlights.map((item) => (
              <div key={item.title} className="surface-panel p-5">
                <item.icon className="mb-4 h-5 w-5 text-emerald-500" />
                <p className="text-sm font-semibold text-zinc-50">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="surface-card p-6 sm:p-8">{children}</div>
        </section>
      </main>
    </div>
  );
}
