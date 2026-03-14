import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Download, ExternalLink, RefreshCw, X } from 'lucide-react';
import { getManagedMirrorStatus, type ManagedMirrorStatus } from '@/src/api/downloads';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/Card';
import { Input } from '@/src/components/ui/Input';
import { useToast } from '@/src/components/ui/Toast';
import type { ClientDownloadId, ClientDownloadPlatform } from '@/src/utils/clientDownloads';
import {
  getManagedMirrorFallbackToast,
  getManagedMirrorStatusToast,
} from '@/src/utils/managedMirrorStatus';
import { cn } from '@/src/utils/cn';

interface MirrorDownloadDialogProps {
  open: boolean;
  url: string;
  clientName: string;
  platform: ClientDownloadPlatform;
  isZh: boolean;
  managed: boolean;
  clientId?: ClientDownloadId;
  onClose: () => void;
}

const PLATFORM_LABELS: Record<ClientDownloadPlatform, string> = {
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux',
  android: 'Android',
  ios: 'iPhone / iPad',
  harmonyos: 'HarmonyOS NEXT',
};

function getStatusBadge(
  status: ManagedMirrorStatus | null,
  isZh: boolean,
): { label: string; variant: 'outline' | 'secondary' | 'success' } {
  if (!status) {
    return {
      label: isZh ? '等待检测' : 'Pending check',
      variant: 'outline',
    };
  }

  if (status.cacheState === 'fresh' && !status.inflight) {
    return {
      label: isZh ? '缓存就绪' : 'Cache ready',
      variant: 'success',
    };
  }

  if (status.cacheState === 'missing' && status.inflight) {
    return {
      label: isZh ? '正在拉取' : 'Fetching now',
      variant: 'secondary',
    };
  }

  if (status.cacheState === 'missing') {
    return {
      label: isZh ? '首次下载' : 'First download',
      variant: 'secondary',
    };
  }

  return {
    label: isZh ? '缓存待刷新' : 'Cache refreshing',
    variant: 'outline',
  };
}

function formatCachedAt(value: number | null, isZh: boolean): string {
  if (!value) return isZh ? '尚未缓存' : 'Not cached yet';
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(value);
  } catch {
    return new Date(value).toLocaleString();
  }
}

