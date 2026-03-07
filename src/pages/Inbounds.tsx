import React, { useState, useEffect } from 'react';
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
import { Plus, Search, Edit2, Trash2, Power, PowerOff, ShieldCheck } from 'lucide-react';
import { getInbounds, deleteInbound, toggleInbound, Inbound } from '@/src/api/client';
import { cn } from '@/src/utils/cn';
import { useI18n } from '@/src/context/I18nContext';
import { InfoTooltip } from '@/src/components/ui/InfoTooltip';

export function InboundsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [inbounds, setInbounds] = useState<Inbound[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  const { t } = useI18n();

  useEffect(() => {
    getInbounds()
      .then(setInbounds)
      .catch(() => toast(t('inbounds.failedLoad'), 'error'))
      .finally(() => setIsLoading(false));
  }, []);

  const formatTraffic = (bytes: number) => {
    if (bytes === 0) return t('inbounds.noLimit');
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1024) return `${(gb / 1024).toFixed(2)} TB`;
    return `${gb.toFixed(2)} GB`;
  };

  const getProtocolColor = (protocol: string) => {
    switch (protocol) {
      case 'VLESS':
        return 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20';
      case 'VMess':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'Trojan':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'Shadowsocks':
        return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      default:
        return 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20';
    }
  };

  const filteredInbounds = inbounds.filter(
    (inbound) =>
      inbound.remark.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inbound.protocol.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleDelete = async (id: number, remark: string) => {
    try {
      await deleteInbound(id);
      setInbounds((prev) => prev.filter((item) => item.id !== id));
      toast(t('inbounds.deleted', { remark }), 'success');
    } catch {
      toast(t('inbounds.deleteFailed'), 'error');
    }
  };

  const handleToggle = async (id: number, remark: string, enable: boolean) => {
    try {
      await toggleInbound(id, enable);
      setInbounds((prev) => prev.map((item) => (item.id === id ? { ...item, enable } : item)));
      toast(`${enable ? t('common.enabled') : t('common.disabled')}: ${remark}`, 'success');
    } catch {
      toast(t('inbounds.toggleFailed'), 'error');
    }
  };

  const handleAction = (action: string, remark: string) => {
    toast(t('inbounds.actionNotReady', { action, remark }), 'info');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('inbounds.title')}</h1>
          <p className="text-zinc-400 mt-1">{t('inbounds.subtitle')}</p>
        </div>
        <Button
          className="gap-2 self-start sm:self-auto"
          onClick={() => toast(t('inbounds.addInboundSoon'), 'info')}
        >
          <Plus className="w-4 h-4" />
          {t('inbounds.addInbound')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle>{t('inbounds.inboundConfigurations')}</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input
                placeholder={t('inbounds.searchPlaceholder')}
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
              {[1, 2, 3].map((value) => (
                <Skeleton key={value} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredInbounds.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('inbounds.id')}</TableHead>
                  <TableHead>{t('inbounds.remark')}</TableHead>
                  <TableHead>
                    <span className="inline-flex items-center gap-1">
                      <span>{t('inbounds.protocol')}</span>
                      <InfoTooltip content={t('inbounds.help.protocol')} />
                    </span>
                  </TableHead>
                  <TableHead className="hidden md:table-cell">{t('inbounds.port')}</TableHead>
                  <TableHead>
                    <span className="inline-flex items-center gap-1">
                      <span>{t('inbounds.trafficUsedTotal')}</span>
                      <InfoTooltip content={t('inbounds.help.trafficUsedTotal')} />
                    </span>
                  </TableHead>
                  <TableHead className="hidden sm:table-cell">
                    <span className="inline-flex items-center gap-1">
                      <span>{t('inbounds.clients')}</span>
                      <InfoTooltip content={t('inbounds.help.clients')} />
                    </span>
                  </TableHead>
                  <TableHead>{t('inbounds.status')}</TableHead>
                  <TableHead className="text-right">{t('inbounds.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInbounds.map((inbound) => {
                  const used = inbound.up + inbound.down;
                  const clientCount = inbound.clientStats?.length ?? 0;
                  return (
                    <TableRow key={inbound.id}>
                      <TableCell className="text-zinc-500 font-mono text-xs">
                        {inbound.id}
                      </TableCell>
                      <TableCell className="font-medium">{inbound.remark}</TableCell>
                      <TableCell>
                        <Badge
                          className={cn('border', getProtocolColor(inbound.protocol.toUpperCase()))}
                        >
                          {inbound.protocol.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono hidden md:table-cell">
                        {inbound.port}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 min-w-[100px]">
                          <div className="flex justify-between text-[10px] text-zinc-500">
                            <span>{formatTraffic(used)}</span>
                            <span>{formatTraffic(inbound.total)}</span>
                          </div>
                          <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full',
                                inbound.total > 0 && used / inbound.total > 0.9
                                  ? 'bg-red-500'
                                  : 'bg-indigo-500',
                              )}
                              style={{
                                width:
                                  inbound.total > 0 ? `${(used / inbound.total) * 100}%` : '0%',
                              }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{clientCount}</TableCell>
                      <TableCell>
                        <Badge variant={inbound.enable ? 'success' : 'secondary'}>
                          {inbound.enable ? t('common.enabled') : t('common.disabled')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              handleToggle(inbound.id, inbound.remark, !inbound.enable)
                            }
                          >
                            {inbound.enable ? (
                              <PowerOff className="w-3.5 h-3.5 text-zinc-500" />
                            ) : (
                              <Power className="w-3.5 h-3.5 text-emerald-500" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleAction(t('nodes.edit'), inbound.remark)}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:bg-red-500/10"
                            onClick={() => handleDelete(inbound.id, inbound.remark)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
              icon={ShieldCheck}
              title={t('inbounds.noInboundsFound')}
              description={
                searchQuery
                  ? t('inbounds.noInboundsMatching', { query: searchQuery })
                  : t('inbounds.noInboundsConfigured')
              }
              actionLabel={searchQuery ? t('inbounds.clearSearch') : t('inbounds.addInbound')}
              onAction={() =>
                searchQuery ? setSearchQuery('') : toast(t('inbounds.addInboundSoon'), 'info')
              }
            />
          )}
        </CardContent>
      </Card>

      <div className="bg-zinc-900/30 border border-white/5 rounded-lg p-4 text-sm text-zinc-500">
        <p>{t('inbounds.note')}</p>
      </div>
    </div>
  );
}
