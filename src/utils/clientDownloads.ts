export type ClientDownloadId = 'v2rayN' | 'v2rayNG' | 'shadowrocket' | 'clashVerge' | 'hiddify';

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

const DEFAULT_VPS_FILES: Partial<Record<ClientDownloadId, string>> = {
  v2rayN: 'v2rayN.zip',
  v2rayNG: 'v2rayNG.apk',
  clashVerge: 'clash-verge.exe',
  hiddify: 'hiddify.apk',
};

function normalizeUrl(url: string | undefined): string {
  return typeof url === 'string' ? url.trim() : '';
}

function joinUrl(base: string, fileName: string): string {
  const normalizedBase = base.replace(/\/+$/, '');
  const normalizedFile = fileName.replace(/^\/+/, '');
  return `${normalizedBase}/${normalizedFile}`;
}

function resolveVpsDownload(id: ClientDownloadId): string {
  const explicit = {
    v2rayN: normalizeUrl(import.meta.env.VITE_CLIENT_DOWNLOAD_VPS_V2RAYN_URL),
    v2rayNG: normalizeUrl(import.meta.env.VITE_CLIENT_DOWNLOAD_VPS_V2RAYNG_URL),
    shadowrocket: normalizeUrl(import.meta.env.VITE_CLIENT_DOWNLOAD_VPS_SHADOWROCKET_URL),
    clashVerge: normalizeUrl(import.meta.env.VITE_CLIENT_DOWNLOAD_VPS_CLASH_VERGE_URL),
    hiddify: normalizeUrl(import.meta.env.VITE_CLIENT_DOWNLOAD_VPS_HIDDIFY_URL),
  } satisfies Record<ClientDownloadId, string>;

  if (explicit[id]) return explicit[id];

  const base = normalizeUrl(import.meta.env.VITE_CLIENT_DOWNLOAD_VPS_BASE_URL);
  const defaultFile = DEFAULT_VPS_FILES[id];
  if (!base || !defaultFile) return '';

  return joinUrl(base, defaultFile);
}

export function getClientDownloadLinks(id: ClientDownloadId): ClientDownloadLinks {
  return {
    github: GITHUB_DOWNLOADS[id],
    vps: resolveVpsDownload(id),
  };
}
