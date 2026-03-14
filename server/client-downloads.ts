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
  v2rayN: {
    windows: {
      repo: '2dust/v2rayN',
      matchers: [/^v2rayN-windows-64-desktop\.zip$/i, /^v2rayN-windows-64\.zip$/i],
    },
    linux: {
      repo: '2dust/v2rayN',
      matchers: [/^v2rayN-linux-64\.zip$/i, /^v2rayN-linux-64\.deb$/i],
    },
  },
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
  clashVerge: {
    windows: {
      repo: 'clash-verge-rev/clash-verge-rev',
      matchers: [
        /^Clash\.Verge_[0-9A-Za-z._-]+_x64-setup\.exe$/i,
        /^Clash\.Verge_[0-9A-Za-z._-]+_x64_fixed_webview2-setup\.exe$/i,
      ],
    },
    macos: {
      repo: 'clash-verge-rev/clash-verge-rev',
      matchers: [
        /^Clash\.Verge_[0-9A-Za-z._-]+_x64\.dmg$/i,
        /^Clash\.Verge_[0-9A-Za-z._-]+_aarch64\.dmg$/i,
      ],
    },
    linux: {
      repo: 'clash-verge-rev/clash-verge-rev',
      matchers: [
        /^Clash\.Verge_x64\.app\.tar\.gz$/i,
        /^Clash\.Verge_[0-9A-Za-z._-]+_amd64\.deb$/i,
        /^Clash\.Verge-[0-9A-Za-z._-]+\.x86_64\.rpm$/i,
      ],
    },
  },
  flClash: {
    windows: {
      repo: 'chen08209/FlClash',
      matchers: [
        /^FlClash-[0-9A-Za-z._-]+-windows-amd64-setup\.exe$/i,
        /^FlClash-[0-9A-Za-z._-]+-windows-amd64\.zip$/i,
      ],
    },
    macos: {
      repo: 'chen08209/FlClash',
      matchers: [
        /^FlClash-[0-9A-Za-z._-]+-macos-amd64\.dmg$/i,
        /^FlClash-[0-9A-Za-z._-]+-macos-arm64\.dmg$/i,
      ],
    },
    linux: {
      repo: 'chen08209/FlClash',
      matchers: [
        /^FlClash-[0-9A-Za-z._-]+-linux-amd64\.AppImage$/i,
        /^FlClash-[0-9A-Za-z._-]+-linux-amd64\.deb$/i,
        /^FlClash-[0-9A-Za-z._-]+-linux-amd64\.rpm$/i,
      ],
    },
    android: {
      repo: 'chen08209/FlClash',
      matchers: [
        /^FlClash-[0-9A-Za-z._-]+-android-arm64-v8a\.apk$/i,
        /^FlClash-[0-9A-Za-z._-]+-android-armeabi-v7a\.apk$/i,
      ],
    },
  },
  exclave: {},
  clashMeta: {
    android: {
      repo: 'MetaCubeX/ClashMetaForAndroid',
      matchers: [/meta-universal-release\.apk$/i],
    },
  },
  sparkle: {
    windows: {
      repo: 'xishang0128/mihomo-party',
      matchers: [
        /^sparkle-windows-[0-9A-Za-z._-]+-x64-setup\.exe$/i,
        /^sparkle-windows-[0-9A-Za-z._-]+-x64-portable\.7z$/i,
      ],
    },
    macos: {
      repo: 'xishang0128/mihomo-party',
      matchers: [
        /^sparkle-macos-[0-9A-Za-z._-]+-x64\.pkg$/i,
        /^sparkle-macos-[0-9A-Za-z._-]+-arm64\.pkg$/i,
      ],
    },
    linux: {
      repo: 'xishang0128/mihomo-party',
      matchers: [
        /^sparkle-linux-[0-9A-Za-z._-]+-amd64\.deb$/i,
        /^sparkle-linux-[0-9A-Za-z._-]+-x86_64\.rpm$/i,
        /^sparkle-linux-[0-9A-Za-z._-]+-x64\.pkg\.tar\.xz$/i,
      ],
    },
  },
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
