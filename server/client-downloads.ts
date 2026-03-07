export type ClientDownloadId = 'v2rayN' | 'v2rayNG' | 'shadowrocket' | 'clashVerge' | 'hiddify';
export type ClientDownloadPlatform = 'windows' | 'macos' | 'android' | 'ios';

export interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
  content_type?: string;
}

export interface GitHubReleasePayload {
  tag_name: string;
  assets: GitHubReleaseAsset[];
}

interface MirrorTarget {
  repo: string;
  matchers: RegExp[];
}

const MIRROR_TARGETS: Record<
  ClientDownloadId,
  Partial<Record<ClientDownloadPlatform, MirrorTarget>>
> = {
  v2rayN: {
    windows: {
      repo: '2dust/v2rayN',
      matchers: [/^v2rayN-windows-64\.zip$/i, /^v2rayN-windows-64(?:-desktop)?\.zip$/i],
    },
  },
  v2rayNG: {
    android: {
      repo: '2dust/v2rayNG',
      matchers: [/universal\.apk$/i],
    },
  },
  shadowrocket: {},
  clashVerge: {
    windows: {
      repo: 'clash-verge-rev/clash-verge-rev',
      matchers: [/x64-setup\.exe$/i],
    },
    macos: {
      repo: 'clash-verge-rev/clash-verge-rev',
      matchers: [/x64\.dmg$/i],
    },
  },
  hiddify: {
    windows: {
      repo: 'hiddify/hiddify-app',
      matchers: [/Windows-Setup-x64\.exe$/i],
    },
    macos: {
      repo: 'hiddify/hiddify-app',
      matchers: [/MacOS\.dmg$/i],
    },
    android: {
      repo: 'hiddify/hiddify-app',
      matchers: [/Android-universal\.apk$/i],
    },
  },
};

export function isClientDownloadId(value: string): value is ClientDownloadId {
  return (
    value === 'v2rayN' ||
    value === 'v2rayNG' ||
    value === 'shadowrocket' ||
    value === 'clashVerge' ||
    value === 'hiddify'
  );
}

export function isClientDownloadPlatform(value: string): value is ClientDownloadPlatform {
  return value === 'windows' || value === 'macos' || value === 'android' || value === 'ios';
}

export function getMirrorTarget(
  clientId: ClientDownloadId,
  platform: ClientDownloadPlatform,
): MirrorTarget | null {
  return MIRROR_TARGETS[clientId][platform] ?? null;
}

export function supportsManagedClientMirror(
  clientId: ClientDownloadId,
  platform: ClientDownloadPlatform,
): boolean {
  return getMirrorTarget(clientId, platform) !== null;
}

export function selectGitHubReleaseAsset(
  release: GitHubReleasePayload,
  clientId: ClientDownloadId,
  platform: ClientDownloadPlatform,
): GitHubReleaseAsset | null {
  const target = getMirrorTarget(clientId, platform);
  if (!target) return null;

  for (const matcher of target.matchers) {
    const matched = release.assets.find((asset) => matcher.test(asset.name));
    if (matched) return matched;
  }

  return null;
}
