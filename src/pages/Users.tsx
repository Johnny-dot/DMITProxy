import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/src/components/ui/Table';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/Card';
import { Input } from '@/src/components/ui/Input';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { useToast } from '@/src/components/ui/Toast';
import QRCode from 'qrcode';
import {
  Activity,
  UserPlus,
  Search,
  Copy,
  UserX,
  Edit2,
  Users as UsersIcon,
  RefreshCw,
  Link2,
  X,
  Check,
  RotateCcw,
} from 'lucide-react';
import {
  deleteInboundClient,
  deleteInboundClientByEmail,
  getInboundClientIps,
  getInboundLastOnline,
  getInbounds,
  Inbound,
  resetInboundClientTraffic,
  updateInboundClient,
} from '@/src/api/client';
import { cn } from '@/src/utils/cn';
import {
  flattenInboundClients,
  formatExpiry,
  formatTraffic,
  getClientStatus,
  XuiClientRow,
} from '@/src/utils/xuiClients';
import { useI18n } from '@/src/context/I18nContext';
import { buildSubscriptionUrl } from '@/src/utils/subscription';
import { InfoTooltip } from '@/src/components/ui/InfoTooltip';

interface UsersPageProps {
  embedded?: boolean;
  onOpenAccounts?: () => void;
}

function isOnlineClient(user: XuiClientRow) {
  return getClientStatus(user) === 'active' && user.up + user.down > 0;
}

const BYTES_PER_GB = 1024 ** 3;

interface EditClientDraft {
  client: XuiClientRow;
  username: string;
  enable: boolean;
  trafficLimitGb: string;
  deviceLimit: string;
  expiryTime: string;
}

interface ClientActivityState {
  client: XuiClientRow;
  ips: string[];
  emptyMessage: string;
  error: string | null;
  isLoading: boolean;
}

function formatTrafficLimitGb(totalBytes: number): string {
  if (!Number.isFinite(totalBytes) || totalBytes <= 0) return '0';
  const gb = totalBytes / BYTES_PER_GB;
  return Number.isInteger(gb) ? String(gb) : gb.toFixed(2).replace(/\.?0+$/, '');
}

function toDatetimeLocalValue(expiryTime: number): string {
  if (!Number.isFinite(expiryTime) || expiryTime <= 0) return '';
  const localDate = new Date(expiryTime - new Date(expiryTime).getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function parseDatetimeLocalValue(value: string): number {
  if (!value.trim()) return 0;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.getTime() : Number.NaN;
}

function normalizeClientIpRecords(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || /^no ip record$/i.test(trimmed)) return [];

    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        return normalizeClientIpRecords(JSON.parse(trimmed));
      } catch {
        return [trimmed];
      }
    }

    return trimmed
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if ('ips' in record) {
      return normalizeClientIpRecords(record.ips);
    }

    return Object.entries(record)
      .map(([ip, hits]) => {
        const normalizedIp = ip.trim();
        if (!normalizedIp) return '';
        if (typeof hits === 'number' && Number.isFinite(hits) && hits > 0) {
          return `${normalizedIp} (${hits})`;
        }
        return normalizedIp;
      })
      .filter(Boolean);
  }

  return [];
}

