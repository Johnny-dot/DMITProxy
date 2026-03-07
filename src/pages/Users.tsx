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
} from 'lucide-react';
import {
  deleteInboundClient,
  deleteInboundClientByEmail,
  getInbounds,
  Inbound,
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

export function UsersPage({ embedded = false, onOpenAccounts }: UsersPageProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, language } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [inbounds, setInbounds] = useState<Inbound[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [subModal, setSubModal] = useState<XuiClientRow | null>(null);
  const [subQrImage, setSubQrImage] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const data = await getInbounds();
      setInbounds(data);
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

  const handleAction = (action: string, username: string) => {
    toast(t('users.actionNotExposed', { action, username }), 'info');
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
            <p className="max-w-3xl text-sm leading-7 text-zinc-400">{t('users.subtitle')}</p>
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
        <div className="flex items-center gap-2">
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
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
                      <TableCell className="hidden lg:table-cell text-zinc-400 text-xs">
                        {user.inboundRemark} · {user.protocol.toUpperCase()}:{user.port}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell font-mono text-xs text-zinc-500">
                        {user.subId || t('users.noSubId')}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5 min-w-[140px]">
                          <div className="flex justify-between text-[10px] text-zinc-500">
                            <span>{formatTraffic(trafficUsed)}</span>
                            <span>
                              {user.totalGB > 0
                                ? formatTraffic(user.totalGB)
                                : t('common.unlimited')}
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
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
                      <TableCell className="hidden sm:table-cell text-zinc-400 text-xs">
                        {formatExpiry(user.expiryTime)}
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
                            onClick={() => handleAction(t('users.editClient'), user.username)}
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
              className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4"
              onClick={() => setSubModal(null)}
            >
              <div className="surface-card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                  <div>
                    <p className="font-semibold text-zinc-50">{subModal.username}</p>
                    <p className="text-xs text-zinc-500 font-mono mt-0.5">
                      {subModal.subId || t('users.noSubId')}
                    </p>
                  </div>
                  <button
                    onClick={() => setSubModal(null)}
                    className="text-zinc-500 hover:text-zinc-200 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="px-5 py-4 space-y-2">
                  {formats.map(({ key, label, format }) => {
                    const url = subModal.subId ? buildSubscriptionUrl(subModal.subId, format) : '';
                    const isCopied = copiedKey === key;
                    return (
                      <div
                        key={key}
                        className="flex items-center gap-2 bg-zinc-800/50 rounded-lg px-3 py-2"
                      >
                        <span className="text-xs font-medium text-zinc-400 w-16 shrink-0">
                          {label}
                        </span>
                        <span className="flex-1 text-xs font-mono text-zinc-300 truncate">
                          {url || <span className="text-zinc-600">{t('users.subUrlMissing')}</span>}
                        </span>
                        <button
                          disabled={!url}
                          onClick={() => copyLink(url, key)}
                          className="shrink-0 text-zinc-500 hover:text-emerald-400 disabled:opacity-30 transition-colors"
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
                    <p className="text-xs text-zinc-500">Universal QR</p>
                    <img src={subQrImage} alt="QR Code" className="w-40 h-40 rounded-lg" />
                  </div>
                )}
              </div>
            </div>
          );
        })()}
    </div>
  );
}
