import React, { useCallback, useEffect, useState } from 'react';
import { Copy, RefreshCw, Save, ShieldAlert } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { useToast } from '@/src/components/ui/Toast';
import {
  getAdminDmitTraffic,
  postAdminDmitBillingSync,
  postAdminDmitTrafficManual,
  ADMIN_DMIT_USERSCRIPT_URL,
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

export function DmitSyncPage() {
  const [data, setData] = useState<AdminDmitTraffic | null>(null);
  const [exists, setExists] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [manual, setManual] = useState({
    bwusage: '',
    bwlimit: '',
    bwusage_in: '',
    bwusage_out: '',
  });
  const { toast } = useToast();

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
    }
  }, [toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onSubmitManual(e: React.FormEvent) {
    e.preventDefault();
    const bwusage = Number(manual.bwusage) * MB_PER_GB;
    const bwlimit = Number(manual.bwlimit) * MB_PER_GB;
    if (!Number.isFinite(bwusage) || !Number.isFinite(bwlimit) || bwlimit <= 0) {
      toast('请填写合法的 GB 值', 'error');
      return;
    }
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
    }
  }

  async function onForceBillingSync() {
    try {
      const r = await postAdminDmitBillingSync();
      toast(`已为 ${r.updated} 个 inbound 设置 billing_day = ${r.billing_day}`, 'success');
      void refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'sync failed', 'error');
    }
  }

  async function onCopyScript() {
    try {
      const r = await fetch(ADMIN_DMIT_USERSCRIPT_URL, { credentials: 'include' });
      if (!r.ok) throw new Error(`fetch failed: ${r.status}`);
      const text = await r.text();
      await navigator.clipboard.writeText(text);
      toast('Tampermonkey 脚本已复制', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'copy failed', 'error');
    }
  }

  if (!configured) {
    return (
      <div className="content-shell-wide px-4 pb-6 md:px-6 xl:px-8">
        <Card>
          <CardHeader>
            <CardTitle>DMIT 同步未启用</CardTitle>
            <CardDescription>
              请在 .env 中配置 DMIT_SYNC_TOKEN 与 DMIT_SERVICE_ID 后重启服务
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="content-shell-wide space-y-4 px-4 pb-6 md:px-6 xl:px-8">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <CardTitle>DMIT 流量同步</CardTitle>
            <CardDescription>
              {exists && data
                ? `最后同步：${relativeTime(data.updated_at)}（${data.source}）${
                    data.is_stale ? ' ⚠ 已超过 7 天' : ''
                  }`
                : '尚未同步过任何数据'}
            </CardDescription>
          </div>
          <Button variant="outline" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
            刷新
          </Button>
        </CardHeader>
        {exists && data && (
          <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="已用" value={formatGB(data.bwusage_mb)} />
            <Stat label="总量" value={formatGB(data.bwlimit_mb)} />
            <Stat label="入站" value={formatGB(data.bwusage_in_mb)} />
            <Stat label="出站" value={formatGB(data.bwusage_out_mb)} />
          </CardContent>
        )}
      </Card>

      {exists && data && data.next_reset_day != null && (
        <Card>
          <CardHeader>
            <CardTitle>Billing Day 状态</CardTitle>
            <CardDescription>
              DMIT 重置日：每月 {data.next_reset_day} 日 UTC
              {data.auto_applied_billing_day != null
                ? `（已自动同步至 3X-UI = ${data.auto_applied_billing_day}）`
                : '（尚未自动同步）'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => void onForceBillingSync()}>
              <ShieldAlert className="mr-2 h-4 w-4" />
              强制同步所有 inbound 的 billing_day
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Tampermonkey 同步脚本</CardTitle>
          <CardDescription>
            装好 Tampermonkey 扩展后，复制下面的脚本新建一个用户脚本粘贴保存即可。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => void onCopyScript()}>
            <Copy className="mr-2 h-4 w-4" />
            复制脚本到剪贴板
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>手动同步（兜底）</CardTitle>
          <CardDescription>仅在 Tampermonkey 失效时使用，单位为 GB</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid grid-cols-1 gap-3 md:grid-cols-2"
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
              label="入站 (GB, 可选)"
              value={manual.bwusage_in}
              onChange={(v) => setManual((m) => ({ ...m, bwusage_in: v }))}
            />
            <FormField
              label="出站 (GB, 可选)"
              value={manual.bwusage_out}
              onChange={(v) => setManual((m) => ({ ...m, bwusage_out: v }))}
            />
            <div className="md:col-span-2">
              <Button type="submit">
                <Save className="mr-2 h-4 w-4" />
                保存
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-[var(--text-tertiary)]">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
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
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="0.00" />
    </label>
  );
}
