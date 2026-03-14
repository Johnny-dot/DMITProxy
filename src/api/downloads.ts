import { localFetch } from './base';
import type { ClientDownloadId, ClientDownloadPlatform } from '@/src/utils/clientDownloads';

export type ManagedMirrorCacheState = 'fresh' | 'stale' | 'missing';

export interface ManagedMirrorStatus {
  supported: boolean;
  platform: ClientDownloadPlatform;
  cacheState: ManagedMirrorCacheState;
  inflight: boolean;
  cachedAt: number | null;
  fileName: string | null;
  tagName: string | null;
}

export function getManagedMirrorStatus(
  clientId: ClientDownloadId,
  platform: ClientDownloadPlatform,
): Promise<ManagedMirrorStatus> {
  return localFetch<ManagedMirrorStatus>(
    `/local/downloads/${encodeURIComponent(clientId)}/status?platform=${encodeURIComponent(platform)}`,
    {
      cache: 'no-store',
      fallbackError: 'Failed to load mirror status',
    },
  );
}
