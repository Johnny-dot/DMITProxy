import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  CalendarClock,
  Check,
  Database,
  RefreshCw,
  SatelliteDish,
  Save,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { useToast } from '@/src/components/ui/Toast';
import { cn } from '@/src/utils/cn';
import {
  getAdminDmitTraffic,
  postAdminDmitBillingSync,
  postAdminDmitTrafficManual,
  type AdminDmitTraffic,
} from '@/src/api/client';

const MB_PER_GB = 1024;

function formatGB(mb: number | null | undefined): string {
  if (mb == null) return '—';
  return `${(mb / MB_PER_GB).toFixed(2)} GB`;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return '刚刚';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小时前`;
  return `${Math.floor(diff / 86400_000)} 天前`;
}

/** Threshold colors for the usage gauge — used% rising toward the cap is "worse". */
function gaugeTone(pct: number) {
  if (pct < 60)
    return { bar: 'bg-emerald-500', text: 'text-emerald-400', glow: 'bg-emerald-500/20' };
  if (pct < 85) return { bar: 'bg-amber-500', text: 'text-amber-400', glow: 'bg-amber-500/20' };
  return { bar: 'bg-red-500', text: 'text-red-400', glow: 'bg-red-500/20' };
}

export function DmitSyncPage() {
  const [data, setData] = useState<AdminDmitTraffic | null>(null);
  const [exists, setExists] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [savingManual, setSavingManual] = useState(false);
  const [syncingBilling, setSyncingBilling] = useState(false);
  const [manual, setManual] = useState({
    bwusage: '',
    bwlimit: '',
    bwusage_in: '',
    bwusage_out: '',
  });
  const { toast } = useToast();

  // Honor reduced-motion: skip the staggered page-load reveal entirely.
  const [reduceMotion] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const reveal = (i: number): React.CSSProperties =>
    reduceMotion
      ? {}
      : {
          animation: 'anim-route-in 420ms cubic-bezier(0.16, 1, 0.3, 1) both',
          animationDelay: `${i * 80}ms`,
        };

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getAdminDmitTraffic();
      setExists(r.exists);
      setConfigured(r.configured);
      setData(r.data ?? null);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'load failed', 'error');
    } finally {
      setLoading(false);
      setInitialLoaded(true);
    }
  }, [toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onSubmitManual(e: React.FormEvent) {
    e.preventDefault();
    if (savingManual) return;
    const bwusage = Number(manual.bwusage) * MB_PER_GB;
    const bwlimit = Number(manual.bwlimit) * MB_PER_GB;
    if (!Number.isFinite(bwusage) || !Number.isFinite(bwlimit) || bwlimit <= 0) {
      toast('请填写合法的 GB 值', 'error');
      return;
    }
    setSavingManual(true);
    try {
      await postAdminDmitTrafficManual({
        bwusage: Math.round(bwusage),
        bwlimit: Math.round(bwlimit),
        bwusage_in: manual.bwusage_in
          ? Math.round(Number(manual.bwusage_in) * MB_PER_GB)
          : undefined,
        bwusage_out: manual.bwusage_out
          ? Math.round(Number(manual.bwusage_out) * MB_PER_GB)
          : undefined,
      });
      toast('已保存', 'success');
      void refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'save failed', 'error');
    } finally {
      setSavingManual(false);
    }
  }

  async function onForceBillingSync() {
    if (syncingBilling) return;
    setSyncingBilling(true);
    try {
      const r = await postAdminDmitBillingSync();
      toast(`已为 ${r.updated} 个 inbound 设置 billing_day = ${r.billing_day}`, 'success');
      void refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'sync failed', 'error');
    } finally {
      setSyncingBilling(false);
    }
  }

  // ── Not configured ────────────────────────────────────────────────────────
  if (initialLoaded && !configured) {
    return (
      <div className="content-shell-wide px-4 pb-6 md:px-6 xl:px-8">
        <div className="surface-card relative overflow-hidden p-10 text-center" style={reveal(0)}>
          <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-24 w-2/3 rounded-full bg-amber-500/15 blur-3xl" />
          <div className="glass-pill mx-auto flex h-14 w-14 items-center justify-center border border-amber-400/25 bg-amber-500/10 text-amber-400">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h2 className="mt-5 text-xl font-semibold tracking-tight">DMIT 同步未启用</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-[var(--text-secondary)]">
            请在 <code className="font-mono text-[var(--text-primary)]">.env</code> 中配置{' '}
            <code className="font-mono text-[var(--accent)]">DMIT_SYNC_TOKEN</code> 与{' '}
            <code className="font-mono text-[var(--accent)]">DMIT_SERVICE_ID</code> 后重启服务。
          </p>
        </div>
      </div>
    );
  }

  const usedMb = data?.bwusage_mb ?? 0;
  const limitMb = data?.bwlimit_mb ?? 0;
  const remainingMb = Math.max(0, limitMb - usedMb);
  const pct = limitMb > 0 ? Math.min(100, (usedMb / limitMb) * 100) : 0;
  const tone = gaugeTone(pct);

  return (
    <div className="content-shell-wide w-full min-w-0 space-y-6 px-4 pb-8 md:px-6 xl:px-8">
      {/* ── Hero: the bandwidth gauge ───────────────────────────────────── */}
      <section className="surface-card relative overflow-hidden p-6 md:p-7" style={reveal(0)}>
        <div
          className={cn(
            'pointer-events-none absolute right-[-6rem] top-[-5rem] h-48 w-48 rounded-full blur-3xl transition-colors duration-700',
            initialLoaded && exists ? tone.glow : 'bg-[var(--accent-soft)]',
          )}
        />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="glass-pill flex h-11 w-11 items-center justify-center border border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]">
              <SatelliteDish className="h-5 w-5" />
            </div>
            <div>
              <p className="section-kicker">DMIT TRAFFIC</p>
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">DMIT 流量同步</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {initialLoaded && exists && data && (
              <span className="glass-pill inline-flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-secondary)]">
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    data.is_stale ? 'bg-red-500' : 'animate-pulse bg-emerald-500',
                  )}
                />
                {relativeTime(data.updated_at)}
                <span className="text-[var(--text-tertiary)]">·</span>
                <span className="font-mono">{data.source}</span>
              </span>
            )}
            <Button variant="outline" onClick={() => void refresh()} disabled={loading}>
              <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
              刷新
            </Button>
          </div>
        </div>

        {/* Gauge body */}
        <div className="relative mt-7">
          {!initialLoaded ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-56" />
              <Skeleton className="h-3 w-full rounded-full" />
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            </div>
          ) : !exists || !data ? (
            <div className="surface-panel flex flex-col items-center gap-2 px-6 py-10 text-center">
              <Activity className="h-6 w-6 text-[var(--text-tertiary)]" />
              <p className="text-sm font-medium text-[var(--text-primary)]">尚未同步过任何数据</p>
              <p className="max-w-sm text-xs leading-6 text-[var(--text-secondary)]">
                机器流量由代理节点上的 NIC agent 每 30 分钟自动上报；若长时间为空，检查节点上的{' '}
                <code className="font-mono">dmit-nic-sync.timer</code> 是否在运行。
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                    机器余量
                  </p>
                  <p className="mt-1 font-mono text-4xl font-semibold tracking-tight text-[var(--text-primary)] md:text-5xl">
                    {(remainingMb / MB_PER_GB).toFixed(2)}
                    <span className="ml-1.5 text-lg font-normal text-[var(--text-tertiary)] md:text-xl">
                      / {formatGB(limitMb)}
                    </span>
                  </p>
                </div>
                <div className="text-right">
                  <p className={cn('font-mono text-3xl font-semibold', tone.text)}>
                    {pct.toFixed(1)}%
                  </p>
                  <p className="text-[11px] uppercase tracking-wider text-[var(--text-tertiary)]">
                    已用占比
                  </p>
                </div>
              </div>

              <div className="glass-progress-track h-3 w-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-[width] duration-700 ease-out',
                    tone.bar,
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatChip
                  icon={Activity}
                  label="已用"
                  value={formatGB(data.bwusage_mb)}
                  tone="border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]"
                />
                <StatChip
                  icon={Database}
                  label="总量"
                  value={formatGB(data.bwlimit_mb)}
                  tone="border-white/10 bg-white/5 text-[var(--text-secondary)]"
                />
                <StatChip
                  icon={ArrowDownToLine}
                  label="入站"
                  value={formatGB(data.bwusage_in_mb)}
                  tone="border-emerald-400/25 bg-emerald-500/10 text-emerald-400"
                />
                <StatChip
                  icon={ArrowUpFromLine}
                  label="出站"
                  value={formatGB(data.bwusage_out_mb)}
                  tone="border-indigo-400/25 bg-indigo-500/10 text-indigo-400"
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Billing day ─────────────────────────────────────────────────── */}
      {exists && data && data.next_reset_day != null && (
        <section className="surface-card relative overflow-hidden p-6" style={reveal(1)}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="glass-pill flex h-11 w-11 items-center justify-center border border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]">
                <CalendarClock className="h-5 w-5" />
              </div>
              <div>
                <p className="section-kicker">BILLING DAY</p>
                <p className="text-base font-semibold tracking-tight">
                  每月 <span className="font-mono text-[var(--accent)]">{data.next_reset_day}</span>{' '}
                  日 · UTC 重置
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  {data.auto_applied_billing_day != null ? (
                    <span className="inline-flex items-center gap-1 text-emerald-400">
                      <Check className="h-3 w-3" /> 已自动同步至 3X-UI（={' '}
                      {data.auto_applied_billing_day}）
                    </span>
                  ) : (
                    '尚未自动同步到 3X-UI'
                  )}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => void onForceBillingSync()}
              disabled={syncingBilling}
            >
              <ShieldAlert className={cn('mr-2 h-4 w-4', syncingBilling && 'animate-spin')} />
              强制同步所有 inbound
            </Button>
          </div>
        </section>
      )}

      {/* ── Tampermonkey script + manual fallback ───────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section
          className="surface-card relative flex flex-col overflow-hidden p-6"
          style={reveal(2)}
        >
          <div className="pointer-events-none absolute inset-x-10 top-0 h-16 rounded-full bg-emerald-500/10 blur-3xl" />
          <p className="section-kicker">AUTO SYNC</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">NIC 自动同步</h2>
          <p className="mt-2 flex-1 text-sm leading-7 text-[var(--text-secondary)]">
            机器流量由代理节点上的 vnstat{' '}
            <span className="text-[var(--text-primary)]">NIC agent</span> 每 30
            分钟自动上报，基于网卡计数（= DMIT
            计费口径），无需浏览器脚本。上方状态点变红即表示同步滞后。
          </p>
          <div className="mt-4 surface-panel rounded-xl p-3 text-xs leading-6 text-[var(--text-secondary)]">
            滞后排查（在代理节点上）：
            <code className="ml-1 font-mono text-[var(--text-primary)]">
              systemctl status dmit-nic-sync.timer
            </code>{' '}
            ·{' '}
            <code className="font-mono text-[var(--text-primary)]">
              journalctl -u dmit-nic-sync
            </code>
          </div>
        </section>

        <section className="surface-card relative overflow-hidden p-6" style={reveal(3)}>
          <p className="section-kicker">MANUAL</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">手动同步（兜底）</h2>
          <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
            仅在 Tampermonkey 失效时使用，单位为 GB。
          </p>
          <form
            className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
            onSubmit={(e) => void onSubmitManual(e)}
          >
            <FormField
              label="已用 (GB)"
              value={manual.bwusage}
              onChange={(v) => setManual((m) => ({ ...m, bwusage: v }))}
            />
            <FormField
              label="总量 (GB)"
              value={manual.bwlimit}
              onChange={(v) => setManual((m) => ({ ...m, bwlimit: v }))}
            />
            <FormField
              label="入站 (GB · 可选)"
              value={manual.bwusage_in}
              onChange={(v) => setManual((m) => ({ ...m, bwusage_in: v }))}
            />
            <FormField
              label="出站 (GB · 可选)"
              value={manual.bwusage_out}
              onChange={(v) => setManual((m) => ({ ...m, bwusage_out: v }))}
            />
            <div className="sm:col-span-2">
              <Button type="submit" variant="outline" disabled={savingManual}>
                <Save className={cn('mr-2 h-4 w-4', savingManual && 'animate-spin')} />
                保存
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

function StatChip({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="surface-panel flex items-center gap-3 p-3">
      <div
        className={cn('glass-pill flex h-9 w-9 shrink-0 items-center justify-center border', tone)}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
          {label}
        </div>
        <div className="truncate font-mono text-sm font-semibold text-[var(--text-primary)]">
          {value}
        </div>
      </div>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-xs font-medium text-[var(--text-secondary)]">{label}</span>
      <Input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0.00"
        className="font-mono"
      />
    </label>
  );
}
