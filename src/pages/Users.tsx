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
import {
  UserPlus,
  Search,
  Copy,
  RotateCcw,
  UserX,
  Edit2,
  Users as UsersIcon,
  RefreshCw,
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

export function UsersPage({ embedded = false, onOpenAccounts }: UsersPageProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [inbounds, setInbounds] = useState<Inbound[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  const users = useMemo(() => {
    return flattenInboundClients(inbounds).sort((a, b) => b.up + b.down - (a.up + a.down));
  }, [inbounds]);

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

  const copySubscriptionLink = async (subId: string) => {
    if (!subId) {
      toast(t('users.subIdMissing'), 'info');
      return;
    }
    const link = buildSubscriptionUrl(subId);
    if (!link) {
      toast(t('users.subUrlMissing'), 'error');
      return;
    }
    await navigator.clipboard.writeText(link);
    toast(t('users.subCopied'), 'success');
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
      const baseMessage = t('users.clientDeleteFailed', { username: user.username });
      const details = error instanceof Error ? error.message : '';
      toast(details ? `${baseMessage}: ${details}` : baseMessage, 'error');
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
    navigate('/portal?section=management&tab=accounts');
  };

  return (
    <div className="space-y-6">
      {!embedded ? (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('users.title')}</h1>
            <p className="text-zinc-400 mt-1">{t('users.subtitle')}</p>
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
        </div>
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

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle>{t('users.userManagement')}</CardTitle>
            <div className="relative w-full sm:w-64">
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
                  <TableHead>{t('users.status')}</TableHead>
                  <TableHead className="text-right">{t('users.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => {
                  const trafficUsed = user.up + user.down;
                  const usagePercent = user.totalGB > 0 ? (trafficUsed / user.totalGB) * 100 : 0;
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
                            onClick={() => copySubscriptionLink(user.subId)}
                            title={t('users.copySubLink')}
                          >
                            <Copy className="w-3.5 h-3.5" />
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
                            onClick={() => handleAction(t('users.resetTraffic'), user.username)}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:bg-red-500/10"
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
              actionLabel={searchQuery ? t('users.clearSearch') : t('users.goToInbounds')}
              onAction={() => (searchQuery ? setSearchQuery('') : navigate('/inbounds'))}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
