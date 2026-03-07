import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  CheckCircle2,
  Globe,
  Palette,
  RefreshCw,
  Settings,
  Shield,
  User,
  XCircle,
  Key,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { Badge } from '@/src/components/ui/Badge';
import { useToast } from '@/src/components/ui/Toast';
import { useI18n } from '@/src/context/I18nContext';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { getServerStatus } from '@/src/api/client';
import { cn } from '@/src/utils/cn';

// ---------------------------------------------------------------------------
// Admin profile data (from /local/admin/profile)
// ---------------------------------------------------------------------------
interface AdminProfile {
  username: string;
  role: 'admin';
  sessionMode: 'xui-cookie' | string;
  xuiServer: string;
  xuiBasePath: string;
}

const DISPLAY_NAME_KEY = 'prism:admin-display-name';

// ---------------------------------------------------------------------------
// Preferences card — shared by both roles
// ---------------------------------------------------------------------------
function PreferencesCard() {
  const { t, language, setLanguage } = useI18n();
  const { theme, setTheme } = useTheme();
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Palette className="w-5 h-5 text-emerald-500" />
          <CardTitle>{t('profile.preferences')}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-zinc-500">{t('profile.language')}</p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={language === 'zh-CN' ? 'secondary' : 'outline'}
              onClick={() => setLanguage('zh-CN')}
            >
              {t('common.zh')}
            </Button>
            <Button
              size="sm"
              variant={language === 'en-US' ? 'secondary' : 'outline'}
              onClick={() => setLanguage('en-US')}
            >
              {t('common.en')}
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-zinc-500">{t('profile.theme')}</p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={theme === 'dark' ? 'secondary' : 'outline'}
              onClick={() => setTheme('dark')}
            >
              {t('profile.dark')}
            </Button>
            <Button
              size="sm"
              variant={theme === 'light' ? 'secondary' : 'outline'}
              onClick={() => setTheme('light')}
            >
              {t('profile.light')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// User profile view
// ---------------------------------------------------------------------------
function UserProfileView() {
  const { username } = useAuth();
  const { t, language } = useI18n();
  const navigate = useNavigate();
  const isZh = language === 'zh-CN';

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-500" />
            <CardTitle>{isZh ? '账号信息' : 'Account'}</CardTitle>
          </div>
          <CardDescription>
            {isZh ? '你的个人账号详情' : 'Your personal account details'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-semibold text-lg">
              {(username ?? '?').slice(0, 1).toUpperCase()}
            </div>
            <div className="space-y-1">
              <p className="font-medium">{username}</p>
              <Badge variant="secondary">{isZh ? '用户' : 'User'}</Badge>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-zinc-900/40 p-3">
            <p className="text-[11px] uppercase tracking-wider text-zinc-500">
              {isZh ? '账号名称' : 'Username'}
            </p>
            <p className="text-sm mt-1 font-mono">{username ?? '-'}</p>
          </div>

          <div className="pt-2 border-t border-white/10">
            <Button
              variant="outline"
              className="gap-2 w-full sm:w-auto"
              onClick={() => navigate('/my-subscription')}
            >
              <Key className="w-4 h-4" />
              {isZh ? '查看我的订阅' : 'View my subscription'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <PreferencesCard />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Admin profile view (original content)
// ---------------------------------------------------------------------------
function AdminProfileView() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingHealth, setIsCheckingHealth] = useState(true);
  const [isHealthy, setIsHealthy] = useState(false);
  const [healthMessage, setHealthMessage] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');

  const displayName = useMemo(() => {
    return displayNameInput.trim() || profile?.username || t('profile.displayNameFallback');
  }, [displayNameInput, profile?.username, t]);

  async function checkHealth() {
    setIsCheckingHealth(true);
    try {
      await getServerStatus();
      setIsHealthy(true);
      setHealthMessage(t('profile.healthOk'));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('profile.healthError');
      setIsHealthy(false);
      setHealthMessage(message);
    } finally {
      setIsCheckingHealth(false);
    }
  }

  async function loadProfile() {
    setIsLoading(true);
    try {
      const storedName = window.localStorage.getItem(DISPLAY_NAME_KEY) ?? '';
      setDisplayNameInput(storedName);
      const res = await fetch('/local/admin/profile', { credentials: 'include' });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error(data?.error ?? t('profile.loadFailed'));
      setProfile(data as AdminProfile);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('profile.loadFailed');
      toast(message, 'error');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
    checkHealth();
  }, []);

  function saveDisplayName() {
    window.localStorage.setItem(DISPLAY_NAME_KEY, displayNameInput.trim());
    toast(t('profile.displayNameSaved'), 'success');
  }

  if (isLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-zinc-700 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-500" />
            <CardTitle>{t('profile.adminAccount')}</CardTitle>
          </div>
          <CardDescription>{t('profile.accountDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-semibold">
              {displayName.slice(0, 1).toUpperCase()}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">{displayName}</p>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{t('profile.roleAdmin')}</Badge>
                <span className="text-xs text-zinc-500">{profile?.username ?? '-'}</span>
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">{t('profile.displayName')}</label>
            <Input
              value={displayNameInput}
              placeholder={profile?.username || ''}
              onChange={(event) => setDisplayNameInput(event.target.value)}
            />
            <p className="text-xs text-zinc-500">{t('profile.displayNameHint')}</p>
            <div>
              <Button size="sm" className="gap-1.5" onClick={saveDisplayName}>
                {t('profile.saveDisplayName')}
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-white/10 bg-zinc-900/40 p-3">
              <p className="text-[11px] uppercase tracking-wider text-zinc-500">
                {t('profile.sessionMode')}
              </p>
              <p className="text-sm mt-1">{t('profile.sessionModeValue')}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-zinc-900/40 p-3">
              <p className="text-[11px] uppercase tracking-wider text-zinc-500">
                {t('profile.username')}
              </p>
              <p className="text-sm mt-1 break-all">{profile?.username || '-'}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-zinc-900/40 p-3 md:col-span-2">
              <p className="text-[11px] uppercase tracking-wider text-zinc-500">
                {t('profile.xuiServer')}
              </p>
              <p className="text-sm mt-1 break-all">{profile?.xuiServer || '-'}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-zinc-900/40 p-3 md:col-span-2">
              <p className="text-[11px] uppercase tracking-wider text-zinc-500">
                {t('profile.xuiBasePath')}
              </p>
              <p className="text-sm mt-1 break-all">{profile?.xuiBasePath || '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <PreferencesCard />

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-500" />
              <CardTitle>{t('profile.systemHealth')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {isCheckingHealth ? (
              <div className="text-sm text-zinc-400">{t('profile.healthChecking')}</div>
            ) : (
              <div
                className={cn(
                  'text-sm flex items-start gap-2',
                  isHealthy ? 'text-emerald-400' : 'text-red-400',
                )}
              >
                {isHealthy ? (
                  <CheckCircle2 className="w-4 h-4 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 mt-0.5" />
                )}
                <span>
                  {healthMessage || (isHealthy ? t('profile.healthOk') : t('profile.healthError'))}
                </span>
              </div>
            )}
            <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={checkHealth}>
              <RefreshCw className={cn('w-3.5 h-3.5', isCheckingHealth && 'animate-spin')} />
              {t('profile.refreshHealth')}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-violet-500" />
              <CardTitle>{t('profile.quickActions')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => navigate('/settings')}
            >
              <Settings className="w-4 h-4" />
              {t('profile.goSettings')}
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => navigate('/subscriptions')}
            >
              <Globe className="w-4 h-4" />
              {t('profile.goSubscriptions')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export — renders different view based on role
// ---------------------------------------------------------------------------
export function ProfilePage() {
  const { role } = useAuth();
  const { t, language } = useI18n();
  const navigate = useNavigate();
  const isZh = language === 'zh-CN';

  const isAdmin = role !== 'user';

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('profile.title')}</h1>
          <p className="text-zinc-400 mt-1">
            {isAdmin
              ? t('profile.subtitle')
              : isZh
                ? '查看你的账号信息与偏好设置'
                : 'View your account info and preferences'}
          </p>
        </div>
        {isAdmin && (
          <Button variant="outline" size="icon" onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        )}
      </div>

      {isAdmin ? <AdminProfileView /> : <UserProfileView />}
    </div>
  );
}
