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
const MARKET_DISPLAY_CURRENCY_STORAGE_KEY = 'prism:market:display-currency';

type MarketDisplayCurrency = 'USD' | 'CNY';

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

function getInitialDisplayCurrency(): MarketDisplayCurrency {
  if (typeof window === 'undefined') return 'USD';

  const stored = window.localStorage.getItem(MARKET_DISPLAY_CURRENCY_STORAGE_KEY);
  return stored === 'CNY' || stored === 'USD' ? stored : 'USD';
}

function formatNumber(value: number, digits: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function getCurrencyPrefix(currency: string) {
  if (currency === 'USD') return '$';
  if (currency === 'CNY') return '¥';
  if (currency === 'HKD') return 'HK$';
  return '';
}

function isConvertibleAsset(item: MarketSnapshotItem) {
  return item.currency === 'USD' && (item.category === 'metals' || item.category === 'crypto');
}

function resolveDisplayCurrencyCode(
  item: MarketSnapshotItem,
  displayCurrency: MarketDisplayCurrency,
  usdCnyRate: number | null,
) {
  if (displayCurrency === 'CNY' && isConvertibleAsset(item) && usdCnyRate) {
    return 'CNY';
  }

  return item.currency;
}

function resolveDisplayValue(
  value: number | null,
  item: MarketSnapshotItem,
  displayCurrency: MarketDisplayCurrency,
  usdCnyRate: number | null,
) {
  if (value === null) return null;

  if (displayCurrency === 'CNY' && isConvertibleAsset(item) && usdCnyRate) {
    return value * usdCnyRate;
  }

  return value;
}

function formatMarketValue(
  item: MarketSnapshotItem,
  locale: string,
  displayCurrency: MarketDisplayCurrency,
  usdCnyRate: number | null,
) {
  const value = resolveDisplayValue(item.latest, item, displayCurrency, usdCnyRate);
  if (value === null) return '--';

  const currencyCode = resolveDisplayCurrencyCode(item, displayCurrency, usdCnyRate);
  const prefix = getCurrencyPrefix(currencyCode);
  const formatted = formatNumber(value, item.decimals, locale);

  if (prefix) return `${prefix}${formatted}`;
  if (currencyCode === 'pts') return `${formatted} pts`;
  return `${formatted} ${currencyCode}`;
}

function formatMarketDelta(
  value: number | null,
  digits: number,
  locale: string,
  options?: { suffix?: string; currency?: string },
) {
  if (value === null) return '--';

  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  const formatted = formatNumber(Math.abs(value), digits, locale);

  if (options?.currency) {
    const prefix = getCurrencyPrefix(options.currency);
    if (prefix) return `${sign}${prefix}${formatted}`;
    if (options.currency === 'pts') return `${sign}${formatted} pts`;
    return `${sign}${formatted} ${options.currency}`;
  }

  return `${sign}${formatted}${options?.suffix ?? ''}`;
}

function getDisplayUnitLabel(
  item: MarketSnapshotItem,
  displayCurrency: MarketDisplayCurrency,
  usdCnyRate: number | null,
  isZh: boolean,
) {
  const converted = displayCurrency === 'CNY' && isConvertibleAsset(item) && Boolean(usdCnyRate);
  const currencyCode = resolveDisplayCurrencyCode(item, displayCurrency, usdCnyRate);

  if (converted) return isZh ? '人民币（换算）' : 'Chinese yuan (converted)';
  if (currencyCode === 'pts') return isZh ? '点位' : 'Points';
  if (currencyCode === 'USD') return isZh ? '美元' : 'US dollar';
  if (currencyCode === 'CNY') return isZh ? '人民币' : 'Chinese yuan';
  if (currencyCode === 'HKD') return isZh ? '港元' : 'Hong Kong dollar';

  return currencyCode;
}

function getDisplayUnitHint(
  item: MarketSnapshotItem,
  displayCurrency: MarketDisplayCurrency,
  usdCnyRate: number | null,
  isZh: boolean,
) {
  if (displayCurrency === 'CNY' && isConvertibleAsset(item) && usdCnyRate) {
    const rate = formatNumber(usdCnyRate, 4, 'en-US');
    return isZh ? `按 USD/CNY ${rate} 换算` : `Converted with USD/CNY ${rate}`;
  }

  if (item.currency === 'pts') {
    return isZh ? '指数按点位显示，不参与币种切换。' : 'Index levels stay in points.';
  }

  if (item.category === 'forex') {
    return isZh
      ? '外汇已统一按人民币报价显示，不受上方 USD/CNY 切换影响。'
      : 'FX pairs are already quoted against CNY and do not follow the USD/CNY toggle.';
  }

  return isZh ? '显示原始报价货币。' : 'Shown in the native quote currency.';
}

function getCategoryLabel(category: MarketCategory, isZh: boolean) {
  if (category === 'indices') return isZh ? '全球指数' : 'Global indices';
  if (category === 'metals') return isZh ? '贵金属' : 'Precious metals';
  if (category === 'crypto') return isZh ? '加密货币' : 'Crypto';
  return isZh ? '外汇' : 'FX';
}

const MARKET_ITEM_DESCRIPTIONS: Record<string, { zh: string; en: string }> = {
  dax: {
    zh: '德国 DAX 指数，跟踪法兰克福市场主要蓝筹公司。',
    en: 'Germany’s DAX index tracking major blue-chip companies in Frankfurt.',
  },
  ftse: {
    zh: '英国富时 100 指数，代表伦敦市场大型上市公司表现。',
    en: 'The UK FTSE 100 index covering large listed companies in London.',
  },
  fchi: {
    zh: '法国 CAC 40 指数，反映巴黎市场 40 只核心蓝筹股走势。',
    en: 'France’s CAC 40 index covering 40 core blue-chip stocks in Paris.',
  },
  n225: {
    zh: '日经 225 指数，日本 225 只代表性股票的价格加权指数。',
    en: 'Japan’s Nikkei 225, a price-weighted index of 225 representative stocks.',
  },
  ks11: {
    zh: '韩国综合股价指数，覆盖韩国交易所主要上市公司。',
    en: 'KOSPI, tracking major companies listed on the Korea Exchange.',
  },
  hsi: {
    zh: '恒生指数，反映香港股市主要大型上市公司的整体走势。',
    en: 'Hang Seng Index, tracking major listed companies in Hong Kong.',
  },
  nasdaq: {
    zh: '纳斯达克综合指数，覆盖纳斯达克市场的大量科技和成长型公司。',
    en: 'Nasdaq Composite, covering a broad set of growth and technology stocks.',
  },
  sse: {
    zh: '上证指数，即上证综指，覆盖上海证券交易所挂牌股票的整体表现。',
    en: 'SSE Composite Index, covering the overall performance of stocks listed in Shanghai.',
  },
  stoxx50e: {
    zh: 'Euro Stoxx 50 指数，追踪欧元区 50 家大型蓝筹公司。',
    en: 'The Euro Stoxx 50 index tracking 50 large eurozone blue chips.',
  },
  gold: {
    zh: '现货黄金，常被视为避险和通胀对冲资产。',
    en: 'Spot gold, commonly used as a safe-haven and inflation hedge.',
  },
  silver: {
    zh: '现货白银，兼具贵金属属性和工业需求。',
    en: 'Spot silver, a precious metal with strong industrial demand.',
  },
  platinum: {
    zh: '铂金，常用于汽车催化和珠宝等行业。',
    en: 'Platinum, widely used in auto catalysts and jewelry.',
  },
  palladium: {
    zh: '钯金，主要用于汽车尾气催化器等工业场景。',
    en: 'Palladium, mainly used in catalytic converters and other industrial uses.',
  },
  btc: {
    zh: '比特币，市值最大的去中心化加密货币。',
    en: 'Bitcoin, the largest decentralized cryptocurrency by market value.',
  },
  eth: {
    zh: '以太坊，支持智能合约和链上应用的主流加密资产。',
    en: 'Ethereum, a major crypto asset powering smart contracts and on-chain apps.',
  },
  sol: {
    zh: 'Solana 公链的原生代币，强调高吞吐和低手续费。',
    en: 'Solana’s native token, known for high throughput and low fees.',
  },
  xrp: {
    zh: 'XRP，常被用于跨境支付相关场景。',
    en: 'XRP, a crypto asset often associated with cross-border payments.',
  },
  'usd-cny': {
    zh: '美元兑人民币，表示 1 美元可兑换多少人民币。',
    en: 'USD/CNY, showing how many Chinese yuan one US dollar buys.',
  },
  'hkd-cny': {
    zh: '港元兑人民币，表示 1 港元可兑换多少人民币。',
    en: 'HKD/CNY, showing how many Chinese yuan one Hong Kong dollar buys.',
  },
  'eur-cny': {
    zh: '欧元兑人民币，表示 1 欧元可兑换多少人民币。',
    en: 'EUR/CNY, showing how many Chinese yuan one euro buys.',
  },
  'gbp-cny': {
    zh: '英镑兑人民币，表示 1 英镑可兑换多少人民币。',
    en: 'GBP/CNY, showing how many Chinese yuan one British pound buys.',
  },
  'jpy-cny': {
    zh: '日元兑人民币，表示 1 日元可兑换多少人民币。',
    en: 'JPY/CNY, showing how many Chinese yuan one Japanese yen buys.',
  },
  'krw-cny': {
    zh: '韩元兑人民币，表示 1 韩元可兑换多少人民币。',
    en: 'KRW/CNY, showing how many Chinese yuan one Korean won buys.',
  },
  'try-cny': {
    zh: '土耳其里拉兑人民币，表示 1 土耳其里拉可兑换多少人民币。',
    en: 'TRY/CNY, showing how many Chinese yuan one Turkish lira buys.',
  },
};

function getAssetDescription(item: MarketSnapshotItem, isZh: boolean) {
  const description = MARKET_ITEM_DESCRIPTIONS[item.id];
  if (!description) {
    return isZh
      ? `${item.labelZh} 的实时价格与走势说明。`
      : `A short explanation for ${item.labelEn} and what this market represents.`;
  }

  return isZh ? description.zh : description.en;
}

export function MarketTab() {
  const { language } = useI18n();
  const isZh = language === 'zh-CN';
  const locale = isZh ? 'zh-CN' : 'en-US';

  const [displayCurrency, setDisplayCurrency] =
    useState<MarketDisplayCurrency>(getInitialDisplayCurrency);
  const [snapshot, setSnapshot] = useState<MarketSnapshotPayload | null>(null);
  const [defaultAssetId, setDefaultAssetId] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [detailCache, setDetailCache] = useState<Record<string, MarketChartDetail>>({});
  const [snapshotError, setSnapshotError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isRefreshingMarket, setIsRefreshingMarket] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(MARKET_DISPLAY_CURRENCY_STORAGE_KEY, displayCurrency);
  }, [displayCurrency]);

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
  const usdCnyRate = useMemo(
    () => snapshot?.items.find((item) => item.id === 'usd-cny')?.latest ?? null,
    [snapshot?.items],
  );
  const selectedChartSeries = useMemo(() => {
    if (!selectedDetail || !selectedItem) return [];

    return selectedDetail.series.map((point) => ({
      ...point,
      value:
        resolveDisplayValue(point.value, selectedItem, displayCurrency, usdCnyRate) ?? point.value,
    }));
  }, [displayCurrency, selectedDetail, selectedItem, usdCnyRate]);
  const groupedItems = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        items: (snapshot?.items ?? []).filter((item) => item.category === category),
      })).filter((group) => group.items.length > 0),
    [snapshot?.items],
  );

  const handleSelectAsset = useCallback(
    (assetId: string) => {
      setSelectedAssetId(assetId);
      if (!detailCache[assetId]) void loadDetail(assetId);
    },
    [detailCache, loadDetail],
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
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={item.id === selectedAssetId}
                      className={cn(
                        'w-full rounded-[20px] border px-3 py-3 text-left transition-colors',
                        item.id === selectedAssetId
                          ? 'border-[color:var(--border-strong)] bg-[var(--surface-strong)]'
                          : 'border-[color:var(--border-subtle)] bg-[var(--surface-card)] hover:bg-[var(--surface-strong)]',
                      )}
                      onClick={() => {
                        handleSelectAsset(item.id);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          handleSelectAsset(item.id);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="inline-flex max-w-full items-center gap-1 truncate text-sm font-medium text-zinc-50">
                            <span className="truncate">{isZh ? item.labelZh : item.labelEn}</span>
                            <InfoTooltip
                              className="shrink-0"
                              content={getAssetDescription(item, isZh)}
                            />
                          </p>
                          <p className="mt-0.5 text-xs text-zinc-500">{item.symbol}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-zinc-50">
                            {formatMarketValue(item, locale, displayCurrency, usdCnyRate)}
                          </p>
                          <p
                            className={cn(
                              'mt-0.5 text-xs',
                              positive ? 'text-emerald-300' : 'text-rose-300',
                            )}
                          >
                            {formatMarketDelta(item.changePercent, 2, locale, { suffix: '%' })}
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
                          {formatMarketDelta(
                            resolveDisplayValue(item.change, item, displayCurrency, usdCnyRate),
                            item.decimals,
                            locale,
                            {
                              currency: resolveDisplayCurrencyCode(
                                item,
                                displayCurrency,
                                usdCnyRate,
                              ),
                            },
                          )}
                        </span>
                      </div>
                    </div>
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
              <div className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-subtle)] bg-[var(--surface-panel)] p-1 shadow-sm">
                <button
                  type="button"
                  className={cn(
                    'h-8 min-w-12 rounded-full px-3 text-xs font-medium transition-colors',
                    displayCurrency === 'USD'
                      ? 'bg-[var(--surface-strong)] text-zinc-50'
                      : 'text-zinc-400 hover:bg-[var(--surface-card)] hover:text-zinc-200',
                  )}
                  onClick={() => setDisplayCurrency('USD')}
                  data-testid="market-display-currency-usd"
                >
                  USD
                </button>
                <button
                  type="button"
                  className={cn(
                    'h-8 min-w-12 rounded-full px-3 text-xs font-medium transition-colors',
                    displayCurrency === 'CNY'
                      ? 'bg-[var(--surface-strong)] text-zinc-50'
                      : 'text-zinc-400 hover:bg-[var(--surface-card)] hover:text-zinc-200',
                  )}
                  onClick={() => setDisplayCurrency('CNY')}
                  data-testid="market-display-currency-cny"
                >
                  CNY
                </button>
              </div>
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
                    <div className="inline-flex items-center gap-2">
                      <h3 className="text-xl font-semibold text-zinc-50">
                        {isZh ? selectedItem.labelZh : selectedItem.labelEn}
                      </h3>
                      <InfoTooltip content={getAssetDescription(selectedItem, isZh)} />
                    </div>
                    <p className="text-sm text-zinc-500">{selectedItem.symbol}</p>
                  </div>
                  <div className="space-y-2 md:text-right">
                    <p className="text-3xl font-semibold text-zinc-50">
                      {formatMarketValue(selectedItem, locale, displayCurrency, usdCnyRate)}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {getDisplayUnitHint(selectedItem, displayCurrency, usdCnyRate, isZh)}
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
                      <span>
                        {formatMarketDelta(
                          resolveDisplayValue(
                            selectedItem.change,
                            selectedItem,
                            displayCurrency,
                            usdCnyRate,
                          ),
                          selectedItem.decimals,
                          locale,
                          {
                            currency: resolveDisplayCurrencyCode(
                              selectedItem,
                              displayCurrency,
                              usdCnyRate,
                            ),
                          },
                        )}
                      </span>
                      <span>
                        {formatMarketDelta(selectedItem.changePercent, 2, locale, {
                          suffix: '%',
                        })}
                      </span>
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
                        data={selectedChartSeries}
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
                            formatMarketDelta(value, selectedItem.decimals, locale, {
                              currency: resolveDisplayCurrencyCode(
                                selectedItem,
                                displayCurrency,
                                usdCnyRate,
                              ),
                            }),
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
                    <span>{isZh ? '显示单位' : 'Display unit'}</span>
                    <InfoTooltip
                      content={
                        isZh
                          ? '这里会告诉你当前数字是按什么单位显示，以及是否用了人民币换算。'
                          : 'Shows the current quote unit and whether CNY conversion is applied.'
                      }
                    />
                  </p>
                  <p className="mt-2 text-sm font-medium text-zinc-50">
                    {getDisplayUnitLabel(selectedItem, displayCurrency, usdCnyRate, isZh)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    {getDisplayUnitHint(selectedItem, displayCurrency, usdCnyRate, isZh)}
                  </p>
                </div>
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
