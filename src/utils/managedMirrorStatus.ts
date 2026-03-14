import type { ManagedMirrorStatus } from '@/src/api/downloads';

export function getManagedMirrorStatusToast(
  status: ManagedMirrorStatus,
  isZh: boolean,
): {
  message: string;
  type: 'success' | 'info';
} {
  if (status.cacheState === 'fresh' && !status.inflight) {
    return {
      type: 'success',
      message: isZh
        ? '镜像已命中当前 VPS 缓存，正在开始下载。'
        : 'Mirror cache hit on this VPS. Your download is starting.',
    };
  }

  if (status.cacheState === 'missing' && status.inflight) {
    return {
      type: 'info',
      message: isZh
        ? '这个镜像已经在拉取官方源了，本次下载可能需要稍等一会。'
        : 'This mirror is already being fetched from the official source, so the download may take a moment.',
    };
  }

  if (status.cacheState === 'missing') {
    return {
      type: 'info',
      message: isZh
        ? '首次镜像下载会先由 VPS 从官方源拉取并缓存，可能需要等待几十秒。'
        : 'The first mirror download fetches and caches the official package on this VPS, so it may take a little longer.',
    };
  }

  return {
    type: 'info',
    message: isZh
      ? '当前镜像缓存已过期，VPS 会先尝试刷新；如果上游较慢，可能临时回退旧缓存。'
      : 'This mirror cache is stale. The VPS will try to refresh it first and may temporarily fall back to the older cache if upstream is slow.',
  };
}

export function getManagedMirrorFallbackToast(isZh: boolean): {
  message: string;
  type: 'info';
} {
  return {
    type: 'info',
    message: isZh
      ? '镜像下载已开始。首次请求可能需要等待 VPS 从官方源准备缓存。'
      : 'Mirror download started. The first request may wait while the VPS prepares the upstream cache.',
  };
}
