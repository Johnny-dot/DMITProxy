import React, { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  ChevronDown,
  Database,
  Globe,
  Link2,
  Plus,
  RefreshCw,
  Save,
  Shield,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/Card';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/Tabs';
import { useToast } from '@/src/components/ui/Toast';
import { AppVersionFooter } from '@/src/components/AppVersionFooter';
import {
  backupDatabase,
  clearPortalSessions,
  clearTrafficLogs,
  getAdminSettings,
  saveAdminSettings,
  type AdminSettings,
} from '@/src/api/client';
import { useI18n } from '@/src/context/I18nContext';
import { cn } from '@/src/utils/cn';
import {
  createEmptyCommunityLink,
  createEmptySharedResource,
  normalizeSettings,
  visibleItemCount,
} from '@/src/utils/settingsHelpers';
import { type SharedResource } from '@/src/types/sharedResource';
import { type CommunityLink } from '@/src/types/communityLink';
import { SharedResourceEditor } from '@/src/pages/settings/SharedResourceEditor';
import { CommunityLinkEditor } from '@/src/pages/settings/CommunityLinkEditor';

const TEXTAREA_CLASS_NAME =
  'min-h-[150px] w-full rounded-[22px] border border-[color:var(--border-subtle)] bg-[var(--surface-card)] px-4 py-3 text-sm text-[var(--text-primary)] shadow-sm placeholder:text-[var(--text-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2';

const DEFAULT_SETTINGS: AdminSettings = {
  siteName: 'Prism Admin',
  publicUrl: '',
  supportTelegram: '',
  announcementText: '',
  announcementActive: false,
  sharedResources: [],
  communityLinks: [],
};

type PortalTab = 'resources' | 'communities';
type SettingsSection = 'general' | 'announcement' | 'portal' | 'tools';

const SETTINGS_SECTION_HASH: Record<SettingsSection, string> = {
  general: 'general-settings',
  announcement: 'system-announcement',
  portal: 'portal-content',
  tools: 'admin-tools',
};

function resolveSectionFromHash(hash: string): SettingsSection {
  const normalized = hash.replace(/^#/, '');

  for (const [section, value] of Object.entries(SETTINGS_SECTION_HASH) as Array<
    [SettingsSection, string]
  >) {
    if (value === normalized) return section;
  }

  return 'general';
}

function OverviewTile({
  icon: Icon,
  label,
  value,
  hint,
  accentClassName,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  accentClassName: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'group w-full rounded-[24px] border p-4 text-left transition-all duration-200',
        active
          ? 'border-[color:var(--border-strong)] bg-[var(--surface-strong)] shadow-[0_0_0_1px_var(--border-strong)]'
          : 'border-[color:var(--border-subtle)] bg-[var(--surface-panel)] hover:-translate-y-0.5 hover:border-[color:var(--border-strong)] hover:bg-[var(--surface-strong)]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] border',
            accentClassName,
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <ArrowUpRight
          className={cn(
            'h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5',
            active ? 'text-[var(--text-primary)]' : 'text-zinc-500',
          )}
        />
      </div>
      <div className="mt-4 space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          {label}
        </p>
        <p className="text-base font-semibold text-[var(--text-primary)]">{value}</p>
        <p className="text-sm leading-6 text-zinc-400">{hint}</p>
      </div>
    </button>
  );
}

function ActionTile({
  icon: Icon,
  title,
  description,
  onClick,
  tone = 'default',
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
  tone?: 'default' | 'danger';
}) {
  const isDanger = tone === 'danger';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group w-full rounded-[24px] border p-4 text-left transition-all duration-200',
        isDanger
          ? 'border-[color:var(--danger-soft-strong)] bg-[var(--danger-soft)] hover:bg-[var(--danger-soft-strong)]'
          : 'border-[color:var(--border-subtle)] bg-[var(--surface-panel)] hover:border-[color:var(--border-strong)] hover:bg-[var(--surface-strong)]',
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] border',
            isDanger
              ? 'border-[color:var(--danger-soft-strong)] bg-[var(--surface-card)] text-[var(--danger)]'
              : 'border-[color:var(--border-subtle)] bg-[var(--surface-card)] text-zinc-500',
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p
              className={cn(
                'font-semibold',
                isDanger ? 'text-[var(--danger)]' : 'text-[var(--text-primary)]',
              )}
            >
              {title}
            </p>
            <ArrowRight
              className={cn(
                'h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5',
                isDanger ? 'text-[var(--danger)]' : 'text-zinc-500',
              )}
            />
          </div>
          <p className="mt-1 text-sm leading-6 text-zinc-400">{description}</p>
        </div>
      </div>
    </button>
  );
}

