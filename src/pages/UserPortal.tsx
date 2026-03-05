import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dog,
  Copy,
  Check,
  Smartphone,
  Monitor,
  Apple,
  LogOut,
  ExternalLink,
  Download,
  Link as LinkIcon,
  Shield,
  Terminal,
  Zap,
  Bell,
  LayoutDashboard,
  ListChecks,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/src/utils/cn';
import { useI18n } from '@/src/context/I18nContext';
import { ThemeToggle } from '@/src/components/ui/ThemeToggle';
import { Button } from '@/src/components/ui/Button';
import { buildSubscriptionUrl } from '@/src/utils/subscription';
import { getClientDownloadLinks } from '@/src/utils/clientDownloads';

interface UserInfo {
  id: number;
  username: string;
  role: string;
  subId: string | null;
  createdAt: number;
}

interface PortalSettings {
  siteName: string;
  publicUrl: string;
  supportTelegram: string;
  announcementText: string;
  announcementActive: boolean;
}

interface PortalNotification {
  id: string;
  level: 'info' | 'success' | 'warning';
  title: string;
  message: string;
  createdAt: number;
}

interface PortalContextResponse {
  user: UserInfo;
  settings: PortalSettings;
  notifications: PortalNotification[];
}

type SubscriptionFormat = 'universal' | 'clash' | 'v2ray' | 'singbox';
type PlatformKey = 'all' | 'windows' | 'macos' | 'android' | 'ios';
type PortalTab = 'home' | 'subscription' | 'notifications';

interface ClientCard {
  id: 'v2rayN' | 'v2rayNG' | 'shadowrocket' | 'clashVerge' | 'hiddify';
  name: string;
  os: string;
  icon: typeof Monitor;
  platforms: Array<Exclude<PlatformKey, 'all'>>;
  recommendedFor: Array<Exclude<PlatformKey, 'all'>>;
  desc: string;
  links: ReturnType<typeof getClientDownloadLinks>;
}

const COPY_RESET_DELAY_MS = 2000;
const READ_NOTIFICATIONS_STORAGE_PREFIX = 'proxydog:user:notification-read:v1';

function toMillis(value: number): number {
  return value > 1_000_000_000_000 ? value : value * 1000;
}

