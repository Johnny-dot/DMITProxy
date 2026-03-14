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
  | 'singBox';
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
  vpsManaged: boolean;
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

const CLIENT_URL_OVERRIDE_ENV: Partial<Record<ClientDownloadId, string>> = {
  v2rayNG: 'VITE_CLIENT_DOWNLOAD_VPS_V2RAYNG_URL',
  surge: 'VITE_CLIENT_DOWNLOAD_VPS_SURGE_URL',
  shadowrocket: 'VITE_CLIENT_DOWNLOAD_VPS_SHADOWROCKET_URL',
  clashBox: 'VITE_CLIENT_DOWNLOAD_VPS_CLASHBOX_URL',
  exclave: 'VITE_CLIENT_DOWNLOAD_VPS_EXCLAVE_URL',
  clashMeta: 'VITE_CLIENT_DOWNLOAD_VPS_CLASH_META_URL',
} as const;

const PLATFORM_URL_OVERRIDE_ENV: Partial<
  Record<ClientDownloadId, Partial<Record<ClientDownloadPlatform, string>>>
> = {
  v2rayN: {
    windows: 'VITE_CLIENT_DOWNLOAD_VPS_V2RAYN_WINDOWS_URL',
    linux: 'VITE_CLIENT_DOWNLOAD_VPS_V2RAYN_LINUX_URL',
  },
  clashVerge: {
    windows: 'VITE_CLIENT_DOWNLOAD_VPS_CLASH_VERGE_WINDOWS_URL',
    macos: 'VITE_CLIENT_DOWNLOAD_VPS_CLASH_VERGE_MACOS_URL',
    linux: 'VITE_CLIENT_DOWNLOAD_VPS_CLASH_VERGE_LINUX_URL',
  },
  flClash: {
    windows: 'VITE_CLIENT_DOWNLOAD_VPS_FLCLASH_WINDOWS_URL',
    macos: 'VITE_CLIENT_DOWNLOAD_VPS_FLCLASH_MACOS_URL',
    linux: 'VITE_CLIENT_DOWNLOAD_VPS_FLCLASH_LINUX_URL',
    android: 'VITE_CLIENT_DOWNLOAD_VPS_FLCLASH_ANDROID_URL',
  },
  sparkle: {
    windows: 'VITE_CLIENT_DOWNLOAD_VPS_SPARKLE_WINDOWS_URL',
    macos: 'VITE_CLIENT_DOWNLOAD_VPS_SPARKLE_MACOS_URL',
    linux: 'VITE_CLIENT_DOWNLOAD_VPS_SPARKLE_LINUX_URL',
  },
  singBox: {
    android: 'VITE_CLIENT_DOWNLOAD_VPS_SING_BOX_ANDROID_URL',
    macos: 'VITE_CLIENT_DOWNLOAD_VPS_SING_BOX_MACOS_URL',
    linux: 'VITE_CLIENT_DOWNLOAD_VPS_SING_BOX_LINUX_URL',
  },
} as const;

const MANAGED_MIRROR_SUPPORTED_PLATFORMS: Record<ClientDownloadId, ClientDownloadPlatform[]> = {
  v2rayN: ['windows', 'linux'],
  v2rayNG: ['android'],
  surge: [],
  shadowrocket: [],
  clashBox: ['harmonyos'],
  clashVerge: ['windows', 'macos', 'linux'],
  flClash: ['windows', 'macos', 'linux', 'android'],
  exclave: [],
  clashMeta: ['android'],
  sparkle: ['windows', 'macos', 'linux'],
  singBox: ['android', 'macos'],
};

const DEFAULT_VPS_FILES: Partial<
  Record<ClientDownloadId, Partial<Record<ClientDownloadPlatform, string>>>
> = {
  v2rayN: {},
  v2rayNG: {
    android: 'v2rayNG-universal.apk',
  },
  surge: {},
  clashVerge: {},
  clashBox: {
    harmonyos: 'clashbox-harmonyos-next.hap',
  },
  flClash: {},
  exclave: {},
  clashMeta: {
    android: 'clash-meta-universal.apk',
  },
  sparkle: {},
  singBox: {
    android: 'singbox-android-universal.apk',
    macos: 'singbox-macos-universal.pkg',
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

function readEnvByName(name: string | undefined): string {
  if (!name) return '';
  return normalizeUrl(import.meta.env[name as keyof ImportMetaEnv] as string | undefined);
}

function resolveVpsDownload(
  id: ClientDownloadId,
  platform: ClientDownloadPlatform,
): { url: string; managed: boolean } {
  const explicitPlatform = readEnvByName(PLATFORM_URL_OVERRIDE_ENV[id]?.[platform]);
  if (explicitPlatform) return { url: explicitPlatform, managed: false };

  const explicitClient = readEnvByName(CLIENT_URL_OVERRIDE_ENV[id]);
  if (explicitClient) return { url: explicitClient, managed: false };

  const base = normalizeUrl(import.meta.env.VITE_CLIENT_DOWNLOAD_VPS_BASE_URL);
  const defaultFile = DEFAULT_VPS_FILES[id]?.[platform];
  if (base && defaultFile) return { url: joinUrl(base, defaultFile), managed: false };

  return supportsManagedMirror(id, platform)
    ? { url: buildManagedMirrorPath(id, platform), managed: true }
    : { url: '', managed: false };
}

function resolveOfficialDownload(id: ClientDownloadId, platform: ClientDownloadPlatform): string {
  return PLATFORM_OFFICIAL_DOWNLOADS[id]?.[platform] ?? OFFICIAL_DOWNLOADS[id];
}

export function getClientDownloadLinks(
  id: ClientDownloadId,
  platform: ClientDownloadPlatform = 'windows',
): ClientDownloadLinks {
  const vps = resolveVpsDownload(id, platform);
  return {
    github: resolveOfficialDownload(id, platform),
    vps: vps.url,
    vpsManaged: vps.managed,
  };
}
