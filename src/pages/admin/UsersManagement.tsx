import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Check, Users, Ticket, Link as LinkIcon, KeyRound, Copy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { Badge } from '@/src/components/ui/Badge';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { useToast } from '@/src/components/ui/Toast';
import { useI18n } from '@/src/context/I18nContext';
import { cn } from '@/src/utils/cn';

interface User {
  id: number;
  username: string;
  sub_id: string | null;
  created_at: number;
}
interface InviteCode {
  id: number;
  code: string;
  used_by_username: string | null;
  used_at: number | null;
  created_at: number;
}
interface SystemFlags {
  xuiAutoProvisionEnabled: boolean;
  xuiAutoProvisionCredentialsConfigured: boolean;
}
interface AppSettings {
  publicUrl?: string;
}

interface UsersManagementPageProps {
  embedded?: boolean;
}

export function UsersManagementPage({ embedded = false }: UsersManagementPageProps) {
  const { toast } = useToast();
  const { t } = useI18n();
  const [users, setUsers] = useState<User[]>([]);
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [editingSubId, setEditingSubId] = useState<{ id: number; value: string } | null>(null);
  const [systemFlags, setSystemFlags] = useState<SystemFlags | null>(null);
  const [publicBaseUrl, setPublicBaseUrl] = useState('');
  const [latestResetLink, setLatestResetLink] = useState<{
    username: string;
    link: string;
    expiresAt: number;
  } | null>(null);

  const portalBase = publicBaseUrl || (typeof window !== 'undefined' ? window.location.origin : '');

  async function load() {
    try {
      const [usersRes, codesRes] = await Promise.all([
        fetch('/local/admin/users', { credentials: 'include' }),
        fetch('/local/admin/invite', { credentials: 'include' }),
      ]);
      if (usersRes.ok) setUsers(await usersRes.json());
      if (codesRes.ok) setCodes(await codesRes.json());

      const flagsRes = await fetch('/local/admin/system', { credentials: 'include' });
      if (flagsRes.ok) setSystemFlags(await flagsRes.json());

      const settingsRes = await fetch('/local/admin/settings', { credentials: 'include' });
      if (settingsRes.ok) {
        const settings = (await settingsRes.json()) as AppSettings;
        const normalized = String(settings?.publicUrl ?? '')
          .trim()
          .replace(/\/+$/, '');
        setPublicBaseUrl(normalized);
      }
    } catch {
      toast(t('userAccounts.failedLoad'), 'error');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createInvite() {
    try {
      const res = await fetch('/local/admin/invite', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 1 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(t('userAccounts.inviteCreated', { code: data.codes[0] }), 'success');
      load();
    } catch {
      toast(t('userAccounts.inviteCreateFailed'), 'error');
    }
  }

  async function deleteCode(id: number) {
    await fetch(`/local/admin/invite/${id}`, { method: 'DELETE', credentials: 'include' });
    setCodes((prev) => prev.filter((code) => code.id !== id));
    toast(t('userAccounts.inviteDeleted'), 'success');
  }

  async function saveSubId(userId: number, subId: string) {
    try {
      const res = await fetch(`/local/admin/users/${userId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subId: subId || null }),
      });
      if (!res.ok) throw new Error();
      setUsers((prev) =>
        prev.map((user) => (user.id === userId ? { ...user, sub_id: subId || null } : user)),
      );
      setEditingSubId(null);
      toast(t('userAccounts.subAssigned'), 'success');
    } catch {
      toast(t('userAccounts.saveFailed'), 'error');
    }
  }

  async function generateResetLink(userId: number, username: string) {
    try {
      const res = await fetch(`/local/admin/users/${userId}/password-reset`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? t('userAccounts.resetLinkCreateFailed'));
      const token = String(data?.token ?? '').trim();
      if (!token) throw new Error(t('userAccounts.resetLinkCreateFailed'));

      const link = `${portalBase}/reset-password?token=${encodeURIComponent(token)}`;
      const expiresAt = Number(data?.expiresAt ?? 0);
      setLatestResetLink({ username, link, expiresAt });

      try {
        await navigator.clipboard.writeText(link);
        toast(
          t('userAccounts.resetLinkCopied', {
            username,
            expiresAt: expiresAt > 0 ? new Date(expiresAt * 1000).toLocaleString() : '-',
          }),
          'success',
        );
      } catch {
        toast(t('userAccounts.resetLinkCreated'), 'info');
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('userAccounts.resetLinkCreateFailed');
      toast(message, 'error');
    }
  }

  async function deleteUser(userId: number, username: string) {
    const confirmed = window.confirm(t('userAccounts.deleteUserConfirm', { username }));
    if (!confirmed) return;

    try {
      const res = await fetch(`/local/admin/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? t('userAccounts.userDeleteFailed'));
      setUsers((prev) => prev.filter((user) => user.id !== userId));
      // Refresh invite list because used invite records may be removed along with the user.
      load();
      toast(t('userAccounts.userDeleted', { username }), 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : t('userAccounts.userDeleteFailed');
      toast(message, 'error');
    }
  }

  function copyInviteLink(code: string, id: number) {
    const link = `${portalBase}/register?invite=${code}`;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="w-full min-w-0 space-y-8">
      <div className={cn(!embedded && 'surface-card space-y-3 p-6 md:p-7')}>
        {!embedded && (
          <>
            <h1 className="text-3xl font-bold tracking-tight">{t('userAccounts.title')}</h1>
            <p className="mt-1 text-[var(--text-secondary)]">{t('userAccounts.subtitle')}</p>
          </>
        )}
        <div
          className={cn(
            'glass-pill inline-flex flex-wrap items-center gap-2 p-3 text-xs',
            embedded ? '' : 'mt-3',
          )}
        >
          <span className="text-[var(--text-secondary)]">{t('userAccounts.autoProvision')}:</span>
          <Badge variant={systemFlags?.xuiAutoProvisionEnabled ? 'success' : 'secondary'}>
            {systemFlags?.xuiAutoProvisionEnabled
              ? t('userAccounts.autoProvisionEnabled')
              : t('userAccounts.autoProvisionDisabled')}
          </Badge>
          {systemFlags?.xuiAutoProvisionEnabled &&
            !systemFlags?.xuiAutoProvisionCredentialsConfigured && (
              <span className="text-amber-500">{t('userAccounts.autoProvisionMissingCreds')}</span>
            )}
          {!systemFlags?.xuiAutoProvisionEnabled && (
            <span className="text-[var(--text-secondary)]">
              {t('userAccounts.autoProvisionOff')}
            </span>
          )}
          {systemFlags?.xuiAutoProvisionEnabled &&
            systemFlags?.xuiAutoProvisionCredentialsConfigured && (
              <span className="text-emerald-500">{t('userAccounts.autoProvisionReady')}</span>
            )}
        </div>
      </div>

      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Ticket className="w-5 h-5 text-[var(--text-secondary)]" />
              {t('userAccounts.inviteCodes')}
            </CardTitle>
            <Button size="sm" className="gap-2" onClick={createInvite}>
              <Plus className="w-4 h-4" />
              {t('userAccounts.generate')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : codes.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--text-secondary)]">
              {t('userAccounts.noInviteCodes')}
            </p>
          ) : (
            <div className="space-y-2">
              {codes.map((code) => (
                <div
                  key={code.id}
                  className="surface-panel flex items-center justify-between px-4 py-3"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-3">
                      <code className="text-sm font-mono text-emerald-400">{code.code}</code>
                      {code.used_by_username ? (
                        <Badge variant="secondary">
                          {t('userAccounts.usedBy', { username: code.used_by_username })}
                        </Badge>
                      ) : (
                        <Badge variant="success">{t('userAccounts.available')}</Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      {t('userAccounts.inviteCreatedAt', {
                        date: new Date(code.created_at * 1000).toLocaleString(),
                      })}
                      {' · '}
                      {code.used_at
                        ? t('userAccounts.inviteUsedAt', {
                            date: new Date(code.used_at * 1000).toLocaleString(),
                          })
                        : t('userAccounts.inviteUnused')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!code.used_by_username && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title={t('userAccounts.copyInviteLink')}
                          onClick={() => copyInviteLink(code.code, code.id)}
                        >
                          {copiedId === code.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <LinkIcon className="w-3.5 h-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:bg-red-500/10"
                          onClick={() => deleteCode(code.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[var(--text-secondary)]" />
            {t('userAccounts.registeredUsers')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--text-secondary)]">
              {t('userAccounts.noUsers')}
            </p>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="surface-panel flex flex-col justify-between gap-3 px-4 py-3 sm:flex-row sm:items-center"
                >
                  <div>
                    <p className="font-medium">{user.username}</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {t('userAccounts.joined', {
                        date: new Date(user.created_at * 1000).toLocaleDateString(),
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-1 sm:max-w-xs">
                    {editingSubId?.id === user.id ? (
                      <>
                        <Input
                          className="h-8 text-xs font-mono"
                          placeholder={t('userAccounts.subIdPlaceholder')}
                          value={editingSubId.value}
                          onChange={(e) => setEditingSubId({ id: user.id, value: e.target.value })}
                          autoFocus
                        />
                        <Button
                          size="sm"
                          className="h-8 px-3"
                          onClick={() => saveSubId(user.id, editingSubId.value)}
                        >
                          {t('common.save')}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-3"
                          onClick={() => setEditingSubId(null)}
                        >
                          {t('common.cancel')}
                        </Button>
                      </>
                    ) : (
                      <>
                        {user.sub_id ? (
                          <code className="flex-1 truncate font-mono text-xs text-[var(--text-secondary)]">
                            {user.sub_id}
                          </code>
                        ) : (
                          <span className="flex-1 text-xs text-[var(--text-tertiary)]">
                            {t('userAccounts.noSubAssigned')}
                          </span>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-3 text-xs shrink-0"
                          onClick={() => setEditingSubId({ id: user.id, value: user.sub_id ?? '' })}
                        >
                          {user.sub_id ? t('userAccounts.change') : t('userAccounts.assignSubId')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-3 text-xs shrink-0 gap-1"
                          onClick={() => generateResetLink(user.id, user.username)}
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          {t('userAccounts.generateResetLink')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-3 text-xs shrink-0 gap-1 text-red-400 border-red-500/30 hover:bg-red-500/10"
                          onClick={() => deleteUser(user.id, user.username)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {t('userAccounts.deleteUser')}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 text-xs text-[var(--text-tertiary)]">
            {t('userAccounts.registrationTip')}
          </p>
          {latestResetLink && (
            <div className="surface-panel mt-4 space-y-2 p-3">
              <p className="text-xs text-[var(--text-secondary)]">
                {t('userAccounts.latestResetLink', {
                  username: latestResetLink.username,
                  expiresAt:
                    latestResetLink.expiresAt > 0
                      ? new Date(latestResetLink.expiresAt * 1000).toLocaleString()
                      : '-',
                })}
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate font-mono text-xs text-[var(--text-primary)]">
                  {latestResetLink.link}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-xs shrink-0 gap-1"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(latestResetLink.link);
                      toast(t('userAccounts.linkCopied'), 'success');
                    } catch {
                      toast(t('userAccounts.resetLinkCreateFailed'), 'error');
                    }
                  }}
                >
                  <Copy className="w-3.5 h-3.5" />
                  {t('common.copy')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