export function UsersPage({ embedded = false, onOpenAccounts }: UsersPageProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, language } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [inbounds, setInbounds] = useState<Inbound[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [subModal, setSubModal] = useState<XuiClientRow | null>(null);
  const [editClient, setEditClient] = useState<EditClientDraft | null>(null);
  const [activityModal, setActivityModal] = useState<ClientActivityState | null>(null);
  const [subQrImage, setSubQrImage] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [isResettingTraffic, setIsResettingTraffic] = useState(false);
  const [lastOnlineByEmail, setLastOnlineByEmail] = useState<Record<string, number>>({});

  const load = async () => {
    setIsLoading(true);
    try {
      const [data, lastOnline] = await Promise.all([
        getInbounds(),
        getInboundLastOnline().catch(() => null),
      ]);
      setInbounds(data);
      setLastOnlineByEmail(lastOnline ?? {});
    } catch {
      toast(t('users.failedLoad'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!subModal?.subId) {
      setSubQrImage('');
      return;
    }
    const url = buildSubscriptionUrl(subModal.subId, 'universal');
    if (!url) {
      setSubQrImage('');
      return;
    }
    QRCode.toDataURL(url, { width: 200, margin: 1 })
      .then(setSubQrImage)
      .catch(() => setSubQrImage(''));
  }, [subModal]);

  const users = useMemo(() => {
    return flattenInboundClients(inbounds).sort((a, b) => b.up + b.down - (a.up + a.down));
  }, [inbounds]);

  const activeUsersCount = useMemo(() => users.filter(isOnlineClient).length, [users]);

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return users;
    return users.filter(
      (user) =>
        user.username.toLowerCase().includes(query) ||
        user.subId.toLowerCase().includes(query) ||
        user.inboundRemark.toLowerCase().includes(query),
    );
  }, [searchQuery, users]);

  const copyLink = async (url: string, key: string) => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const openEditClient = (user: XuiClientRow) => {
    if (user.configSource !== 'settings') {
      toast(t('users.editClientConfigUnavailable'), 'info');
      return;
    }

    if (!user.clientId) {
      toast(t('users.editClientIdMissing'), 'error');
      return;
    }

    setEditClient({
      client: user,
      username: user.email || user.username,
      enable: user.enable,
      trafficLimitGb: formatTrafficLimitGb(user.totalGB),
      deviceLimit: String(user.deviceLimit || 0),
      expiryTime: toDatetimeLocalValue(user.expiryTime),
    });
  };

  const saveClientEdits = async () => {
    if (!editClient) return;

    const username = editClient.username.trim();
    if (!username) {
      toast(t('users.editClientSaveFailed', { username: editClient.client.username }), 'error');
      return;
    }

    const trafficLimitGb = Number(editClient.trafficLimitGb.trim() || '0');
    const deviceLimit = Number(editClient.deviceLimit.trim() || '0');
    const expiryTime = parseDatetimeLocalValue(editClient.expiryTime);

    if (!Number.isFinite(trafficLimitGb) || trafficLimitGb < 0) {
      toast(t('users.editClientSaveFailed', { username: editClient.client.username }), 'error');
      return;
    }

    if (!Number.isFinite(deviceLimit) || deviceLimit < 0) {
      toast(t('users.editClientSaveFailed', { username: editClient.client.username }), 'error');
      return;
    }

    if (Number.isNaN(expiryTime)) {
      toast(t('users.editClientSaveFailed', { username: editClient.client.username }), 'error');
      return;
    }

    setIsSavingClient(true);
    try {
      const mergedClient = {
        ...editClient.client.rawClient,
        email: username,
        enable: editClient.enable,
        limitIp: Math.trunc(deviceLimit),
        totalGB: trafficLimitGb > 0 ? Math.round(trafficLimitGb * BYTES_PER_GB) : 0,
        expiryTime,
      };

      await updateInboundClient({
        inboundId: editClient.client.inboundId,
        clientId: editClient.client.clientId,
        client: mergedClient,
      });

      toast(t('users.editClientSaved', { username }), 'success');
      setEditClient(null);
      await load();
    } catch (error) {
      const raw = error instanceof Error ? error.message : '';
      const base = t('users.editClientSaveFailed', { username: editClient.client.username });
      toast(raw ? `${base}: ${raw}` : base, 'error');
    } finally {
      setIsSavingClient(false);
    }
  };

  const getClientLastOnline = (user: XuiClientRow) => {
    const emailKey = user.email.trim();
    if (emailKey && emailKey in lastOnlineByEmail) {
      return lastOnlineByEmail[emailKey];
    }

    const usernameKey = user.username.trim();
    if (usernameKey && usernameKey in lastOnlineByEmail) {
      return lastOnlineByEmail[usernameKey];
    }

    return 0;
  };

  const formatLastOnlineValue = (timestamp: number) => {
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      return t('users.lastOnlineNever');
    }
    return new Date(timestamp).toLocaleString(language === 'zh-CN' ? 'zh-CN' : 'en-US');
  };

  const refreshClientActivity = async (user: XuiClientRow) => {
    if (!user.email.trim()) {
      toast(t('users.clientEmailMissing', { username: user.username }), 'error');
      return;
    }

    setActivityModal((current) =>
      current && current.client.key === user.key
        ? { ...current, isLoading: true, error: null }
        : {
            client: user,
            ips: [],
            emptyMessage: '',
            error: null,
            isLoading: true,
          },
    );

    try {
      const [ipsPayload, lastOnline] = await Promise.all([
        getInboundClientIps(user.email),
        getInboundLastOnline().catch(() => null),
      ]);

      if (lastOnline) {
        setLastOnlineByEmail(lastOnline);
      }

      const ips = normalizeClientIpRecords(ipsPayload);

      setActivityModal((current) =>
        current && current.client.key === user.key
          ? {
              ...current,
              ips,
              emptyMessage: ips.length === 0 ? t('users.noIpRecords') : '',
              error: null,
              isLoading: false,
            }
          : current,
      );
    } catch (error) {
      const raw = error instanceof Error ? error.message : '';
      const baseMessage = t('users.clientActivityLoadFailed', { username: user.username });
      setActivityModal((current) =>
        current && current.client.key === user.key
          ? {
              ...current,
              ips: [],
              emptyMessage: '',
              error: raw ? `${baseMessage}: ${raw}` : baseMessage,
              isLoading: false,
            }
          : current,
      );
    }
  };

  const openClientActivity = (user: XuiClientRow) => {
    void refreshClientActivity(user);
  };

  const handleResetClientTraffic = async (user: XuiClientRow) => {
    if (!user.email.trim()) {
      toast(t('users.clientEmailMissing', { username: user.username }), 'error');
      return;
    }

    const confirmed = window.confirm(
      t('users.resetClientTrafficConfirm', { username: user.username }),
    );
    if (!confirmed) return;

    setIsResettingTraffic(true);
    try {
      await resetInboundClientTraffic(user.inboundId, user.email);
      toast(t('users.resetClientTrafficSuccess', { username: user.username }), 'success');
      await load();
      await refreshClientActivity(user);
    } catch (error) {
      const raw = error instanceof Error ? error.message : '';
      const baseMessage = t('users.resetClientTrafficFailed', { username: user.username });
      toast(raw ? `${baseMessage}: ${raw}` : baseMessage, 'error');
    } finally {
      setIsResettingTraffic(false);
    }
  };

  const handleDeleteClient = async (user: XuiClientRow) => {
    const confirmed = window.confirm(
      t('users.deleteClientConfirm', {
        username: user.username,
        inbound: user.inboundRemark,
      }),
    );
    if (!confirmed) return;

    try {
      if (user.email) {
        try {
          await deleteInboundClientByEmail(user.inboundId, user.email);
        } catch (error) {
          if (!user.uuid) throw error;
          await deleteInboundClient(user.inboundId, user.uuid);
        }
      } else if (user.uuid) {
        await deleteInboundClient(user.inboundId, user.uuid);
      } else {
        throw new Error(t('users.deleteClientMissingIdentifier', { username: user.username }));
      }

      toast(t('users.clientDeleted', { username: user.username }), 'success');
      await load();
    } catch (error) {
      const raw = error instanceof Error ? error.message : '';
      const isLastClient = raw.toLowerCase().includes('no client remained');
      if (isLastClient) {
        toast(
          `${user.username}: 该 Inbound 里只剩此 Client，3X-UI 不允许删除最后一个。请先在 3X-UI 面板新增一个临时 Client，再回来删除。`,
          'error',
        );
      } else {
        const baseMessage = t('users.clientDeleteFailed', { username: user.username });
        toast(raw ? `${baseMessage}: ${raw}` : baseMessage, 'error');
      }
    }
  };

  const getStatusLabel = (status: 'active' | 'disabled' | 'expired') => {
    if (status === 'active') return t('common.active');
    if (status === 'disabled') return t('common.disabled');
    return t('common.expired');
  };

  const openAccounts = () => {
    if (onOpenAccounts) {
      onOpenAccounts();
      return;
    }
    navigate('/users?tab=accounts');
  };

  const onlineColumnLabel = language === 'zh-CN' ? '在线' : 'Online';
  const onlineHelpText =
    language === 'zh-CN'
      ? '根据账号状态为可用且累计流量大于 0 推断为在线。'
      : 'Inferred as online when the client is active and cumulative traffic is greater than 0.';
  const statusHelpText =
    language === 'zh-CN'
      ? '这里表示这条订阅本身是否可用，例如启用中、已停用或已过期；和“在线”不是一回事。'
      : 'This shows whether the subscription itself is usable, such as active, disabled, or expired. It is different from Online.';
  const actionsHelpText =
    language === 'zh-CN'
      ? '这里可以打开订阅链接、编辑客户端信息，或删除这条客户端记录。'
      : 'Open links, edit the client entry, or delete this client record from here.';
  const onlineStatusLabel = (online: boolean) =>
    online ? (language === 'zh-CN' ? '在线' : 'Online') : language === 'zh-CN' ? '离线' : 'Offline';

  return (
    <div className="w-full min-w-0 space-y-6">
      {!embedded ? (
        <section className="surface-card flex flex-col gap-4 p-6 sm:flex-row sm:items-end sm:justify-between md:p-7">
          <div className="space-y-3">
            <p className="section-kicker">{t('users.title')}</p>
            <h1 className="text-3xl font-semibold tracking-tight">{t('users.title')}</h1>
            <p className="max-w-3xl text-sm leading-7 text-[var(--text-secondary)]">
              {t('users.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={load} disabled={isLoading}>
              <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
            </Button>
            <Button className="gap-2" onClick={openAccounts}>
              <UserPlus className="w-4 h-4" />
              {t('users.inviteAccounts')}
            </Button>
          </div>
        </section>
      ) : (
        <div className="glass-pill inline-flex items-center gap-2 p-2">
          <Button variant="outline" size="icon" onClick={load} disabled={isLoading}>
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </Button>
          <Button className="gap-2" onClick={openAccounts}>
            <UserPlus className="w-4 h-4" />
            {t('users.inviteAccounts')}
          </Button>
        </div>
      )}

      <Card className="w-full">
        <CardHeader>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-3">
              <CardTitle>{t('users.userManagement')}</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  {users.length} {t('users.title')}
                </Badge>
                <Badge variant="success">
                  {activeUsersCount} {onlineColumnLabel}
                </Badge>
              </div>
            </div>
            <div className="relative w-full sm:w-72 xl:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
              <Input
                placeholder={t('users.searchPlaceholder')}
                className="pl-10 h-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-10 flex-1" />
                  <Skeleton className="h-10 w-24" />
                </div>
              ))}
            </div>
          ) : filteredUsers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('users.username')}</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    <span className="inline-flex items-center gap-1">
                      <span>{t('users.inbound')}</span>
                      <InfoTooltip content={t('users.help.inbound')} />
                    </span>
                  </TableHead>
                  <TableHead className="hidden xl:table-cell">
                    <span className="inline-flex items-center gap-1">
                      <span>{t('users.subId')}</span>
                      <InfoTooltip content={t('users.help.subId')} />
                    </span>
                  </TableHead>
                  <TableHead>
                    <span className="inline-flex items-center gap-1">
                      <span>{t('users.trafficUsage')}</span>
                      <InfoTooltip content={t('users.help.trafficUsage')} />
                    </span>
                  </TableHead>
                  <TableHead className="hidden md:table-cell">
                    <span className="inline-flex items-center gap-1">
                      <span>{t('users.devices')}</span>
                      <InfoTooltip content={t('users.help.devices')} />
                    </span>
                  </TableHead>
                  <TableHead className="hidden sm:table-cell">
                    <span className="inline-flex items-center gap-1">
                      <span>{t('users.expireTime')}</span>
                      <InfoTooltip content={t('users.help.expireTime')} />
                    </span>
                  </TableHead>
                  <TableHead className="hidden 2xl:table-cell">
                    <span className="inline-flex items-center gap-1">
                      <span>{t('users.lastOnline')}</span>
                      <InfoTooltip content={t('users.help.lastOnline')} />
                    </span>
                  </TableHead>
                  <TableHead>
                    <span className="inline-flex items-center gap-1">
                      <span>{onlineColumnLabel}</span>
                      <InfoTooltip content={onlineHelpText} />
                    </span>
                  </TableHead>
                  <TableHead>
                    <span className="inline-flex items-center gap-1">
                      <span>{t('users.status')}</span>
                      <InfoTooltip content={statusHelpText} />
                    </span>
                  </TableHead>
                  <TableHead className="text-right">
                    <span className="inline-flex items-center justify-end gap-1">
                      <span>{t('users.actions')}</span>
                      <InfoTooltip content={actionsHelpText} />
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => {
                  const trafficUsed = user.up + user.down;
                  const usagePercent = user.totalGB > 0 ? (trafficUsed / user.totalGB) * 100 : 0;
                  const online = isOnlineClient(user);
                  const status = getClientStatus(user);

                  return (
                    <TableRow key={user.key}>
                      <TableCell className="font-medium">{user.username}</TableCell>
                      <TableCell className="hidden text-xs text-[var(--text-secondary)] lg:table-cell">
                        {user.inboundRemark} · {user.protocol.toUpperCase()}:{user.port}
                      </TableCell>
                      <TableCell className="hidden font-mono text-xs text-[var(--text-tertiary)] xl:table-cell">
                        {user.subId || t('users.noSubId')}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5 min-w-[140px]">
                          <div className="flex justify-between text-[10px] text-[var(--text-secondary)]">
                            <span>{formatTraffic(trafficUsed)}</span>
                            <span>
                              {user.totalGB > 0
                                ? formatTraffic(user.totalGB)
                                : t('common.unlimited')}
                            </span>
                          </div>
                          <div className="glass-progress-track h-1.5 w-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all duration-500',
                                usagePercent < 70
                                  ? 'bg-emerald-500'
                                  : usagePercent < 90
                                    ? 'bg-yellow-500'
                                    : 'bg-red-500',
                              )}
                              style={{ width: `${Math.min(usagePercent, 100)}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {user.deviceLimit || t('common.unlimited')}
                      </TableCell>
                      <TableCell className="hidden text-xs text-[var(--text-secondary)] sm:table-cell">
                        {formatExpiry(user.expiryTime)}
                      </TableCell>
                      <TableCell className="hidden text-xs text-[var(--text-secondary)] 2xl:table-cell">
                        {formatLastOnlineValue(getClientLastOnline(user))}
                      </TableCell>
                      <TableCell>
                        <Badge variant={online ? 'success' : 'secondary'}>
                          {onlineStatusLabel(online)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            status === 'active'
                              ? 'success'
                              : status === 'disabled'
                                ? 'secondary'
                                : 'destructive'
                          }
                        >
                          {getStatusLabel(status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setSubModal(user)}
                            title={t('users.viewSubLinks')}
                          >
                            <Link2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openClientActivity(user)}
                            title={t('users.viewClientActivity')}
                          >
                            <Activity className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditClient(user)}
                            title={t('users.editClient')}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title={t('users.deleteClient')}
                            onClick={() => handleDeleteClient(user)}
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              icon={UsersIcon}
              title={t('users.noUsersFound')}
              description={
                searchQuery
                  ? t('users.noUsersMatching', { query: searchQuery })
                  : t('users.noClientsFound')
              }
              illustration={searchQuery ? undefined : 'empty-users.webp'}
              actionLabel={searchQuery ? t('users.clearSearch') : t('users.goToInbounds')}
              onAction={() => {
                if (searchQuery) {
                  setSearchQuery('');
                  return;
                }
                navigate('/inbounds');
              }}
            />
          )}
        </CardContent>
      </Card>
      {activityModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4 backdrop-blur-sm"
          onClick={() => (isResettingTraffic ? undefined : setActivityModal(null))}
        >
          <div className="surface-card w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-[color:var(--border-subtle)] px-5 py-4">
              <div className="space-y-1">
                <p className="font-semibold text-[var(--text-primary)]">
                  {t('users.clientActivityTitle')}
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  {t('users.clientActivityDescription')}
                </p>
              </div>
              <button
                onClick={() => (isResettingTraffic ? undefined : setActivityModal(null))}
                className="text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                disabled={isResettingTraffic}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 px-5 py-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                    {t('users.username')}
                  </label>
                  <Input value={activityModal.client.username} readOnly disabled />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                    {t('users.lastOnline')}
                  </label>
                  <Input
                    value={formatLastOnlineValue(getClientLastOnline(activityModal.client))}
                    readOnly
                    disabled
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                    {t('users.inbound')}
                  </label>
                  <Input
                    value={`${activityModal.client.inboundRemark} · ${activityModal.client.protocol.toUpperCase()}:${activityModal.client.port}`}
                    readOnly
                    disabled
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                    {t('users.editClientSubIdLabel')}
                  </label>
                  <Input
                    value={activityModal.client.subId || t('users.noSubId')}
                    readOnly
                    disabled
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                  {t('users.onlineIps')}
                </label>
                <div className="rounded-[22px] border border-[color:var(--border-subtle)] bg-[var(--surface-panel)] px-4 py-3">
                  {activityModal.isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>{t('common.loading')}</span>
                    </div>
                  ) : activityModal.error ? (
                    <p className="text-sm text-red-300">{activityModal.error}</p>
                  ) : activityModal.ips.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {activityModal.ips.map((ip) => (
                        <Badge key={ip} variant="secondary">
                          {ip}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--text-secondary)]">
                      {activityModal.emptyMessage || t('users.noIpRecords')}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--border-subtle)] px-5 py-4">
              <Button
                type="button"
                variant="ghost"
                className="gap-2"
                onClick={() => void refreshClientActivity(activityModal.client)}
                disabled={activityModal.isLoading || isResettingTraffic}
              >
                <RefreshCw className={cn('h-4 w-4', activityModal.isLoading && 'animate-spin')} />
                {t('common.refresh')}
              </Button>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setActivityModal(null)}
                  disabled={isResettingTraffic}
                >
                  {t('common.close')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => void handleResetClientTraffic(activityModal.client)}
                  disabled={activityModal.isLoading || isResettingTraffic}
                >
                  <RotateCcw className={cn('h-4 w-4', isResettingTraffic && 'animate-spin')} />
                  {t('users.resetClientTraffic')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {editClient && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4 backdrop-blur-sm"
          onClick={() => (isSavingClient ? undefined : setEditClient(null))}
        >
          <div className="surface-card w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-[color:var(--border-subtle)] px-5 py-4">
              <div className="space-y-1">
                <p className="font-semibold text-[var(--text-primary)]">
                  {t('users.editClientDetails')}
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  {t('users.editClientDescription')}
                </p>
              </div>
              <button
                onClick={() => (isSavingClient ? undefined : setEditClient(null))}
                className="text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                disabled={isSavingClient}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 px-5 py-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                    {t('users.editClientUsernameLabel')}
                  </label>
                  <Input
                    value={editClient.username}
                    onChange={(e) =>
                      setEditClient((current) =>
                        current ? { ...current, username: e.target.value } : current,
                      )
                    }
                    disabled={isSavingClient}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                    {t('users.editClientEnabledLabel')}
                  </label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={editClient.enable ? 'secondary' : 'outline'}
                      className="flex-1"
                      onClick={() =>
                        setEditClient((current) =>
                          current ? { ...current, enable: true } : current,
                        )
                      }
                      disabled={isSavingClient}
                    >
                      {t('common.enabled')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={!editClient.enable ? 'secondary' : 'outline'}
                      className="flex-1"
                      onClick={() =>
                        setEditClient((current) =>
                          current ? { ...current, enable: false } : current,
                        )
                      }
                      disabled={isSavingClient}
                    >
                      {t('common.disabled')}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                    {t('users.editClientTrafficLimitLabel')}
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={editClient.trafficLimitGb}
                    onChange={(e) =>
                      setEditClient((current) =>
                        current ? { ...current, trafficLimitGb: e.target.value } : current,
                      )
                    }
                    disabled={isSavingClient}
                  />
                  <p className="text-xs text-[var(--text-secondary)]">
                    {t('users.editClientTrafficLimitHint')}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                    {t('users.editClientDeviceLimitLabel')}
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={editClient.deviceLimit}
                    onChange={(e) =>
                      setEditClient((current) =>
                        current ? { ...current, deviceLimit: e.target.value } : current,
                      )
                    }
                    disabled={isSavingClient}
                  />
                  <p className="text-xs text-[var(--text-secondary)]">
                    {t('users.editClientDeviceLimitHint')}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                    {t('users.editClientExpiryLabel')}
                  </label>
                  <Input
                    type="datetime-local"
                    value={editClient.expiryTime}
                    onChange={(e) =>
                      setEditClient((current) =>
                        current ? { ...current, expiryTime: e.target.value } : current,
                      )
                    }
                    disabled={isSavingClient}
                  />
                  <p className="text-xs text-[var(--text-secondary)]">
                    {t('users.editClientExpiryHint')}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                    {t('users.editClientSubIdLabel')}
                  </label>
                  <Input value={editClient.client.subId} readOnly disabled />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                  {t('users.editClientClientIdLabel')}
                </label>
                <Input value={editClient.client.clientId} readOnly disabled />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[color:var(--border-subtle)] px-5 py-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditClient(null)}
                disabled={isSavingClient}
              >
                {t('common.cancel')}
              </Button>
              <Button type="button" onClick={saveClientEdits} disabled={isSavingClient}>
                {isSavingClient ? t('common.saving') : t('common.save')}
              </Button>
            </div>
          </div>
        </div>
      )}
      {subModal &&
        (() => {
          const formats = [
            { key: 'universal', label: 'Universal', format: 'universal' as const },
            { key: 'clash', label: 'Clash', format: 'clash' as const },
            { key: 'v2ray', label: 'V2Ray', format: 'v2ray' as const },
            { key: 'singbox', label: 'Sing-box', format: 'singbox' as const },
          ];
          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4 backdrop-blur-sm"
              onClick={() => setSubModal(null)}
            >
              <div className="surface-card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-[color:var(--border-subtle)] px-5 py-4">
                  <div>
                    <p className="font-semibold text-[var(--text-primary)]">{subModal.username}</p>
                    <p className="mt-0.5 font-mono text-xs text-[var(--text-secondary)]">
                      {subModal.subId || t('users.noSubId')}
                    </p>
                  </div>
                  <button
                    onClick={() => setSubModal(null)}
                    className="text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="px-5 py-4 space-y-2">
                  {formats.map(({ key, label, format }) => {
                    const url = subModal.subId ? buildSubscriptionUrl(subModal.subId, format) : '';
                    const isCopied = copiedKey === key;
                    return (
                      <div key={key} className="surface-panel flex items-center gap-2 px-3 py-2">
                        <span className="w-16 shrink-0 text-xs font-medium text-[var(--text-secondary)]">
                          {label}
                        </span>
                        <span className="flex-1 truncate font-mono text-xs text-[var(--text-primary)]">
                          {url || (
                            <span className="text-[var(--text-tertiary)]">
                              {t('users.subUrlMissing')}
                            </span>
                          )}
                        </span>
                        <button
                          disabled={!url}
                          onClick={() => copyLink(url, key)}
                          className="shrink-0 text-[var(--text-secondary)] transition-colors hover:text-emerald-400 disabled:opacity-30"
                        >
                          {isCopied ? (
                            <Check className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {subQrImage && (
                  <div className="px-5 pb-5 flex flex-col items-center gap-2">
                    <p className="text-xs text-[var(--text-secondary)]">Universal QR</p>
                    <img src={subQrImage} alt="QR Code" className="w-40 h-40 rounded-[20px]" />
                  </div>
                )}
              </div>
            </div>
          );
        })()}
    </div>
  );
}
