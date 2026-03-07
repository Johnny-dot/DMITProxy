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
import { Save, Bell, Shield, Globe, Database, RefreshCw } from 'lucide-react';
import {
  AdminSettings,
  backupDatabase,
  clearPortalSessions,
  clearTrafficLogs,
  getAdminSettings,
  saveAdminSettings,
} from '@/src/api/client';
import { cn } from '@/src/utils/cn';
import { useI18n } from '@/src/context/I18nContext';

const DEFAULT_SETTINGS: AdminSettings = {
  siteName: 'Prism Admin',
  publicUrl: '',
  supportTelegram: '',
  announcementText: '',
  announcementActive: false,
};

export function SettingsPage() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);
  const [isSavingAnnouncement, setIsSavingAnnouncement] = useState(false);
  const [lastBackupPath, setLastBackupPath] = useState('');

  const load = async () => {
    setIsLoading(true);
    try {
      const data = await getAdminSettings();
      setSettings(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('settings.loadFailed');
      toast(message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateField = <K extends keyof AdminSettings>(key: K, value: AdminSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
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
        <Button variant="outline" size="icon" onClick={load}>
          <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
        </Button>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-6">
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
              <div className="pt-4 border-t border-white/5 space-y-2">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider">
                  {t('settings.lastBackup')}
                </p>
                <p className="text-xs text-zinc-400 break-all">
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
