import React, { useEffect, useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/src/components/ui/Table';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/Card';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { useToast } from '@/src/components/ui/Toast';
import { Activity, RefreshCw, XCircle, Users as UsersIcon, Copy } from 'lucide-react';
import { getInbounds, Inbound } from '@/src/api/client';
import { cn } from '@/src/utils/cn';
import {
  flattenInboundClients,
  formatExpiry,
  formatTraffic,
  getClientStatus,
} from '@/src/utils/xuiClients';
import { useI18n } from '@/src/context/I18nContext';
import { buildSubscriptionUrl } from '@/src/utils/subscription';
import { InfoTooltip } from '@/src/components/ui/InfoTooltip';

interface OnlineUsersPageProps {
  embedded?: boolean;
}

export function OnlineUsersPage({ embedded = false }: OnlineUsersPageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [inbounds, setInbounds] = useState<Inbound[]>([]);
  const { toast } = useToast();
  const { t } = useI18n();

  const load = async (showSuccess = false) => {
    setIsLoading(true);
    try {
      const data = await getInbounds();
      setInbounds(data);
      if (showSuccess) toast(t('online.listUpdated'), 'success');
    } catch {
      toast(t('online.failedLoad'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const activeClients = useMemo(() => {
    return flattenInboundClients(inbounds)
      .filter((client) => getClientStatus(client) === 'active')
      .filter((client) => client.up + client.down > 0)
      .sort((a, b) => b.up + b.down - (a.up + a.down));
  }, [inbounds]);

  const copyLink = async (subId: string) => {
    if (!subId) {
      toast(t('online.missingSubOrUrl'), 'info');
      return;
    }
    const link = buildSubscriptionUrl(subId);
    if (!link) {
      toast(t('online.missingSubOrUrl'), 'info');
      return;
    }
    await navigator.clipboard.writeText(link);
    toast(t('online.subCopied'), 'success');
  };

  const handleDisconnect = (username: string) => {
    toast(t('online.disconnectUnavailable', { username }), 'info');
  };

  return (
    <div className="space-y-6">
      {!embedded ? (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('online.title')}</h1>
            <p className="text-zinc-400 mt-1">{t('online.subtitle')}</p>
          </div>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => load(true)}
            disabled={isLoading}
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
            {t('online.refresh')}
          </Button>
        </div>
      ) : (
        <Button variant="outline" className="gap-2" onClick={() => load(true)} disabled={isLoading}>
          <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          {t('online.refresh')}
        </Button>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-500" />
            <CardTitle className="flex items-center gap-1">
              <span>{t('online.activeConnections')}</span>
              <InfoTooltip content={t('online.help.activeConnections')} />
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : activeClients.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('online.username')}</TableHead>
                  <TableHead className="hidden md:table-cell">
                    <span className="inline-flex items-center gap-1">
                      <span>{t('online.inbound')}</span>
                      <InfoTooltip content={t('online.help.inbound')} />
                    </span>
                  </TableHead>
                  <TableHead>
                    <span className="inline-flex items-center gap-1">
                      <span>{t('online.traffic')}</span>
                      <InfoTooltip content={t('online.help.traffic')} />
                    </span>
                  </TableHead>
                  <TableHead className="hidden sm:table-cell">
                    <span className="inline-flex items-center gap-1">
                      <span>{t('online.expire')}</span>
                      <InfoTooltip content={t('online.help.expire')} />
                    </span>
                  </TableHead>
                  <TableHead>
                    <span className="inline-flex items-center gap-1">
                      <span>{t('online.status')}</span>
                      <InfoTooltip content={t('online.help.status')} />
                    </span>
                  </TableHead>
                  <TableHead className="text-right">{t('online.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeClients.map((user) => (
                  <TableRow key={user.key}>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-zinc-400">
                      {user.inboundRemark} · {user.protocol.toUpperCase()}:{user.port}
                    </TableCell>
                    <TableCell>{formatTraffic(user.up + user.down)}</TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-zinc-400">
                      {formatExpiry(user.expiryTime)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="success">{t('common.active')}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => copyLink(user.subId)}
                          title={t('online.copySubLink')}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-400 hover:bg-red-500/10 gap-2"
                          onClick={() => handleDisconnect(user.username)}
                        >
                          <XCircle className="w-4 h-4" />
                          <span className="hidden sm:inline">{t('online.disconnect')}</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              icon={UsersIcon}
              title={t('online.noActiveClients')}
              description={t('online.noActivity')}
              actionLabel={t('online.refreshList')}
              onAction={() => load(true)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
