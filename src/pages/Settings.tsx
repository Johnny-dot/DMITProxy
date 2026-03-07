import React, { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { Badge } from '@/src/components/ui/Badge';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { useToast } from '@/src/components/ui/Toast';
import { Save, Bell, Shield, Globe, Database, RefreshCw, Plus, Trash2 } from 'lucide-react';
import {
  type AdminSettings,
  backupDatabase,
  clearPortalSessions,
  clearTrafficLogs,
  getAdminSettings,
  saveAdminSettings,
} from '@/src/api/client';
import {
  SHARED_RESOURCE_ACCESS_OPTIONS,
  SHARED_RESOURCE_KIND_OPTIONS,
  type SharedResource,
} from '@/src/types/sharedResource';
import { COMMUNITY_PLATFORM_OPTIONS, type CommunityLink } from '@/src/types/communityLink';
import { cn } from '@/src/utils/cn';
import { useI18n } from '@/src/context/I18nContext';

function createEmptySharedResource(): SharedResource {
  const id =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `resource-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return {
    id,
    title: '',
    kind: 'other',
    access: 'instructions',
    summary: '',
    content: '',
    active: true,
  };
}

function createEmptyCommunityLink(): CommunityLink {
  const id =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `community-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return {
    id,
    title: '',
    platform: 'telegram',
    url: '',
    summary: '',
    rules: '',
    notes: '',
    qrContent: '',
    active: true,
  };
}

const DEFAULT_SETTINGS: AdminSettings = {
  siteName: 'Prism Admin',
  publicUrl: '',
  supportTelegram: '',
  announcementText: '',
  announcementActive: false,
  sharedResources: [],
  communityLinks: [],
};

export function SettingsPage() {
  const { toast } = useToast();
  const { t, language } = useI18n();
  const isZh = language === 'zh-CN';
  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);
  const [isSavingAnnouncement, setIsSavingAnnouncement] = useState(false);
  const [isSavingResources, setIsSavingResources] = useState(false);
  const [isSavingCommunities, setIsSavingCommunities] = useState(false);
  const [lastBackupPath, setLastBackupPath] = useState('');

  const load = async () => {
    setIsLoading(true);
    try {
      const data = await getAdminSettings();
      setSettings({
        ...data,
        sharedResources: Array.isArray(data.sharedResources) ? data.sharedResources : [],
        communityLinks: Array.isArray(data.communityLinks) ? data.communityLinks : [],
      });
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
    setSettings((prev) => ({
      ...prev,
      sharedResources: [...prev.sharedResources, createEmptySharedResource()],
    }));
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
    setSettings((prev) => ({
      ...prev,
      communityLinks: [...prev.communityLinks, createEmptyCommunityLink()],
    }));
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
      setSettings(updated);
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
      setSettings(updated);
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
      setSettings(updated);
      toast(
        isZh ? '共享资源与家庭组邀请已更新' : 'Shared resources and family invites updated',
        'success',
      );
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
      setSettings(updated);
      toast(isZh ? '社区入口已更新' : 'Community links updated', 'success');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : isZh
            ? '保存社区入口失败'
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="surface-card flex flex-col gap-4 p-6 sm:flex-row sm:items-end sm:justify-between md:p-7">
        <div className="space-y-3">
          <p className="section-kicker">{t('settings.title')}</p>
          <h1 className="text-3xl font-semibold tracking-tight">{t('settings.title')}</h1>
          <p className="max-w-3xl text-sm leading-7 text-zinc-400">{t('settings.subtitle')}</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => void load()}>
          <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
        </Button>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-indigo-500" />
                <CardTitle>{t('settings.generalTitle')}</CardTitle>
              </div>
              <CardDescription>{t('settings.generalDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">{t('settings.siteName')}</label>
                <Input
                  value={settings.siteName}
                  onChange={(e) => updateField('siteName', e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">{t('settings.publicUrl')}</label>
                <Input
                  value={settings.publicUrl}
                  onChange={(e) => updateField('publicUrl', e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">{t('settings.supportTelegram')}</label>
                <Input
                  value={settings.supportTelegram}
                  onChange={(e) => updateField('supportTelegram', e.target.value)}
                />
              </div>
              <Button className="gap-2" onClick={saveGeneral} disabled={isSavingGeneral}>
                <Save className="w-4 h-4" />
                {isSavingGeneral ? t('common.saving') : t('settings.saveChanges')}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-yellow-500" />
                <CardTitle>{t('settings.systemAnnouncement')}</CardTitle>
              </div>
              <CardDescription>{t('settings.announcementDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea
                className="min-h-[150px] w-full rounded-[22px] border border-[color:var(--border-subtle)] bg-[var(--surface-card)] px-4 py-3 text-sm text-zinc-50 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
                placeholder={t('settings.announcementPlaceholder')}
                value={settings.announcementText}
                onChange={(e) => updateField('announcementText', e.target.value)}
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-400">{t('settings.announcementStatus')}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateField('announcementActive', !settings.announcementActive)}
                  >
                    {settings.announcementActive ? t('common.disabled') : t('common.enabled')}
                  </Button>
                  <Badge variant={settings.announcementActive ? 'success' : 'secondary'}>
                    {settings.announcementActive
                      ? t('settings.announcementActive')
                      : t('settings.announcementDisabled')}
                  </Badge>
                </div>
                <Button
                  className="gap-2"
                  onClick={saveAnnouncement}
                  disabled={isSavingAnnouncement}
                >
                  <Save className="w-4 h-4" />
                  {isSavingAnnouncement ? t('common.saving') : t('settings.updateAnnouncement')}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-emerald-500" />
                <CardTitle>
                  {isZh ? '共享资源与家庭组邀请' : 'Shared resources and family invites'}
                </CardTitle>
              </div>
              <CardDescription>
                {isZh
                  ? '这里可以维护多条共享内容，例如美区 Apple ID、ChatGPT 会员账号、1Password / Spotify / Google One 家庭组邀请链接等。'
                  : 'Manage multiple shared entries here, such as a US Apple ID, a ChatGPT account, or family invite links for 1Password, Spotify, or Google One.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-2"
                  onClick={addSharedResource}
                >
                  <Plus className="w-4 h-4" />
                  {isZh ? '新增共享资源' : 'Add shared resource'}
                </Button>
              </div>

              {settings.sharedResources.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-[color:var(--border-subtle)] bg-[var(--surface-panel)] px-4 py-5 text-sm leading-6 text-zinc-400">
                  {isZh
                    ? '当前还没有共享资源。你可以新增 Apple ID、ChatGPT 账号、家庭组邀请链接或其他数字资产说明。'
                    : 'No shared resources yet. Add an Apple ID, a ChatGPT account, a family invite link, or other digital access notes.'}
                </div>
              ) : (
                <div className="space-y-4">
                  {settings.sharedResources.map((resource, index) => (
                    <div
                      key={resource.id}
                      className="rounded-[26px] border border-[color:var(--border-subtle)] bg-[var(--surface-panel)] p-4 md:p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-zinc-100">
                            {isZh ? `资源 ${index + 1}` : `Resource ${index + 1}`}
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={resource.active ? 'success' : 'secondary'}>
                              {resource.active
                                ? isZh
                                  ? '已显示给用户'
                                  : 'Visible to users'
                                : isZh
                                  ? '隐藏'
                                  : 'Hidden'}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              updateSharedResource(resource.id, { active: !resource.active })
                            }
                          >
                            {resource.active ? (isZh ? '隐藏' : 'Hide') : isZh ? '显示' : 'Show'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-2 text-red-400 hover:text-red-300"
                            onClick={() => removeSharedResource(resource.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                            {isZh ? '删除' : 'Remove'}
                          </Button>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div className="grid gap-2">
                          <label className="text-sm font-medium">
                            {isZh ? '显示标题' : 'Title'}
                          </label>
                          <Input
                            value={resource.title}
                            placeholder={
                              isZh
                                ? '例如：ChatGPT Plus 共享账号'
                                : 'Example: Shared ChatGPT Plus account'
                            }
                            onChange={(e) =>
                              updateSharedResource(resource.id, { title: e.target.value })
                            }
                          />
                        </div>

                        <div className="grid gap-2">
                          <label className="text-sm font-medium">
                            {isZh ? '资源类型' : 'Resource type'}
                          </label>
                          <select
                            className="h-11 rounded-[18px] border border-[color:var(--border-subtle)] bg-[var(--surface-card)] px-4 text-sm text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
                            value={resource.kind}
                            onChange={(e) =>
                              updateSharedResource(resource.id, {
                                kind: e.target.value as SharedResource['kind'],
                              })
                            }
                          >
                            {SHARED_RESOURCE_KIND_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {isZh ? option.labelZh : option.labelEn}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid gap-2">
                          <label className="text-sm font-medium">
                            {isZh ? '交付方式' : 'Delivery type'}
                          </label>
                          <select
                            className="h-11 rounded-[18px] border border-[color:var(--border-subtle)] bg-[var(--surface-card)] px-4 text-sm text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
                            value={resource.access}
                            onChange={(e) =>
                              updateSharedResource(resource.id, {
                                access: e.target.value as SharedResource['access'],
                              })
                            }
                          >
                            {SHARED_RESOURCE_ACCESS_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {isZh ? option.labelZh : option.labelEn}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid gap-2">
                          <label className="text-sm font-medium">
                            {isZh ? '简短说明' : 'Short summary'}
                          </label>
                          <Input
                            value={resource.summary}
                            placeholder={
                              isZh
                                ? '例如：用于 iPhone 下载 Shadowrocket，请安装后及时退出'
                                : 'Example: Use this for Shadowrocket on iPhone and sign out after install'
                            }
                            onChange={(e) =>
                              updateSharedResource(resource.id, { summary: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2">
                        <label className="text-sm font-medium">
                          {isZh ? '详细内容 / 邀请信息' : 'Details / invite content'}
                        </label>
                        <textarea
                          className="min-h-[160px] w-full rounded-[22px] border border-[color:var(--border-subtle)] bg-[var(--surface-card)] px-4 py-3 text-sm text-zinc-50 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
                          placeholder={
                            isZh
                              ? '例如：\n账号：example@example.com\n密码：******\n规则：只在 App Store 登录，不要开启 iCloud。\n\n或者：\n邀请链接：https://...\n说明：点击接受后告诉管理员已加入。'
                              : 'Example:\nAccount: example@example.com\nPassword: ******\nRule: sign in only inside App Store, do not enable iCloud.\n\nOr:\nInvite link: https://...\nNote: accept the invite and tell the admin after joining.'
                          }
                          value={resource.content}
                          onChange={(e) =>
                            updateSharedResource(resource.id, { content: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Button className="gap-2" onClick={saveSharedResources} disabled={isSavingResources}>
                <Save className="w-4 h-4" />
                {isSavingResources
                  ? t('common.saving')
                  : isZh
                    ? '保存共享资源'
                    : 'Save shared resources'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-cyan-400" />
                <CardTitle>{isZh ? '社区入口' : 'Community links'}</CardTitle>
              </div>
              <CardDescription>
                {isZh
                  ? '为朋友们维护单独的社区入口，例如 Telegram、WhatsApp、Discord、微信群说明或自定义链接。'
                  : 'Maintain dedicated community entries for friends, such as Telegram, WhatsApp, Discord, WeChat notes, or custom links.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-2"
                  onClick={addCommunityLink}
                >
                  <Plus className="w-4 h-4" />
                  {isZh ? '新增社区入口' : 'Add community link'}
                </Button>
              </div>

              {settings.communityLinks.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-[color:var(--border-subtle)] bg-[var(--surface-panel)] px-4 py-5 text-sm leading-6 text-zinc-400">
                  {isZh
                    ? '当前还没有社区入口。你可以添加 Telegram、WhatsApp、Discord、微信群说明或其他你们自己的加入方式。'
                    : 'No community links yet. Add Telegram, WhatsApp, Discord, WeChat notes, or any other join method you use.'}
                </div>
              ) : (
                <div className="space-y-4">
                  {settings.communityLinks.map((entry, index) => (
                    <div
                      key={entry.id}
                      className="rounded-[26px] border border-[color:var(--border-subtle)] bg-[var(--surface-panel)] p-4 md:p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-zinc-100">
                            {isZh ? `社区入口 ${index + 1}` : `Community ${index + 1}`}
                          </p>
                          <Badge variant={entry.active ? 'success' : 'secondary'}>
                            {entry.active
                              ? isZh
                                ? '已显示给用户'
                                : 'Visible to users'
                              : isZh
                                ? '隐藏'
                                : 'Hidden'}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => updateCommunityLink(entry.id, { active: !entry.active })}
                          >
                            {entry.active ? (isZh ? '隐藏' : 'Hide') : isZh ? '显示' : 'Show'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-2 text-red-400 hover:text-red-300"
                            onClick={() => removeCommunityLink(entry.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                            {isZh ? '删除' : 'Remove'}
                          </Button>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div className="grid gap-2">
                          <label className="text-sm font-medium">
                            {isZh ? '显示标题' : 'Title'}
                          </label>
                          <Input
                            value={entry.title}
                            placeholder={isZh ? '例如：朋友交流群' : 'Example: Friends community'}
                            onChange={(e) =>
                              updateCommunityLink(entry.id, { title: e.target.value })
                            }
                          />
                        </div>

                        <div className="grid gap-2">
                          <label className="text-sm font-medium">
                            {isZh ? '平台' : 'Platform'}
                          </label>
                          <select
                            className="h-11 rounded-[18px] border border-[color:var(--border-subtle)] bg-[var(--surface-card)] px-4 text-sm text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
                            value={entry.platform}
                            onChange={(e) =>
                              updateCommunityLink(entry.id, {
                                platform: e.target.value as CommunityLink['platform'],
                              })
                            }
                          >
                            {COMMUNITY_PLATFORM_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {isZh ? option.labelZh : option.labelEn}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid gap-2 md:col-span-2">
                          <label className="text-sm font-medium">
                            {isZh ? '加入链接 / 联系方式' : 'Join link / contact'}
                          </label>
                          <Input
                            value={entry.url}
                            placeholder={
                              isZh
                                ? '例如：https://t.me/... 或 https://chat.whatsapp.com/...'
                                : 'Example: https://t.me/... or https://chat.whatsapp.com/...'
                            }
                            onChange={(e) => updateCommunityLink(entry.id, { url: e.target.value })}
                          />
                        </div>

                        <div className="grid gap-2">
                          <label className="text-sm font-medium">{isZh ? '简介' : 'Summary'}</label>
                          <Input
                            value={entry.summary}
                            placeholder={
                              isZh
                                ? '例如：主要聊科技、市场和生活'
                                : 'Example: For tech, markets, and everyday chat'
                            }
                            onChange={(e) =>
                              updateCommunityLink(entry.id, { summary: e.target.value })
                            }
                          />
                        </div>

                        <div className="grid gap-2">
                          <label className="text-sm font-medium">
                            {isZh ? '二维码内容（可选）' : 'QR content (optional)'}
                          </label>
                          <Input
                            value={entry.qrContent}
                            placeholder={
                              isZh ? '留空则默认使用加入链接' : 'Leave empty to reuse the join link'
                            }
                            onChange={(e) =>
                              updateCommunityLink(entry.id, { qrContent: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div className="grid gap-2">
                          <label className="text-sm font-medium">
                            {isZh ? '群规 / 加入规则' : 'Rules'}
                          </label>
                          <textarea
                            className="min-h-[140px] w-full rounded-[22px] border border-[color:var(--border-subtle)] bg-[var(--surface-card)] px-4 py-3 text-sm text-zinc-50 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
                            value={entry.rules}
                            placeholder={
                              isZh
                                ? '例如：\n1. 先看置顶说明\n2. 不讨论违法内容\n3. 不刷屏'
                                : 'Example:\n1. Read the pinned note first\n2. No illegal content\n3. No spam'
                            }
                            onChange={(e) =>
                              updateCommunityLink(entry.id, { rules: e.target.value })
                            }
                          />
                        </div>

                        <div className="grid gap-2">
                          <label className="text-sm font-medium">{isZh ? '备注' : 'Notes'}</label>
                          <textarea
                            className="min-h-[140px] w-full rounded-[22px] border border-[color:var(--border-subtle)] bg-[var(--surface-card)] px-4 py-3 text-sm text-zinc-50 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
                            value={entry.notes}
                            placeholder={
                              isZh
                                ? '例如：\n工作日白天回复更快\n新成员先自我介绍'
                                : 'Example:\nReplies are faster on weekdays\nNew members should introduce themselves first'
                            }
                            onChange={(e) =>
                              updateCommunityLink(entry.id, { notes: e.target.value })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Button className="gap-2" onClick={saveCommunityLinks} disabled={isSavingCommunities}>
                <Save className="w-4 h-4" />
                {isSavingCommunities
                  ? t('common.saving')
                  : isZh
                    ? '保存社区入口'
                    : 'Save community links'}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-500" />
                <CardTitle>{t('settings.security')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => toast(t('settings.passwordHint'), 'info')}
              >
                {t('settings.changeAdminPassword')}
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => toast(t('settings.twoFactorHint'), 'info')}
              >
                {t('settings.twoFactorAuth')}
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                onClick={handleClearSessions}
              >
                {t('settings.clearUserSessions')}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-500" />
                <CardTitle>{t('settings.maintenance')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={handleBackup}
              >
                {t('settings.backupDatabase')}
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={handleClearTraffic}
              >
                {t('settings.clearTrafficLogs')}
              </Button>
              <div className="space-y-2 border-t border-white/5 pt-4">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                  {t('settings.lastBackup')}
                </p>
                <p className="break-all text-xs text-zinc-400">
                  {lastBackupPath || t('settings.noBackup')}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
