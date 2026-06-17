import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Check,
  Users,
  Link as LinkIcon,
  KeyRound,
  Copy,
  Edit2,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/Card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/src/components/ui/Table';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { Badge } from '@/src/components/ui/Badge';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { useToast } from '@/src/components/ui/Toast';
import { useI18n } from '@/src/context/I18nContext';
import { cn } from '@/src/utils/cn';
import { getInbounds, getOnlineClients, Inbound } from '@/src/api/client';
import { updateInboundClient } from '@/src/api/xui';
import { flattenInboundClients, formatExpiry, formatTraffic } from '@/src/utils/xuiClients';

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

type SortKey = 'username' | 'joined' | 'status' | 'traffic' | 'expiry' | 'subId';
type SortState = { key: SortKey; dir: 'asc' | 'desc' } | null;

type ClientRow = ReturnType<typeof flattenInboundClients>[number];

const BYTES_PER_GB = 1024 ** 3;

function toDatetimeLocal(expiryTime: number): string {
  if (!Number.isFinite(expiryTime) || expiryTime <= 0) return '';
  const local = new Date(expiryTime - new Date(expiryTime).getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function parseDatetimeLocal(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const ms = new Date(trimmed).getTime();
  return Number.isNaN(ms) ? NaN : ms;
}

interface EditState {
  id: number;
  subId: string;
  trafficGb: string;
  expiryLocal: string;
  enable: boolean;
  client: ClientRow | null;
}

// Combined inline editor: sub-id link plus the 3X-UI client's expiry / traffic cap / enable,
// reused by both the desktop table row and the mobile card.
function UserEditForm({
  state,
  onChange,
  onSave,
  onCancel,
  isZh,
  subIdPlaceholder,
  saveLabel,
  cancelLabel,
}: {
  state: EditState;
  onChange: (patch: Partial<EditState>) => void;
  onSave: () => void;
  onCancel: () => void;
  isZh: boolean;
  subIdPlaceholder: string;
  saveLabel: string;
  cancelLabel: string;
}) {
  const fieldLabel = 'space-y-1 text-xs text-[var(--text-secondary)]';
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={fieldLabel}>
          <span>{isZh ? '订阅 ID' : 'Sub ID'}</span>
          <Input
            className="h-9 font-mono"
            placeholder={subIdPlaceholder}
            value={state.subId}
            onChange={(e) => onChange({ subId: e.target.value })}
            autoFocus
          />
        </label>
        {state.client ? (
          <>
            <label className={fieldLabel}>
              <span>{isZh ? '流量上限(GB,0 = 不限)' : 'Traffic cap (GB, 0 = unlimited)'}</span>
              <Input
                className="h-9"
                type="number"
                min="0"
                inputMode="decimal"
                value={state.trafficGb}
                onChange={(e) => onChange({ trafficGb: e.target.value })}
              />
            </label>
            <label className={fieldLabel}>
              <span>{isZh ? '到期(留空 = 永不)' : 'Expiry (empty = never)'}</span>
              <input
                type="datetime-local"
                className="h-9 w-full rounded-[14px] border border-[color:var(--border-subtle)] bg-[var(--surface-card)] px-3 text-base text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] sm:text-sm"
                value={state.expiryLocal}
                onChange={(e) => onChange({ expiryLocal: e.target.value })}
              />
            </label>
            <label className="flex items-center gap-2 self-end pb-1.5 text-sm text-[var(--text-primary)]">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--accent)]"
                checked={state.enable}
                onChange={(e) => onChange({ enable: e.target.checked })}
              />
              <span>{isZh ? '启用' : 'Enabled'}</span>
            </label>
          </>
        ) : (
          <p className="self-center text-xs text-[var(--text-tertiary)]">
            {isZh ? '关联订阅 ID 后可改到期与流量' : 'Link a sub ID to edit expiry & traffic'}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" className="h-9 px-4" onClick={onSave}>
          {saveLabel}
        </Button>
        <Button size="sm" variant="ghost" className="h-9 px-4" onClick={onCancel}>
          {cancelLabel}
        </Button>
      </div>
    </div>
  );
}

function SortableHead({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  sort: SortState;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const dir = sort && sort.key === sortKey ? sort.dir : null;
  return (
    <TableHead
      className={className}
      aria-sort={dir ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 rounded transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
      >
        <span>{label}</span>
        {dir === 'desc' ? (
          <ArrowDown className="h-3 w-3" />
        ) : dir === 'asc' ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </TableHead>
  );
}

export function UsersManagementPage({ embedded = false }: UsersManagementPageProps) {
  const { toast } = useToast();
  const { t, language } = useI18n();
  const isZh = language === 'zh-CN';
  const [users, setUsers] = useState<User[]>([]);
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [inbounds, setInbounds] = useState<Inbound[]>([]);
  const [onlineEmails, setOnlineEmails] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [editingSubId, setEditingSubId] = useState<EditState | null>(null);
  const [systemFlags, setSystemFlags] = useState<SystemFlags | null>(null);
  const [publicBaseUrl, setPublicBaseUrl] = useState('');
  const [latestResetLink, setLatestResetLink] = useState<{
    username: string;
    link: string;
    expiresAt: number;
  } | null>(null);

  const portalBase = publicBaseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  const pendingCodes = codes.filter((code) => !code.used_by_username);

  // Join each portal account to its 3X-UI client(s) by sub_id, so the unified view shows
  // real usage (online / traffic / expiry) next to the account — no separate "用户" tab needed.
  const clientStatsBySubId = useMemo(() => {
    const onlineSet = new Set(onlineEmails.map((e) => e.trim().toLowerCase()).filter(Boolean));
    const map = new Map<
      string,
      { used: number; total: number; expiryTime: number; online: boolean }
    >();
    for (const client of flattenInboundClients(inbounds)) {
      const sid = (client.subId ?? '').trim().toLowerCase();
      if (!sid) continue;
      const email = (client.email ?? '').trim().toLowerCase();
      const prev = map.get(sid) ?? { used: 0, total: 0, expiryTime: 0, online: false };
      map.set(sid, {
        used: prev.used + client.up + client.down,
        total: prev.total + (client.totalGB || 0),
        expiryTime: prev.expiryTime || client.expiryTime || 0,
        online: prev.online || (email ? onlineSet.has(email) : false),
      });
    }
    return map;
  }, [inbounds, onlineEmails]);

  const statsFor = (user: User) => {
    const sid = user.sub_id?.trim().toLowerCase();
    return sid ? clientStatsBySubId.get(sid) : undefined;
  };

  // Full client row (carries inboundId / clientId / rawClient) for editing expiry & traffic.
  const clientRowBySubId = useMemo(() => {
    const map = new Map<string, ClientRow>();
    for (const client of flattenInboundClients(inbounds)) {
      const sid = (client.subId ?? '').trim().toLowerCase();
      if (sid && !map.has(sid)) map.set(sid, client);
    }
    return map;
  }, [inbounds]);
  const clientFor = (user: User) => {
    const sid = user.sub_id?.trim().toLowerCase();
    return sid ? clientRowBySubId.get(sid) : undefined;
  };
  const openEdit = (user: User) => {
    const c = clientFor(user);
    setEditingSubId({
      id: user.id,
      subId: user.sub_id ?? '',
      trafficGb:
        c && c.totalGB > 0 ? String(Math.round((c.totalGB / BYTES_PER_GB) * 100) / 100) : '',
      expiryLocal: c ? toDatetimeLocal(c.expiryTime) : '',
      enable: c ? c.enable : true,
      client: c ?? null,
    });
  };

  // Header-click sorting: first click sorts descending (e.g. most traffic first);
  // clicking the same header again flips to ascending.
  const [sort, setSort] = useState<SortState>(null);
  const toggleSort = (key: SortKey) => {
    setSort((prev) =>
      prev?.key === key ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' },
    );
  };

  const sortedUsers = useMemo(() => {
    if (!sort) return users;
    const rank = (user: User): number | string => {
      switch (sort.key) {
        case 'username':
          return user.username.toLowerCase();
        case 'joined':
          return user.created_at;
        case 'status': {
          const stats = statsFor(user);
          return stats ? (stats.online ? 2 : 1) : 0;
        }
        case 'traffic':
          return statsFor(user)?.used ?? -1;
        case 'expiry':
          return statsFor(user)?.expiryTime ?? -1;
        case 'subId':
          return (user.sub_id ?? '').toLowerCase();
      }
    };
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...users].sort((a, b) => {
      const va = rank(a);
      const vb = rank(b);
      const cmp =
        typeof va === 'string' && typeof vb === 'string'
          ? va.localeCompare(vb)
          : Number(va) - Number(vb);
      return cmp * factor;
    });
  }, [users, sort, clientStatsBySubId]);

  async function load() {
    try {
      const [usersRes, codesRes] = await Promise.all([
        fetch('/local/admin/users', { credentials: 'include' }),
        fetch('/local/admin/invite', { credentials: 'include' }),
      ]);
      if (usersRes.ok) setUsers(await usersRes.json());
      if (codesRes.ok) setCodes(await codesRes.json());

      const [inboundData, onlineData] = await Promise.all([
        getInbounds().catch(() => [] as Inbound[]),
        getOnlineClients().catch(() => [] as string[]),
      ]);
      setInbounds(inboundData);
      setOnlineEmails(onlineData);

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

  async function saveUser() {
    const edit = editingSubId;
    if (!edit) return;

    let totalBytes = 0;
    let expiryTime = 0;
    if (edit.client) {
      const trafficGb = Number(edit.trafficGb.trim() || '0');
      if (!Number.isFinite(trafficGb) || trafficGb < 0) {
        toast(t('userAccounts.saveFailed'), 'error');
        return;
      }
      expiryTime = parseDatetimeLocal(edit.expiryLocal);
      if (Number.isNaN(expiryTime)) {
        toast(t('userAccounts.saveFailed'), 'error');
        return;
      }
      totalBytes = trafficGb > 0 ? Math.round(trafficGb * BYTES_PER_GB) : 0;
    }

    try {
      const current = users.find((u) => u.id === edit.id);
      const nextSubId = edit.subId.trim() || null;
      if (nextSubId !== (current?.sub_id ?? null)) {
        const res = await fetch(`/local/admin/users/${edit.id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subId: nextSubId }),
        });
        if (!res.ok) throw new Error();
        setUsers((prev) => prev.map((u) => (u.id === edit.id ? { ...u, sub_id: nextSubId } : u)));
      }
      if (edit.client) {
        await updateInboundClient({
          inboundId: edit.client.inboundId,
          clientId: edit.client.clientId,
          client: {
            ...edit.client.rawClient,
            enable: edit.enable,
            totalGB: totalBytes,
            expiryTime,
          },
        });
      }
      setEditingSubId(null);
      await load();
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
    <div
      className={cn(
        'w-full min-w-0 space-y-6',
        !embedded && 'content-shell-wide reveal-stagger px-4 md:px-6 xl:px-8',
      )}
    >
      {!embedded && (
        <section className="surface-card space-y-3 p-6 md:p-7">
          <p className="section-kicker">{t('userAccounts.title')}</p>
          <h1 className="text-3xl font-semibold tracking-tight">{t('userAccounts.title')}</h1>
          <p className="max-w-3xl text-sm leading-7 text-zinc-400">{t('userAccounts.subtitle')}</p>
        </section>
      )}

      <Card className="w-full">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-3">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[var(--text-secondary)]" />
                {isZh ? '用户与邀请' : 'Users & invites'}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  {users.length} {isZh ? '已注册' : 'registered'}
                </Badge>
                <Badge variant={pendingCodes.length ? 'success' : 'secondary'}>
                  {pendingCodes.length} {isZh ? '待接受邀请' : 'pending'}
                </Badge>
                <Badge variant={systemFlags?.xuiAutoProvisionEnabled ? 'success' : 'secondary'}>
                  {t('userAccounts.autoProvision')}:{' '}
                  {systemFlags?.xuiAutoProvisionEnabled
                    ? t('userAccounts.autoProvisionEnabled')
                    : t('userAccounts.autoProvisionDisabled')}
                </Badge>
                {systemFlags?.xuiAutoProvisionEnabled &&
                  !systemFlags?.xuiAutoProvisionCredentialsConfigured && (
                    <span className="text-xs text-amber-500">
                      {t('userAccounts.autoProvisionMissingCreds')}
                    </span>
                  )}
              </div>
            </div>
            <Button size="sm" className="gap-2" onClick={createInvite}>
              <Plus className="w-4 h-4" />
              {t('userAccounts.generate')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : (
            <>
              {pendingCodes.length > 0 && (
                <div className="space-y-2">
                  <p className="section-kicker">
                    {isZh ? '待接受的邀请' : 'Pending invites'} · {pendingCodes.length}
                  </p>
                  {pendingCodes.map((code) => (
                    <div
                      key={code.id}
                      className="surface-panel flex items-center justify-between px-4 py-3"
                    >
                      <div className="min-w-0 space-y-1.5">
                        <code className="font-mono text-sm text-emerald-400">{code.code}</code>
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          {t('userAccounts.inviteCreatedAt', {
                            date: new Date(code.created_at * 1000).toLocaleString(),
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title={t('userAccounts.copyInviteLink')}
                          onClick={() => copyInviteLink(code.code, code.id)}
                        >
                          {copiedId === code.id ? (
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <LinkIcon className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:bg-red-500/10"
                          onClick={() => deleteCode(code.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-3">
                <p className="section-kicker">
                  {isZh ? '已注册用户' : 'Registered users'} · {users.length}
                </p>
                {users.length === 0 ? (
                  <EmptyState icon={Users} title={t('userAccounts.noUsers')} description="" />
                ) : (
                  <>
                    {/* Mobile: a sortable card per user — the 7-column table is unusable on a phone. */}
                    <div className="space-y-3 md:hidden">
                      <div className="flex items-center gap-2">
                        <select
                          aria-label={isZh ? '排序方式' : 'Sort by'}
                          value={sort?.key ?? 'joined'}
                          onChange={(e) => toggleSort(e.target.value as SortKey)}
                          className="h-9 flex-1 rounded-[14px] border border-[color:var(--border-subtle)] bg-[var(--surface-card)] px-3 text-base text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] sm:text-sm"
                        >
                          <option value="joined">{isZh ? '注册时间' : 'Joined'}</option>
                          <option value="username">{isZh ? '用户名' : 'User'}</option>
                          <option value="status">{isZh ? '状态' : 'Status'}</option>
                          <option value="traffic">{isZh ? '流量' : 'Traffic'}</option>
                          <option value="expiry">{isZh ? '到期' : 'Expires'}</option>
                        </select>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 shrink-0 gap-1.5"
                          onClick={() => toggleSort(sort?.key ?? 'joined')}
                        >
                          {sort?.dir === 'asc' ? (
                            <ArrowUp className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5" />
                          )}
                          {sort?.dir === 'asc' ? (isZh ? '升序' : 'Asc') : isZh ? '降序' : 'Desc'}
                        </Button>
                      </div>

                      {sortedUsers.map((user) => {
                        const stats = statsFor(user);
                        const pct =
                          stats && stats.total > 0
                            ? Math.min((stats.used / stats.total) * 100, 100)
                            : 0;
                        const editing = editingSubId?.id === user.id ? editingSubId : null;
                        const assignLabel = user.sub_id
                          ? t('userAccounts.change')
                          : t('userAccounts.assignSubId');
                        return (
                          <div key={user.id} className="surface-panel space-y-3 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate font-medium text-[var(--text-primary)]">
                                  {user.username}
                                </p>
                                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                                  {isZh ? '注册' : 'Joined'}{' '}
                                  {new Date(user.created_at * 1000).toLocaleDateString()}
                                </p>
                              </div>
                              {stats ? (
                                <Badge variant={stats.online ? 'success' : 'secondary'}>
                                  {stats.online
                                    ? isZh
                                      ? '在线'
                                      : 'Online'
                                    : isZh
                                      ? '离线'
                                      : 'Offline'}
                                </Badge>
                              ) : (
                                <Badge variant="secondary">{isZh ? '未开通' : 'No client'}</Badge>
                              )}
                            </div>

                            {stats ? (
                              <div className="space-y-1.5">
                                <div className="flex justify-between font-mono text-[11px] tabular-nums text-[var(--text-secondary)]">
                                  <span>{formatTraffic(stats.used)}</span>
                                  <span>
                                    {stats.total > 0
                                      ? formatTraffic(stats.total)
                                      : t('common.unlimited')}
                                  </span>
                                </div>
                                <div className="glass-progress-track h-1.5 w-full overflow-hidden">
                                  <div
                                    className={cn(
                                      'h-full rounded-full transition-all duration-500',
                                      pct < 70
                                        ? 'bg-emerald-500'
                                        : pct < 90
                                          ? 'bg-yellow-500'
                                          : 'bg-red-500',
                                    )}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            ) : null}

                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)]">
                              <span>
                                {isZh ? '到期' : 'Expires'}{' '}
                                {stats && stats.expiryTime > 0
                                  ? formatExpiry(stats.expiryTime)
                                  : '—'}
                              </span>
                              <span className="inline-flex min-w-0 items-center gap-1">
                                <span>{isZh ? '订阅' : 'Sub'}</span>
                                {user.sub_id ? (
                                  <code className="truncate font-mono text-[var(--text-tertiary)]">
                                    {user.sub_id}
                                  </code>
                                ) : (
                                  <span className="text-[var(--text-tertiary)]">
                                    {t('userAccounts.noSubAssigned')}
                                  </span>
                                )}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 border-t border-[color:var(--border-subtle)] pt-3">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-9 flex-1 gap-1.5"
                                onClick={() => openEdit(user)}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                                {assignLabel}
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-9 w-9"
                                title={t('userAccounts.generateResetLink')}
                                aria-label={t('userAccounts.generateResetLink')}
                                onClick={() => generateResetLink(user.id, user.username)}
                              >
                                <KeyRound className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-9 w-9 text-red-500 hover:bg-red-500/10"
                                title={t('userAccounts.deleteUser')}
                                aria-label={t('userAccounts.deleteUser')}
                                onClick={() => deleteUser(user.id, user.username)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>

                            {editing && (
                              <div className="border-t border-[color:var(--border-subtle)] pt-3">
                                <UserEditForm
                                  state={editing}
                                  onChange={(patch) =>
                                    setEditingSubId((prev) => (prev ? { ...prev, ...patch } : prev))
                                  }
                                  onSave={saveUser}
                                  onCancel={() => setEditingSubId(null)}
                                  isZh={isZh}
                                  subIdPlaceholder={t('userAccounts.subIdPlaceholder')}
                                  saveLabel={t('common.save')}
                                  cancelLabel={t('common.cancel')}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="hidden md:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <SortableHead
                              label={isZh ? '用户' : 'User'}
                              sortKey="username"
                              sort={sort}
                              onSort={toggleSort}
                            />
                            <SortableHead
                              label={isZh ? '注册时间' : 'Joined'}
                              sortKey="joined"
                              sort={sort}
                              onSort={toggleSort}
                              className="hidden md:table-cell"
                            />
                            <SortableHead
                              label={isZh ? '状态' : 'Status'}
                              sortKey="status"
                              sort={sort}
                              onSort={toggleSort}
                            />
                            <SortableHead
                              label={isZh ? '流量' : 'Traffic'}
                              sortKey="traffic"
                              sort={sort}
                              onSort={toggleSort}
                            />
                            <SortableHead
                              label={isZh ? '到期' : 'Expires'}
                              sortKey="expiry"
                              sort={sort}
                              onSort={toggleSort}
                              className="hidden lg:table-cell"
                            />
                            <SortableHead
                              label={isZh ? '订阅 ID' : 'Sub ID'}
                              sortKey="subId"
                              sort={sort}
                              onSort={toggleSort}
                              className="hidden xl:table-cell"
                            />
                            <TableHead className="text-right">
                              {isZh ? '操作' : 'Actions'}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedUsers.map((user) => {
                            const stats = statsFor(user);
                            const pct =
                              stats && stats.total > 0
                                ? Math.min((stats.used / stats.total) * 100, 100)
                                : 0;
                            const editing = editingSubId?.id === user.id ? editingSubId : null;
                            const assignLabel = user.sub_id
                              ? t('userAccounts.change')
                              : t('userAccounts.assignSubId');
                            return (
                              <React.Fragment key={user.id}>
                                <TableRow>
                                  <TableCell className="max-w-[240px] font-medium">
                                    <span className="block truncate">{user.username}</span>
                                  </TableCell>
                                  <TableCell className="hidden text-xs text-[var(--text-secondary)] md:table-cell">
                                    {new Date(user.created_at * 1000).toLocaleDateString()}
                                  </TableCell>
                                  <TableCell>
                                    {stats ? (
                                      <Badge variant={stats.online ? 'success' : 'secondary'}>
                                        {stats.online
                                          ? isZh
                                            ? '在线'
                                            : 'Online'
                                          : isZh
                                            ? '离线'
                                            : 'Offline'}
                                      </Badge>
                                    ) : (
                                      <Badge variant="secondary">
                                        {isZh ? '未开通' : 'No client'}
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {stats ? (
                                      <div className="flex min-w-[150px] max-w-[240px] flex-col gap-1.5">
                                        <div className="flex justify-between font-mono text-[10px] tabular-nums text-[var(--text-secondary)]">
                                          <span>{formatTraffic(stats.used)}</span>
                                          <span>
                                            {stats.total > 0
                                              ? formatTraffic(stats.total)
                                              : t('common.unlimited')}
                                          </span>
                                        </div>
                                        <div className="glass-progress-track h-1.5 w-full overflow-hidden">
                                          <div
                                            className={cn(
                                              'h-full rounded-full transition-all duration-500',
                                              pct < 70
                                                ? 'bg-emerald-500'
                                                : pct < 90
                                                  ? 'bg-yellow-500'
                                                  : 'bg-red-500',
                                            )}
                                            style={{ width: `${pct}%` }}
                                          />
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-xs text-[var(--text-tertiary)]">—</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="hidden text-xs text-[var(--text-secondary)] lg:table-cell">
                                    {stats && stats.expiryTime > 0
                                      ? formatExpiry(stats.expiryTime)
                                      : '—'}
                                  </TableCell>
                                  <TableCell className="hidden xl:table-cell">
                                    {user.sub_id ? (
                                      <code className="block max-w-[180px] truncate font-mono text-xs text-[var(--text-tertiary)]">
                                        {user.sub_id}
                                      </code>
                                    ) : (
                                      <span className="text-xs text-[var(--text-tertiary)]">
                                        {t('userAccounts.noSubAssigned')}
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        title={assignLabel}
                                        aria-label={assignLabel}
                                        onClick={() => openEdit(user)}
                                      >
                                        <Edit2 className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        title={t('userAccounts.generateResetLink')}
                                        aria-label={t('userAccounts.generateResetLink')}
                                        onClick={() => generateResetLink(user.id, user.username)}
                                      >
                                        <KeyRound className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-red-500 hover:bg-red-500/10"
                                        title={t('userAccounts.deleteUser')}
                                        aria-label={t('userAccounts.deleteUser')}
                                        onClick={() => deleteUser(user.id, user.username)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                                {editing && (
                                  <TableRow>
                                    <TableCell colSpan={7}>
                                      <UserEditForm
                                        state={editing}
                                        onChange={(patch) =>
                                          setEditingSubId((prev) =>
                                            prev ? { ...prev, ...patch } : prev,
                                          )
                                        }
                                        onSave={saveUser}
                                        onCancel={() => setEditingSubId(null)}
                                        isZh={isZh}
                                        subIdPlaceholder={t('userAccounts.subIdPlaceholder')}
                                        saveLabel={t('common.save')}
                                        cancelLabel={t('common.cancel')}
                                      />
                                    </TableCell>
                                  </TableRow>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </div>

              <p className="text-xs text-[var(--text-tertiary)]">
                {t('userAccounts.registrationTip')}
              </p>

              {latestResetLink && (
                <div className="surface-panel space-y-2 p-3">
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
                      className="h-8 shrink-0 gap-1 px-3 text-xs"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(latestResetLink.link);
                          toast(t('userAccounts.linkCopied'), 'success');
                        } catch {
                          toast(t('userAccounts.resetLinkCreateFailed'), 'error');
                        }
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {t('common.copy')}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
