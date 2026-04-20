import { Apple, Monitor, Smartphone, Terminal } from 'lucide-react';
import type { ClientCard, PlatformKey } from './types';
import type { ClientDownloadPlatform } from '@/src/utils/clientDownloads';

export type GuidePlatform = Exclude<PlatformKey, 'all'>;
export type ClientId = ClientCard['id'];
export type GuideTone = 'launch' | 'import' | 'connect';

export interface MirrorDialogState {
  url: string;
  clientName: string;
  clientId: ClientId;
  platform: ClientDownloadPlatform;
  managed: boolean;
}

export interface GuideScreenshotHighlight {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GuideStep {
  tone: GuideTone;
  title: string;
  description: string;
  helper: string;
  visualLabel: string;
  visualItems: string[];
  ctaLabel: string;
  screenshot?: {
    src: string;
    alt: string;
  };
}

export interface ClientGuide {
  recommendedFormat: import('./types').SubscriptionFormat;
  note: string;
  steps: GuideStep[];
  sourceLabel?: string;
  sourceUrl?: string;
}

export const PLATFORM_OPTIONS: Array<{ key: GuidePlatform; label: string; zhLabel: string }> = [
  { key: 'windows', label: 'Windows', zhLabel: 'Windows' },
  { key: 'macos', label: 'macOS', zhLabel: 'macOS' },
  { key: 'linux', label: 'Linux', zhLabel: 'Linux' },
  { key: 'android', label: 'Android', zhLabel: 'Android' },
  { key: 'ios', label: 'iPhone / iPad', zhLabel: 'iPhone / iPad' },
  { key: 'harmonyos', label: 'HarmonyOS NEXT', zhLabel: 'HarmonyOS NEXT' },
];

export const CLIENT_META: Array<{
  id: ClientId;
  name: string;
  icon: typeof Monitor;
  os: string;
  platforms: GuidePlatform[];
  recommendedFor: GuidePlatform[];
  descZh: string;
  descEn: string;
}> = [
  {
    id: 'v2rayN',
    name: 'v2rayN',
    icon: Monitor,
    os: 'Windows / Linux',
    platforms: ['windows', 'linux'],
    recommendedFor: ['windows'],
    descZh: 'Windows 上最直接的传统选择。',
    descEn: 'A straightforward classic choice for Windows and Linux.',
  },
  {
    id: 'clashVerge',
    name: 'Clash Verge Rev',
    icon: Monitor,
    os: 'Windows / macOS / Linux',
    platforms: ['windows', 'macos', 'linux'],
    recommendedFor: ['macos'],
    descZh: '社区维护的 Mihomo 桌面 GUI（原 Clash Verge 已归档），适合需要规则组和策略控制的用户。',
    descEn:
      'Community-maintained Mihomo desktop GUI (continuation of the archived Clash Verge). Best when you want rules, groups, and policy control.',
  },
  {
    id: 'v2rayNG',
    name: 'v2rayNG',
    icon: Smartphone,
    os: 'Android',
    platforms: ['android'],
    recommendedFor: [],
    descZh: 'Android 上成熟稳定，适合日常使用。',
    descEn: 'A stable Android option for everyday use.',
  },
  {
    id: 'surge',
    name: 'Surge',
    icon: Apple,
    os: 'iPhone / iPad',
    platforms: ['ios'],
    recommendedFor: [],
    descZh: 'iOS 上更偏向规则与高级控制的选择，适合熟悉代理规则的用户。',
    descEn: 'A stronger iOS option for users who want deeper rule control and advanced tuning.',
  },
  {
    id: 'shadowrocket',
    name: 'Shadowrocket',
    icon: Apple,
    os: 'iPhone / iPad',
    platforms: ['ios'],
    recommendedFor: ['ios'],
    descZh: 'iPhone 和 iPad 上最常见的导入方式。',
    descEn: 'The most common import flow on iPhone and iPad.',
  },
  {
    id: 'flClash',
    name: 'FlClash',
    icon: Smartphone,
    os: 'Windows / macOS / Linux / Android',
    platforms: ['windows', 'macos', 'linux', 'android'],
    recommendedFor: ['android'],
    descZh: 'Mihomo 系下更现代的一类客户端，适合规则组、分流和日常使用。',
    descEn: 'A more modern first-tier Mihomo client for rule groups, routing, and everyday use.',
  },
  {
    id: 'exclave',
    name: 'Exclave',
    icon: Smartphone,
    os: 'Android',
    platforms: ['android'],
    recommendedFor: [],
    descZh:
      '偏轻量的 Android 客户端，适合单节点和想要快速导入的用户。注意：2026/09 起 Google 限制认证 Android 设备侧载,可能影响安装。',
    descEn:
      'Android client focused on quick imports and lighter setups. Note: from Sept 2026, Google restricts sideloading on certified Android devices — installation may be blocked.',
  },
  {
    id: 'clashMeta',
    name: 'Clash Meta for Android',
    icon: Smartphone,
    os: 'Android',
    platforms: ['android'],
    recommendedFor: [],
    descZh: 'MetaCubeX 官方 Android 客户端，适合想要更完整 Mihomo 功能的用户。',
    descEn: 'The official MetaCubeX Android client when you want fuller Mihomo controls.',
  },
  {
    id: 'clashBox',
    name: 'ClashBox',
    icon: Smartphone,
    os: 'HarmonyOS NEXT',
    platforms: ['harmonyos'],
    recommendedFor: ['harmonyos'],
    descZh: 'HarmonyOS NEXT 上更直接的 Clash/Mihomo 选择，适合先用 Clash 格式导入订阅。',
    descEn:
      'A straightforward Clash and Mihomo option for HarmonyOS NEXT. Start with the Clash format for the cleanest import path.',
  },
  {
    id: 'sparkle',
    name: 'Sparkle',
    icon: Monitor,
    os: 'Windows / macOS / Linux',
    platforms: ['windows', 'macos', 'linux'],
    recommendedFor: [],
    descZh: '较新的 Mihomo 桌面 GUI，更偏向现代化的策略组和窗口体验。',
    descEn: 'A newer Mihomo desktop GUI with a more modern rule-group experience.',
  },
  {
    id: 'singBox',
    name: 'Sing-box',
    icon: Terminal,
    os: 'Android / macOS / Linux / iPhone / iPad',
    platforms: ['android', 'macos', 'linux', 'ios'],
    recommendedFor: [],
    descZh:
      'sing-box 系一类选择，DNS 和协议跟进更快，适合愿意研究配置的用户。注意：iOS / macOS 的 App Store 版本目前停留在旧版无法更新，要拿到最新协议支持需走 TestFlight。',
    descEn:
      'A first-tier sing-box option with faster DNS and protocol support for more advanced users. Note: the iOS / macOS App Store builds are currently frozen on an older version — install via TestFlight for the latest protocols.',
  },
];

export const DEFAULT_CLIENT_BY_PLATFORM: Record<GuidePlatform, ClientId> = {
  windows: 'flClash',
  macos: 'flClash',
  linux: 'flClash',
  android: 'flClash',
  ios: 'shadowrocket',
  harmonyos: 'clashBox',
};

export const PLATFORM_CLIENT_ORDER: Record<GuidePlatform, ClientId[]> = {
  windows: ['flClash', 'v2rayN', 'sparkle'],
  macos: ['flClash', 'sparkle', 'singBox'],
  linux: ['flClash', 'v2rayN', 'sparkle', 'singBox'],
  android: ['flClash', 'clashMeta', 'singBox', 'v2rayNG', 'exclave'],
  ios: ['shadowrocket', 'surge', 'singBox'],
  harmonyos: ['clashBox'],
};

export const V2RAYN_GUIDE_SOURCE_URL = 'https://v2rayn.org/';
export const V2RAYN_WINDOWS_SCREENSHOTS = {
  subscriptionMenu: '/guides/v2rayn/subscription-group.jpg',
  addGroup: '/guides/v2rayn/add-group.jpg',
  pasteUrl: '/guides/v2rayn/paste-url.jpg',
  refreshSubscription: '/guides/v2rayn/refresh-subscription.jpg',
  chooseNode: '/guides/v2rayn/choose-node.jpg',
  systemProxy: '/guides/v2rayn/system-proxy.jpg',
} as const;
export const V2RAYN_LINUX_GUIDE_SOURCE_URL = 'https://github.com/2dust/v2rayN/issues/6998';
export const V2RAYN_LINUX_SCREENSHOTS = {
  subscriptionGroupSettings: '/guides/v2rayn/linux-subscription-group-settings.png',
  serverList: '/guides/v2rayn/linux-server-list.png',
} as const;

export const CLASH_VERGE_GUIDE_SOURCE_URL = 'https://clashvergerev.com/en/guide/profile';
export const CLASH_VERGE_SCREENSHOTS = {
  profilesEmpty: '/guides/clash-verge/profiles-empty.webp',
  createProfile: '/guides/clash-verge/create-profile.webp',
  pasteSubscription: '/guides/clash-verge/paste-subscription.webp',
  subscriptionAdded: '/guides/clash-verge/subscription-added.webp',
  proxyGroups: '/guides/clash-verge/proxy-groups.webp',
  systemProxy: '/guides/clash-verge/system-proxy.webp',
} as const;

export const V2RAYNG_GUIDE_SOURCE_URL = 'https://v2rayng.xyz/tutorials/use-v2rayng/';
export const V2RAYNG_SCREENSHOTS = {
  openSubscription: '/guides/v2rayng/open-subscription.webp',
  addSubscription: '/guides/v2rayng/add-subscription.webp',
  updateSubscription: '/guides/v2rayng/update-subscription.webp',
  proxyList: '/guides/v2rayng/proxy-list.webp',
  startProxy: '/guides/v2rayng/start-proxy.webp',
} as const;

export const SHADOWROCKET_GUIDE_SOURCE_URL = 'https://wiki.zgcvpn.com/en/sw/ios/shadowrocket';
export const SHADOWROCKET_SCREENSHOTS = {
  addSubscription: '/guides/shadowrocket/add-subscription.png',
  connectNode: '/guides/shadowrocket/connect-node.png',
  autoUpdate: '/guides/shadowrocket/auto-update.png',
} as const;

export const FLCLASH_GUIDE_SOURCE_URL = 'https://help.jegovpn.com/en/tool/flclash';
export const FLCLASH_ANDROID_GUIDE_SOURCE_URL = 'https://flclash.men/guides/android/';
export const FLCLASH_MACOS_GUIDE_SOURCE_URL = 'https://flclash.men/guides/macos/';
export const FLCLASH_SCREENSHOTS = {
  newConfiguration: '/guides/flclash/new-configuration.png',
  url: '/guides/flclash/url.png',
  editConfiguration: '/guides/flclash/edit-configuration.png',
  enableProxy: '/guides/flclash/enable-proxy.png',
  nodeSelection: '/guides/flclash/node-selection.png',
} as const;
export const FLCLASH_ANDROID_SCREENSHOTS = {
  import: '/guides/flclash/android-import.webp',
  connect: '/guides/flclash/android-connect.webp',
} as const;
export const FLCLASH_MACOS_SCREENSHOTS = {
  main: '/guides/flclash/macos-main.webp',
  config: '/guides/flclash/macos-config.webp',
  chooseProxy: '/guides/flclash/macos-choose-proxy.webp',
  startProxy: '/guides/flclash/macos-start-proxy.webp',
} as const;

export const SPARKLE_OFFICIAL_ISSUES_SOURCE_URL = 'https://github.com/xishang0128/sparkle/issues';
export const SPARKLE_WINDOWS_SCREENSHOTS = {
  subscriptionManagement: '/guides/sparkle/windows-subscription-management.png',
  importMenu: '/guides/sparkle/windows-import-menu.png',
  remoteConfigUrl: '/guides/sparkle/windows-remote-config-url.png',
  systemProxy: '/guides/sparkle/windows-system-proxy.png',
} as const;

export const SURGE_GUIDE_SOURCE_URL = 'https://help.jegovpn.com/en/tool/surge';
export const SURGE_SCREENSHOTS = {
  dropdownMenu: '/guides/surge/dropdown-menu.png',
  downloadConfiguration: '/guides/surge/download-configuration.png',
  pasteLink: '/guides/surge/paste-link.png',
  configurationFile: '/guides/surge/configuration-file.png',
  startConnection: '/guides/surge/start-connection.png',
} as const;

export const SINGBOX_APPLE_GUIDE_SOURCE_URL = 'https://help.jegovpn.com/en/tool/sing-boxforapple';
export const SINGBOX_APPLE_SCREENSHOTS = {
  macosConfigurationSettings: '/guides/sing-box/apple/macos-configuration-settings.png',
  macosEnableSingBox: '/guides/sing-box/apple/macos-enable-sing-box.png',
  macosInternetMode: '/guides/sing-box/apple/macos-internet-mode.png',
  macosNodeSelection: '/guides/sing-box/apple/macos-node-selection.png',
  iosConfigurationSettings1: '/guides/sing-box/apple/ios-configuration-settings-1.png',
  iosConfigurationSettings2: '/guides/sing-box/apple/ios-configuration-settings-2.png',
  iosEnableSingBox1: '/guides/sing-box/apple/ios-enable-sing-box-1.png',
  iosEnableSingBox2: '/guides/sing-box/apple/ios-enable-sing-box-2.png',
  iosGroups: '/guides/sing-box/apple/ios-groups.png',
} as const;

export const SINGBOX_ANDROID_GUIDE_SOURCE_URL =
  'https://help.jegovpn.com/en/tool/sing-boxforandroid';
export const SINGBOX_ANDROID_SCREENSHOTS = {
  createConfig1: '/guides/sing-box/android/create-config-1.jpg',
  createConfig2: '/guides/sing-box/android/create-config-2.jpg',
  configSettings: '/guides/sing-box/android/config-settings.jpg',
  vpnPermission: '/guides/sing-box/android/vpn-permission.jpg',
  nodeSelection: '/guides/sing-box/android/node-selection.jpg',
} as const;

export const CLASHBOX_GUIDE_SOURCE_URL = 'https://help.jegovpn.com/en/tool/clashbox';
export const CLASHBOX_SCREENSHOTS = {
  home: '/guides/clashbox/home.png',
  profile: '/guides/clashbox/profile.jpg',
  start: '/guides/clashbox/start.jpg',
} as const;

export const CLASH_META_GUIDE_SOURCE_URL = 'https://help.jegovpn.com/en/tool/clash-for-android';
export const CLASH_META_SCREENSHOTS = {
  home: '/guides/clash-meta/home.png',
  configuration: '/guides/clash-meta/configuration.png',
  saveConfiguration: '/guides/clash-meta/save-configuration.png',
  startProxy: '/guides/clash-meta/start-proxy.png',
} as const;

export const GUIDE_SCREENSHOT_HIGHLIGHTS: Record<string, GuideScreenshotHighlight[]> = {
  [CLASH_VERGE_SCREENSHOTS.profilesEmpty]: [
    { x: 4, y: 23, w: 15, h: 11 },
    { x: 89, y: 8, w: 8, h: 7.5 },
  ],
  [CLASH_VERGE_SCREENSHOTS.createProfile]: [
    { x: 29.5, y: 12, w: 41.5, h: 7.5 },
    { x: 67, y: 89, w: 10, h: 7 },
  ],
  [CLASH_VERGE_SCREENSHOTS.pasteSubscription]: [
    { x: 30, y: 20.5, w: 40, h: 6.5 },
    { x: 30, y: 40.5, w: 40, h: 17 },
    { x: 67, y: 89, w: 10, h: 7 },
  ],
  [CLASH_VERGE_SCREENSHOTS.subscriptionAdded]: [
    { x: 24, y: 13, w: 38, h: 14 },
    { x: 55.5, y: 14, w: 4.5, h: 6.5 },
  ],
  [CLASH_VERGE_SCREENSHOTS.proxyGroups]: [
    { x: 23, y: 13, w: 70, h: 12.5 },
    { x: 23, y: 28.5, w: 35, h: 13 },
  ],
  [CLASH_VERGE_SCREENSHOTS.systemProxy]: [
    { x: 35.5, y: 17, w: 30, h: 9 },
    { x: 74, y: 30.5, w: 20.5, h: 10 },
  ],
};

export function detectInitialPlatform(): GuidePlatform {
  if (typeof window === 'undefined') return 'windows';
  const ua = window.navigator.userAgent.toLowerCase();
  if (ua.includes('harmonyos') || ua.includes('openharmony')) return 'harmonyos';
  if (ua.includes('android')) return 'android';
  if (ua.includes('iphone') || ua.includes('ipad')) return 'ios';
  if (ua.includes('mac os') || ua.includes('macintosh')) return 'macos';
  if (ua.includes('linux') || ua.includes('x11')) return 'linux';
  return 'windows';
}

export function getPlatformLabel(platform: GuidePlatform, isZh: boolean) {
  return (
    PLATFORM_OPTIONS.find((item) => item.key === platform)?.[isZh ? 'zhLabel' : 'label'] ??
    'Windows'
  );
}

export function getPlatformBlurb(platform: GuidePlatform, isZh: boolean) {
  if (platform === 'windows') {
    return isZh ? '适合电脑端日常使用。' : 'A solid choice for desktop use.';
  }
  if (platform === 'macos') {
    return isZh ? '适合偏好规则组和策略控制。' : 'Best if you prefer rules and policy control.';
  }
  if (platform === 'linux') {
    return isZh
      ? '适合 Linux 上的 Clash、v2rayN 和 sing-box 客户端。'
      : 'Best for Clash, v2rayN, and sing-box clients on Linux.';
  }
  if (platform === 'android') {
    return isZh ? '适合手机上快速导入。' : 'Great for quick setup on your phone.';
  }
  if (platform === 'harmonyos') {
    return isZh
      ? '适合 HarmonyOS NEXT 上的 Clash 类客户端导入。'
      : 'Best for Clash-style clients on HarmonyOS NEXT.';
  }
  return isZh ? '适合 iPhone 和 iPad 导入。' : 'Best for import on iPhone and iPad.';
}

export function getRecommendedClientId(platform: GuidePlatform): ClientId {
  return DEFAULT_CLIENT_BY_PLATFORM[platform];
}

export function createStep(
  tone: GuideTone,
  title: string,
  description: string,
  helper: string,
  visualLabel: string,
  visualItems: string[],
  ctaLabel: string,
  screenshot?: GuideStep['screenshot'],
): GuideStep {
  return { tone, title, description, helper, visualLabel, visualItems, ctaLabel, screenshot };
}
