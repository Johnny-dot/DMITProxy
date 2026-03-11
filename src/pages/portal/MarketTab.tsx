import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownRight, ArrowUpRight, RefreshCw, TrendingUp } from 'lucide-react';
import { getMarketChart, getMarketSnapshot, refreshMarketSnapshot } from '@/src/api/client';
import { Button } from '@/src/components/ui/Button';
import { InfoTooltip } from '@/src/components/ui/InfoTooltip';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { useI18n } from '@/src/context/I18nContext';
import type {
  MarketCategory,
  MarketChartDetail,
  MarketSnapshotItem,
  MarketSnapshotPayload,
} from '@/src/types/market';
import { cn } from '@/src/utils/cn';

const CATEGORY_ORDER: MarketCategory[] = ['indices', 'metals', 'crypto', 'forex'];

function formatDateTime(value: number | null, locale: string) {
  if (!value) return '--';
  return new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function formatMarketValue(item: MarketSnapshotItem) {
  if (item.latest === null) return '--';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: item.decimals,
    maximumFractionDigits: item.decimals,
  }).format(item.latest);
}

function formatMarketDelta(value: number | null, digits: number, suffix = '') {
  if (value === null) return '--';
  const sign = value > 0 ? '+' : '';
  return `${sign}${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)}${suffix}`;
}

function getCategoryLabel(category: MarketCategory, isZh: boolean) {
  if (category === 'indices') return isZh ? '全球指数' : 'Global indices';
  if (category === 'metals') return isZh ? '贵金属' : 'Precious metals';
  if (category === 'crypto') return isZh ? '加密货币' : 'Crypto';
  return isZh ? '外汇' : 'FX';
}

