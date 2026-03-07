import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { Router } from 'express';
import { dataDirectory } from '../db.js';
import {
  getMirrorTarget,
  isClientDownloadId,
  isClientDownloadPlatform,
  selectGitHubReleaseAsset,
  type ClientDownloadId,
  type ClientDownloadPlatform,
  type GitHubReleasePayload,
} from '../client-downloads.js';

const router = Router();
const DEFAULT_CACHE_TTL_MINUTES = 6 * 60;
const configuredCacheTtlMinutes = Number.parseInt(
  process.env.CLIENT_DOWNLOAD_CACHE_TTL_MINUTES ?? '',
  10,
);
const CACHE_TTL_MS =
  Number.isFinite(configuredCacheTtlMinutes) && configuredCacheTtlMinutes > 0
    ? configuredCacheTtlMinutes * 60 * 1000
    : DEFAULT_CACHE_TTL_MINUTES * 60 * 1000;
const cacheDirectory = path.join(dataDirectory, 'client-download-cache');
const inflightDownloads = new Map<string, Promise<CachedDownload>>();

interface CachedDownload {
  cachedAt: number;
  contentType: string;
  fileName: string;
  filePath: string;
  sourceUrl: string;
  tagName: string;
}

class ManagedMirrorError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

function ensureCacheDir() {
  if (!fs.existsSync(cacheDirectory)) {
    fs.mkdirSync(cacheDirectory, { recursive: true });
  }
}

function normalizeCacheKey(clientId: ClientDownloadId, platform: ClientDownloadPlatform) {
  return `${clientId}-${platform}`;
}

function getMetadataPath(cacheKey: string) {
  return path.join(cacheDirectory, `${cacheKey}.json`);
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-');
}

function readCachedDownload(cacheKey: string): CachedDownload | null {
  const metadataPath = getMetadataPath(cacheKey);
  if (!fs.existsSync(metadataPath)) return null;

  try {
    const parsed = JSON.parse(fs.readFileSync(metadataPath, 'utf8')) as CachedDownload;
    if (
      !parsed ||
      typeof parsed.filePath !== 'string' ||
      typeof parsed.fileName !== 'string' ||
      typeof parsed.cachedAt !== 'number'
    ) {
      return null;
    }
    if (!fs.existsSync(parsed.filePath)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isCacheFresh(entry: CachedDownload) {
  return Date.now() - entry.cachedAt < CACHE_TTL_MS;
}

function pruneOlderCacheEntries(cacheKey: string, keepFilePath: string) {
  const prefix = `${cacheKey}-`;
  for (const fileName of fs.readdirSync(cacheDirectory)) {
    if (!fileName.startsWith(prefix)) continue;
    const candidatePath = path.join(cacheDirectory, fileName);
    if (candidatePath === keepFilePath) continue;
    fs.rmSync(candidatePath, { force: true });
  }
}

async function fetchLatestRelease(repo: string): Promise<GitHubReleasePayload> {
  const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Prism',
    },
  });

  if (!response.ok) {
    throw new ManagedMirrorError(
      `Failed to fetch latest release metadata for ${repo} (HTTP ${response.status}).`,
    );
  }

  const payload = (await response.json()) as GitHubReleasePayload;
  if (!payload || !Array.isArray(payload.assets)) {
    throw new ManagedMirrorError(`Invalid release metadata returned for ${repo}.`);
  }

  return payload;
}

async function downloadToCache(
  cacheKey: string,
  tagName: string,
  asset: { name: string; browser_download_url: string; content_type?: string },
): Promise<CachedDownload> {
  const safeTag = sanitizeFileName(tagName || 'latest');
  const safeAssetName = sanitizeFileName(asset.name);
  const targetPath = path.join(cacheDirectory, `${cacheKey}-${safeTag}-${safeAssetName}`);
  const tempPath = `${targetPath}.part`;

  const response = await fetch(asset.browser_download_url, {
    headers: { 'User-Agent': 'Prism' },
    redirect: 'follow',
  });

  if (!response.ok || !response.body) {
    throw new ManagedMirrorError(
      `Failed to download ${asset.name} from upstream (HTTP ${response.status}).`,
    );
  }

  await pipeline(Readable.fromWeb(response.body as any), fs.createWriteStream(tempPath));

  fs.rmSync(targetPath, { force: true });
  fs.renameSync(tempPath, targetPath);

  const metadata: CachedDownload = {
    cachedAt: Date.now(),
    contentType:
      typeof asset.content_type === 'string' && asset.content_type.trim()
        ? asset.content_type
        : 'application/octet-stream',
    fileName: asset.name,
    filePath: targetPath,
    sourceUrl: asset.browser_download_url,
    tagName,
  };

  fs.writeFileSync(getMetadataPath(cacheKey), JSON.stringify(metadata, null, 2), 'utf8');
  pruneOlderCacheEntries(cacheKey, targetPath);
  return metadata;
}

async function refreshManagedMirror(
  clientId: ClientDownloadId,
  platform: ClientDownloadPlatform,
): Promise<CachedDownload> {
  const target = getMirrorTarget(clientId, platform);
  if (!target) {
    throw new ManagedMirrorError(
      `No managed mirror is available for ${clientId} on ${platform}.`,
      404,
    );
  }

  const release = await fetchLatestRelease(target.repo);
  const asset = selectGitHubReleaseAsset(release, clientId, platform);
  if (!asset) {
    throw new ManagedMirrorError(
      `Latest release for ${clientId} does not expose a supported ${platform} asset.`,
      404,
    );
  }

  return downloadToCache(normalizeCacheKey(clientId, platform), release.tag_name, asset);
}

async function ensureCachedDownload(
  clientId: ClientDownloadId,
  platform: ClientDownloadPlatform,
): Promise<CachedDownload> {
  ensureCacheDir();

  const cacheKey = normalizeCacheKey(clientId, platform);
  const cached = readCachedDownload(cacheKey);
  if (cached && isCacheFresh(cached)) {
    return cached;
  }

  const existingInflight = inflightDownloads.get(cacheKey);
  if (existingInflight) {
    return existingInflight;
  }

  const refreshPromise = refreshManagedMirror(clientId, platform)
    .catch((error) => {
      if (cached) {
        console.warn(
          `[Prism] Client mirror refresh failed for ${cacheKey}; serving stale cache instead:`,
          error,
        );
        return cached;
      }
      throw error;
    })
    .finally(() => {
      inflightDownloads.delete(cacheKey);
    });

  inflightDownloads.set(cacheKey, refreshPromise);
  return refreshPromise;
}

router.get('/:clientId', async (req, res) => {
  const clientId = String(req.params.clientId ?? '').trim();
  const platform = String(req.query.platform ?? '')
    .trim()
    .toLowerCase();

  if (!isClientDownloadId(clientId)) {
    return res.status(404).json({ error: 'Unknown client download target.' });
  }
  if (!isClientDownloadPlatform(platform)) {
    return res.status(400).json({ error: 'A valid platform query is required.' });
  }

  try {
    const cached = await ensureCachedDownload(clientId, platform);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Content-Type', cached.contentType || 'application/octet-stream');
    return res.download(cached.filePath, cached.fileName);
  } catch (error) {
    const status = error instanceof ManagedMirrorError ? error.status : 502;
    const message = error instanceof Error ? error.message : 'Failed to prepare download mirror.';
    return res.status(status).json({ error: message });
  }
});

export default router;