export function UserPortalPage() {
  const navigate = useNavigate();
  const { t, language, setLanguage } = useI18n();
  const isZh = language === 'zh-CN';

  const [context, setContext] = useState<PortalContextResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [activeTab, setActiveTab] = useState<PortalTab>('home');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeFormat, setActiveFormat] = useState<SubscriptionFormat>('universal');
  const [activePlatform, setActivePlatform] = useState<PlatformKey>('all');
  const [hasCopied, setHasCopied] = useState(false);
  const [hasOpenedDownload, setHasOpenedDownload] = useState(false);
  const [hasMarkedConnected, setHasMarkedConnected] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);

  const loadContext = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');

    try {
      const res = await fetch('/local/auth/portal/context', { credentials: 'include' });
      if (res.status === 401) {
        navigate('/login', { replace: true });
        return;
      }

      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        throw new Error(data?.error ?? 'Failed to load portal context');
      }

      setContext(data as PortalContextResponse);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load portal context');
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('android')) {
      setActivePlatform('android');
      return;
    }
    if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
      setActivePlatform('ios');
      return;
    }
    if (userAgent.includes('mac os')) {
      setActivePlatform('macos');
      return;
    }
    if (userAgent.includes('windows')) {
      setActivePlatform('windows');
    }
  }, []);

  const notificationStorageKey = useMemo(
    () => (context ? `${READ_NOTIFICATIONS_STORAGE_PREFIX}:${context.user.username}` : ''),
    [context],
  );

  useEffect(() => {
    if (!notificationStorageKey) return;
    try {
      const raw = window.localStorage.getItem(notificationStorageKey);
      if (!raw) {
        setReadNotificationIds([]);
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setReadNotificationIds(parsed.filter((item): item is string => typeof item === 'string'));
      } else {
        setReadNotificationIds([]);
      }
    } catch {
      setReadNotificationIds([]);
    }
  }, [notificationStorageKey]);

  useEffect(() => {
    if (!notificationStorageKey) return;
    window.localStorage.setItem(notificationStorageKey, JSON.stringify(readNotificationIds));
  }, [notificationStorageKey, readNotificationIds]);

  const formatOptions = useMemo(
    () => [
      {
        key: 'universal' as const,
        label: 'Universal',
        desc: isZh ? '兼容绝大多数客户端' : 'Works with most clients',
      },
      {
        key: 'clash' as const,
        label: 'Clash',
        desc: isZh ? '推荐 Clash 系列' : 'Recommended for Clash clients',
      },
      {
        key: 'v2ray' as const,
        label: 'V2Ray',
        desc: isZh ? '适合 V2Ray 客户端' : 'For V2Ray clients',
      },
      {
        key: 'singbox' as const,
        label: 'Singbox',
        desc: isZh ? '适合 sing-box 客户端' : 'For sing-box clients',
      },
    ],
    [isZh],
  );

  const platformOptions = useMemo(
    () => [
      { key: 'all' as const, label: isZh ? '全部' : 'All' },
      { key: 'windows' as const, label: 'Windows' },
      { key: 'macos' as const, label: 'macOS' },
      { key: 'android' as const, label: 'Android' },
      { key: 'ios' as const, label: 'iOS' },
    ],
    [isZh],
  );
  const clients = useMemo<ClientCard[]>(
    () => [
      {
        id: 'v2rayN',
        name: 'v2rayN',
        os: 'Windows',
        icon: Monitor,
        platforms: ['windows'],
        recommendedFor: ['windows'],
        links: getClientDownloadLinks('v2rayN'),
        desc: t('portal.recommendedFor', { platform: 'Windows' }),
      },
      {
        id: 'v2rayNG',
        name: 'v2rayNG',
        os: 'Android',
        icon: Smartphone,
        platforms: ['android'],
        recommendedFor: ['android'],
        links: getClientDownloadLinks('v2rayNG'),
        desc: t('portal.recommendedFor', { platform: 'Android' }),
      },
      {
        id: 'shadowrocket',
        name: 'Shadowrocket',
        os: 'iOS',
        icon: Apple,
        platforms: ['ios'],
        recommendedFor: ['ios'],
        links: getClientDownloadLinks('shadowrocket'),
        desc: t('portal.recommendedFor', { platform: 'iPhone/iPad' }),
      },
      {
        id: 'clashVerge',
        name: 'Clash Verge',
        os: 'Windows / macOS',
        icon: Monitor,
        platforms: ['windows', 'macos'],
        recommendedFor: ['macos'],
        links: getClientDownloadLinks('clashVerge'),
        desc: t('portal.advancedRules'),
      },
      {
        id: 'hiddify',
        name: 'Hiddify',
        os: 'Windows / macOS / Android / iOS',
        icon: Smartphone,
        platforms: ['windows', 'macos', 'android', 'ios'],
        recommendedFor: ['windows', 'android', 'ios'],
        links: getClientDownloadLinks('hiddify'),
        desc: t('portal.easyToUse'),
      },
    ],
    [t],
  );

  const tutorialMap = useMemo<Record<Exclude<PlatformKey, 'all'>, string[]>>(
    () => ({
      windows: [
        t('subscriptions.tutorial.windows1'),
        t('subscriptions.tutorial.windows2'),
        t('subscriptions.tutorial.windows3'),
      ],
      macos: [
        t('subscriptions.tutorial.macos1'),
        t('subscriptions.tutorial.macos2'),
        t('subscriptions.tutorial.macos3'),
      ],
      ios: [
        t('subscriptions.tutorial.ios1'),
        t('subscriptions.tutorial.ios2'),
        t('subscriptions.tutorial.ios3'),
      ],
      android: [
        t('subscriptions.tutorial.android1'),
        t('subscriptions.tutorial.android2'),
        t('subscriptions.tutorial.android3'),
      ],
    }),
    [t],
  );

  const troubleshooting = isZh
    ? [
        '先在客户端执行“更新订阅”再连接。',
        '切换其它节点重试，优先选择低延迟节点。',
        '若仍失败，把报错截图发给管理员排查。',
      ]
    : [
        'Run "Update subscription" in the client before connecting.',
        'Switch to another node and prefer lower latency options.',
        'If it still fails, send an error screenshot to your admin.',
      ];

  const subscriptionLinks = useMemo(
    () => ({
      universal: context?.user.subId ? buildSubscriptionUrl(context.user.subId, 'universal') : '',
      clash: context?.user.subId ? buildSubscriptionUrl(context.user.subId, 'clash') : '',
      v2ray: context?.user.subId ? buildSubscriptionUrl(context.user.subId, 'v2ray') : '',
      singbox: context?.user.subId ? buildSubscriptionUrl(context.user.subId, 'singbox') : '',
    }),
    [context?.user.subId],
  );

  const notifications = useMemo(
    () =>
      [...(context?.notifications ?? [])].sort(
        (left, right) => toMillis(right.createdAt) - toMillis(left.createdAt),
      ),
    [context?.notifications],
  );

  const unreadCount = useMemo(
    () => notifications.filter((item) => !readNotificationIds.includes(item.id)).length,
    [notifications, readNotificationIds],
  );

  const hasSubscription = Boolean(subscriptionLinks.universal);
  const activeSubUrl = subscriptionLinks[activeFormat];
  const guidePlatform: Exclude<PlatformKey, 'all'> =
    activePlatform === 'all' ? 'windows' : activePlatform;
  const guideSteps = tutorialMap[guidePlatform];
  const currentGuideLabel =
    platformOptions.find((item) => item.key === guidePlatform)?.label ?? 'Windows';
  const visibleClients = useMemo(
    () =>
      activePlatform === 'all'
        ? clients
        : clients.filter((client) => client.platforms.includes(activePlatform)),
    [activePlatform, clients],
  );

  useEffect(() => {
    if (hasSubscription) return;
    setHasCopied(false);
    setHasMarkedConnected(false);
  }, [hasSubscription]);

  const setupSteps = [
    {
      id: 'copy',
      title: isZh ? '复制订阅链接' : 'Copy subscription URL',
      done: hasSubscription && hasCopied,
    },
    {
      id: 'download',
      title: isZh ? '下载客户端' : 'Download a client',
      done: hasOpenedDownload,
    },
    {
      id: 'connect',
      title: isZh ? '导入并连接' : 'Import and connect',
      done: hasMarkedConnected,
    },
  ];

  const completedCount = setupSteps.filter((step) => step.done).length;
  const progressPercent = Math.round((completedCount / setupSteps.length) * 100);

  const latestAnnouncement = context?.settings.announcementActive
    ? context.settings.announcementText.trim()
    : '';

  const formatDateTime = (value: number) =>
    new Date(toMillis(value)).toLocaleString(isZh ? 'zh-CN' : 'en-US', { hour12: false });

  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setHasCopied(true);
      setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current));
      }, COPY_RESET_DELAY_MS);
    });
  };

  const handleLogout = async () => {
    await fetch('/local/auth/logout', { method: 'POST', credentials: 'include' });
    navigate('/login', { replace: true });
  };

  const openDownload = (url: string) => {
    if (!url) return;
    setHasOpenedDownload(true);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const markNotificationRead = (id: string) => {
    setReadNotificationIds((previous) => (previous.includes(id) ? previous : [...previous, id]));
  };

  const markAllNotificationsRead = () => {
    setReadNotificationIds((previous) => {
      const next = new Set(previous);
      notifications.forEach((item) => next.add(item.id));
      return Array.from(next);
    });
  };

  const localizeNotification = (item: PortalNotification) => {
    if (!isZh) return item;

    if (item.id === 'subscription-ready') {
      return {
        ...item,
        title: '订阅已就绪',
        message: '你的订阅链接已可用，现在可以在客户端导入或更新。',
      };
    }
    if (item.id === 'subscription-pending') {
      return {
        ...item,
        title: '订阅待分配',
        message: '账号已创建，但订阅尚未分配，请联系管理员处理。',
      };
    }
    if (item.id === 'admin-announcement') {
      return {
        ...item,
        title: '管理员公告',
      };
    }
    if (item.id === 'support-contact') {
      return {
        ...item,
        title: '客服联系方式',
        message: `需要帮助请联系：${context.settings.supportTelegram || item.message}`,
      };
    }
    return item;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-zinc-700 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!context) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-50 p-6 flex items-center justify-center">
        <div className="w-full max-w-md rounded-xl border border-white/10 bg-zinc-900/60 p-6 space-y-4">
          <h2 className="text-lg font-semibold">
            {isZh ? '无法加载用户中心' : 'Failed to load user workspace'}
          </h2>
          <p className="text-sm text-zinc-400">{loadError || 'Unknown error'}</p>
          <Button onClick={() => void loadContext()}>{isZh ? '重试' : 'Retry'}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <header className="border-b border-white/5 bg-zinc-900/50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-zinc-800 border border-white/10 rounded-lg flex items-center justify-center">
            <Dog className="w-5 h-5 text-emerald-500" />
          </div>
          <span className="font-semibold">{context.settings.siteName || 'ProxyDog'}</span>
          <span className="text-zinc-500 text-sm">@{context.user.username}</span>
        </div>
        <div className="flex items-center gap-2">
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
            onClick={handleLogout}
            className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {t('portal.signOut')}
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/10 via-zinc-900 to-zinc-900 p-6 md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-300/80">
                USER WORKSPACE
              </p>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
                {isZh ? '用户中心与上手引导一体化' : 'Onboarding and user workspace in one place'}
              </h1>
              <p className="text-sm text-zinc-300 max-w-2xl">
                {isZh
                  ? '流程完成后仍可继续使用：查看订阅、更新客户端、接收管理员公告。'
                  : 'After onboarding, users can keep using this workspace for subscription, client updates, and admin notices.'}
              </p>
            </div>

            <div className="w-full md:w-60 rounded-xl border border-white/10 bg-zinc-950/60 p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>{isZh ? '完成进度' : 'Progress'}</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-sm text-zinc-200">
                {completedCount}/{setupSteps.length} {isZh ? '步已完成' : 'steps completed'}
              </p>
            </div>
          </div>
        </section>
        <section className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className={cn(
              'px-3 py-2 rounded-lg text-sm border transition-colors inline-flex items-center gap-2',
              activeTab === 'home'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-white/10 bg-zinc-900/50 text-zinc-300 hover:bg-zinc-800/60',
            )}
          >
            <LayoutDashboard className="w-4 h-4" />
            {isZh ? '概览' : 'Overview'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('subscription')}
            className={cn(
              'px-3 py-2 rounded-lg text-sm border transition-colors inline-flex items-center gap-2',
              activeTab === 'subscription'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-white/10 bg-zinc-900/50 text-zinc-300 hover:bg-zinc-800/60',
            )}
          >
            <ListChecks className="w-4 h-4" />
            {isZh ? '订阅与客户端' : 'Subscription & Clients'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('notifications')}
            className={cn(
              'px-3 py-2 rounded-lg text-sm border transition-colors inline-flex items-center gap-2',
              activeTab === 'notifications'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-white/10 bg-zinc-900/50 text-zinc-300 hover:bg-zinc-800/60',
            )}
          >
            <Bell className="w-4 h-4" />
            {isZh ? '通知' : 'Notifications'}
            {unreadCount > 0 && (
              <span className="min-w-5 h-5 px-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
        </section>

        {activeTab === 'home' && (
          <section className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 space-y-4">
              <h2 className="text-lg font-semibold">{isZh ? '账户状态' : 'Account status'}</h2>
              <div className="space-y-2 text-sm">
                <p className="text-zinc-300">
                  <span className="text-zinc-500">{isZh ? '用户名：' : 'Username: '}</span>
                  {context.user.username}
                </p>
                <p className="text-zinc-300">
                  <span className="text-zinc-500">{isZh ? '创建时间：' : 'Created at: '}</span>
                  {formatDateTime(context.user.createdAt)}
                </p>
                <p
                  className={cn(
                    'font-medium',
                    hasSubscription ? 'text-emerald-300' : 'text-amber-300',
                  )}
                >
                  {hasSubscription
                    ? isZh
                      ? '订阅已就绪，可随时导入客户端。'
                      : 'Subscription is active and ready to import.'
                    : isZh
                      ? '订阅尚未分配，请联系管理员。'
                      : 'Subscription is not assigned yet. Contact your admin.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setActiveTab('subscription');
                    handleCopy(subscriptionLinks.universal, 'home-universal');
                  }}
                  disabled={!hasSubscription}
                >
                  {isZh ? '复制通用订阅' : 'Copy Universal Link'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setActiveTab('subscription')}>
                  {isZh ? '打开订阅中心' : 'Open Subscription Center'}
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 space-y-4">
              <h2 className="text-lg font-semibold">{isZh ? '管理员消息' : 'Admin messages'}</h2>
              {latestAnnouncement ? (
                <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-4 text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                  {latestAnnouncement}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">
                  {isZh ? '当前没有启用公告。' : 'No active announcement.'}
                </p>
              )}
              {context.settings.supportTelegram ? (
                <p className="text-sm text-zinc-300">
                  <span className="text-zinc-500">{isZh ? '客服联系：' : 'Support: '}</span>
                  {context.settings.supportTelegram}
                </p>
              ) : (
                <p className="text-sm text-zinc-500">
                  {isZh ? '暂未配置客服联系方式。' : 'Support contact is not configured.'}
                </p>
              )}
              <Button variant="outline" size="sm" onClick={() => setActiveTab('notifications')}>
                {isZh ? '查看全部通知' : 'View all notifications'}
              </Button>
            </div>
          </section>
        )}

        {activeTab === 'subscription' && (
          <>
            <section className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
              <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 space-y-4">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <LinkIcon className="w-4 h-4 text-emerald-400" />
                    <span>{isZh ? '步骤 1：复制订阅链接' : 'Step 1: Copy subscription URL'}</span>
                  </h2>
                  <p className="text-sm text-zinc-400">{t('portal.subscriptionDesc')}</p>
                </div>

                {hasSubscription ? (
                  <div className="space-y-4">
                    <div className="grid gap-2 md:grid-cols-4">
                      {formatOptions.map((format) => (
                        <button
                          key={format.key}
                          type="button"
                          onClick={() => setActiveFormat(format.key)}
                          className={cn(
                            'rounded-lg border p-3 text-left transition-colors',
                            activeFormat === format.key
                              ? 'border-emerald-500/40 bg-emerald-500/10'
                              : 'border-white/10 bg-zinc-950/50 hover:bg-zinc-800/60',
                          )}
                        >
                          <p className="text-sm font-medium">{format.label}</p>
                          <p className="text-[11px] text-zinc-500 mt-0.5">{format.desc}</p>
                        </button>
                      ))}
                    </div>

                    <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-4 space-y-3">
                      <p className="font-mono text-xs text-zinc-300 break-all">{activeSubUrl}</p>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="gap-2"
                        onClick={() => handleCopy(activeSubUrl, `active-${activeFormat}`)}
                      >
                        {copiedKey === `active-${activeFormat}` ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                        {copiedKey === `active-${activeFormat}`
                          ? t('portal.copied')
                          : isZh
                            ? `复制 ${formatOptions.find((item) => item.key === activeFormat)?.label} 链接`
                            : `Copy ${formatOptions.find((item) => item.key === activeFormat)?.label} link`}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-zinc-950/50 p-6 text-center space-y-2">
                    <p className="text-zinc-300 text-sm">{t('portal.notReadyTitle')}</p>
                    <p className="text-zinc-500 text-xs">{t('portal.notReadyDesc')}</p>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span>{isZh ? '上手进度清单' : 'Setup checklist'}</span>
                </h2>
                <div className="space-y-3">
                  {setupSteps.map((step, index) => (
                    <div
                      key={step.id}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border px-3 py-2',
                        step.done
                          ? 'border-emerald-500/30 bg-emerald-500/10'
                          : 'border-white/10 bg-zinc-950/40',
                      )}
                    >
                      <span
                        className={cn(
                          'w-6 h-6 rounded-full flex items-center justify-center text-xs border',
                          step.done
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                            : 'bg-zinc-800 border-white/10 text-zinc-400',
                        )}
                      >
                        {step.done ? <Check className="w-3.5 h-3.5" /> : index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm text-zinc-100">{step.title}</p>
                        <p className="text-[11px] text-zinc-500">
                          {step.done ? (isZh ? '已完成' : 'Done') : isZh ? '待完成' : 'Pending'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setHasMarkedConnected((prev) => !prev)}
                >
                  {hasMarkedConnected
                    ? isZh
                      ? '已标记：连接成功'
                      : 'Marked: Connected'
                    : isZh
                      ? '连接成功后点此标记'
                      : 'Mark this after successful connection'}
                </Button>
              </div>
            </section>
            <section className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>{isZh ? '步骤 2：下载客户端' : 'Step 2: Download client'}</span>
                </h2>
                <p className="text-sm text-zinc-400">
                  {isZh
                    ? '先筛选你的设备，再安装推荐客户端。'
                    : 'Pick your device first, then install the recommended client.'}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {platformOptions.map((platform) => (
                  <button
                    key={platform.key}
                    type="button"
                    onClick={() => setActivePlatform(platform.key)}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-xs border transition-colors',
                      activePlatform === platform.key
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                        : 'border-white/10 bg-zinc-950/40 text-zinc-300 hover:bg-zinc-800/60',
                    )}
                  >
                    {platform.label}
                  </button>
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {visibleClients.map((client) => {
                  const isRecommended =
                    activePlatform !== 'all' && client.recommendedFor.includes(activePlatform);
                  return (
                    <div
                      key={client.id}
                      className="rounded-xl border border-white/10 bg-zinc-950/40 p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <client.icon className="w-5 h-5 text-zinc-400 mt-0.5" />
                          <div>
                            <p className="font-medium text-sm">{client.name}</p>
                            <p className="text-xs text-zinc-500">
                              {client.os} / {client.desc}
                            </p>
                          </div>
                        </div>
                        {isRecommended && (
                          <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                            {isZh ? '推荐' : 'Recommended'}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 text-xs"
                          onClick={() => openDownload(client.links.github)}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          GitHub
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 text-xs"
                          onClick={() => openDownload(client.links.vps)}
                          disabled={!client.links.vps}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          VPS
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 space-y-4">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <span>{isZh ? '步骤 3：导入并连接' : 'Step 3: Import and connect'}</span>
                  </h2>
                  <p className="text-sm text-zinc-400">
                    {isZh
                      ? `当前教程设备：${currentGuideLabel}`
                      : `Current guide: ${currentGuideLabel}`}
                  </p>
                </div>
                <div className="space-y-3">
                  {guideSteps.map((step, index) => (
                    <div key={step} className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full border border-white/10 bg-zinc-950/60 text-xs flex items-center justify-center text-zinc-300 flex-shrink-0">
                        {index + 1}
                      </span>
                      <p className="text-sm text-zinc-300 pt-0.5">{step}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>{isZh ? '连接失败排查' : 'Troubleshooting'}</span>
                </h2>
                <div className="space-y-3">
                  {troubleshooting.map((item, index) => (
                    <p key={item} className="text-sm text-zinc-300">
                      {index + 1}. {item}
                    </p>
                  ))}
                </div>
                <p className="text-xs text-zinc-500 border-t border-white/10 pt-4">
                  {t('portal.needHelp')}
                </p>
              </div>
            </section>
          </>
        )}

        {activeTab === 'notifications' && (
          <section className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Bell className="w-4 h-4 text-emerald-400" />
                <span>{isZh ? '通知中心' : 'Notification center'}</span>
              </h2>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => void loadContext()}>
                  {isZh ? '刷新' : 'Refresh'}
                </Button>
                <Button variant="secondary" size="sm" onClick={markAllNotificationsRead}>
                  {isZh ? '全部已读' : 'Mark all read'}
                </Button>
              </div>
            </div>

            {notifications.length === 0 ? (
              <p className="text-sm text-zinc-500">{isZh ? '暂无通知。' : 'No notifications.'}</p>
            ) : (
              <div className="space-y-3">
                {notifications.map((item) => {
                  const localized = localizeNotification(item);
                  const isRead = readNotificationIds.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'rounded-xl border p-4 space-y-2',
                        item.level === 'success' && 'border-emerald-500/20 bg-emerald-500/5',
                        item.level === 'warning' && 'border-amber-500/20 bg-amber-500/5',
                        item.level === 'info' && 'border-white/10 bg-zinc-950/40',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-100">{localized.title}</p>
                          <p className="text-xs text-zinc-500 mt-1">
                            {formatDateTime(item.createdAt)}
                          </p>
                        </div>
                        {!isRead && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300 border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 rounded">
                            <AlertTriangle className="w-3 h-3" />
                            {isZh ? '未读' : 'Unread'}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-300 whitespace-pre-wrap">
                        {localized.message}
                      </p>
                      {!isRead && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => markNotificationRead(item.id)}
                        >
                          {isZh ? '标记已读' : 'Mark as read'}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