export function MirrorDownloadDialog({
  open,
  url,
  clientName,
  platform,
  isZh,
  managed,
  clientId,
  onClose,
}: MirrorDownloadDialogProps) {
  const { toast } = useToast();
  const [status, setStatus] = useState<ManagedMirrorStatus | null>(null);
  const [statusError, setStatusError] = useState('');
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

  const resolvedUrl = useMemo(() => {
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    if (typeof window === 'undefined') return url;
    return new URL(url, window.location.origin).toString();
  }, [url]);

  const loadStatus = useCallback(async () => {
    if (!managed || !clientId) {
      setStatus(null);
      setStatusError('');
      return;
    }

    setIsLoadingStatus(true);
    setStatusError('');
    try {
      const next = await getManagedMirrorStatus(clientId, platform);
      setStatus(next);
    } catch {
      setStatus(null);
      setStatusError(
        isZh ? '暂时无法获取当前镜像状态。' : 'Unable to load the current mirror status.',
      );
    } finally {
      setIsLoadingStatus(false);
    }
  }, [clientId, isZh, managed, platform]);

  useEffect(() => {
    if (!open) return;
    void loadStatus();
  }, [loadStatus, open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  const handleCopy = useCallback(async () => {
    if (!resolvedUrl) return;
    await navigator.clipboard.writeText(resolvedUrl);
    toast(isZh ? '下载链接已复制。' : 'Download link copied.', 'success');
  }, [isZh, resolvedUrl, toast]);

  const handleStartDownload = useCallback(() => {
    if (!resolvedUrl) return;
    window.open(resolvedUrl, '_blank', 'noopener,noreferrer');

    if (managed && clientId) {
      if (status) {
        const hint = getManagedMirrorStatusToast(status, isZh);
        toast(hint.message, hint.type);
      } else {
        const fallback = getManagedMirrorFallbackToast(isZh);
        toast(fallback.message, fallback.type);
      }
    } else {
      toast(isZh ? '已在新标签页打开镜像下载。' : 'Mirror download opened in a new tab.', 'info');
    }

    onClose();
  }, [clientId, isZh, managed, onClose, resolvedUrl, status, toast]);

  if (!open) return null;

  const statusBadge = getStatusBadge(status, isZh);
  const statusMessage = managed
    ? status
      ? getManagedMirrorStatusToast(status, isZh).message
      : statusError || (isZh ? '正在检查镜像状态。' : 'Checking the mirror status.')
    : isZh
      ? '这是一个已配置的镜像下载地址，点击后会在新标签页开始下载。'
      : 'This mirror uses a configured download URL and will open in a new tab.';

  return (
    <div
      className="fixed inset-0 z-[105] flex items-center justify-center bg-[var(--overlay)] p-4"
      onClick={onClose}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onClose();
      }}
    >
      <Card
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <CardHeader className="space-y-3 p-4 pb-3 sm:p-7 sm:pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={managed ? 'success' : 'outline'}>
                  {managed
                    ? isZh
                      ? '托管镜像'
                      : 'Managed mirror'
                    : isZh
                      ? '自定义镜像'
                      : 'Custom mirror'}
                </Badge>
                <Badge variant="outline">{PLATFORM_LABELS[platform]}</Badge>
                <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-4 w-4 text-[var(--accent)]" />
                  {isZh ? `${clientName} 镜像下载` : `${clientName} mirror download`}
                </CardTitle>
                <CardDescription className="mt-2">
                  {isZh
                    ? '先确认当前镜像状态，再开始下载，会比直接跳转更可控。'
                    : 'Check the mirror state first, then start the download when you are ready.'}
                </CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 space-y-4 overflow-y-auto px-4 pb-4 pt-0 sm:px-7 sm:pb-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[20px] border border-[color:var(--border-subtle)] bg-[var(--surface-panel)] p-3.5 sm:p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                {isZh ? '当前状态' : 'Current status'}
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-primary)]">{statusMessage}</p>
            </div>
            <div className="rounded-[20px] border border-[color:var(--border-subtle)] bg-[var(--surface-panel)] p-3.5 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                  {isZh ? '镜像文件' : 'Mirror file'}
                </p>
                {managed ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    onClick={() => void loadStatus()}
                    disabled={isLoadingStatus}
                  >
                    <RefreshCw className={cn('h-3.5 w-3.5', isLoadingStatus && 'animate-spin')} />
                    {isZh ? '刷新' : 'Refresh'}
                  </Button>
                ) : null}
              </div>
              <p className="mt-2 break-all text-sm font-medium text-[var(--text-primary)]">
                {status?.fileName ||
                  (isZh ? '首次请求时由服务器准备' : 'Prepared by the server on first request')}
              </p>
              <p className="mt-2 text-xs leading-6 text-[var(--text-secondary)]">
                {isZh ? '最近缓存时间：' : 'Last cached: '}
                {formatCachedAt(status?.cachedAt ?? null, isZh)}
              </p>
              {status?.tagName ? (
                <p className="text-xs leading-6 text-[var(--text-secondary)]">
                  {isZh ? '上游版本：' : 'Upstream tag: '}
                  {status.tagName}
                </p>
              ) : null}
              {statusError ? (
                <p className="mt-2 text-xs text-[var(--danger)]">{statusError}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
              {isZh ? '下载地址' : 'Download URL'}
            </p>
            <Input value={resolvedUrl} readOnly className="font-mono text-xs" />
            <p className="text-xs leading-6 text-[var(--text-secondary)]">
              {isZh
                ? '点击开始下载后，会在新标签页打开下载请求；复制链接适合手动排查或转发。'
                : 'Starting the download opens the request in a new tab. Copy the link if you need to debug or share it.'}
            </p>
          </div>
        </CardContent>
        <CardFooter className="border-t border-[color:var(--border-subtle)] bg-[var(--surface-card)] px-4 pb-4 pt-4 sm:px-7 sm:pb-6">
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button variant="ghost" className="gap-2" onClick={onClose}>
              {isZh ? '稍后再说' : 'Not now'}
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" className="gap-2" onClick={() => void handleCopy()}>
                <Copy className="h-4 w-4" />
                {isZh ? '复制链接' : 'Copy link'}
              </Button>
              <Button className="gap-2" onClick={handleStartDownload}>
                <ExternalLink className="h-4 w-4" />
                {isZh ? '开始下载' : 'Start download'}
              </Button>
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
