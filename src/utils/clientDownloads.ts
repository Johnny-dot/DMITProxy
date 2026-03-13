export type ClientDownloadId =
  | 'v2rayN'
  | 'v2rayNG'
  | 'surge'
  | 'shadowrocket'
  | 'clashBox'
  | 'clashVerge'
  | 'flClash'
  | 'exclave'
  | 'clashMeta'
  | 'sparkle'
  | 'singBox'
  | 'hiddify';
export type ClientDownloadPlatform =
  | 'windows'
  | 'macos'
  | 'linux'
  | 'android'
  | 'ios'
  | 'harmonyos';

export interface ClientDownloadLinks {
  github: string;
  vps: string;
}

const OFFICIAL_DOWNLOADS: Record<ClientDownloadId, string> = {
  v2rayN: 'https://github.com/2dust/v2rayN/releases/latest',
  v2rayNG: 'https://github.com/2dust/v2rayNG/releases/latest',
  surge: 'https://apps.apple.com/app/surge-5/id1442620678',
  shadowrocket: 'https://apps.apple.com/app/shadowrocket/id932747118',
  clashBox: 'https://github.com/xiaobaigroup/ClashBox/releases/latest',
  clashVerge: 'https://github.com/clash-verge-rev/clash-verge-rev/releases/latest',
  flClash: 'https://github.com/chen08209/FlClash/releases/latest',
  exclave: 'https://github.com/dyhkwong/Exclave/releases/latest',
  clashMeta: 'https://github.com/MetaCubeX/ClashMetaForAndroid/releases/latest',
  sparkle: 'https://github.com/xishang0128/mihomo-party/releases/latest',
  singBox: 'https://sing-box.sagernet.org/zh/clients/android/',
  hiddify: 'https://github.com/hiddify/hiddify-app/releases/latest',
};

const PLATFORM_OFFICIAL_DOWNLOADS: Partial<
  Record<ClientDownloadId, Partial<Record<ClientDownloadPlatform, string>>>
> = {
  singBox: {
    android: 'https://sing-box.sagernet.org/zh/clients/android/',
    macos: 'https://sing-box.sagernet.org/zh/clients/apple/',
    linux: 'https://sing-box.sagernet.org/zh/installation/package-manager/',
    ios: 'https://apps.apple.com/app/sing-box-vt/id6673731168',
  },
};

const MANAGED_MIRROR_SUPPORTED_PLATFORMS: Record<ClientDownloadId, ClientDownloadPlatform[]> = {
  v2rayN: ['windows'],
  v2rayNG: ['android'],
  surge: [],
  shadowrocket: [],
  clashBox: [],
  clashVerge: ['windows', 'macos'],
  flClash: [],
  exclave: [],
  clashMeta: [],
  sparkle: [],
  singBox: [],
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
  surge: {},
  clashVerge: {
    windows: 'clash-verge-x64-setup.exe',
    macos: 'clash-verge-x64.dmg',
  },
  clashBox: {},
  flClash: {},
  exclave: {},
  clashMeta: {},
  sparkle: {},
  singBox: {},
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
    surge: normalizeUrl(import.meta.env.VITE_CLIENT_DOWNLOAD_VPS_SURGE_URL),
    shadowrocket: normalizeUrl(import.meta.env.VITE_CLIENT_DOWNLOAD_VPS_SHADOWROCKET_URL),
    clashBox: normalizeUrl(import.meta.env.VITE_CLIENT_DOWNLOAD_VPS_CLASHBOX_URL),
    clashVerge: normalizeUrl(import.meta.env.VITE_CLIENT_DOWNLOAD_VPS_CLASH_VERGE_URL),
    flClash: normalizeUrl(import.meta.env.VITE_CLIENT_DOWNLOAD_VPS_FLCLASH_URL),
    exclave: normalizeUrl(import.meta.env.VITE_CLIENT_DOWNLOAD_VPS_EXCLAVE_URL),
    clashMeta: normalizeUrl(import.meta.env.VITE_CLIENT_DOWNLOAD_VPS_CLASH_META_URL),
    sparkle: normalizeUrl(import.meta.env.VITE_CLIENT_DOWNLOAD_VPS_SPARKLE_URL),
    singBox: normalizeUrl(import.meta.env.VITE_CLIENT_DOWNLOAD_VPS_SING_BOX_URL),
    hiddify: normalizeUrl(import.meta.env.VITE_CLIENT_DOWNLOAD_VPS_HIDDIFY_URL),
  } satisfies Record<ClientDownloadId, string>;

  if (explicit[id]) return explicit[id];

  const base = normalizeUrl(import.meta.env.VITE_CLIENT_DOWNLOAD_VPS_BASE_URL);
  const defaultFile = DEFAULT_VPS_FILES[id]?.[platform];
  if (base && defaultFile) return joinUrl(base, defaultFile);

  return supportsManagedMirror(id, platform) ? buildManagedMirrorPath(id, platform) : '';
}

function resolveOfficialDownload(id: ClientDownloadId, platform: ClientDownloadPlatform): string {
  return PLATFORM_OFFICIAL_DOWNLOADS[id]?.[platform] ?? OFFICIAL_DOWNLOADS[id];
}

export function getClientDownloadLinks(
  id: ClientDownloadId,
  platform: ClientDownloadPlatform = 'windows',
): ClientDownloadLinks {
  return {
    github: resolveOfficialDownload(id, platform),
    vps: resolveVpsDownload(id, platform),
  };
}
