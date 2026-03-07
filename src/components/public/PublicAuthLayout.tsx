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
      title: isZh ? '统一控制面' : 'Unified control plane',
      description: isZh
        ? '节点、订阅、用户和通知都放在一套安静的界面里。'
        : 'Nodes, subscriptions, users, and notices stay in one quiet workspace.',
    },
    {
      icon: ShieldCheck,
      title: isZh ? '低噪音运营体验' : 'Low-noise operations',
      description: isZh
        ? '更少装饰，更清楚的状态与操作优先级。'
        : 'Less decoration, clearer states, and calmer operational decisions.',
    },
    {
      icon: Waypoints,
      title: isZh ? '管理员与用户共用语言' : 'Shared language across roles',
      description: isZh
        ? '从登录到订阅交付，前后台都使用同一套产品节奏。'
        : 'From sign-in to subscription delivery, admin and user flows feel consistent.',
    },
  ];

  return (
    <div className="min-h-screen px-4 py-5 sm:px-6 lg:px-10" style={bgStyle}>
      <div className="mx-auto flex max-w-7xl justify-end">
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

      <main className="mx-auto grid max-w-7xl gap-10 py-8 lg:min-h-[calc(100vh-6rem)] lg:grid-cols-[minmax(0,1.2fr)_minmax(380px,460px)] lg:items-center">
        <section className="order-2 space-y-8 lg:order-1 lg:pr-12">
          <div className="flex items-center gap-3">
            <div className="surface-panel flex h-12 w-12 items-center justify-center">
              <img src="/logo.svg" alt="Prism" className="h-7 w-7" />
            </div>
            <span className="section-kicker">Prism</span>
          </div>

          <div className="space-y-5">
            <p className="section-kicker">{eyebrow}</p>
            <h1 className="page-title max-w-3xl">{title}</h1>
            <p className="page-copy max-w-2xl">{description}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {highlights.map((item) => (
              <div key={item.title} className="surface-panel p-5">
                <item.icon className="mb-4 h-5 w-5 text-emerald-500" />
                <p className="text-sm font-semibold text-zinc-50">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="order-1 lg:order-2">
          <div className="surface-card p-6 sm:p-8">{children}</div>
        </section>
      </main>
    </div>
  );
}
