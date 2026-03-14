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
  v2rayN: {},
  v2rayNG: {
    android: {
      repo: '2dust/v2rayNG',
      matchers: [/universal\.apk$/i],
    },
  },
  surge: {},
  shadowrocket: {},
  clashBox: {
    harmonyos: {
      repo: 'xiaobaigroup/ClashBox',
      matchers: [/^ClashNEXT-LTS-[0-9A-Za-z._-]+\.hap$/i],
    },
  },
  clashVerge: {},
  flClash: {},
  exclave: {},
  clashMeta: {
    android: {
      repo: 'MetaCubeX/ClashMetaForAndroid',
      matchers: [/meta-universal-release\.apk$/i],
    },
  },
  sparkle: {},
  singBox: {
    android: {
      repo: 'SagerNet/sing-box',
      matchers: [/^SFA-[0-9A-Za-z._-]+-universal\.apk$/i],
    },
    macos: {
      repo: 'SagerNet/sing-box',
      matchers: [/^SFM-[0-9A-Za-z._-]+-Universal\.pkg$/i],
    },
  },
};

export function isClientDownloadId(value: string): value is ClientDownloadId {
  return (
    value === 'v2rayN' ||
    value === 'v2rayNG' ||
    value === 'surge' ||
    value === 'shadowrocket' ||
    value === 'clashBox' ||
    value === 'clashVerge' ||
    value === 'flClash' ||
    value === 'exclave' ||
    value === 'clashMeta' ||
    value === 'sparkle' ||
    value === 'singBox'
  );
}

export function isClientDownloadPlatform(value: string): value is ClientDownloadPlatform {
  return (
    value === 'windows' ||
    value === 'macos' ||
    value === 'linux' ||
    value === 'android' ||
    value === 'ios' ||
    value === 'harmonyos'
  );
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
