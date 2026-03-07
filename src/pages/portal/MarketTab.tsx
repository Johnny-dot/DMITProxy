import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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

function formatUpdatedAt(value: number | null, locale: string) {
  if (!value) return '--';
  return new Date(value).toLocaleString(locale, { hour12: false });
}

function formatMarketValue(item: MarketSnapshotItem) {
  if (item.latest === null) return '--';
  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: item.decimals,
    maximumFractionDigits: item.decimals,
  });
  return formatter.format(item.latest);
}

function formatMarketDelta(value: number | null, digits: number, suffix = '') {
  if (value === null) return '--';
  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatter.format(value)}${suffix}`;
}

function getCategoryLabel(category: MarketCategory, isZh: boolean) {
  if (category === 'indices') return isZh ? '全球指数' : 'Global indices';
  if (category === 'metals') return isZh ? '贵金属' : 'Precious metals';
  if (category === 'crypto') return isZh ? '加密货币' : 'Crypto';
  return isZh ? '汇率' : 'FX';
}

function MarketChartSkeleton() {
  return (
    <div className="surface-card space-y-5 p-6 md:p-7">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-[220px] w-full" />
    </div>
  );
}

export function MarketTab() {
  const { language } = useI18n();
  const isZh = language === 'zh-CN';
  const locale = isZh ? 'zh-CN' : 'en-US';
  const [snapshot, setSnapshot] = useState<MarketSnapshotPayload | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [defaultAssetId, setDefaultAssetId] = useState<string | null>(null);
  const [detailCache, setDetailCache] = useState<Record<string, MarketChartDetail>>({});
  const [snapshotError, setSnapshotError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const updatedHelpText = isZh
    ? '当前卡片数值最近一次更新的时间。'
    : 'When the current market value was last updated.';
  const rangeHelpText = isZh
    ? '这张迷你走势图覆盖的时间范围。'
    : 'The time range covered by this mini chart.';
  const marketStatusHelpText = isZh
    ? '表示这个市场当前是否开市；有些品类不会返回这个状态。'
    : 'Whether this market is currently open. Some asset types may not report it.';

  const loadSnapshot = useCallback(async () => {
    setIsLoadingSnapshot(true);
    setSnapshotError('');
    try {
      const data = await getMarketSnapshot();
      setSnapshot(data.snapshot);
      setDefaultAssetId(data.defaultAssetId);
      setSelectedAssetId((current) => {
        if (current && data.snapshot.items.some((item) => item.id === current)) return current;
        return data.snapshot.items.find((item) => item.status === 'ok')?.id ?? data.defaultAssetId;
      });
    } catch (error) {
      setSnapshotError(
        error instanceof Error
          ? error.message
          : isZh
            ? '无法加载资讯快照'
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

        if ('detail' in data && data.detail) {
          setDetailCache((previous) => ({ ...previous, [assetId]: data.detail }));
          if ('snapshot' in data && data.snapshot) {
            setSnapshot(data.snapshot);
          }
          return;
        }

        if ('snapshot' in data) {
          setSnapshot(data.snapshot);
          if (data.detail) {
            setDetailCache((previous) => ({ ...previous, [assetId]: data.detail! }));
          }
        }
      } catch (error) {
        setDetailError(
          error instanceof Error ? error.message : isZh ? '无法加载走势图' : 'Failed to load chart',
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
    if (!selectedAssetId) return;
    if (detailCache[selectedAssetId]) return;
    void loadDetail(selectedAssetId);
  }, [detailCache, loadDetail, selectedAssetId]);

  const selectedItem = useMemo(
    () => snapshot?.items.find((item) => item.id === selectedAssetId) ?? null,
    [selectedAssetId, snapshot?.items],
  );

  const selectedDetail = selectedAssetId ? (detailCache[selectedAssetId] ?? null) : null;

  const groupedItems = useMemo(() => {
    const items = snapshot?.items ?? [];
    return CATEGORY_ORDER.map((category) => ({
      category,
      items: items.filter((item) => item.category === category),
    })).filter((group) => group.items.length > 0);
  }, [snapshot?.items]);

  async function handleRefresh() {
    const targetAssetId = selectedAssetId ?? defaultAssetId;
    if (!targetAssetId) return;

    setIsRefreshing(true);
    setSnapshotError('');
    setDetailError('');
    try {
      const data = await refreshMarketSnapshot(targetAssetId);
      setSnapshot(data.snapshot);
      if (data.detail) {
        setDetailCache((previous) => ({ ...previous, [targetAssetId]: data.detail! }));
      }
    } catch (error) {
      setSnapshotError(
        error instanceof Error
          ? error.message
          : isZh
            ? '刷新资讯失败'
            : 'Failed to refresh market data',
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <div className="space-y-6" data-testid="portal-market-tab">
      <section className="surface-card flex flex-col gap-4 p-6 md:flex-row md:items-start md:justify-between md:p-7">
        <div className="space-y-3">
          <p className="section-kicker">{isZh ? '资讯' : 'Markets'}</p>
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-50">
            {isZh ? '看看今天外面的市场快照。' : 'Take a quick look at the market snapshot.'}
          </h2>
          <p className="max-w-3xl text-sm leading-7 text-zinc-400">
            {isZh
              ? '这里只做轻量参考：先看卡片，再点开单个项目看小走势图。'
              : 'This stays lightweight: start with cards, then open any item for a mini chart.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-3 py-2 text-xs text-zinc-400">
            {snapshot
              ? isZh
                ? `上次更新 ${formatUpdatedAt(snapshot.cachedAt, locale)} · 缓存 ${snapshot.ttlMinutes} 分钟`
                : `Updated ${formatUpdatedAt(snapshot.cachedAt, locale)} · ${snapshot.ttlMinutes} min cache`
              : isZh
                ? '等待首次加载'
                : 'Waiting for first load'}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => void handleRefresh()}
            disabled={isRefreshing || isLoadingSnapshot}
          >
            <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
            {isRefreshing ? (isZh ? '刷新中...' : 'Refreshing...') : isZh ? '刷新' : 'Refresh'}
          </Button>
        </div>
      </section>

      {snapshotError && !snapshot ? (
        <section className="surface-card space-y-3 p-6 md:p-7">
          <h3 className="text-lg font-semibold text-zinc-50">
            {isZh ? '资讯暂时还没准备好' : 'Market data is not ready yet'}
          </h3>
          <p className="text-sm leading-7 text-zinc-400">{snapshotError}</p>
          <p className="hidden">
            {isZh
              ? '在 .env 里加上 TWELVEDATA_API_KEY 以后，这里就会显示数据。'
              : 'This tab uses public market feeds and does not require extra setup. Try refreshing again later.'}
          </p>
          <p className="text-xs leading-6 text-zinc-500">
            {isZh
              ? '这里走的是公开市场数据源，不需要额外配置。稍后刷新重试即可。'
              : 'This tab uses public market feeds and does not require extra setup. Try refreshing again later.'}
          </p>
        </section>
      ) : null}

      {isLoadingSnapshot ? (
        <div className="space-y-6">
          <MarketChartSkeleton />
          <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-36 w-full rounded-[28px]" />
            ))}
          </section>
        </div>
      ) : null}

      {!isLoadingSnapshot && snapshot ? (
        <>
          {selectedItem ? (
            <section className="surface-card space-y-5 p-6 md:p-7">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <p className="section-kicker">{getCategoryLabel(selectedItem.category, isZh)}</p>
                  <h3 className="text-2xl font-semibold tracking-tight text-zinc-50">
                    {isZh ? selectedItem.labelZh : selectedItem.labelEn}
                  </h3>
                  <p className="text-sm text-zinc-500">{selectedItem.symbol}</p>
                </div>

                <div className="space-y-2 text-right">
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

              {detailError && !selectedDetail ? (
                <div className="surface-panel p-4 text-sm leading-6 text-zinc-400">
                  {detailError}
                </div>
              ) : null}

              {isLoadingDetail && !selectedDetail ? (
                <Skeleton className="h-[220px] w-full rounded-[28px]" />
              ) : selectedDetail ? (
                <div className="space-y-4">
                  <div className="h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={selectedDetail.series}>
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
                    </ResponsiveContainer>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="surface-panel p-4">
                      <p className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                        <span>{isZh ? '最近更新时间' : 'Last updated'}</span>
                        <InfoTooltip content={updatedHelpText} />
                      </p>
                      <p className="mt-2 text-sm font-medium text-zinc-50">
                        {formatUpdatedAt(selectedItem.updatedAt, locale)}
                      </p>
                    </div>
                    <div className="surface-panel p-4">
                      <p className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                        <span>{isZh ? '图表范围' : 'Chart range'}</span>
                        <InfoTooltip content={rangeHelpText} />
                      </p>
                      <p className="mt-2 text-sm font-medium text-zinc-50">
                        {selectedDetail.rangeLabel}
                      </p>
                    </div>
                    <div className="surface-panel p-4">
                      <p className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                        <span>{isZh ? '市场状态' : 'Market status'}</span>
                        <InfoTooltip content={marketStatusHelpText} />
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
              ) : null}
            </section>
          ) : null}

          <div className="space-y-6">
            {groupedItems.map((group) => (
              <section key={group.category} className="space-y-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                  <h3 className="text-lg font-semibold text-zinc-50">
                    {getCategoryLabel(group.category, isZh)}
                  </h3>
                </div>

                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
                  {group.items.map((item) => {
                    const isSelected = selectedAssetId === item.id;
                    const positive = (item.change ?? 0) >= 0;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={cn(
                          'surface-card space-y-4 p-5 text-left transition-colors',
                          isSelected
                            ? 'border-[color:var(--border-strong)] bg-[var(--surface-strong)]'
                            : 'hover:bg-[var(--surface-panel)]',
                        )}
                        onClick={() => {
                          setSelectedAssetId(item.id);
                          if (!detailCache[item.id]) {
                            void loadDetail(item.id);
                          }
                        }}
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-zinc-50">
                            {isZh ? item.labelZh : item.labelEn}
                          </p>
                          <p className="text-xs text-zinc-500">{item.symbol}</p>
                        </div>

                        {item.status === 'error' ? (
                          <p className="text-sm leading-6 text-zinc-500">
                            {item.error ||
                              (isZh
                                ? '上游暂时没有返回这个标的'
                                : 'Upstream data is unavailable for this asset')}
                          </p>
                        ) : (
                          <>
                            <div className="space-y-2">
                              <p className="text-2xl font-semibold text-zinc-50">
                                {formatMarketValue(item)}
                              </p>
                              <div
                                className={cn(
                                  'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium',
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
                                <span>{formatMarketDelta(item.change, item.decimals)}</span>
                                <span>{formatMarketDelta(item.changePercent, 2, '%')}</span>
                              </div>
                            </div>

                            <div className="text-xs text-zinc-500">
                              {isZh ? '更新时间 ' : 'Updated '}
                              {formatUpdatedAt(item.updatedAt, locale)}
                            </div>
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <p className="px-1 text-xs leading-6 text-zinc-500">
            {isZh ? '数据来源：' : 'Data source: '}
            <a
              href={snapshot.attributionUrl}
              target="_blank"
              rel="noreferrer"
              className="text-emerald-400 hover:text-emerald-300"
            >
              {snapshot.provider}
            </a>
            {isZh ? '。仅供参考，不构成投资建议。' : '. For reference only, not investment advice.'}
          </p>
        </>
      ) : null}
    </div>
  );
}