export function SettingsPage() {
  const { toast } = useToast();
  const { t, language } = useI18n();
  const isZh = language === 'zh-CN';

  const copy = useMemo(
    () => ({
      refresh: isZh ? '刷新数据' : 'Refresh',
      navBasics: isZh ? '基础' : 'Basics',
      navAnnouncement: isZh ? '公告' : 'Announcement',
      navPortal: isZh ? '门户内容' : 'Portal content',
      navTools: isZh ? '管理工具' : 'Admin tools',
      headerBadge: isZh ? '模块化设置' : 'Modular setup',
      generalHelper: isZh
        ? '这些字段会同步到管理端导航和用户门户。'
        : 'These fields are reflected in the admin shell and the user portal.',
      siteNameHelper: isZh
        ? '用于导航、浏览器标题和品牌展示。'
        : 'Used for navigation, browser titles, and brand presentation.',
      publicUrlHelper: isZh
        ? '建议填写给用户访问门户和下载订阅的公开地址。'
        : 'Set the public URL users should open for the portal and subscription downloads.',
      telegramHelper: isZh
        ? '展示给用户的售后或支持联系方式。'
        : 'The support or after-sales Telegram contact shown to users.',
      announcementEnabledHint: isZh
        ? '启用后会在用户门户首页立即显示。'
        : 'When enabled, the announcement is shown immediately in the user portal.',
      announcementDisabledHint: isZh
        ? '关闭后用户门户不会显示任何公告。'
        : 'When disabled, no announcement is shown in the user portal.',
      turnOnAnnouncement: isZh ? '启用公告' : 'Turn On',
      turnOffAnnouncement: isZh ? '关闭公告' : 'Turn Off',
      portalTitle: isZh ? '门户内容编排' : 'Portal content',
      portalDescription: isZh
        ? '把共享资源和社群入口收纳到同一组里，降低长页面的干扰感。'
        : 'Keep shared resources and community links in one grouped section so the page feels lighter.',
      resourceTab: isZh ? '共享资源' : 'Shared resources',
      communityTab: isZh ? '社群入口' : 'Community links',
      visible: isZh ? '可见' : 'Visible',
      hidden: isZh ? '隐藏' : 'Hidden',
      addSharedResource: isZh ? '新增共享项' : 'Add shared item',
      addCommunityLink: isZh ? '新增社群入口' : 'Add community link',
      sharedResourcesIntro: isZh
        ? '面向用户的额外账号、邀请和补充说明。'
        : 'Extra user-facing accounts, invites, and support notes.',
      communityLinksIntro: isZh
        ? '用户可见的 Telegram、WhatsApp、Discord 或微信群入口。'
        : 'Telegram, WhatsApp, Discord, or other join paths that users can see.',
      sharedResourcesEmpty: isZh
        ? '还没有共享资源。先添加一个共享账号、家庭邀请或下载辅助说明。'
        : 'No shared resources yet. Add a shared account, a family invite, or a download note first.',
      communityLinksEmpty: isZh
        ? '还没有社群入口。可以添加 Telegram、WhatsApp、Discord 或微信群说明。'
        : 'No community links yet. Add Telegram, WhatsApp, Discord, or another join note.',
      saveSharedResources: isZh ? '保存共享资源' : 'Save shared resources',
      saveCommunityLinks: isZh ? '保存社群入口' : 'Save community links',
      remove: isZh ? '移除' : 'Remove',
      show: isZh ? '显示' : 'Show',
      hide: isZh ? '隐藏' : 'Hide',
      expand: isZh ? '展开' : 'Expand',
      collapse: isZh ? '收起' : 'Collapse',
      sharedItemLabel: isZh ? '共享项' : 'Shared item',
      communityItemLabel: isZh ? '社群' : 'Community',
      titleField: isZh ? '标题' : 'Title',
      resourceTypeField: isZh ? '资源类型' : 'Resource type',
      deliveryTypeField: isZh ? '交付方式' : 'Delivery type',
      summaryField: isZh ? '简短说明' : 'Short summary',
      detailField: isZh ? '详细内容 / 邀请信息' : 'Details / invite content',
      accountField: isZh ? '账号 / 邮箱' : 'Account / email',
      passwordField: isZh ? '密码 / 验证码' : 'Password / code',
      inviteValueField: isZh ? '邀请链接' : 'Invite link',
      noteField: isZh ? '补充说明' : 'Extra note',
      platformField: isZh ? '平台' : 'Platform',
      joinLinkField: isZh ? '加入链接 / 联系方式' : 'Join link / contact',
      qrContentField: isZh ? '二维码内容（可选）' : 'QR content (optional)',
      rulesField: isZh ? '规则' : 'Rules',
      notesField: isZh ? '备注' : 'Notes',
      securityPanelTitle: isZh ? '安全与维护' : 'Security and maintenance',
      securityPanelDesc: isZh
        ? '把提示型操作、维护工具和危险动作拆开，避免和表单混在一起。'
        : 'Separate guidance, maintenance, and destructive actions so they do not look like form fields.',
      securityHint: isZh
        ? '密码和 2FA 仍由 3X-UI 面板管理，这里只保留清晰入口。'
        : 'Password and 2FA are still managed in 3X-UI. Keep the entry points explicit here.',
      passwordActionDesc: isZh
        ? '管理员密码需要在 3X-UI 面板内修改。'
        : 'Admin password changes still need to be completed in the 3X-UI panel.',
      twoFactorActionDesc: isZh
        ? '双重认证也需要在 3X-UI 面板内配置。'
        : 'Two-factor auth also needs to be configured inside the 3X-UI panel.',
      maintenanceTitle: isZh ? '维护工具' : 'Maintenance tools',
      maintenanceDesc: isZh
        ? '低频工具默认收起，避免打断常规设置。'
        : 'Low-frequency tools stay collapsed by default to reduce visual noise.',
      maintenanceOpen: isZh ? '展开维护工具' : 'Expand maintenance',
      maintenanceClose: isZh ? '收起维护工具' : 'Collapse maintenance',
      backupDesc: isZh
        ? '立即生成数据库备份，建议在结构性调整前执行。'
        : 'Create a database backup before structural changes or risky maintenance.',
      dangerTitle: isZh ? '危险操作' : 'Danger zone',
      dangerDesc: isZh
        ? '这些动作会清理会话或日志，单独隔离可以减少误触。'
        : 'These actions clear sessions or logs, so they are isolated to reduce mistakes.',
      clearSessionsDesc: isZh
        ? '强制所有门户用户重新登录，适合权限变更或异常会话排查。'
        : 'Force all portal users to sign in again after permission changes or suspicious sessions.',
      clearTrafficDesc: isZh
        ? '清空当前流量日志前，先确认需要的数据已经保留。'
        : 'Clear traffic logs only after confirming that the required data has been preserved.',
      toolsSummaryReady: isZh ? '工具区已整理' : 'Tools organized',
      toolsSummaryMissing: isZh ? '尚未生成备份' : 'No backup yet',
      notConfigured: isZh ? '未配置' : 'Not configured',
      portalSummary: (sharedCount: number, communityCount: number) =>
        isZh
          ? `${sharedCount} 个共享项，${communityCount} 个社群入口`
          : `${sharedCount} shared items, ${communityCount} community links`,
      visibilitySummary: (visibleCount: number, totalCount: number) =>
        isZh
          ? `${visibleCount}/${totalCount} 对用户可见`
          : `${visibleCount}/${totalCount} visible to users`,
    }),
    [isZh],
  );

  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);
  const [isSavingAnnouncement, setIsSavingAnnouncement] = useState(false);
  const [isSavingResources, setIsSavingResources] = useState(false);
  const [isSavingCommunities, setIsSavingCommunities] = useState(false);
  const [lastBackupPath, setLastBackupPath] = useState('');
  const [activePortalTab, setActivePortalTab] = useState<PortalTab>('resources');
  const [activeSection, setActiveSection] = useState<SettingsSection>(() =>
    typeof window === 'undefined' ? 'general' : resolveSectionFromHash(window.location.hash),
  );
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);

  const applyServerSettings = (data: AdminSettings) => {
    const normalized = normalizeSettings(data);
    setSettings(normalized);
  };

  const load = async () => {
    setIsLoading(true);
    try {
      const data = await getAdminSettings();
      applyServerSettings(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('settings.loadFailed');
      toast(message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncSectionFromHash = () => {
      setActiveSection(resolveSectionFromHash(window.location.hash));
    };

    syncSectionFromHash();
    window.addEventListener('hashchange', syncSectionFromHash);
    return () => window.removeEventListener('hashchange', syncSectionFromHash);
  }, []);

  const updateField = <K extends keyof AdminSettings>(key: K, value: AdminSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const updateSharedResource = (id: string, patch: Partial<SharedResource>) => {
    setSettings((prev) => ({
      ...prev,
      sharedResources: prev.sharedResources.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    }));
  };

  const addSharedResource = () => {
    const nextResource = createEmptySharedResource();
    setSettings((prev) => ({
      ...prev,
      sharedResources: [...prev.sharedResources, nextResource],
    }));
    setActivePortalTab('resources');
  };

  const removeSharedResource = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      sharedResources: prev.sharedResources.filter((item) => item.id !== id),
    }));
  };

  const updateCommunityLink = (id: string, patch: Partial<CommunityLink>) => {
    setSettings((prev) => ({
      ...prev,
      communityLinks: prev.communityLinks.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    }));
  };

  const addCommunityLink = () => {
    const nextEntry = createEmptyCommunityLink();
    setSettings((prev) => ({
      ...prev,
      communityLinks: [...prev.communityLinks, nextEntry],
    }));
    setActivePortalTab('communities');
  };

  const removeCommunityLink = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      communityLinks: prev.communityLinks.filter((item) => item.id !== id),
    }));
  };

  const saveGeneral = async () => {
    setIsSavingGeneral(true);
    try {
      const updated = await saveAdminSettings({
        siteName: settings.siteName,
        publicUrl: settings.publicUrl,
        supportTelegram: settings.supportTelegram,
      });
      applyServerSettings(updated);
      toast(t('settings.saveGeneralSuccess'), 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : t('settings.saveGeneralFailed');
      toast(message, 'error');
    } finally {
      setIsSavingGeneral(false);
    }
  };

  const saveAnnouncement = async () => {
    setIsSavingAnnouncement(true);
    try {
      const updated = await saveAdminSettings({
        announcementText: settings.announcementText,
        announcementActive: settings.announcementActive,
      });
      applyServerSettings(updated);
      toast(t('settings.announcementUpdated'), 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : t('settings.announcementSaveFailed');
      toast(message, 'error');
    } finally {
      setIsSavingAnnouncement(false);
    }
  };

  const saveSharedResources = async () => {
    setIsSavingResources(true);
    try {
      const updated = await saveAdminSettings({
        sharedResources: settings.sharedResources,
      });
      applyServerSettings(updated);
      toast(isZh ? '共享资源已更新' : 'Shared resources updated', 'success');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : isZh
            ? '保存共享资源失败'
            : 'Failed to save shared resources';
      toast(message, 'error');
    } finally {
      setIsSavingResources(false);
    }
  };

  const saveCommunityLinks = async () => {
    setIsSavingCommunities(true);
    try {
      const updated = await saveAdminSettings({
        communityLinks: settings.communityLinks,
      });
      applyServerSettings(updated);
      toast(isZh ? '社群入口已更新' : 'Community links updated', 'success');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : isZh
            ? '保存社群入口失败'
            : 'Failed to save community links';
      toast(message, 'error');
    } finally {
      setIsSavingCommunities(false);
    }
  };

  const handleClearSessions = async () => {
    try {
      const cleared = await clearPortalSessions();
      toast(t('settings.sessionsCleared', { count: cleared }), 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : t('settings.clearSessionsFailed');
      toast(message, 'error');
    }
  };

  const handleBackup = async () => {
    try {
      const filePath = await backupDatabase();
      setLastBackupPath(filePath);
      toast(t('settings.backupCreated'), 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : t('settings.backupFailed');
      toast(message, 'error');
    }
  };

  const handleClearTraffic = async () => {
    try {
      await clearTrafficLogs();
      toast(t('settings.trafficCleared'), 'success');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('settings.trafficClearUnavailable');
      toast(message, 'info');
    }
  };

  const selectSection = (section: SettingsSection) => {
    setActiveSection(section);

    if (typeof window === 'undefined') return;

    const nextUrl = `${window.location.pathname}${window.location.search}#${SETTINGS_SECTION_HASH[section]}`;
    window.history.replaceState(null, '', nextUrl);
  };

  const sharedResourcesVisible = visibleItemCount(settings.sharedResources);
  const communityLinksVisible = visibleItemCount(settings.communityLinks);
  const announcementSummary = settings.announcementActive
    ? copy.announcementEnabledHint
    : copy.announcementDisabledHint;
  const toolsSummary = lastBackupPath ? copy.toolsSummaryReady : copy.toolsSummaryMissing;

  const overviewTiles = [
    {
      section: 'general' as const,
      icon: Globe,
      label: copy.navBasics,
      value: settings.siteName || copy.notConfigured,
      hint: settings.publicUrl || copy.publicUrlHelper,
      accentClassName:
        'border-[color:var(--info-soft-strong)] bg-[var(--info-soft)] text-[var(--info)]',
    },
    {
      section: 'announcement' as const,
      icon: Bell,
      label: copy.navAnnouncement,
      value: settings.announcementActive
        ? t('settings.announcementActive')
        : t('settings.announcementDisabled'),
      hint: settings.announcementText.trim() || announcementSummary,
      accentClassName:
        'border-[color:var(--warning-soft-strong)] bg-[var(--warning-soft)] text-[var(--warning)]',
    },
    {
      section: 'portal' as const,
      icon: Link2,
      label: copy.navPortal,
      value: copy.portalSummary(settings.sharedResources.length, settings.communityLinks.length),
      hint: copy.visibilitySummary(
        sharedResourcesVisible + communityLinksVisible,
        settings.sharedResources.length + settings.communityLinks.length,
      ),
      accentClassName:
        'border-[color:var(--success-soft-strong)] bg-[var(--success-soft)] text-[var(--success)]',
    },
    {
      section: 'tools' as const,
      icon: Database,
      label: copy.navTools,
      value: toolsSummary,
      hint: lastBackupPath || copy.maintenanceDesc,
      accentClassName:
        'border-[color:var(--accent-soft)] bg-[var(--accent-soft)] text-[var(--accent)]',
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6 px-4 md:px-6 xl:px-8">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-[420px] w-full" />
      </div>
    );
  }

  return (
    <div className="content-shell-wide w-full min-w-0 space-y-6 px-4 pb-10 md:px-6 xl:px-8">
      <section className="surface-card overflow-hidden p-6 md:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <p className="section-kicker">{t('settings.title')}</p>
              <Badge variant="outline">{copy.headerBadge}</Badge>
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight">{t('settings.title')}</h1>
              <p className="max-w-3xl text-sm leading-7 text-zinc-400">{t('settings.subtitle')}</p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="gap-2 self-start xl:self-auto"
            onClick={() => void load()}
          >
            <RefreshCw className="h-4 w-4" />
            {copy.refresh}
          </Button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {overviewTiles.map((tile) => (
            <React.Fragment key={tile.section}>
              <OverviewTile
                {...tile}
                active={activeSection === tile.section}
                onClick={() => selectSection(tile.section)}
              />
            </React.Fragment>
          ))}
        </div>
      </section>

      <nav className="surface-card flex flex-wrap gap-2 p-3">
        {overviewTiles.map((tile) => (
          <button
            key={tile.section}
            type="button"
            onClick={() => selectSection(tile.section)}
            className={cn(
              'rounded-full border px-4 py-2 text-sm font-medium transition',
              activeSection === tile.section
                ? 'border-[color:var(--border-strong)] bg-[var(--surface-strong)] text-[var(--text-primary)]'
                : 'border-[color:var(--border-subtle)] bg-[var(--surface-panel)] text-[var(--text-secondary)] hover:border-[color:var(--border-strong)] hover:text-[var(--text-primary)]',
            )}
          >
            {tile.label}
          </button>
        ))}
      </nav>

      <div className="min-w-0">
        {activeSection === 'general' ? (
          <Card>
            <CardHeader className="pb-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-[color:var(--info-soft-strong)] bg-[var(--info-soft)] text-[var(--info)]">
                      <Globe className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle>{t('settings.generalTitle')}</CardTitle>
                      <CardDescription>{t('settings.generalDesc')}</CardDescription>
                    </div>
                  </div>
                </div>
                <Badge variant="secondary">{copy.navBasics}</Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="grid gap-5 xl:grid-cols-2">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">{t('settings.siteName')}</label>
                  <Input
                    value={settings.siteName}
                    onChange={(event) => updateField('siteName', event.target.value)}
                  />
                  <p className="text-xs leading-6 text-zinc-500">{copy.siteNameHelper}</p>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium">{t('settings.publicUrl')}</label>
                  <Input
                    value={settings.publicUrl}
                    onChange={(event) => updateField('publicUrl', event.target.value)}
                  />
                  <p className="text-xs leading-6 text-zinc-500">{copy.publicUrlHelper}</p>
                </div>

                <div className="grid gap-2 xl:col-span-2">
                  <label className="text-sm font-medium">{t('settings.supportTelegram')}</label>
                  <Input
                    value={settings.supportTelegram}
                    onChange={(event) => updateField('supportTelegram', event.target.value)}
                  />
                  <p className="text-xs leading-6 text-zinc-500">{copy.telegramHelper}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-[color:var(--border-subtle)] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-6 text-zinc-400">{copy.generalHelper}</p>
                <Button className="gap-2" onClick={saveGeneral} disabled={isSavingGeneral}>
                  <Save className="h-4 w-4" />
                  {isSavingGeneral ? t('common.saving') : t('settings.saveChanges')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {activeSection === 'announcement' ? (
          <Card>
            <CardHeader className="pb-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-[color:var(--warning-soft-strong)] bg-[var(--warning-soft)] text-[var(--warning)]">
                    <Bell className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle>{t('settings.systemAnnouncement')}</CardTitle>
                    <CardDescription>{t('settings.announcementDesc')}</CardDescription>
                  </div>
                </div>
                <Badge variant={settings.announcementActive ? 'success' : 'secondary'}>
                  {settings.announcementActive
                    ? t('settings.announcementActive')
                    : t('settings.announcementDisabled')}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="rounded-[24px] border border-[color:var(--border-subtle)] bg-[var(--surface-panel)] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {t('settings.announcementStatus')}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-zinc-400">{announcementSummary}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateField('announcementActive', !settings.announcementActive)}
                  >
                    {settings.announcementActive
                      ? copy.turnOffAnnouncement
                      : copy.turnOnAnnouncement}
                  </Button>
                </div>
              </div>

              <textarea
                className={TEXTAREA_CLASS_NAME}
                placeholder={t('settings.announcementPlaceholder')}
                value={settings.announcementText}
                onChange={(event) => updateField('announcementText', event.target.value)}
              />

              <div className="flex flex-col gap-3 border-t border-[color:var(--border-subtle)] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-6 text-zinc-400">
                  {settings.announcementActive
                    ? copy.announcementEnabledHint
                    : copy.announcementDisabledHint}
                </p>
                <Button
                  className="gap-2"
                  onClick={saveAnnouncement}
                  disabled={isSavingAnnouncement}
                >
                  <Save className="h-4 w-4" />
                  {isSavingAnnouncement ? t('common.saving') : t('settings.updateAnnouncement')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {activeSection === 'portal' ? (
          <Card>
            <CardHeader className="pb-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-[color:var(--success-soft-strong)] bg-[var(--success-soft)] text-[var(--success)]">
                    <Link2 className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle>{copy.portalTitle}</CardTitle>
                    <CardDescription>{copy.portalDescription}</CardDescription>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="success">
                    {copy.visible} {sharedResourcesVisible + communityLinksVisible}
                  </Badge>
                  <Badge variant="secondary">
                    {copy.hidden}{' '}
                    {settings.sharedResources.length +
                      settings.communityLinks.length -
                      sharedResourcesVisible -
                      communityLinksVisible}
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              <Tabs>
                <TabsList className="w-full justify-start overflow-x-auto">
                  <TabsTrigger
                    active={activePortalTab === 'resources'}
                    onClick={() => setActivePortalTab('resources')}
                    className="gap-2"
                  >
                    <span>{copy.resourceTab}</span>
                    <span className="rounded-full bg-[var(--surface-panel)] px-2 py-0.5 text-[11px]">
                      {settings.sharedResources.length}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger
                    active={activePortalTab === 'communities'}
                    onClick={() => setActivePortalTab('communities')}
                    className="gap-2"
                  >
                    <span>{copy.communityTab}</span>
                    <span className="rounded-full bg-[var(--surface-panel)] px-2 py-0.5 text-[11px]">
                      {settings.communityLinks.length}
                    </span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent active={activePortalTab === 'resources'} className="space-y-5">
                  <div className="flex flex-col gap-3 rounded-[24px] border border-[color:var(--border-subtle)] bg-[var(--surface-panel)] p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {copy.sharedResourcesIntro}
                      </p>
                      <p className="text-sm text-zinc-400">
                        {copy.visibilitySummary(
                          sharedResourcesVisible,
                          settings.sharedResources.length,
                        )}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="gap-2 self-start sm:self-auto"
                      onClick={addSharedResource}
                    >
                      <Plus className="h-4 w-4" />
                      {copy.addSharedResource}
                    </Button>
                  </div>

                  {settings.sharedResources.length === 0 ? (
                    <div className="rounded-[24px] border border-dashed border-[color:var(--border-subtle)] bg-[var(--surface-panel)] px-5 py-6 text-sm leading-7 text-zinc-400">
                      {copy.sharedResourcesEmpty}
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {settings.sharedResources.map((resource) => (
                        <SharedResourceEditor
                          key={resource.id}
                          resource={resource}
                          isZh={isZh}
                          copy={copy}
                          onUpdate={updateSharedResource}
                          onRemove={removeSharedResource}
                        />
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col gap-3 border-t border-[color:var(--border-subtle)] pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm leading-6 text-zinc-400">
                      {isZh
                        ? '共享资源单独保存，避免和其他设置一起提交。'
                        : 'Shared resources are saved separately so they do not block other changes.'}
                    </p>
                    <Button
                      className="gap-2"
                      onClick={saveSharedResources}
                      disabled={isSavingResources}
                    >
                      <Save className="h-4 w-4" />
                      {isSavingResources ? t('common.saving') : copy.saveSharedResources}
                    </Button>
                  </div>
                </TabsContent>
                <TabsContent active={activePortalTab === 'communities'} className="space-y-5">
                  <div className="flex flex-col gap-3 rounded-[24px] border border-[color:var(--border-subtle)] bg-[var(--surface-panel)] p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {copy.communityLinksIntro}
                      </p>
                      <p className="text-sm text-zinc-400">
                        {copy.visibilitySummary(
                          communityLinksVisible,
                          settings.communityLinks.length,
                        )}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="gap-2 self-start sm:self-auto"
                      onClick={addCommunityLink}
                    >
                      <Plus className="h-4 w-4" />
                      {copy.addCommunityLink}
                    </Button>
                  </div>

                  {settings.communityLinks.length === 0 ? (
                    <div className="rounded-[24px] border border-dashed border-[color:var(--border-subtle)] bg-[var(--surface-panel)] px-5 py-6 text-sm leading-7 text-zinc-400">
                      {copy.communityLinksEmpty}
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {settings.communityLinks.map((entry) => (
                        <CommunityLinkEditor
                          key={entry.id}
                          entry={entry}
                          isZh={isZh}
                          copy={copy}
                          onUpdate={updateCommunityLink}
                          onRemove={removeCommunityLink}
                        />
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col gap-3 border-t border-[color:var(--border-subtle)] pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm leading-6 text-zinc-400">
                      {isZh
                        ? '社群入口单独保存，避免与通用设置互相影响。'
                        : 'Community links are saved independently from general settings.'}
                    </p>
                    <Button
                      className="gap-2"
                      onClick={saveCommunityLinks}
                      disabled={isSavingCommunities}
                    >
                      <Save className="h-4 w-4" />
                      {isSavingCommunities ? t('common.saving') : copy.saveCommunityLinks}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        ) : null}

        {activeSection === 'tools' ? (
          <Card>
            <CardHeader className="pb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-[color:var(--accent-soft)] bg-[var(--accent-soft)] text-[var(--accent)]">
                  <Shield className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle>{copy.securityPanelTitle}</CardTitle>
                  <CardDescription>{copy.securityPanelDesc}</CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="rounded-[24px] border border-[color:var(--border-subtle)] bg-[var(--surface-panel)] p-4">
                <p className="text-sm leading-6 text-zinc-400">{copy.securityHint}</p>
              </div>

              <div className="space-y-3">
                <ActionTile
                  icon={Shield}
                  title={t('settings.changeAdminPassword')}
                  description={copy.passwordActionDesc}
                  onClick={() => toast(t('settings.passwordHint'), 'info')}
                />
                <ActionTile
                  icon={Shield}
                  title={t('settings.twoFactorAuth')}
                  description={copy.twoFactorActionDesc}
                  onClick={() => toast(t('settings.twoFactorHint'), 'info')}
                />
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setMaintenanceOpen((current) => !current)}
                  className="flex w-full items-center justify-between rounded-[24px] border border-[color:var(--border-subtle)] bg-[var(--surface-panel)] px-4 py-4 text-left transition hover:border-[color:var(--border-strong)] hover:bg-[var(--surface-strong)]"
                >
                  <div className="space-y-1">
                    <p className="font-semibold text-[var(--text-primary)]">
                      {copy.maintenanceTitle}
                    </p>
                    <p className="text-sm leading-6 text-zinc-400">{copy.maintenanceDesc}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                      {maintenanceOpen ? copy.maintenanceClose : copy.maintenanceOpen}
                    </span>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-zinc-500 transition-transform duration-200',
                        maintenanceOpen && 'rotate-180',
                      )}
                    />
                  </div>
                </button>

                {maintenanceOpen ? (
                  <div className="space-y-3">
                    <ActionTile
                      icon={Database}
                      title={t('settings.backupDatabase')}
                      description={copy.backupDesc}
                      onClick={handleBackup}
                    />
                    <div className="rounded-[24px] border border-[color:var(--border-subtle)] bg-[var(--surface-panel)] p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                        {t('settings.lastBackup')}
                      </p>
                      <p className="mt-2 break-all text-sm leading-6 text-zinc-400">
                        {lastBackupPath || t('settings.noBackup')}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-3 border-t border-[color:var(--border-subtle)] pt-5">
                <div className="rounded-[24px] border border-[color:var(--danger-soft-strong)] bg-[var(--danger-soft)] p-4">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-[var(--danger)]" />
                    <p className="text-sm font-semibold text-[var(--danger)]">{copy.dangerTitle}</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{copy.dangerDesc}</p>
                </div>

                <ActionTile
                  icon={ShieldAlert}
                  title={t('settings.clearUserSessions')}
                  description={copy.clearSessionsDesc}
                  onClick={handleClearSessions}
                  tone="danger"
                />
                <ActionTile
                  icon={Trash2}
                  title={t('settings.clearTrafficLogs')}
                  description={copy.clearTrafficDesc}
                  onClick={handleClearTraffic}
                  tone="danger"
                />
              </div>
            </CardContent>
          </Card>
        ) : null}

        <AppVersionFooter />
      </div>
    </div>
  );
}
