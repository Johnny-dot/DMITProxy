export type ClientDownloadId = 'v2rayN' | 'v2rayNG' | 'shadowrocket' | 'clashVerge' | 'hiddify';
export type ClientDownloadPlatform = 'windows' | 'macos' | 'android' | 'ios';

export interface ClientDownloadLinks {
  github: string;
  vps: string;
}

const GITHUB_DOWNLOADS: Record<ClientDownloadId, string> = {
  v2rayN: 'https://github.com/2dust/v2rayN/releases/latest',
  v2rayNG: 'https://github.com/2dust/v2rayNG/releases/latest',
  shadowrocket: 'https://apps.apple.com/app/shadowrocket/id932747118',
  clashVerge: 'https://github.com/clash-verge-rev/clash-verge-rev/releases/latest',
  hiddify: 'https://github.com/hiddify/hiddify-app/releases/latest',
};

const MANAGED_MIRROR_SUPPORTED_PLATFORMS: Record<ClientDownloadId, ClientDownloadPlatform[]> = {
  v2rayN: ['windows'],
  v2rayNG: ['android'],
  shadowrocket: [],
  clashVerge: ['windows', 'macos'],
  hiddify: ['windows', 'macos', 'android'],
};

const DEFAULT_VPS_FILES: Partial<
  Record<ClientDownloadId, Partial<Record<ClientDownloadPlatform, string>>>
> = {
  v2rayN: {
    windows: 'v2rayN-windows-64.zip',
  },
  v2rayNG: {
    android: 'v2rayNG-universal.apk',
  },
  clashVerge: {
    windows: 'clash-verge-x64-setup.exe',
    macos: 'clash-verge-x64.dmg',
  },
  hiddify: {
    windows: 'hiddify-windows-x64.exe',
    macos: 'hiddify-macos.dmg',
    android: 'hiddify-android-universal.apk',
  },
};

function normalizeUrl(url: string | undefined): string {
  return typeof url === 'string' ? url.trim() : '';
}

function joinUrl(base: string, fileName: string): string {
  const normalizedBase = base.replace(/\/+$/, '');
  const normalizedFile = fileName.replace(/^\/+/, '');
  return `${normalizedBase}/${normalizedFile}`;
}

function supportsManagedMirror(id: ClientDownloadId, platform: ClientDownloadPlatform): boolean {
  return MANAGED_MIRROR_SUPPORTED_PLATFORMS[id].includes(platform);
}

function buildManagedMirrorPath(id: ClientDownloadId, platform: ClientDownloadPlatform): string {
  const query = new URLSearchParams({ platform });
  return `/local/downloads/${id}?${query.toString()}`;
}

function resolveVpsDownload(id: ClientDownloadId, platform: ClientDownloadPlatform): string {
  const explicit = {
    v2rayN: normalizeUrl(import.meta.env.VITE_CLIENT_DOWNLOAD_VPS_V2RAYN_URL),
    v2rayNG: normalizeUrl(import.meta.env.VITE_CLIENT_DOWNLOAD_VPS_V2RAYNG_URL),
    shadowrocket: normalizeUrl(import.meta.env.VITE_CLIENT_DOWNLOAD_VPS_SHADOWROCKET_URL),
    clashVerge: normalizeUrl(import.meta.env.VITE_CLIENT_DOWNLOAD_VPS_CLASH_VERGE_URL),
    hiddify: normalizeUrl(import.meta.env.VITE_CLIENT_DOWNLOAD_VPS_HIDDIFY_URL),
  } satisfies Record<ClientDownloadId, string>;

  if (explicit[id]) return explicit[id];

  const base = normalizeUrl(import.meta.env.VITE_CLIENT_DOWNLOAD_VPS_BASE_URL);
  const defaultFile = DEFAULT_VPS_FILES[id]?.[platform];
  if (base && defaultFile) return joinUrl(base, defaultFile);

  return supportsManagedMirror(id, platform) ? buildManagedMirrorPath(id, platform) : '';
}

export function getClientDownloadLinks(
  id: ClientDownloadId,
  platform: ClientDownloadPlatform = 'windows',
): ClientDownloadLinks {
  return {
    github: GITHUB_DOWNLOADS[id],
    vps: resolveVpsDownload(id, platform),
  };
}