export function MarketTab() {
  const { language } = useI18n();
  const isZh = language === 'zh-CN';
  const locale = isZh ? 'zh-CN' : 'en-US';

  const [snapshot, setSnapshot] = useState<MarketSnapshotPayload | null>(null);
  const [defaultAssetId, setDefaultAssetId] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [detailCache, setDetailCache] = useState<Record<string, MarketChartDetail>>({});
  const [snapshotError, setSnapshotError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isRefreshingMarket, setIsRefreshingMarket] = useState(false);

  const loadSnapshot = useCallback(async () => {
    setIsLoadingSnapshot(true);
    setSnapshotError('');
    try {
      const data = await getMarketSnapshot();
      setSnapshot(data.snapshot);
      setDefaultAssetId(data.defaultAssetId);
      setSelectedAssetId((current) =>
        current && data.snapshot.items.some((item) => item.id === current)
          ? current
          : (data.snapshot.items.find((item) => item.status === 'ok')?.id ?? data.defaultAssetId),
      );
    } catch (error) {
      setSnapshotError(
        error instanceof Error
          ? error.message
          : isZh
            ? '暂时无法加载市场数据'
            : 'Failed to load market snapshot',
      );
    } finally {
      setIsLoadingSnapshot(false);
    }
  }, [isZh]);

  const loadDetail = useCallback(
    async (assetId: string, forceRefresh = false) => {
      setIsLoadingDetail(true);
      setDetailError('');
      try {
        const data = forceRefresh
          ? await refreshMarketSnapshot(assetId)
          : await getMarketChart(assetId);
        if ('snapshot' in data && data.snapshot) {
          setSnapshot(data.snapshot);
        }
        if ('detail' in data && data.detail) {
          setDetailCache((previous) => ({ ...previous, [assetId]: data.detail }));
        }
      } catch (error) {
        setDetailError(
          error instanceof Error
            ? error.message
            : isZh
              ? '暂时无法加载走势'
              : 'Failed to load chart',
        );
      } finally {
        setIsLoadingDetail(false);
      }
    },
    [isZh],
  );

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  useEffect(() => {
    if (!selectedAssetId || detailCache[selectedAssetId]) return;
    void loadDetail(selectedAssetId);
  }, [detailCache, loadDetail, selectedAssetId]);

  const selectedItem = useMemo(
    () => snapshot?.items.find((item) => item.id === selectedAssetId) ?? null,
    [selectedAssetId, snapshot?.items],
  );
  const selectedDetail = selectedAssetId ? (detailCache[selectedAssetId] ?? null) : null;
  const groupedItems = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        items: (snapshot?.items ?? []).filter((item) => item.category === category),
      })).filter((group) => group.items.length > 0),
    [snapshot?.items],
  );

  async function handleRefreshMarket() {
    const assetId = selectedAssetId ?? defaultAssetId;
    if (!assetId) return;
    setIsRefreshingMarket(true);
    try {
      await loadDetail(assetId, true);
    } finally {
      setIsRefreshingMarket(false);
    }
  }

  const quickScanSection =
    !isLoadingSnapshot && snapshot ? (
      <section className="surface-card space-y-4 p-4 md:p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <p className="section-kicker">{isZh ? '速览' : 'Quick scan'}</p>
            <h3 className="text-lg font-semibold text-zinc-50">
              {isZh ? '其余标的也能一眼看完。' : 'See the rest of the board at a glance.'}
            </h3>
          </div>
          <p className="text-xs leading-5 text-zinc-500">
            {isZh ? '数据来源：' : 'Data source: '}
            <a
              href={snapshot.attributionUrl}
              target="_blank"
              rel="noreferrer"
              className="text-emerald-400 hover:text-emerald-300"
            >
              {snapshot.provider}
            </a>
            {isZh ? '，仅供参考。' : ', for reference only.'}
          </p>
        </div>

        {snapshotError ? (
          <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-4 text-sm text-zinc-400">
            {snapshotError}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
          {groupedItems.map((group) => (
            <section
              key={group.category}
              className="rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-3"
            >
              <div className="mb-3 flex items-center justify-between gap-3 px-1">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                  <h4 className="text-sm font-semibold text-zinc-50">
                    {getCategoryLabel(group.category, isZh)}
                  </h4>
                </div>
                <span className="text-xs text-zinc-500">{group.items.length}</span>
              </div>
              <div className="space-y-2">
                {group.items.map((item) => {
                  const positive = (item.change ?? 0) >= 0;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={cn(
                        'w-full rounded-[20px] border px-3 py-3 text-left transition-colors',
                        item.id === selectedAssetId
                          ? 'border-[color:var(--border-strong)] bg-[var(--surface-strong)]'
                          : 'border-[color:var(--border-subtle)] bg-[var(--surface-card)] hover:bg-[var(--surface-strong)]',
                      )}
                      onClick={() => {
                        setSelectedAssetId(item.id);
                        if (!detailCache[item.id]) void loadDetail(item.id);
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-zinc-50">
                            {isZh ? item.labelZh : item.labelEn}
                          </p>
                          <p className="mt-0.5 text-xs text-zinc-500">{item.symbol}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-zinc-50">
                            {formatMarketValue(item)}
                          </p>
                          <p
                            className={cn(
                              'mt-0.5 text-xs',
                              positive ? 'text-emerald-300' : 'text-rose-300',
                            )}
                          >
                            {formatMarketDelta(item.changePercent, 2, '%')}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-zinc-500">
                        <span className="truncate">
                          {item.status === 'error'
                            ? item.error || (isZh ? '上游数据源暂不可用' : 'Upstream unavailable')
                            : `${isZh ? '更新' : 'Updated'} ${formatDateTime(item.updatedAt, locale)}`}
                        </span>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-1',
                            positive
                              ? 'bg-emerald-500/10 text-emerald-300'
                              : 'bg-rose-500/10 text-rose-300',
                          )}
                        >
                          {positive ? (
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDownRight className="h-3.5 w-3.5" />
                          )}
                          {formatMarketDelta(item.change, item.decimals)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </section>
    ) : null;

  return (
    <div className="space-y-4" data-testid="portal-market-tab">
      {isLoadingSnapshot ? (
        <div className="surface-card space-y-4 p-5 md:p-6">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-[220px] w-full rounded-[28px]" />
          <div className="grid gap-3 md:grid-cols-3">
            <Skeleton className="h-20 w-full rounded-[24px]" />
            <Skeleton className="h-20 w-full rounded-[24px]" />
            <Skeleton className="h-20 w-full rounded-[24px]" />
          </div>
        </div>
      ) : (
        <section className="surface-card min-w-0 space-y-4 p-5 md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <p className="section-kicker">{isZh ? '市场' : 'Markets'}</p>
              <h2 className="text-xl font-semibold tracking-tight text-zinc-50 md:text-2xl">
                {isZh
                  ? '重点行情单独看，不再和资讯挤在一页。'
                  : 'Market moves now have their own page.'}
              </h2>
              <p className="max-w-2xl text-sm leading-6 text-zinc-400">
                {isZh
                  ? '这里专门展示关键标的、价格变化和走势细节，切换更清楚。'
                  : 'Key assets, price changes, and chart details stay focused here for a cleaner view.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-3 py-2 text-xs text-zinc-400">
                {snapshot
                  ? `${isZh ? '更新' : 'Updated'} ${formatDateTime(snapshot.cachedAt, locale)}`
                  : '--'}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => void handleRefreshMarket()}
                disabled={isRefreshingMarket}
              >
                <RefreshCw className={cn('h-4 w-4', isRefreshingMarket && 'animate-spin')} />
                {isZh ? '刷新行情' : 'Refresh'}
              </Button>
            </div>
          </div>

          {snapshotError && !snapshot ? (
            <div className="rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-4 text-sm text-zinc-400">
              {snapshotError}
            </div>
          ) : null}

          {selectedItem ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_300px]">
              <div className="min-w-0 rounded-[30px] border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-4 md:p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                      {getCategoryLabel(selectedItem.category, isZh)}
                    </p>
                    <h3 className="text-xl font-semibold text-zinc-50">
                      {isZh ? selectedItem.labelZh : selectedItem.labelEn}
                    </h3>
                    <p className="text-sm text-zinc-500">{selectedItem.symbol}</p>
                  </div>
                  <div className="space-y-2 md:text-right">
                    <p className="text-3xl font-semibold text-zinc-50">
                      {formatMarketValue(selectedItem)}
                    </p>
                    <div
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium',
                        (selectedItem.change ?? 0) >= 0
                          ? 'bg-emerald-500/10 text-emerald-300'
                          : 'bg-rose-500/10 text-rose-300',
                      )}
                    >
                      {(selectedItem.change ?? 0) >= 0 ? (
                        <ArrowUpRight className="h-4 w-4" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4" />
                      )}
                      <span>{formatMarketDelta(selectedItem.change, selectedItem.decimals)}</span>
                      <span>{formatMarketDelta(selectedItem.changePercent, 2, '%')}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 min-w-0">
                  {detailError && !selectedDetail ? (
                    <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 text-sm text-zinc-400">
                      {detailError}
                    </div>
                  ) : null}
                  {isLoadingDetail && !selectedDetail ? (
                    <Skeleton className="h-[220px] w-full rounded-[24px]" />
                  ) : null}
                  {selectedDetail ? (
                    <div className="h-[220px] w-full min-w-0">
                      <AreaChart
                        responsive
                        data={selectedDetail.series}
                        style={{ width: '100%', height: '100%' }}
                      >
                        <defs>
                          <linearGradient id="market-area-fill" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#34d399" stopOpacity={0.28} />
                            <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="label"
                          tickLine={false}
                          axisLine={false}
                          minTickGap={24}
                          stroke="#71717a"
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis hide domain={['dataMin', 'dataMax']} />
                        <Tooltip
                          cursor={{ stroke: '#3f3f46', strokeDasharray: '4 4' }}
                          formatter={(value: number) => [
                            new Intl.NumberFormat('en-US', {
                              minimumFractionDigits: selectedItem.decimals,
                              maximumFractionDigits: selectedItem.decimals,
                            }).format(value),
                            isZh ? selectedItem.labelZh : selectedItem.labelEn,
                          ]}
                          labelFormatter={(label) => (isZh ? `时间 ${label}` : `Date ${label}`)}
                          contentStyle={{
                            backgroundColor: '#111115',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '18px',
                            color: '#fafafa',
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="#34d399"
                          strokeWidth={2.2}
                          fill="url(#market-area-fill)"
                          dot={false}
                          activeDot={{ r: 4, fill: '#34d399' }}
                        />
                      </AreaChart>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="grid gap-3">
                <div className="rounded-[26px] border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-4">
                  <p className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                    <span>{isZh ? '最近更新' : 'Last updated'}</span>
                    <InfoTooltip
                      content={
                        isZh
                          ? '这是这张行情卡片最近一次更新的时间。'
                          : 'This is when the selected market card was last updated.'
                      }
                    />
                  </p>
                  <p className="mt-2 text-sm font-medium text-zinc-50">
                    {formatDateTime(selectedItem.updatedAt, locale)}
                  </p>
                </div>
                <div className="rounded-[26px] border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-4">
                  <p className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                    <span>{isZh ? '图表范围' : 'Chart range'}</span>
                    <InfoTooltip
                      content={
                        isZh
                          ? '这张图显示的是这段时间里的价格变化。'
                          : 'This chart shows changes over this time range.'
                      }
                    />
                  </p>
                  <p className="mt-2 text-sm font-medium text-zinc-50">
                    {selectedDetail?.rangeLabel ?? '--'}
                  </p>
                </div>
                <div className="rounded-[26px] border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-4">
                  <p className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                    <span>{isZh ? '交易状态' : 'Market status'}</span>
                    <InfoTooltip
                      content={
                        isZh
                          ? '这里会告诉你现在是交易中还是已收盘。'
                          : 'This tells you whether the market is currently open or closed.'
                      }
                    />
                  </p>
                  <p className="mt-2 text-sm font-medium text-zinc-50">
                    {selectedItem.marketOpen === null
                      ? '--'
                      : selectedItem.marketOpen
                        ? isZh
                          ? '交易中'
                          : 'Open'
                        : isZh
                          ? '已收盘'
                          : 'Closed'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface-panel)] p-4 text-sm text-zinc-400">
              {isZh ? '暂时没有可展示的市场数据。' : 'There is no visible market data right now.'}
            </div>
          )}
        </section>
      )}

      {quickScanSection}
    </div>
  );
}
