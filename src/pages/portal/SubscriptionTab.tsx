import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Apple,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  Link as LinkIcon,
  Monitor,
  QrCode,
  Smartphone,
  Terminal,
} from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { InfoTooltip } from '@/src/components/ui/InfoTooltip';
import { useI18n } from '@/src/context/I18nContext';
import { cn } from '@/src/utils/cn';
import { getClientDownloadLinks, type ClientDownloadPlatform } from '@/src/utils/clientDownloads';
import { buildSubscriptionUrl } from '@/src/utils/subscription';
import type { ClientCard, PlatformKey, PortalTab, SetupFocus, SubscriptionFormat } from './types';
import { COPY_RESET_DELAY_MS } from './types';

type GuidePlatform = Exclude<PlatformKey, 'all'>;
type ClientId = ClientCard['id'];
type GuideTone = 'launch' | 'import' | 'connect';

interface GuideScreenshotHighlight {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface GuideStep {
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

interface ClientGuide {
  recommendedFormat: SubscriptionFormat;
  note: string;
  steps: GuideStep[];
  sourceLabel?: string;
  sourceUrl?: string;
}

interface SubscriptionTabProps {
  initialFocus?: SetupFocus;
  subId: string | null;
  onSetSection?: (tab: PortalTab) => void;
}

const PLATFORM_OPTIONS: Array<{ key: GuidePlatform; label: string; zhLabel: string }> = [
  { key: 'windows', label: 'Windows', zhLabel: 'Windows' },
  { key: 'macos', label: 'macOS', zhLabel: 'macOS' },
  { key: 'linux', label: 'Linux', zhLabel: 'Linux' },
  { key: 'android', label: 'Android', zhLabel: 'Android' },
  { key: 'ios', label: 'iPhone / iPad', zhLabel: 'iPhone / iPad' },
  { key: 'harmonyos', label: 'HarmonyOS NEXT', zhLabel: 'HarmonyOS NEXT' },
];

const CLIENT_META: Array<{
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
    name: 'Clash Verge',
    icon: Monitor,
    os: 'Windows / macOS / Linux',
    platforms: ['windows', 'macos', 'linux'],
    recommendedFor: ['macos'],
    descZh: '适合需要规则组和策略控制的用户。',
    descEn: 'Best when you want rules, groups, and policy control.',
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
    descZh: 'Mihomo 绯讳笅鏇寸幇浠ｇ殑涓€绫诲鎴风锛岄€傚悎瑙勫垯缁勩€佸垎娴佸拰鏃ュ父浣跨敤銆?',
    descEn: 'A more modern first-tier Mihomo client for rule groups, routing, and everyday use.',
  },
  {
    id: 'exclave',
    name: 'Exclave',
    icon: Smartphone,
    os: 'Android',
    platforms: ['android'],
    recommendedFor: [],
    descZh: '偏轻量的 Android 客户端，适合单节点和想要快速导入的用户。',
    descEn: 'Android client focused on quick imports and lighter setups.',
  },
  {
    id: 'clashMeta',
    name: 'Clash Meta for Android',
    icon: Smartphone,
    os: 'Android',
    platforms: ['android'],
    recommendedFor: [],
    descZh: 'MetaCubeX 瀹樻柟 Android 瀹㈡埛绔紝閫傚悎瑕佹洿瀹屾暣 Mihomo 鍔熻兘鐨勭敤鎴枫€?',
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
    descZh: '杈冩柊鐨?Mihomo 妗岄潰 GUI锛屾洿鍋忓悜鐜颁唬鍖栫殑绛栫暐缁勫拰绐楀彛浣撻獙銆?',
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
      'sing-box 绯讳竴绫婚€夋嫨锛孌NS 鍜屽崗璁窡杩涙洿蹇紝浣嗘洿閫傚悎鎰挎剰鐮旂┒閰嶇疆鐨勭敤鎴枫€?',
    descEn:
      'A first-tier sing-box option with faster DNS and protocol support for more advanced users.',
  },
  {
    id: 'hiddify',
    name: 'Hiddify',
    icon: Smartphone,
    os: 'Windows / macOS',
    platforms: ['windows', 'macos'],
    recommendedFor: ['windows'],
    descZh: '上手最快，支持 URL、剪贴板和二维码导入。',
    descEn: 'Fastest to onboard with URL, clipboard, and QR import.',
  },
];

const DEFAULT_CLIENT_BY_PLATFORM: Record<GuidePlatform, ClientId> = {
  windows: 'flClash',
  macos: 'flClash',
  linux: 'flClash',
  android: 'flClash',
  ios: 'shadowrocket',
  harmonyos: 'clashBox',
};

const PLATFORM_CLIENT_ORDER: Record<GuidePlatform, ClientId[]> = {
  windows: ['flClash', 'v2rayN', 'sparkle'],
  macos: ['flClash', 'sparkle', 'singBox'],
  linux: ['flClash', 'v2rayN', 'sparkle', 'singBox'],
  android: ['flClash', 'exclave', 'clashMeta', 'singBox', 'v2rayNG'],
  ios: ['shadowrocket', 'surge', 'singBox'],
  harmonyos: ['clashBox'],
};

const V2RAYN_GUIDE_SOURCE_URL = 'https://v2rayn.org/';
const V2RAYN_WINDOWS_SCREENSHOTS = {
  subscriptionMenu: '/guides/v2rayn/subscription-group.jpg',
  addGroup: '/guides/v2rayn/add-group.jpg',
  pasteUrl: '/guides/v2rayn/paste-url.jpg',
  refreshSubscription: '/guides/v2rayn/refresh-subscription.jpg',
  chooseNode: '/guides/v2rayn/choose-node.jpg',
  systemProxy: '/guides/v2rayn/system-proxy.jpg',
} as const;

const CLASH_VERGE_GUIDE_SOURCE_URL = 'https://clashvergerev.com/en/guide/profile';
const CLASH_VERGE_SCREENSHOTS = {
  profilesEmpty: '/guides/clash-verge/profiles-empty.webp',
  createProfile: '/guides/clash-verge/create-profile.webp',
  pasteSubscription: '/guides/clash-verge/paste-subscription.webp',
  subscriptionAdded: '/guides/clash-verge/subscription-added.webp',
  proxyGroups: '/guides/clash-verge/proxy-groups.webp',
  systemProxy: '/guides/clash-verge/system-proxy.webp',
} as const;

const V2RAYNG_GUIDE_SOURCE_URL = 'https://v2rayng.xyz/tutorials/use-v2rayng/';
const V2RAYNG_SCREENSHOTS = {
  openSubscription: '/guides/v2rayng/open-subscription.webp',
  addSubscription: '/guides/v2rayng/add-subscription.webp',
  updateSubscription: '/guides/v2rayng/update-subscription.webp',
  proxyList: '/guides/v2rayng/proxy-list.webp',
  startProxy: '/guides/v2rayng/start-proxy.webp',
} as const;

const SHADOWROCKET_GUIDE_SOURCE_URL = 'https://wiki.zgcvpn.com/en/sw/ios/shadowrocket';
const SHADOWROCKET_SCREENSHOTS = {
  addSubscription: '/guides/shadowrocket/add-subscription.png',
  connectNode: '/guides/shadowrocket/connect-node.png',
  autoUpdate: '/guides/shadowrocket/auto-update.png',
} as const;

const HIDDIFY_GUIDE_SOURCE_URL =
  'https://hiddify.com/manager/installation-and-setup/How-to-use-HiddifyApp/';
const HIDDIFY_SCREENSHOTS = {
  openAddProfile: '/guides/hiddify/open-add-profile.png',
  addFromClipboard: '/guides/hiddify/add-from-clipboard.png',
  addManually: '/guides/hiddify/add-manually.png',
  connectHome: '/guides/hiddify/connect-home.png',
  updateProfile: '/guides/hiddify/update-profile.png',
} as const;

const FLCLASH_GUIDE_SOURCE_URL = 'https://help.jegovpn.com/en/tool/flclash';
const FLCLASH_SCREENSHOTS = {
  newConfiguration: '/guides/flclash/new-configuration.png',
  url: '/guides/flclash/url.png',
  editConfiguration: '/guides/flclash/edit-configuration.png',
  enableProxy: '/guides/flclash/enable-proxy.png',
  nodeSelection: '/guides/flclash/node-selection.png',
} as const;

const SPARKLE_GUIDE_SOURCE_URL = 'https://mihomoparty.net/tutorial/';
const SPARKLE_SCREENSHOTS = {
  start: '/guides/sparkle/start.webp',
  addSubscription: '/guides/sparkle/add-subscription.webp',
  subscription: '/guides/sparkle/subscription.webp',
  proxies: '/guides/sparkle/proxies.webp',
  systemProxy: '/guides/sparkle/system-proxy.webp',
} as const;

const SURGE_GUIDE_SOURCE_URL = 'https://help.jegovpn.com/en/tool/surge';
const SURGE_SCREENSHOTS = {
  dropdownMenu: '/guides/surge/dropdown-menu.png',
  downloadConfiguration: '/guides/surge/download-configuration.png',
  pasteLink: '/guides/surge/paste-link.png',
  configurationFile: '/guides/surge/configuration-file.png',
  startConnection: '/guides/surge/start-connection.png',
} as const;

const SINGBOX_APPLE_GUIDE_SOURCE_URL = 'https://help.jegovpn.com/en/tool/sing-boxforapple';
const SINGBOX_APPLE_SCREENSHOTS = {
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

const SINGBOX_ANDROID_GUIDE_SOURCE_URL = 'https://help.jegovpn.com/en/tool/sing-boxforandroid';
const SINGBOX_ANDROID_SCREENSHOTS = {
  createConfig1: '/guides/sing-box/android/create-config-1.jpg',
  createConfig2: '/guides/sing-box/android/create-config-2.jpg',
  configSettings: '/guides/sing-box/android/config-settings.jpg',
  vpnPermission: '/guides/sing-box/android/vpn-permission.jpg',
  nodeSelection: '/guides/sing-box/android/node-selection.jpg',
} as const;

const CLASHBOX_GUIDE_SOURCE_URL = 'https://help.jegovpn.com/en/tool/clashbox';
const CLASHBOX_SCREENSHOTS = {
  home: '/guides/clashbox/home.png',
  profile: '/guides/clashbox/profile.jpg',
  start: '/guides/clashbox/start.jpg',
} as const;

const CLASH_META_GUIDE_SOURCE_URL = 'https://help.jegovpn.com/en/tool/clash-for-android';
const CLASH_META_SCREENSHOTS = {
  home: '/guides/clash-meta/home.png',
  configuration: '/guides/clash-meta/configuration.png',
  saveConfiguration: '/guides/clash-meta/save-configuration.png',
  startProxy: '/guides/clash-meta/start-proxy.png',
} as const;

const GUIDE_SCREENSHOT_HIGHLIGHTS: Record<string, GuideScreenshotHighlight[]> = {
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
  [HIDDIFY_SCREENSHOTS.addFromClipboard]: [{ x: 18, y: 56, w: 31, h: 41 }],
  [HIDDIFY_SCREENSHOTS.addManually]: [
    { x: 1.5, y: 14, w: 97, h: 7.5 },
    { x: 1.5, y: 23.5, w: 97, h: 7.5 },
    { x: 84, y: 93, w: 14, h: 6.5 },
  ],
  [HIDDIFY_SCREENSHOTS.connectHome]: [
    { x: 23, y: 13, w: 73, h: 11.5 },
    { x: 42, y: 43, w: 26, h: 28.5 },
  ],
};

function detectInitialPlatform(): GuidePlatform {
  if (typeof window === 'undefined') return 'windows';
  const ua = window.navigator.userAgent.toLowerCase();
  if (ua.includes('harmonyos') || ua.includes('openharmony')) return 'harmonyos';
  if (ua.includes('android')) return 'android';
  if (ua.includes('iphone') || ua.includes('ipad')) return 'ios';
  if (ua.includes('mac os') || ua.includes('macintosh')) return 'macos';
  if (ua.includes('linux') || ua.includes('x11')) return 'linux';
  return 'windows';
}

function getPlatformLabel(platform: GuidePlatform, isZh: boolean) {
  return (
    PLATFORM_OPTIONS.find((item) => item.key === platform)?.[isZh ? 'zhLabel' : 'label'] ??
    'Windows'
  );
}

function getPlatformBlurb(platform: GuidePlatform, isZh: boolean) {
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

function getRecommendedClientId(platform: GuidePlatform): ClientId {
  return DEFAULT_CLIENT_BY_PLATFORM[platform];
}

function createStep(
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

function buildClientGuide(
  clientId: ClientId,
  platform: GuidePlatform,
  platformLabel: string,
  isZh: boolean,
): ClientGuide {
  const note = isZh
    ? '不同版本按钮名称会有差异，但导入路径一般都在这些位置。'
    : 'Button labels vary by version, but the import flow is usually in these places.';

  if (
    clientId === 'flClash' ||
    clientId === 'clashMeta' ||
    clientId === 'sparkle' ||
    clientId === 'clashBox'
  ) {
    const clientName =
      clientId === 'clashMeta'
        ? 'Clash Meta for Android'
        : clientId === 'clashBox'
          ? 'ClashBox'
          : clientId === 'sparkle'
            ? 'Sparkle'
            : 'FlClash';
    const connectPermission =
      platform === 'android' || platform === 'harmonyos' ? 'Allow VPN' : 'Allow system proxy';

    return {
      recommendedFormat: 'clash',
      note: `${clientName} belongs to the Mihomo/Clash family, so keep this page on the Clash format during import.`,
      steps: [
        createStep(
          'launch',
          `Open the Profiles or Config screen in ${clientName}`,
          'Subscription imports usually live under Profiles, Configs, or the subscription page.',
          'If the app wants to initialize its core first, let that finish before importing.',
          'Profiles / Config',
          ['Profiles', 'Configs', 'Subscriptions'],
          'Open import entry',
        ),
        createStep(
          'import',
          'Switch to the Clash format, then paste the subscription link',
          'Choose Clash on this page first, then paste the subscription URL into the client.',
          'If policy groups do not show up after import, the first thing to check is whether the format is wrong.',
          'Import from URL',
          ['Clash format', 'Subscription URL', 'Save / Update'],
          'Import Clash profile',
        ),
        createStep(
          'connect',
          'Refresh, choose a policy group, then enable proxy',
          'Make sure nodes and groups are loaded before enabling TUN or system proxy.',
          'Importing alone does not move traffic until the proxy mode is enabled.',
          'Proxy / TUN',
          ['Refresh subscription', 'Choose group', connectPermission],
          'Connect',
        ),
      ],
    };
  }

  if (clientId === 'singBox') {
    const appLabel =
      platform === 'ios'
        ? 'Sing-box VT'
        : platform === 'macos'
          ? 'Singbox for Mac'
          : platform === 'linux'
            ? 'Singbox for Linux'
            : 'Sing-box';
    const connectPermission =
      platform === 'android' || platform === 'ios' ? 'Allow VPN' : 'Allow system proxy';

    return {
      recommendedFormat: 'singbox',
      note: `${appLabel} works best with the Sing-box format, so switch this page to Sing-box first for the cleanest import path.`,
      steps: [
        createStep(
          'launch',
          `Open the profile import entry in ${appLabel}`,
          'Sing-box clients usually place imports under Profiles, Configs, or Servers.',
          'On first launch you may need to allow network or VPN permission before importing.',
          'Profiles / Servers',
          ['Profiles', 'Configs', 'Servers'],
          'Open import entry',
        ),
        createStep(
          'import',
          'Switch to the Sing-box format before importing',
          'Choose Sing-box on this page first, then import by URL or clipboard inside the client.',
          'If the client talks about Profiles or JSON, that is usually the sing-box-native import path.',
          'Import Sing-box profile',
          ['Sing-box format', 'URL / Clipboard', 'Save'],
          'Import profile',
        ),
        createStep(
          'connect',
          'Save, switch to the imported profile, then connect',
          'Make sure nodes, DNS, and rule resources have loaded before you hit connect.',
          'These clients expose more low-level options, so avoid changing unfamiliar toggles until the import works.',
          'Connect',
          ['Select imported profile', 'Refresh subscription', connectPermission],
          'Connect',
        ),
      ],
    };
  }

  if (clientId === 'clashVerge') {
    return {
      recommendedFormat: 'clash',
      note,
      steps: isZh
        ? [
            createStep(
              'launch',
              '先开 Profiles',
              '导入入口一般在 Profiles。',
              '首次打开先允许网络或内核初始化。',
              'Profiles',
              ['配置列表', '新建配置', '导入入口'],
              '进入 Profiles',
            ),
            createStep(
              'import',
              '切到 Clash 格式后导入',
              '把当前页格式保持为 Clash，再粘贴 URL。',
              '看不到策略组时先检查格式和刷新。',
              'Import from URL',
              ['格式: Clash', '粘贴链接', '刷新配置'],
              '导入订阅',
            ),
            createStep(
              'connect',
              '刷新后开启代理或 TUN',
              '先选策略组，再开系统代理或 TUN。',
              '只导入不启用代理时，流量不会真的走过去。',
              'Proxy / TUN',
              ['策略组', '系统代理', 'TUN'],
              '开始连接',
            ),
          ]
        : [
            createStep(
              'launch',
              'Open Profiles first',
              'The import entry is usually in Profiles.',
              'Allow network or core initialization on first launch.',
              'Profiles',
              ['Profile list', 'New profile', 'Import entry'],
              'Open Profiles',
            ),
            createStep(
              'import',
              'Switch to Clash and import',
              'Keep this page on Clash format, then paste the URL.',
              'If policy groups do not appear, check the format and refresh.',
              'Import from URL',
              ['Format: Clash', 'Paste URL', 'Refresh'],
              'Import',
            ),
            createStep(
              'connect',
              'Refresh, then enable proxy or TUN',
              'Pick a policy group before enabling proxy or TUN.',
              'Import alone does not route traffic until proxy mode is enabled.',
              'Proxy / TUN',
              ['Policy group', 'System proxy', 'TUN'],
              'Connect',
            ),
          ],
    };
  }

  if (clientId === 'surge') {
    return {
      recommendedFormat: 'surge',
      note: isZh
        ? 'Surge 更适合用 Surge 格式导入，这样规则组和配置字段兼容性会更好。'
        : 'Surge imports are cleaner with the Surge format, especially when you rely on rule groups and Surge-native fields.',
      steps: isZh
        ? [
            createStep(
              'launch',
              '先进入配置或模块入口',
              'Surge 一般从配置列表、下载配置，或右上角加号进入导入。',
              '第一次打开时，先完成本地网络权限或基础初始化。',
              '配置 / 导入',
              ['配置列表', '下载配置', '右上角 +'],
              '打开导入入口',
            ),
            createStep(
              'import',
              '切到 Surge 格式后再导入',
              '先把当前页面切到 Surge，再把复制的链接贴进 Surge 的下载配置入口。',
              '如果配置导入后规则组不完整，先检查是不是用了 Universal 链接。',
              '下载配置',
              ['Surge 格式', '粘贴订阅 URL', '保存配置'],
              '导入配置',
            ),
            createStep(
              'connect',
              '更新配置后启用并允许 VPN',
              '先确认配置和策略组已经更新，再点连接或启用增强模式。',
              '连接不上时优先检查本地 VPN 权限和配置更新时间。',
              '连接',
              ['更新配置', '选择策略组', '允许 VPN'],
              '开始连接',
            ),
          ]
        : [
            createStep(
              'launch',
              'Open the profiles or import entry first',
              'Surge usually imports from the profiles list, download profile flow, or the top-right add button.',
              'Finish any first-run network permission or base setup before importing.',
              'Profiles / Import',
              ['Profiles list', 'Download profile', 'Top-right +'],
              'Open import entry',
            ),
            createStep(
              'import',
              'Switch to the Surge format before importing',
              'Set this page to Surge first, then paste the copied link into Surge.',
              'If groups or fields look incomplete after import, check that you did not use the Universal link.',
              'Download profile',
              ['Surge format', 'Paste subscription URL', 'Save profile'],
              'Import profile',
            ),
            createStep(
              'connect',
              'Refresh the profile, then enable it and allow VPN',
              'Make sure the profile and policy groups are up to date before connecting.',
              'If traffic does not move, check local VPN permission and whether the profile refreshed successfully.',
              'Connect',
              ['Refresh profile', 'Choose policy group', 'Allow VPN'],
              'Connect',
            ),
          ],
    };
  }

  if (clientId === 'shadowrocket') {
    return {
      recommendedFormat: 'universal',
      note,
      steps: isZh
        ? [
            createStep(
              'launch',
              '点右上角加号',
              'Shadowrocket 一般从右上角加号新建订阅。',
              '看到空白列表时先找右上角。',
              'New subscription',
              ['首页', '右上角 +', '订阅类型'],
              '新建订阅',
            ),
            createStep(
              'import',
              '把链接粘贴到 URL',
              '名称可以自定义，关键是 URL 字段。',
              '扫码也能导，但 URL 更稳。',
              'URL field',
              ['名称', '订阅链接', '保存'],
              '粘贴链接',
            ),
            createStep(
              'connect',
              '刷新后选节点并允许 VPN',
              '导入成功后先刷新，再点选节点连接。',
              '如果看起来连上了却没网络，优先检查 VPN 权限。',
              'Connect',
              ['刷新订阅', '选择节点', '允许 VPN'],
              '开始连接',
            ),
          ]
        : [
            createStep(
              'launch',
              'Tap the top-right plus button',
              'Shadowrocket usually creates subscriptions from the plus button.',
              'If the list is empty, check the top-right corner first.',
              'New subscription',
              ['Home', 'Top-right +', 'Subscription type'],
              'Create',
            ),
            createStep(
              'import',
              'Paste the link into URL',
              'The name is optional; the URL field is the important part.',
              'QR works too, but URL import is usually easier to troubleshoot.',
              'URL field',
              ['Name', 'Subscription URL', 'Save'],
              'Paste link',
            ),
            createStep(
              'connect',
              'Refresh, pick a node, allow VPN',
              'Refresh once after import, then connect through a node.',
              'If it looks connected but traffic fails, check VPN permission first.',
              'Connect',
              ['Refresh', 'Pick node', 'Allow VPN'],
              'Connect',
            ),
          ],
    };
  }

  if (clientId === 'v2rayNG') {
    return {
      recommendedFormat: 'universal',
      note,
      steps: isZh
        ? [
            createStep(
              'launch',
              '进入订阅分组或加号菜单',
              '常见导入入口在订阅分组页。',
              '不同版本名字会写成 Subscription、导入或分组。',
              'Subscription',
              ['订阅分组', '右上角 +', '导入入口'],
              '打开菜单',
            ),
            createStep(
              'import',
              '优先用剪贴板或 URL 导入',
              '刚复制过链接时，剪贴板导入最快。',
              '二维码更像备用入口。',
              'Clipboard / URL',
              ['读取剪贴板', '粘贴 URL', '确认导入'],
              '导入订阅',
            ),
            createStep(
              'connect',
              '刷新后选节点并允许 VPN',
              '先刷新节点列表，再点击连接。',
              '节点列表为空时先检查有没有刷新。',
              'VPN permission',
              ['更新订阅', '选择节点', '允许 VPN'],
              '开始连接',
            ),
          ]
        : [
            createStep(
              'launch',
              'Open the subscription or plus menu',
              'The import entry is usually on the subscription screen.',
              'Labels often mention Subscription, Import, or Group.',
              'Subscription',
              ['Subscription group', 'Top-right +', 'Import entry'],
              'Open menu',
            ),
            createStep(
              'import',
              'Prefer clipboard or URL import',
              'Clipboard import is usually fastest if you just copied the link.',
              'QR is useful, but usually secondary.',
              'Clipboard / URL',
              ['Read clipboard', 'Paste URL', 'Confirm'],
              'Import',
            ),
            createStep(
              'connect',
              'Refresh, select a node, allow VPN',
              'Refresh the list before you hit connect.',
              'If the list stays empty, refresh the subscription first.',
              'VPN permission',
              ['Refresh', 'Pick node', 'Allow VPN'],
              'Connect',
            ),
          ],
    };
  }

  if (clientId === 'exclave') {
    return {
      recommendedFormat: 'universal',
      note: isZh
        ? 'Exclave 的导入路径和经典安卓 V2Ray 客户端接近，优先用 Universal 链接会更稳。'
        : 'Exclave stays close to classic Android V2Ray clients, and the Universal link is usually the safest import path.',
      steps: isZh
        ? [
            createStep(
              'launch',
              '先打开订阅或配置入口',
              'Exclave 一般会把导入入口放在订阅、配置或右上角加号里。',
              '第一次启动时，先完成核心初始化或权限提示。',
              '订阅 / 配置',
              ['订阅列表', '右上角 +', '导入入口'],
              '打开入口',
            ),
            createStep(
              'import',
              '优先粘贴 Universal 订阅链接',
              '保持当前页面为 Universal，再把复制的订阅链接粘贴到 Exclave。',
              '如果你刚复制过链接，优先尝试 URL 或剪贴板导入。',
              'URL 导入',
              ['Universal 格式', '粘贴 URL', '保存 / 更新'],
              '导入订阅',
            ),
            createStep(
              'connect',
              '刷新后选节点并允许 VPN',
              '先确认节点列表已经拉下来，再点连接。',
              '节点为空时，先检查订阅是否刷新成功。',
              'VPN 权限',
              ['刷新订阅', '选择节点', '允许 VPN'],
              '开始连接',
            ),
          ]
        : [
            createStep(
              'launch',
              'Open the subscription or profile entry first',
              'Exclave usually places imports under subscriptions, profiles, or the top-right plus menu.',
              'Finish any first-run core setup or permission prompts before importing.',
              'Subscription / Profile',
              ['Subscription list', 'Top-right +', 'Import entry'],
              'Open entry',
            ),
            createStep(
              'import',
              'Prefer the Universal subscription link',
              'Keep this page on Universal, then paste the copied subscription link into Exclave.',
              'If you just copied the link, URL or clipboard import is usually the fastest path.',
              'Import by URL',
              ['Universal format', 'Paste URL', 'Save / Update'],
              'Import subscription',
            ),
            createStep(
              'connect',
              'Refresh, pick a node, and allow VPN',
              'Make sure the node list has loaded before connecting.',
              'If the node list stays empty, refresh the subscription again first.',
              'VPN permission',
              ['Refresh subscription', 'Pick node', 'Allow VPN'],
              'Connect',
            ),
          ],
    };
  }

  if (clientId === 'v2rayN') {
    return {
      recommendedFormat: 'universal',
      note,
      steps: isZh
        ? [
            createStep(
              'launch',
              '首次打开先准备内核',
              'v2rayN 第一次启动通常要先初始化内核。',
              '先把核心状态准备好，再导入订阅。',
              'Core ready',
              ['核心检测', '初始化', '主窗口'],
              '准备内核',
            ),
            createStep(
              'import',
              '从订阅菜单添加当前链接',
              '一般在订阅组或订阅设置里添加。',
              '如果换了客户端，记得回来确认格式。',
              'Subscription',
              ['订阅组', '添加订阅', '粘贴链接'],
              '导入订阅',
            ),
            createStep(
              'connect',
              '更新成功后选节点并启用代理',
              '先更新订阅，再选择节点，最后启用系统代理。',
              '只更新不启用代理时，浏览器不会跟着走。',
              'System proxy',
              ['更新订阅', '选择节点', '启用代理'],
              '开始连接',
            ),
          ]
        : [
            createStep(
              'launch',
              'Prepare the core first',
              'v2rayN often needs core initialization on first launch.',
              'Get the core into a healthy state before importing.',
              'Core ready',
              ['Core check', 'Initialize', 'Main window'],
              'Prepare core',
            ),
            createStep(
              'import',
              'Add the copied link from the subscription menu',
              'You usually add it from the subscription group or settings.',
              'If you switch clients, come back and confirm the format.',
              'Subscription',
              ['Subscription group', 'Add subscription', 'Paste URL'],
              'Import',
            ),
            createStep(
              'connect',
              'Refresh, select a node, enable proxy',
              'Update the subscription, then enable system proxy.',
              'Refreshing alone does not move browser traffic.',
              'System proxy',
              ['Refresh', 'Select node', 'Enable proxy'],
              'Connect',
            ),
          ],
    };
  }

  const connectPermission =
    platform === 'android' || platform === 'ios'
      ? isZh
        ? '允许 VPN'
        : 'Allow VPN'
      : isZh
        ? '允许系统代理'
        : 'Allow system proxy';

  return {
    recommendedFormat: 'universal',
    note,
    steps: isZh
      ? [
          createStep(
            'launch',
            `先打开 ${platformLabel} 上的 Hiddify`,
            '首页通常会直接看到导入入口。',
            '欢迎页先初始化，再继续。',
            platformLabel,
            ['首页', '添加配置', '导入入口'],
            '打开客户端',
          ),
          createStep(
            'import',
            '用 URL、剪贴板或二维码导入',
            'Hiddify 三种方式都支持，但 URL 和剪贴板更稳。',
            '二维码适合手机快速导入。',
            'Import profile',
            ['URL 导入', '剪贴板导入', '扫码导入'],
            '导入订阅',
          ),
          createStep(
            'connect',
            '保存后选节点并连接',
            '导入成功后先确认节点列表已刷新。',
            '连接前记得允许系统权限。',
            'Connect',
            ['刷新节点', '选择节点', connectPermission],
            '开始连接',
          ),
        ]
      : [
          createStep(
            'launch',
            `Open Hiddify on ${platformLabel}`,
            'The import entry is usually visible on the first screen.',
            'Finish the welcome setup before importing.',
            platformLabel,
            ['Home', 'Add profile', 'Import entry'],
            'Open client',
          ),
          createStep(
            'import',
            'Import by URL, clipboard, or QR',
            'All three methods work, but URL and clipboard are usually the most reliable.',
            'QR is convenient on mobile.',
            'Import profile',
            ['Import URL', 'Read clipboard', 'Scan QR'],
            'Import',
          ),
          createStep(
            'connect',
            'Save, pick a node, and connect',
            'Make sure the node list is refreshed first.',
            'Remember to allow the required system permission.',
            'Connect',
            ['Refresh nodes', 'Select node', connectPermission],
            'Connect',
          ),
        ],
  };
}

function buildRealV2RayNGuide(isZh: boolean): ClientGuide {
  return {
    recommendedFormat: 'universal',
    note: isZh
      ? '这组步骤使用真实 v2rayN 界面截图，导入时照着点就可以。'
      : 'These steps use real v2rayN screenshots so you can follow the exact UI.',
    sourceLabel: isZh ? 'v2rayN 图文教程原页' : 'Original v2rayN walkthrough',
    sourceUrl: V2RAYN_GUIDE_SOURCE_URL,
    steps: isZh
      ? [
          createStep(
            'launch',
            '先打开订阅分组设置',
            '从主界面的“订阅分组”进入订阅设置，这是导入订阅的入口。',
            '如果你刚装好客户端，先保持主窗口打开，不用急着点系统代理。',
            '订阅分组',
            ['点击订阅分组', '进入订阅分组设置'],
            '打开菜单',
            {
              src: V2RAYN_WINDOWS_SCREENSHOTS.subscriptionMenu,
              alt: 'v2rayN 打开订阅分组设置',
            },
          ),
          createStep(
            'import',
            '先新建一个订阅分组',
            '在订阅分组设置窗口里先点“添加”，让当前订阅有一个独立入口。',
            '一个订阅地址对应一个分组最清楚，后面更新也更方便。',
            '添加分组',
            ['点击添加', '准备填写别名和订阅地址'],
            '新增分组',
            {
              src: V2RAYN_WINDOWS_SCREENSHOTS.addGroup,
              alt: 'v2rayN 订阅分组设置窗口',
            },
          ),
          createStep(
            'import',
            '粘贴别名和订阅地址',
            '别名随便填一个你认得出的名字，URL 位置粘贴刚才复制的订阅链接，然后点确定。',
            '这里最关键的是 URL 不要贴错，也不要多带空格。',
            '订阅地址',
            ['填写别名', '粘贴订阅 URL', '点击确定'],
            '保存订阅',
            {
              src: V2RAYN_WINDOWS_SCREENSHOTS.pasteUrl,
              alt: 'v2rayN 填写订阅地址并保存',
            },
          ),
          createStep(
            'connect',
            '回到主界面更新全部订阅',
            '保存后回到“订阅分组”，点击“更新全部订阅(不通过代理)”，把节点列表真正拉下来。',
            '第一次导入时建议用“不通过代理”，避免还没连上就卡在更新环节。',
            '更新订阅',
            ['回到订阅分组', '更新全部订阅(不通过代理)', '等待节点刷新完成'],
            '刷新节点',
            {
              src: V2RAYN_WINDOWS_SCREENSHOTS.refreshSubscription,
              alt: 'v2rayN 更新全部订阅不通过代理',
            },
          ),
          createStep(
            'connect',
            '选一个节点设为活动服务器',
            '节点出来以后，在主列表选中一个节点，右键设为活动服务器，或者直接双击该节点。',
            '如果节点很多，先选延迟低、名字清楚的那个，不要随机点。',
            '选择节点',
            ['选中目标节点', '右键设为活动服务器', '确认当前节点已切换'],
            '切换节点',
            {
              src: V2RAYN_WINDOWS_SCREENSHOTS.chooseNode,
              alt: 'v2rayN 选择活动服务器',
            },
          ),
          createStep(
            'connect',
            '最后开启系统代理',
            '在托盘图标右键菜单里开启“自动配置系统代理”，浏览器流量才会真正经过 v2rayN。',
            '如果只是导入和更新，没有开系统代理，网页还是不会走你的节点。',
            '系统代理',
            ['右键托盘图标', '开启自动配置系统代理', '浏览器重新打开测试'],
            '开始连接',
            {
              src: V2RAYN_WINDOWS_SCREENSHOTS.systemProxy,
              alt: 'v2rayN 开启自动配置系统代理',
            },
          ),
        ]
      : [
          createStep(
            'launch',
            'Open the subscription group settings',
            'Start from the main window and open the subscription group menu. That is the entry for importing a subscription URL.',
            'If you just installed v2rayN, keep the main window open and do not touch system proxy yet.',
            'Subscription group',
            ['Open the subscription group menu', 'Enter subscription group settings'],
            'Open menu',
            {
              src: V2RAYN_WINDOWS_SCREENSHOTS.subscriptionMenu,
              alt: 'Open v2rayN subscription group settings',
            },
          ),
          createStep(
            'import',
            'Create a subscription group first',
            'Click Add in the subscription settings window so the current subscription has its own group.',
            'One URL per group keeps future refreshes easier to manage.',
            'Add group',
            ['Click Add', 'Prepare the alias and subscription URL'],
            'Create group',
            {
              src: V2RAYN_WINDOWS_SCREENSHOTS.addGroup,
              alt: 'v2rayN subscription group settings window',
            },
          ),
          createStep(
            'import',
            'Paste the alias and subscription URL',
            'Use any alias you can recognize, paste the copied subscription URL into the URL field, then confirm.',
            'The important part here is the URL field. Make sure you do not paste extra spaces.',
            'Subscription URL',
            ['Fill an alias', 'Paste the subscription URL', 'Confirm the dialog'],
            'Save',
            {
              src: V2RAYN_WINDOWS_SCREENSHOTS.pasteUrl,
              alt: 'Paste subscription URL into v2rayN',
            },
          ),
          createStep(
            'connect',
            'Update all subscriptions from the main window',
            'Go back to Subscription Group and run Update all subscriptions (without proxy) so the node list is fetched.',
            'Using the no-proxy option is safer on first import because the client is not routing traffic yet.',
            'Refresh subscription',
            [
              'Return to Subscription Group',
              'Update all subscriptions (without proxy)',
              'Wait for nodes to load',
            ],
            'Refresh nodes',
            {
              src: V2RAYN_WINDOWS_SCREENSHOTS.refreshSubscription,
              alt: 'Update all subscriptions without proxy in v2rayN',
            },
          ),
          createStep(
            'connect',
            'Choose the node you want to use',
            'After the list appears, select a node and set it as the active server, or simply double-click it.',
            'Start with a node that looks stable and has lower latency instead of picking randomly.',
            'Select node',
            ['Select a node', 'Set it as active server', 'Confirm the active node changed'],
            'Select node',
            {
              src: V2RAYN_WINDOWS_SCREENSHOTS.chooseNode,
              alt: 'Choose an active server in v2rayN',
            },
          ),
          createStep(
            'connect',
            'Enable system proxy last',
            'Use the tray icon menu and enable Auto configure system proxy so browser traffic actually goes through v2rayN.',
            'Importing and refreshing alone will not route browser traffic until proxy mode is enabled.',
            'System proxy',
            [
              'Right-click the tray icon',
              'Enable auto configure system proxy',
              'Reopen the browser and test',
            ],
            'Connect',
            {
              src: V2RAYN_WINDOWS_SCREENSHOTS.systemProxy,
              alt: 'Enable auto configure system proxy in v2rayN',
            },
          ),
        ],
  };
}

function buildRealClashVergeGuide(platformLabel: string, isZh: boolean): ClientGuide {
  return {
    recommendedFormat: 'clash',
    note: isZh
      ? `${platformLabel} 上直接照 Clash Verge 的真实界面操作即可。`
      : `Follow the real Clash Verge UI on ${platformLabel} step by step.`,
    sourceLabel: isZh ? 'Clash Verge 图文教程原页' : 'Original Clash Verge walkthrough',
    sourceUrl: CLASH_VERGE_GUIDE_SOURCE_URL,
    steps: isZh
      ? [
          createStep(
            'launch',
            '先进入 Profiles 页面',
            '打开 Clash Verge 后，左侧切到 Profiles，这里就是导入订阅的入口。',
            '如果刚装好客户端，先不用处理 TUN 和系统代理，先把订阅加进去。',
            'Profiles',
            ['打开 Profiles', '确认上方有 Profile URL 和 NEW 按钮'],
            '打开 Profiles',
            {
              src: CLASH_VERGE_SCREENSHOTS.profilesEmpty,
              alt: 'Clash Verge Profiles 页面',
            },
          ),
          createStep(
            'import',
            '先新建一个 Remote Profile',
            '点右上角 NEW，新建一个远程订阅配置。',
            '类型保持 Remote 就行，不需要自己手改成本地文件。',
            'Create profile',
            ['点击 NEW', '确认 Type 为 Remote'],
            '新建订阅',
            {
              src: CLASH_VERGE_SCREENSHOTS.createProfile,
              alt: 'Clash Verge 新建订阅窗口',
            },
          ),
          createStep(
            'import',
            '把订阅链接粘贴到 Subscription URL',
            '名称随便填一个你认得出的名字，把当前页面复制的 Clash 链接粘贴到 Subscription URL。',
            '这里一定要用 Clash 格式链接，不要把 Universal 链接贴进来。',
            'Subscription URL',
            ['填写名称', '粘贴 Subscription URL', '点击 SAVE'],
            '保存订阅',
            {
              src: CLASH_VERGE_SCREENSHOTS.pasteSubscription,
              alt: 'Clash Verge 粘贴订阅链接',
            },
          ),
          createStep(
            'connect',
            '确认订阅已经添加成功',
            '保存后 Profiles 里会出现一张订阅卡片，说明配置已经收进来了。',
            '如果列表还是空的，优先检查 URL、格式和网络。',
            'Profile card',
            ['确认卡片已出现', '必要时点卡片上的刷新图标'],
            '检查订阅',
            {
              src: CLASH_VERGE_SCREENSHOTS.subscriptionAdded,
              alt: 'Clash Verge 已添加订阅卡片',
            },
          ),
          createStep(
            'connect',
            '去 Proxies 里选一个节点或策略组',
            '切到 Proxies 页面，先选中一个可用节点或自动选择组。',
            '只导入订阅不选节点时，客户端并不会真正开始走代理。',
            'Proxy groups',
            ['打开 Proxies', '选择节点或策略组', '确认当前节点已切换'],
            '选择节点',
            {
              src: CLASH_VERGE_SCREENSHOTS.proxyGroups,
              alt: 'Clash Verge 代理组和节点列表',
            },
          ),
          createStep(
            'connect',
            '最后开启 System Proxy',
            '回到 Home，把 System Proxy 打开，浏览器和系统流量才会开始走 Clash Verge。',
            '如果你想全局接管，也可以再研究 TUN，但第一次导入先把 System Proxy 跑通就够了。',
            'System proxy',
            ['回到 Home', '开启 System Proxy', '重新打开网页测试'],
            '开始连接',
            {
              src: CLASH_VERGE_SCREENSHOTS.systemProxy,
              alt: 'Clash Verge 开启系统代理',
            },
          ),
        ]
      : [
          createStep(
            'launch',
            'Open the Profiles page first',
            'After launching Clash Verge, switch to Profiles from the left sidebar. That is where subscription import starts.',
            'Do not worry about TUN or system proxy yet. Import the profile first.',
            'Profiles',
            ['Open Profiles', 'Check that Profile URL and NEW are visible'],
            'Open Profiles',
            {
              src: CLASH_VERGE_SCREENSHOTS.profilesEmpty,
              alt: 'Clash Verge Profiles page',
            },
          ),
          createStep(
            'import',
            'Create a Remote profile',
            'Click NEW and create a remote subscription profile.',
            'Leave the type as Remote. You do not need a local file here.',
            'Create profile',
            ['Click NEW', 'Keep Type on Remote'],
            'Create profile',
            {
              src: CLASH_VERGE_SCREENSHOTS.createProfile,
              alt: 'Clash Verge create profile dialog',
            },
          ),
          createStep(
            'import',
            'Paste the Clash link into Subscription URL',
            'Use any name you can recognize, then paste the Clash-formatted subscription link into Subscription URL.',
            'Make sure you paste the Clash link here instead of the Universal link.',
            'Subscription URL',
            ['Enter a name', 'Paste the Subscription URL', 'Click SAVE'],
            'Save profile',
            {
              src: CLASH_VERGE_SCREENSHOTS.pasteSubscription,
              alt: 'Clash Verge paste subscription URL',
            },
          ),
          createStep(
            'connect',
            'Confirm the profile was added',
            'After saving, a new subscription card should appear in Profiles.',
            'If the list is still empty, check the URL, format, and network first.',
            'Profile card',
            ['Confirm the card is visible', 'Refresh it if needed'],
            'Check profile',
            {
              src: CLASH_VERGE_SCREENSHOTS.subscriptionAdded,
              alt: 'Clash Verge subscription card added',
            },
          ),
          createStep(
            'connect',
            'Pick a node or proxy group in Proxies',
            'Switch to Proxies and choose the node or group you want to use.',
            'Importing alone does not start routing until a node or group is active.',
            'Proxy groups',
            [
              'Open Proxies',
              'Choose a node or proxy group',
              'Confirm the active selection changed',
            ],
            'Select node',
            {
              src: CLASH_VERGE_SCREENSHOTS.proxyGroups,
              alt: 'Clash Verge proxy groups and nodes',
            },
          ),
          createStep(
            'connect',
            'Enable System Proxy last',
            'Go back to Home and enable System Proxy so browser and system traffic actually go through Clash Verge.',
            'You can explore TUN later, but System Proxy is the cleanest first setup.',
            'System proxy',
            ['Return to Home', 'Enable System Proxy', 'Reload a page and test'],
            'Connect',
            {
              src: CLASH_VERGE_SCREENSHOTS.systemProxy,
              alt: 'Clash Verge enable system proxy',
            },
          ),
        ],
  };
}

function buildRealV2RayNGGuide(isZh: boolean): ClientGuide {
  return {
    recommendedFormat: 'universal',
    note: isZh
      ? '这组步骤使用真实 v2rayNG 安卓界面截图，按顺序点就可以。'
      : 'These steps use real v2rayNG Android screenshots so you can follow the exact flow.',
    sourceLabel: isZh ? 'v2rayNG 图文教程原页' : 'Original v2rayNG walkthrough',
    sourceUrl: V2RAYNG_GUIDE_SOURCE_URL,
    steps: isZh
      ? [
          createStep(
            'launch',
            '先打开订阅设置',
            '从左上角菜单进入“订阅设置”，这是添加订阅链接的入口。',
            '如果你第一次打开 v2rayNG，先别急着连接，先把订阅配进去。',
            '订阅设置',
            ['打开左上角菜单', '进入订阅设置'],
            '打开菜单',
            {
              src: V2RAYNG_SCREENSHOTS.openSubscription,
              alt: 'v2rayNG 打开订阅设置',
            },
          ),
          createStep(
            'import',
            '新建一个订阅地址',
            '在订阅设置页点右上角加号，新增一条订阅。',
            '这里建议直接填一条专门给当前账号的订阅，不要混着用多个来源。',
            '新增订阅',
            ['点击右上角加号', '准备填写备注和地址'],
            '新增订阅',
            {
              src: V2RAYNG_SCREENSHOTS.addSubscription,
              alt: 'v2rayNG 新增订阅地址',
            },
          ),
          createStep(
            'connect',
            '回到主界面更新订阅',
            '保存后回到配置页，点右上角三点菜单里的“更新订阅”。',
            '不先更新的话，节点列表不会真正加载出来。',
            '更新订阅',
            ['回到主界面', '打开三点菜单', '点击更新订阅'],
            '刷新节点',
            {
              src: V2RAYNG_SCREENSHOTS.updateSubscription,
              alt: 'v2rayNG 更新订阅',
            },
          ),
          createStep(
            'connect',
            '从列表里选中要用的节点',
            '更新完成后，在配置列表里点你要连接的节点，把它切成当前活动项。',
            '优先选名称清楚、延迟低的节点，不要第一次就随机点。',
            '节点列表',
            ['等待节点列表出现', '点选目标节点', '确认当前节点高亮'],
            '选择节点',
            {
              src: V2RAYNG_SCREENSHOTS.proxyList,
              alt: 'v2rayNG 节点列表',
            },
          ),
          createStep(
            'connect',
            '最后确认 VPN 连接请求',
            '开始连接时，Android 会弹出 VPN 权限确认，点确定后代理才会真正生效。',
            '如果你已经导入成功但浏览器还是直连，通常就是这里还没有放行。',
            'VPN 权限',
            ['点击连接', '允许 VPN 请求', '回到浏览器测试'],
            '开始连接',
            {
              src: V2RAYNG_SCREENSHOTS.startProxy,
              alt: 'v2rayNG 确认 VPN 连接请求',
            },
          ),
        ]
      : [
          createStep(
            'launch',
            'Open subscription settings first',
            'Use the top-left menu to open Subscription settings. That is where you add the subscription URL.',
            'If this is your first time in v2rayNG, do not connect yet. Add the subscription first.',
            'Subscription settings',
            ['Open the top-left menu', 'Enter Subscription settings'],
            'Open menu',
            {
              src: V2RAYNG_SCREENSHOTS.openSubscription,
              alt: 'Open subscription settings in v2rayNG',
            },
          ),
          createStep(
            'import',
            'Add a new subscription entry',
            'Tap the plus button in Subscription settings and create a new subscription item.',
            'It is cleaner to keep one subscription entry per account.',
            'Add subscription',
            ['Tap the plus button', 'Prepare the remark and URL'],
            'Add subscription',
            {
              src: V2RAYNG_SCREENSHOTS.addSubscription,
              alt: 'Add subscription entry in v2rayNG',
            },
          ),
          createStep(
            'connect',
            'Update the subscription from the main page',
            'After saving, return to the config page and run Update subscription from the top-right menu.',
            'The node list will not load until you refresh the subscription once.',
            'Update subscription',
            ['Return to the main page', 'Open the three-dot menu', 'Tap Update subscription'],
            'Refresh nodes',
            {
              src: V2RAYNG_SCREENSHOTS.updateSubscription,
              alt: 'Update subscription in v2rayNG',
            },
          ),
          createStep(
            'connect',
            'Pick the node you want to use',
            'After refresh finishes, choose the node you want from the config list.',
            'Start with a clearer, lower-latency node instead of guessing.',
            'Node list',
            [
              'Wait for the node list to appear',
              'Tap the node you want',
              'Confirm the active node changed',
            ],
            'Select node',
            {
              src: V2RAYNG_SCREENSHOTS.proxyList,
              alt: 'v2rayNG node list',
            },
          ),
          createStep(
            'connect',
            'Accept the Android VPN request',
            'When you start the proxy, Android shows a VPN permission dialog. Accept it to route traffic.',
            'If import worked but the browser is still direct, this permission is usually the missing step.',
            'VPN permission',
            ['Tap connect', 'Allow the VPN request', 'Return to the browser and test'],
            'Connect',
            {
              src: V2RAYNG_SCREENSHOTS.startProxy,
              alt: 'Confirm VPN request in v2rayNG',
            },
          ),
        ],
  };
}

function buildRealShadowrocketGuide(isZh: boolean): ClientGuide {
  return {
    recommendedFormat: 'universal',
    note: isZh
      ? '这是 Shadowrocket 的真实 iPhone 界面截图流程。'
      : 'These steps use real Shadowrocket iPhone screenshots.',
    sourceLabel: isZh ? 'Shadowrocket 图文教程来源' : 'Shadowrocket tutorial source',
    sourceUrl: SHADOWROCKET_GUIDE_SOURCE_URL,
    steps: isZh
      ? [
          createStep(
            'import',
            '先用右上角加号添加订阅',
            '在 Shadowrocket 首页点右上角加号，类型选 Subscribe，再把当前页面复制的订阅链接填进 URL。',
            '名称可以随便写，但 URL 一定要贴完整，别多空格。',
            '新增订阅',
            ['点右上角加号', '类型选 Subscribe', '粘贴 URL 并保存'],
            '添加订阅',
            {
              src: SHADOWROCKET_SCREENSHOTS.addSubscription,
              alt: 'Shadowrocket 添加订阅',
            },
          ),
          createStep(
            'connect',
            '回到首页打开开关并连接节点',
            '保存后回到首页，确认节点已经出现，再打开右侧开关开始连接。',
            '如果列表里有多个节点，先选你最常用或延迟更低的那个。',
            '连接节点',
            ['回到首页', '确认节点已导入', '打开右侧连接开关'],
            '开始连接',
            {
              src: SHADOWROCKET_SCREENSHOTS.connectNode,
              alt: 'Shadowrocket 首页连接节点',
            },
          ),
          createStep(
            'connect',
            '顺手把订阅自动更新打开',
            '进设置里的订阅页，把“打开时更新”和“自动后台更新”打开，后续换节点和续费会更省心。',
            '这一步不是必须，但长期使用强烈建议开。',
            '自动更新',
            ['进入设置', '打开订阅页', '开启自动更新选项'],
            '优化订阅',
            {
              src: SHADOWROCKET_SCREENSHOTS.autoUpdate,
              alt: 'Shadowrocket 订阅自动更新设置',
            },
          ),
        ]
      : [
          createStep(
            'import',
            'Add the subscription from the plus button',
            'Tap the top-right plus button on the Shadowrocket home screen, choose Subscribe, and paste the copied URL.',
            'The name can be anything, but the URL must be pasted cleanly.',
            'Add subscription',
            ['Tap the top-right plus button', 'Choose Subscribe', 'Paste the URL and save'],
            'Add subscription',
            {
              src: SHADOWROCKET_SCREENSHOTS.addSubscription,
              alt: 'Add subscription in Shadowrocket',
            },
          ),
          createStep(
            'connect',
            'Return home and enable the node',
            'After saving, go back to the home screen, confirm the node is visible, and turn on the switch to connect.',
            'If there are multiple nodes, start with the one you use most or the lower-latency one.',
            'Connect node',
            ['Return to Home', 'Confirm the node was imported', 'Turn on the connect switch'],
            'Connect',
            {
              src: SHADOWROCKET_SCREENSHOTS.connectNode,
              alt: 'Connect a node in Shadowrocket',
            },
          ),
          createStep(
            'connect',
            'Enable automatic subscription updates',
            'Open Settings > Subscription and turn on update-on-open and background update so future refreshes are easier.',
            'This is optional for first setup, but strongly recommended for long-term use.',
            'Auto update',
            ['Open Settings', 'Enter Subscription', 'Enable the update options'],
            'Optimize setup',
            {
              src: SHADOWROCKET_SCREENSHOTS.autoUpdate,
              alt: 'Shadowrocket subscription auto-update settings',
            },
          ),
        ],
  };
}

function buildRealHiddifyGuide(platformLabel: string, isZh: boolean): ClientGuide {
  return {
    recommendedFormat: 'universal',
    note: isZh
      ? `这组步骤来自 Hiddify 官方文档，${platformLabel} 上布局可能略有差异，但导入入口和顺序基本一致。`
      : `These screenshots come from the official Hiddify docs. The ${platformLabel} layout may differ slightly, but the import flow is effectively the same.`,
    sourceLabel: isZh ? 'Hiddify 官方教程' : 'Official Hiddify guide',
    sourceUrl: HIDDIFY_GUIDE_SOURCE_URL,
    steps: isZh
      ? [
          createStep(
            'launch',
            '先打开添加配置入口',
            '进入 Hiddify 首页后，先点添加配置或加号，准备导入新订阅。',
            '如果你是第一次打开，欢迎页先过一遍即可。',
            '添加配置',
            ['打开 Hiddify', '进入添加配置入口'],
            '打开入口',
            {
              src: HIDDIFY_SCREENSHOTS.openAddProfile,
              alt: 'Hiddify 打开添加配置入口',
            },
          ),
          createStep(
            'import',
            '最快的方法是直接读剪贴板',
            '如果你刚复制过订阅链接，直接用剪贴板导入会最快。',
            '这是最省事的一种方式，适合大多数第一次接入的用户。',
            '剪贴板导入',
            ['复制订阅链接', '点击 Add from clipboard', '等待配置识别'],
            '剪贴板导入',
            {
              src: HIDDIFY_SCREENSHOTS.addFromClipboard,
              alt: 'Hiddify 从剪贴板导入',
            },
          ),
          createStep(
            'import',
            '如果剪贴板不行，再手动粘贴 URL',
            '也可以手动新增配置，把当前页面复制的订阅链接粘贴进去保存。',
            '手动导入更适合排查链接有没有复制错。',
            '手动导入',
            ['选择手动新增', '粘贴订阅 URL', '保存配置'],
            '手动导入',
            {
              src: HIDDIFY_SCREENSHOTS.addManually,
              alt: 'Hiddify 手动粘贴订阅 URL',
            },
          ),
          createStep(
            'connect',
            '导入完成后回首页直接连接',
            '配置出现后，回到首页点连接按钮，开始使用当前节点。',
            '如果你有多个配置，先确认当前激活的是刚导入的那一个。',
            '连接首页',
            ['回到首页', '确认当前配置', '点击连接'],
            '开始连接',
            {
              src: HIDDIFY_SCREENSHOTS.connectHome,
              alt: 'Hiddify 首页连接',
            },
          ),
          createStep(
            'connect',
            '后续记得更新配置',
            '如果后台给你换了节点或续费了套餐，记得在配置页手动更新一次。',
            '更新不成功时，优先检查当前网络和订阅链接是否还有效。',
            '更新配置',
            ['打开配置详情', '执行更新', '确认节点已刷新'],
            '刷新配置',
            {
              src: HIDDIFY_SCREENSHOTS.updateProfile,
              alt: 'Hiddify 更新配置',
            },
          ),
        ]
      : [
          createStep(
            'launch',
            'Open the add-profile entry first',
            'After landing on the Hiddify home screen, open the add-profile or plus entry to start importing.',
            'If this is your first launch, just finish the welcome screen first.',
            'Add profile',
            ['Open Hiddify', 'Enter the add-profile screen'],
            'Open entry',
            {
              src: HIDDIFY_SCREENSHOTS.openAddProfile,
              alt: 'Open add-profile entry in Hiddify',
            },
          ),
          createStep(
            'import',
            'The fastest way is import from clipboard',
            'If you just copied the subscription link, importing from clipboard is usually the quickest option.',
            'This is the easiest path for most first-time setups.',
            'Clipboard import',
            [
              'Copy the subscription link',
              'Tap Add from clipboard',
              'Wait for the profile to be recognized',
            ],
            'Import from clipboard',
            {
              src: HIDDIFY_SCREENSHOTS.addFromClipboard,
              alt: 'Import from clipboard in Hiddify',
            },
          ),
          createStep(
            'import',
            'Paste the URL manually if clipboard fails',
            'You can also add a profile manually and paste the copied subscription URL.',
            'Manual import is the better option when you want to verify the link itself.',
            'Manual import',
            ['Choose manual add', 'Paste the subscription URL', 'Save the profile'],
            'Paste URL manually',
            {
              src: HIDDIFY_SCREENSHOTS.addManually,
              alt: 'Paste subscription URL manually in Hiddify',
            },
          ),
          createStep(
            'connect',
            'Return home and connect',
            'Once the profile appears, go back to the home screen and connect with it.',
            'If you have multiple profiles, make sure the newly imported one is active first.',
            'Home connect',
            ['Return to Home', 'Confirm the active profile', 'Tap Connect'],
            'Connect',
            {
              src: HIDDIFY_SCREENSHOTS.connectHome,
              alt: 'Connect from the Hiddify home screen',
            },
          ),
          createStep(
            'connect',
            'Remember to refresh the profile later',
            'If your nodes change or your plan is renewed, refresh the profile once from its detail page.',
            'When refresh fails, check the current network and the subscription link first.',
            'Update profile',
            ['Open the profile details', 'Run update', 'Confirm the node list refreshed'],
            'Refresh profile',
            {
              src: HIDDIFY_SCREENSHOTS.updateProfile,
              alt: 'Refresh profile in Hiddify',
            },
          ),
        ],
  };
}

function buildRealFlClashGuide(platformLabel: string, isZh: boolean): ClientGuide {
  return {
    recommendedFormat: 'clash',
    note: isZh
      ? `这组步骤使用公开的 FlClash 真机截图；${platformLabel} 上布局可能略有差异，但导入顺序基本一致。`
      : `These steps use public FlClash screenshots. The ${platformLabel} layout may differ slightly, but the import flow stays effectively the same.`,
    sourceLabel: isZh ? 'FlClash 图文教程来源' : 'FlClash tutorial source',
    sourceUrl: FLCLASH_GUIDE_SOURCE_URL,
    steps: isZh
      ? [
          createStep(
            'launch',
            '先打开配置页并准备新建订阅',
            '进入 Config 或 Profiles 页面，找到 New Configuration 之类的入口。',
            '首次启动如果弹出核心初始化或权限提示，先完成再继续。',
            '配置页',
            ['Configs / Profiles', 'New Configuration', '导入入口'],
            '打开配置页',
            {
              src: FLCLASH_SCREENSHOTS.newConfiguration,
              alt: 'FlClash 新建配置入口',
            },
          ),
          createStep(
            'import',
            '把当前页面切到 Clash，再粘贴订阅 URL',
            '先在这里复制 Clash 链接，再在 FlClash 里选择 URL 导入并粘贴。',
            'Mihomo/Clash 客户端一旦格式选错，策略组通常不会完整出现。',
            'URL 导入',
            ['Clash 格式', '粘贴 URL', '保存配置'],
            '导入订阅',
            {
              src: FLCLASH_SCREENSHOTS.url,
              alt: 'FlClash URL 导入界面',
            },
          ),
          createStep(
            'connect',
            '确认配置写入并主动刷新一次',
            '保存后回到配置卡片，确认新配置已经出现，必要时手动更新。',
            '如果节点为空，先检查是不是还没刷新配置。',
            '配置卡片',
            ['已创建配置', '刷新配置', '等待资源加载'],
            '检查配置',
            {
              src: FLCLASH_SCREENSHOTS.editConfiguration,
              alt: 'FlClash 配置详情界面',
            },
          ),
          createStep(
            'connect',
            '先选节点或策略组',
            '进入 Proxy 页面，先确认节点和策略组已经加载出来，再切换到你要用的目标。',
            '先选好节点，再开代理，排错会简单很多。',
            '节点选择',
            ['打开 Proxy', '选择节点', '确认已切换'],
            '选择节点',
            {
              src: FLCLASH_SCREENSHOTS.nodeSelection,
              alt: 'FlClash 节点选择界面',
            },
          ),
          createStep(
            'connect',
            '最后开启代理或系统代理',
            '回到主界面打开代理开关；桌面端再确认系统代理已经接管流量。',
            '只导入不打开代理时，浏览器和系统流量不会真正经过 FlClash。',
            '开始连接',
            ['启用代理', '允许系统权限', '回到浏览器测试'],
            '开始连接',
            {
              src: FLCLASH_SCREENSHOTS.enableProxy,
              alt: 'FlClash 开启代理',
            },
          ),
        ]
      : [
          createStep(
            'launch',
            'Open the config screen and prepare a new profile',
            'Go to Configs or Profiles and find the new configuration entry.',
            'If first launch prompts for core setup or permissions, finish that first.',
            'Config screen',
            ['Configs / Profiles', 'New Configuration', 'Import entry'],
            'Open config screen',
            {
              src: FLCLASH_SCREENSHOTS.newConfiguration,
              alt: 'FlClash new configuration entry',
            },
          ),
          createStep(
            'import',
            'Switch this page to Clash, then paste the subscription URL',
            'Copy the Clash link from here first, then import it by URL inside FlClash.',
            'If the format is wrong, policy groups are usually the first thing to look broken.',
            'URL import',
            ['Clash format', 'Paste URL', 'Save profile'],
            'Import subscription',
            {
              src: FLCLASH_SCREENSHOTS.url,
              alt: 'FlClash URL import screen',
            },
          ),
          createStep(
            'connect',
            'Confirm the profile exists and refresh once',
            'After saving, return to the profile card and make sure the imported config is visible.',
            'If the node list stays empty, check whether the profile was refreshed.',
            'Profile card',
            ['Imported config', 'Refresh profile', 'Wait for resources'],
            'Check profile',
            {
              src: FLCLASH_SCREENSHOTS.editConfiguration,
              alt: 'FlClash profile details',
            },
          ),
          createStep(
            'connect',
            'Pick a node or policy group first',
            'Open Proxy and confirm nodes and policy groups have loaded before switching.',
            'Choosing the node before enabling proxy makes troubleshooting much simpler.',
            'Node selection',
            ['Open Proxy', 'Choose a node', 'Confirm it switched'],
            'Select node',
            {
              src: FLCLASH_SCREENSHOTS.nodeSelection,
              alt: 'FlClash node selection',
            },
          ),
          createStep(
            'connect',
            'Enable proxy or system proxy last',
            'Turn on the proxy switch from the main screen; on desktop also confirm system proxy is active.',
            'Importing alone does not move browser or system traffic until proxy mode is enabled.',
            'Connect',
            ['Enable proxy', 'Allow permissions', 'Test in the browser'],
            'Connect',
            {
              src: FLCLASH_SCREENSHOTS.enableProxy,
              alt: 'Enable proxy in FlClash',
            },
          ),
        ],
  };
}

function buildRealSparkleGuide(platformLabel: string, isZh: boolean): ClientGuide {
  return {
    recommendedFormat: 'clash',
    note: isZh
      ? `这组截图来自 Mihomo Party 教程；Sparkle 和它属于近似分支，${platformLabel} 上的订阅与代理流程基本一致。`
      : `These screenshots come from the Mihomo Party tutorial. Sparkle tracks a very similar desktop flow on ${platformLabel}, so the subscription and proxy steps still line up closely.`,
    sourceLabel: isZh
      ? 'Sparkle / Mihomo Party 教程来源'
      : 'Sparkle / Mihomo Party tutorial source',
    sourceUrl: SPARKLE_GUIDE_SOURCE_URL,
    steps: isZh
      ? [
          createStep(
            'launch',
            '先看主界面，确认订阅入口在哪',
            '打开 Sparkle 后，先确认左侧导航和主界面都正常显示，订阅入口通常就在侧栏里。',
            '如果刚安装完成，先把必要权限或管理员提示处理掉。',
            '主界面',
            ['侧边栏', 'Profiles / Subscriptions', '系统权限'],
            '打开主界面',
            {
              src: SPARKLE_SCREENSHOTS.start,
              alt: 'Sparkle 主界面',
            },
          ),
          createStep(
            'import',
            '新建远程订阅',
            '进入订阅页后，点击添加订阅或类似入口，准备导入新的远程配置。',
            'Sparkle 的订阅入口名称可能略有变化，但都在订阅或配置区域。',
            '新建订阅',
            ['Subscriptions', 'Add subscription', 'Remote profile'],
            '新建订阅',
            {
              src: SPARKLE_SCREENSHOTS.addSubscription,
              alt: 'Sparkle 新建订阅',
            },
          ),
          createStep(
            'import',
            '切到 Clash 格式并粘贴订阅链接',
            '复制当前页面的 Clash 链接，再粘贴到 Sparkle 的订阅地址输入框里并保存。',
            '如果导入后看不到策略组，先检查是不是导错了格式。',
            '订阅地址',
            ['Clash 格式', '粘贴 URL', '保存并刷新'],
            '保存订阅',
            {
              src: SPARKLE_SCREENSHOTS.subscription,
              alt: 'Sparkle 订阅管理界面',
            },
          ),
          createStep(
            'connect',
            '切到 Proxies 选择节点或策略组',
            '确认订阅刷新完成后，到 Proxies 页面里选中你想用的节点或自动选择组。',
            '导入成功但没选节点时，流量通常还不会按预期走代理。',
            '节点与策略组',
            ['打开 Proxies', '选择节点', '确认当前组已切换'],
            '选择节点',
            {
              src: SPARKLE_SCREENSHOTS.proxies,
              alt: 'Sparkle 代理组和节点',
            },
          ),
          createStep(
            'connect',
            '最后开启系统代理',
            '回到主界面，打开 System Proxy 或等价代理开关，让浏览器和系统流量接管到 Sparkle。',
            'TUN 可以后面再研究，第一次先把 System Proxy 跑通就够了。',
            '系统代理',
            ['回到首页', '开启 System Proxy', '重新打开网页测试'],
            '开始连接',
            {
              src: SPARKLE_SCREENSHOTS.systemProxy,
              alt: 'Sparkle 开启系统代理',
            },
          ),
        ]
      : [
          createStep(
            'launch',
            'Open the home screen and find the subscription entry',
            'After Sparkle launches, confirm the sidebar and the subscription area are visible.',
            'Handle any first-run permission or admin prompt before importing.',
            'Home screen',
            ['Sidebar', 'Profiles / Subscriptions', 'System permissions'],
            'Open home',
            {
              src: SPARKLE_SCREENSHOTS.start,
              alt: 'Sparkle home screen',
            },
          ),
          createStep(
            'import',
            'Create a new remote subscription',
            'Open the subscription page and add a new remote profile.',
            'The label may differ by build, but it stays in the subscriptions or profile area.',
            'New subscription',
            ['Subscriptions', 'Add subscription', 'Remote profile'],
            'Create subscription',
            {
              src: SPARKLE_SCREENSHOTS.addSubscription,
              alt: 'Create subscription in Sparkle',
            },
          ),
          createStep(
            'import',
            'Switch this page to Clash and paste the link',
            'Copy the Clash subscription link from here, paste it into Sparkle, then save and refresh.',
            'If policy groups are missing after import, check the format first.',
            'Subscription URL',
            ['Clash format', 'Paste URL', 'Save and refresh'],
            'Save subscription',
            {
              src: SPARKLE_SCREENSHOTS.subscription,
              alt: 'Sparkle subscription management screen',
            },
          ),
          createStep(
            'connect',
            'Choose a node or policy group in Proxies',
            'Once the subscription has refreshed, switch to Proxies and choose the node or group you want.',
            'Importing successfully is not enough if no active group is selected.',
            'Nodes and groups',
            ['Open Proxies', 'Choose a node', 'Confirm the active group changed'],
            'Select node',
            {
              src: SPARKLE_SCREENSHOTS.proxies,
              alt: 'Sparkle proxies and nodes',
            },
          ),
          createStep(
            'connect',
            'Enable system proxy last',
            'Return to the main page and turn on System Proxy so browser and system traffic actually route through Sparkle.',
            'You can explore TUN later. System Proxy is the cleanest first test.',
            'System proxy',
            ['Return home', 'Enable System Proxy', 'Reload a page and test'],
            'Connect',
            {
              src: SPARKLE_SCREENSHOTS.systemProxy,
              alt: 'Enable system proxy in Sparkle',
            },
          ),
        ],
  };
}

function buildRealSurgeGuide(isZh: boolean): ClientGuide {
  return {
    recommendedFormat: 'surge',
    note: isZh
      ? '这组步骤使用公开的 Surge 真机截图，直接按 Surge 配置导入流程走即可。'
      : 'These steps use public Surge screenshots and follow the normal Surge profile import flow.',
    sourceLabel: isZh ? 'Surge 图文教程来源' : 'Surge tutorial source',
    sourceUrl: SURGE_GUIDE_SOURCE_URL,
    steps: isZh
      ? [
          createStep(
            'launch',
            '先打开导入或下载配置入口',
            '进入 Surge 后，先从下拉菜单或配置页进入 Download Configuration 一类的入口。',
            '第一次使用先不用折腾脚本和模块，先把订阅导入成功。',
            '导入入口',
            ['下拉菜单', 'Profiles', 'Download Configuration'],
            '打开导入入口',
            {
              src: SURGE_SCREENSHOTS.dropdownMenu,
              alt: 'Surge 下拉菜单',
            },
          ),
          createStep(
            'import',
            '新建远程配置',
            '点击下载配置或新增配置，让 Surge 准备接收一个新的远程订阅。',
            'Surge 更适合直接使用 Surge 格式订阅，不建议这里贴 Universal。',
            '新建配置',
            ['Download Configuration', 'Remote profile', '配置列表'],
            '新建配置',
            {
              src: SURGE_SCREENSHOTS.downloadConfiguration,
              alt: 'Surge 下载配置入口',
            },
          ),
          createStep(
            'import',
            '粘贴当前页面的 Surge 订阅链接',
            '先把当前页面切到 Surge，再把复制好的订阅地址粘贴到 Surge 的输入框里。',
            '如果规则组看起来不完整，优先检查是不是用了错误格式的链接。',
            '订阅链接',
            ['Surge 格式', '粘贴 URL', '保存配置'],
            '导入配置',
            {
              src: SURGE_SCREENSHOTS.pasteLink,
              alt: 'Surge 粘贴订阅链接',
            },
          ),
          createStep(
            'connect',
            '确认配置文件已经生成并刷新',
            '保存后回到配置文件列表，确认刚才的配置已经出现，必要时手动刷新一次。',
            '导入后先确认规则和策略组都正常加载，再去启动。',
            '配置文件',
            ['配置已生成', '刷新配置', '等待资源完成'],
            '检查配置',
            {
              src: SURGE_SCREENSHOTS.configurationFile,
              alt: 'Surge 配置文件列表',
            },
          ),
          createStep(
            'connect',
            '最后启动并允许 VPN',
            '确认配置可用后点击启动，iPhone / iPad 会弹出 VPN 权限确认。',
            '如果导入成功但网络仍然直连，通常是这里的 VPN 权限还没放行。',
            '开始连接',
            ['启动配置', '允许 VPN', '回到应用测试'],
            '开始连接',
            {
              src: SURGE_SCREENSHOTS.startConnection,
              alt: 'Surge 启动连接',
            },
          ),
        ]
      : [
          createStep(
            'launch',
            'Open the import or download profile entry first',
            'Inside Surge, start from the dropdown menu or profile screen and open Download Configuration.',
            'Ignore scripts and modules for now. Get the subscription imported first.',
            'Import entry',
            ['Dropdown menu', 'Profiles', 'Download Configuration'],
            'Open import entry',
            {
              src: SURGE_SCREENSHOTS.dropdownMenu,
              alt: 'Surge dropdown menu',
            },
          ),
          createStep(
            'import',
            'Create a new remote profile',
            'Use the download configuration flow to add a new remote subscription profile.',
            'Surge works best with the Surge format here instead of the Universal link.',
            'New profile',
            ['Download Configuration', 'Remote profile', 'Profile list'],
            'Create profile',
            {
              src: SURGE_SCREENSHOTS.downloadConfiguration,
              alt: 'Surge download configuration screen',
            },
          ),
          createStep(
            'import',
            'Paste the Surge subscription URL from this page',
            'Switch this page to Surge first, then paste the copied link into Surge.',
            'If groups or fields look incomplete after import, the wrong format is the first thing to check.',
            'Subscription URL',
            ['Surge format', 'Paste URL', 'Save profile'],
            'Import profile',
            {
              src: SURGE_SCREENSHOTS.pasteLink,
              alt: 'Paste subscription URL into Surge',
            },
          ),
          createStep(
            'connect',
            'Confirm the profile exists and refresh it',
            'Return to the profile list, confirm the new configuration file is present, and refresh if needed.',
            'Make sure rules and policy groups have loaded before you start the connection.',
            'Profile file',
            ['Profile created', 'Refresh profile', 'Wait for resources'],
            'Check profile',
            {
              src: SURGE_SCREENSHOTS.configurationFile,
              alt: 'Surge configuration file list',
            },
          ),
          createStep(
            'connect',
            'Start the profile and allow VPN',
            'Once the profile looks correct, start it and accept the iOS VPN permission prompt.',
            'If import succeeded but traffic stays direct, this VPN permission is usually the missing step.',
            'Connect',
            ['Start profile', 'Allow VPN', 'Test in the app or browser'],
            'Connect',
            {
              src: SURGE_SCREENSHOTS.startConnection,
              alt: 'Start the connection in Surge',
            },
          ),
        ],
  };
}

function buildRealSingBoxAppleGuide(platform: 'ios' | 'macos', isZh: boolean): ClientGuide {
  if (platform === 'macos') {
    return {
      recommendedFormat: 'singbox',
      note: isZh
        ? '这组步骤使用公开的 Singbox for Mac 真机截图，直接按 SFM 的配置导入流程走即可。'
        : 'These steps use public Singbox for Mac screenshots and follow the standard SFM profile import flow.',
      sourceLabel: isZh ? 'Sing-box for Apple 教程来源' : 'Sing-box for Apple tutorial source',
      sourceUrl: SINGBOX_APPLE_GUIDE_SOURCE_URL,
      steps: isZh
        ? [
            createStep(
              'launch',
              '先打开配置管理页',
              '进入 Singbox for Mac 后，先到配置或 Profiles 页面，准备新增远程配置。',
              '第一次启动如果要求授予网络或代理权限，先完成。',
              '配置页',
              ['Profiles', 'Configurations', '导入入口'],
              '打开配置页',
              {
                src: SINGBOX_APPLE_SCREENSHOTS.macosConfigurationSettings,
                alt: 'Singbox for Mac 配置管理页',
              },
            ),
            createStep(
              'import',
              '切到 Sing-box 格式并保存配置',
              '先在这里复制 Sing-box 链接，再在 SFM 的配置输入框里粘贴并保存。',
              'Sing-box 客户端最好直接吃 Sing-box 格式，兼容性最稳。',
              '配置导入',
              ['Sing-box 格式', '粘贴 URL', '保存配置'],
              '导入配置',
              {
                src: SINGBOX_APPLE_SCREENSHOTS.macosEnableSingBox,
                alt: 'Singbox for Mac 保存配置并启用',
              },
            ),
            createStep(
              'connect',
              '确认网络模式或系统代理设置',
              '导入后先检查网络模式，确认系统代理或对应接管方式已经准备好。',
              '桌面端如果不接管系统代理，浏览器流量通常还不会真正经过 sing-box。',
              '网络模式',
              ['Network mode', 'System proxy', '允许系统权限'],
              '检查模式',
              {
                src: SINGBOX_APPLE_SCREENSHOTS.macosInternetMode,
                alt: 'Singbox for Mac 网络模式设置',
              },
            ),
            createStep(
              'connect',
              '选择节点或策略组并连接',
              '确认配置和规则加载完成后，选择节点或策略组，再开始连接。',
              '第一次连通后再改 DNS、路由之类高级开关，排错会轻松很多。',
              '节点选择',
              ['选择节点', '确认分组', '开始连接'],
              '开始连接',
              {
                src: SINGBOX_APPLE_SCREENSHOTS.macosNodeSelection,
                alt: 'Singbox for Mac 节点选择',
              },
            ),
          ]
        : [
            createStep(
              'launch',
              'Open the profile management screen first',
              'Inside Singbox for Mac, go to Profiles or Configurations and prepare a new remote profile.',
              'If first launch asks for network or proxy permission, finish that first.',
              'Profile screen',
              ['Profiles', 'Configurations', 'Import entry'],
              'Open profile screen',
              {
                src: SINGBOX_APPLE_SCREENSHOTS.macosConfigurationSettings,
                alt: 'Singbox for Mac profile management screen',
              },
            ),
            createStep(
              'import',
              'Switch this page to Sing-box and save the profile',
              'Copy the Sing-box link from here, paste it into SFM, then save the profile.',
              'Sing-box clients are most reliable when they import the Sing-box format directly.',
              'Profile import',
              ['Sing-box format', 'Paste URL', 'Save profile'],
              'Import profile',
              {
                src: SINGBOX_APPLE_SCREENSHOTS.macosEnableSingBox,
                alt: 'Save and enable profile in Singbox for Mac',
              },
            ),
            createStep(
              'connect',
              'Confirm network mode or system proxy',
              'After import, check the network mode and make sure system proxy handoff is ready.',
              'Desktop traffic usually stays direct until system proxy has actually been taken over.',
              'Network mode',
              ['Network mode', 'System proxy', 'Allow permissions'],
              'Check mode',
              {
                src: SINGBOX_APPLE_SCREENSHOTS.macosInternetMode,
                alt: 'Singbox for Mac network mode settings',
              },
            ),
            createStep(
              'connect',
              'Choose a node or group and connect',
              'Once rules and resources have finished loading, select the node or group you want and connect.',
              'Leave advanced DNS or routing toggles alone until the first connection works.',
              'Node selection',
              ['Choose node', 'Confirm group', 'Connect'],
              'Connect',
              {
                src: SINGBOX_APPLE_SCREENSHOTS.macosNodeSelection,
                alt: 'Singbox for Mac node selection',
              },
            ),
          ],
    };
  }

  return {
    recommendedFormat: 'singbox',
    note: isZh
      ? '这组步骤使用公开的 Sing-box VT 真机截图，按 iPhone / iPad 上的配置导入顺序走即可。'
      : 'These steps use public Sing-box VT screenshots and follow the normal iPhone / iPad import flow.',
    sourceLabel: isZh ? 'Sing-box for Apple 教程来源' : 'Sing-box for Apple tutorial source',
    sourceUrl: SINGBOX_APPLE_GUIDE_SOURCE_URL,
    steps: isZh
      ? [
          createStep(
            'launch',
            '先进入配置页准备新增订阅',
            '打开 Sing-box VT 后，先进入配置或 Profiles 页面，准备新增远程配置。',
            '如果刚安装完成，先把网络扩展或基础权限提示处理掉。',
            '配置页',
            ['Profiles', 'Configurations', '新增配置'],
            '打开配置页',
            {
              src: SINGBOX_APPLE_SCREENSHOTS.iosConfigurationSettings1,
              alt: 'Sing-box VT 配置页',
            },
          ),
          createStep(
            'import',
            '切到 Sing-box 格式并保存配置',
            '先在这里复制 Sing-box 链接，再在 App 里粘贴到远程配置或 URL 输入框并保存。',
            '如果你看到 JSON、Profile 或 Configuration 字样，基本就是对的入口。',
            '导入配置',
            ['Sing-box 格式', '粘贴 URL', '保存配置'],
            '保存配置',
            {
              src: SINGBOX_APPLE_SCREENSHOTS.iosConfigurationSettings2,
              alt: 'Sing-box VT 保存配置',
            },
          ),
          createStep(
            'connect',
            '回到主页启用 sing-box',
            '配置保存后，回到主页或运行页，把 sing-box 开关打开。',
            '如果导入成功却还没开始代理，通常就是开关还没真正启用。',
            '启用配置',
            ['返回主页', '打开 sing-box', '确认状态变化'],
            '启用 sing-box',
            {
              src: SINGBOX_APPLE_SCREENSHOTS.iosEnableSingBox1,
              alt: 'Sing-box VT 启用连接',
            },
          ),
          createStep(
            'connect',
            '允许 iOS 的 VPN / 网络扩展权限',
            'iPhone / iPad 第一次连接时会弹出系统确认，需要手动允许。',
            '如果状态看起来已开启但网络还是直连，优先回来看这一步。',
            '系统权限',
            ['Allow VPN', '系统确认', '返回应用'],
            '允许权限',
            {
              src: SINGBOX_APPLE_SCREENSHOTS.iosEnableSingBox2,
              alt: 'Sing-box VT iOS 权限确认',
            },
          ),
          createStep(
            'connect',
            '最后选择节点或策略组',
            '连接建立后，到分组页里选中要使用的节点或策略组。',
            '先用默认规则跑通，再去改更细的 DNS 或路由设置。',
            '分组选择',
            ['打开 Groups', '选择节点', '确认当前分组'],
            '选择节点',
            {
              src: SINGBOX_APPLE_SCREENSHOTS.iosGroups,
              alt: 'Sing-box VT 分组和节点选择',
            },
          ),
        ]
      : [
          createStep(
            'launch',
            'Open the configuration screen first',
            'After launching Sing-box VT, go to Profiles or Configurations and prepare a new remote profile.',
            'If installation just finished, clear any network extension or base permission prompt first.',
            'Configuration screen',
            ['Profiles', 'Configurations', 'New profile'],
            'Open configuration screen',
            {
              src: SINGBOX_APPLE_SCREENSHOTS.iosConfigurationSettings1,
              alt: 'Sing-box VT configuration screen',
            },
          ),
          createStep(
            'import',
            'Switch this page to Sing-box and save the profile',
            'Copy the Sing-box link from here, paste it into the remote profile or URL field inside the app, then save.',
            'If the app talks about JSON, Profiles, or Configurations, you are usually in the right place.',
            'Import profile',
            ['Sing-box format', 'Paste URL', 'Save profile'],
            'Save profile',
            {
              src: SINGBOX_APPLE_SCREENSHOTS.iosConfigurationSettings2,
              alt: 'Save a profile in Sing-box VT',
            },
          ),
          createStep(
            'connect',
            'Return home and enable sing-box',
            'After the profile is saved, go back to the main screen and turn sing-box on.',
            'If import worked but no proxy starts, the switch often was not fully enabled yet.',
            'Enable profile',
            ['Return home', 'Turn on sing-box', 'Confirm status changed'],
            'Enable sing-box',
            {
              src: SINGBOX_APPLE_SCREENSHOTS.iosEnableSingBox1,
              alt: 'Enable the connection in Sing-box VT',
            },
          ),
          createStep(
            'connect',
            'Allow the iOS VPN / network extension prompt',
            'The first connection on iPhone or iPad triggers a system confirmation that you must accept.',
            'If the app looks active but traffic stays direct, check this permission first.',
            'System permission',
            ['Allow VPN', 'Accept system prompt', 'Return to app'],
            'Allow permission',
            {
              src: SINGBOX_APPLE_SCREENSHOTS.iosEnableSingBox2,
              alt: 'iOS permission prompt in Sing-box VT',
            },
          ),
          createStep(
            'connect',
            'Choose a node or policy group last',
            'Once the connection is up, open the groups page and choose the node or policy group you want.',
            'Keep DNS and routing tweaks for later. Start with the default rules first.',
            'Groups',
            ['Open Groups', 'Choose node', 'Confirm active group'],
            'Select node',
            {
              src: SINGBOX_APPLE_SCREENSHOTS.iosGroups,
              alt: 'Groups and node selection in Sing-box VT',
            },
          ),
        ],
  };
}

function buildRealSingBoxAndroidGuide(isZh: boolean): ClientGuide {
  return {
    recommendedFormat: 'singbox',
    note: isZh
      ? '这组步骤使用公开的 sing-box for Android 真机截图。'
      : 'These steps use public sing-box for Android screenshots.',
    sourceLabel: isZh ? 'sing-box for Android 教程来源' : 'sing-box for Android tutorial source',
    sourceUrl: SINGBOX_ANDROID_GUIDE_SOURCE_URL,
    steps: isZh
      ? [
          createStep(
            'launch',
            '先新建一个远程配置',
            '打开 sing-box for Android 后，先从 Profiles 或新增配置入口开始。',
            '第一次启动如果要初始化核心或读取存储权限，先完成。',
            '新增配置',
            ['Profiles', '新增配置', '远程配置'],
            '新建配置',
            {
              src: SINGBOX_ANDROID_SCREENSHOTS.createConfig1,
              alt: 'sing-box for Android 新建配置第一步',
            },
          ),
          createStep(
            'import',
            '继续选择远程导入方式',
            '在新增配置流程里继续往下走，选择通过 URL 或远程配置导入。',
            'sing-box 原生格式通常会走 Profiles / Config 这条路径。',
            '导入方式',
            ['Remote profile', 'URL 导入', '继续下一步'],
            '选择导入方式',
            {
              src: SINGBOX_ANDROID_SCREENSHOTS.createConfig2,
              alt: 'sing-box for Android 新建配置第二步',
            },
          ),
          createStep(
            'import',
            '切到 Sing-box 格式并保存配置',
            '先在这里复制 Sing-box 链接，再在配置设置页里粘贴并保存。',
            '如果导入后解析报错，先检查是不是复制了错误格式的链接。',
            '配置设置',
            ['Sing-box 格式', '粘贴 URL', '保存配置'],
            '保存配置',
            {
              src: SINGBOX_ANDROID_SCREENSHOTS.configSettings,
              alt: 'sing-box for Android 配置设置页',
            },
          ),
          createStep(
            'connect',
            '开始连接并允许 VPN',
            '保存后回到主界面开始连接，Android 会弹出 VPN 权限请求。',
            '如果列表已经有节点但网络还是不通，通常就是这一步没放行。',
            'VPN 权限',
            ['开始连接', 'Allow VPN', '返回应用'],
            '允许 VPN',
            {
              src: SINGBOX_ANDROID_SCREENSHOTS.vpnPermission,
              alt: 'sing-box for Android VPN 权限确认',
            },
          ),
          createStep(
            'connect',
            '最后选择节点或策略组',
            '连接建立后，到分组页里选中你要使用的节点或策略组。',
            '先用默认规则跑通，再去改更底层的 DNS 或路由开关。',
            '节点选择',
            ['打开 Groups', '选择节点', '确认当前分组'],
            '选择节点',
            {
              src: SINGBOX_ANDROID_SCREENSHOTS.nodeSelection,
              alt: 'sing-box for Android 节点选择',
            },
          ),
        ]
      : [
          createStep(
            'launch',
            'Create a new remote profile first',
            'After opening sing-box for Android, start from Profiles or the new profile entry.',
            'If first launch needs core initialization or storage permission, finish that first.',
            'New profile',
            ['Profiles', 'New profile', 'Remote profile'],
            'Create profile',
            {
              src: SINGBOX_ANDROID_SCREENSHOTS.createConfig1,
              alt: 'Create a new profile in sing-box for Android',
            },
          ),
          createStep(
            'import',
            'Continue with the remote import flow',
            'In the profile creation flow, keep going and choose URL or remote profile import.',
            'The sing-box-native path usually stays under Profiles or Configs.',
            'Import method',
            ['Remote profile', 'URL import', 'Continue'],
            'Choose import method',
            {
              src: SINGBOX_ANDROID_SCREENSHOTS.createConfig2,
              alt: 'Continue remote profile import in sing-box for Android',
            },
          ),
          createStep(
            'import',
            'Switch this page to Sing-box and save the profile',
            'Copy the Sing-box link from here, paste it into the settings screen, then save.',
            'If parsing fails after import, the first thing to check is whether the wrong format was copied.',
            'Profile settings',
            ['Sing-box format', 'Paste URL', 'Save profile'],
            'Save profile',
            {
              src: SINGBOX_ANDROID_SCREENSHOTS.configSettings,
              alt: 'Profile settings in sing-box for Android',
            },
          ),
          createStep(
            'connect',
            'Start the profile and allow VPN',
            'Return to the main screen, start the connection, and accept Android’s VPN permission prompt.',
            'If the node list is visible but traffic still fails, this permission is usually the missing piece.',
            'VPN permission',
            ['Start connection', 'Allow VPN', 'Return to app'],
            'Allow VPN',
            {
              src: SINGBOX_ANDROID_SCREENSHOTS.vpnPermission,
              alt: 'VPN permission prompt in sing-box for Android',
            },
          ),
          createStep(
            'connect',
            'Choose a node or policy group last',
            'After the connection comes up, open the groups page and choose the node or policy group you want.',
            'Leave lower-level DNS and routing toggles alone until the first connection is stable.',
            'Node selection',
            ['Open Groups', 'Choose node', 'Confirm active group'],
            'Select node',
            {
              src: SINGBOX_ANDROID_SCREENSHOTS.nodeSelection,
              alt: 'Node selection in sing-box for Android',
            },
          ),
        ],
  };
}

function buildRealClashBoxGuide(isZh: boolean): ClientGuide {
  return {
    recommendedFormat: 'clash',
    note: isZh
      ? '这组步骤使用公开的 ClashBox 真机截图，适合 HarmonyOS NEXT 直接按 Clash 流程导入。'
      : 'These steps use public ClashBox screenshots and follow the normal Clash-style import flow on HarmonyOS NEXT.',
    sourceLabel: isZh ? 'ClashBox 图文教程来源' : 'ClashBox tutorial source',
    sourceUrl: CLASHBOX_GUIDE_SOURCE_URL,
    steps: isZh
      ? [
          createStep(
            'launch',
            '先打开 ClashBox 主界面',
            '进入 ClashBox 后，先找到 Profiles、配置或导入入口。',
            'HarmonyOS NEXT 上第一次启动如果有系统提示，先完成。',
            '主界面',
            ['Profiles', '配置页', '导入入口'],
            '打开主界面',
            {
              src: CLASHBOX_SCREENSHOTS.home,
              alt: 'ClashBox 主界面',
            },
          ),
          createStep(
            'import',
            '切到 Clash 格式并保存订阅',
            '先复制当前页面的 Clash 链接，再粘贴到 ClashBox 的配置或订阅输入框里并保存。',
            'ClashBox 最稳妥的导入方式还是 Clash 格式，不要先贴 Universal。',
            '导入配置',
            ['Clash 格式', '粘贴 URL', '保存配置'],
            '保存订阅',
            {
              src: CLASHBOX_SCREENSHOTS.profile,
              alt: 'ClashBox 配置和订阅页面',
            },
          ),
          createStep(
            'connect',
            '最后启动并允许系统接管',
            '确认配置加载完成后再点击启动，让 ClashBox 接管网络流量。',
            '如果导入成功但网络不通，优先检查系统权限或代理接管状态。',
            '开始连接',
            ['启动配置', '允许系统权限', '回到浏览器测试'],
            '开始连接',
            {
              src: CLASHBOX_SCREENSHOTS.start,
              alt: 'ClashBox 开始连接',
            },
          ),
        ]
      : [
          createStep(
            'launch',
            'Open the ClashBox home screen first',
            'Inside ClashBox, start from the Profiles, configuration, or import entry.',
            'If HarmonyOS NEXT shows a first-run prompt, finish that first.',
            'Home screen',
            ['Profiles', 'Config screen', 'Import entry'],
            'Open home',
            {
              src: CLASHBOX_SCREENSHOTS.home,
              alt: 'ClashBox home screen',
            },
          ),
          createStep(
            'import',
            'Switch this page to Clash and save the profile',
            'Copy the Clash link from here, paste it into ClashBox, then save the remote profile.',
            'ClashBox is most reliable when you start with the Clash format instead of the Universal link.',
            'Profile import',
            ['Clash format', 'Paste URL', 'Save profile'],
            'Save profile',
            {
              src: CLASHBOX_SCREENSHOTS.profile,
              alt: 'ClashBox profile import screen',
            },
          ),
          createStep(
            'connect',
            'Start the profile and allow system takeover',
            'Once the profile has loaded, start the connection so ClashBox takes over network traffic.',
            'If import succeeds but traffic still fails, check system permissions or proxy takeover first.',
            'Connect',
            ['Start profile', 'Allow system permission', 'Test in browser'],
            'Connect',
            {
              src: CLASHBOX_SCREENSHOTS.start,
              alt: 'Start the connection in ClashBox',
            },
          ),
        ],
  };
}

function buildRealClashMetaGuide(isZh: boolean): ClientGuide {
  return {
    recommendedFormat: 'clash',
    note: isZh
      ? '这组截图来自公开的 Clash for Android 教程；Clash Meta for Android 的订阅导入入口和流程基本一致。'
      : 'These screenshots come from a public Clash for Android walkthrough. Clash Meta for Android keeps a nearly identical Clash-style import flow.',
    sourceLabel: isZh
      ? 'Clash Meta for Android 教程来源'
      : 'Clash Meta for Android tutorial source',
    sourceUrl: CLASH_META_GUIDE_SOURCE_URL,
    steps: isZh
      ? [
          createStep(
            'launch',
            '先打开配置主界面',
            '进入 Clash Meta for Android 后，先找到配置列表或 Profiles 页。',
            '第一次启动如果还没初始化核心或权限，先处理掉。',
            '配置首页',
            ['Profiles', '配置列表', '导入入口'],
            '打开配置页',
            {
              src: CLASH_META_SCREENSHOTS.home,
              alt: 'Clash Meta for Android 主界面',
            },
          ),
          createStep(
            'import',
            '新建远程配置并准备粘贴链接',
            '在配置页里新增一个远程配置，准备导入当前页面的 Clash 订阅。',
            'Meta 系客户端同样应该优先使用 Clash 格式，别先贴 Universal。',
            '新增配置',
            ['Clash 格式', 'Remote profile', 'URL 导入'],
            '新建配置',
            {
              src: CLASH_META_SCREENSHOTS.configuration,
              alt: 'Clash Meta for Android 配置界面',
            },
          ),
          createStep(
            'import',
            '粘贴 Clash 链接并保存',
            '复制当前页面的 Clash 订阅链接，粘贴到配置输入框并保存。',
            '如果规则或策略组不完整，通常先回头检查格式和刷新状态。',
            '保存配置',
            ['粘贴 URL', '保存配置', '回到列表'],
            '保存配置',
            {
              src: CLASH_META_SCREENSHOTS.saveConfiguration,
              alt: 'Clash Meta for Android 保存配置',
            },
          ),
          createStep(
            'connect',
            '最后启动代理并允许 VPN',
            '确认配置加载完成后再启动代理，Android 会弹出 VPN 权限请求。',
            '如果看得到节点却还是不通，优先检查这一步有没有放行。',
            '开启代理',
            ['启动代理', 'Allow VPN', '回到浏览器测试'],
            '开始连接',
            {
              src: CLASH_META_SCREENSHOTS.startProxy,
              alt: 'Clash Meta for Android 开启代理',
            },
          ),
        ]
      : [
          createStep(
            'launch',
            'Open the profile screen first',
            'Inside Clash Meta for Android, start from the profile list or Profiles screen.',
            'If core setup or permissions are still pending, finish that first.',
            'Profile home',
            ['Profiles', 'Profile list', 'Import entry'],
            'Open profile screen',
            {
              src: CLASH_META_SCREENSHOTS.home,
              alt: 'Clash Meta for Android home screen',
            },
          ),
          createStep(
            'import',
            'Create a remote profile and prepare the link',
            'From the profile page, create a new remote profile and prepare to import the Clash subscription from this page.',
            'Meta-family clients should still import the Clash format here, not the Universal link.',
            'New profile',
            ['Clash format', 'Remote profile', 'URL import'],
            'Create profile',
            {
              src: CLASH_META_SCREENSHOTS.configuration,
              alt: 'Clash Meta for Android profile configuration screen',
            },
          ),
          createStep(
            'import',
            'Paste the Clash URL and save',
            'Copy the Clash subscription link from here, paste it into the input field, and save the profile.',
            'If rules or groups look incomplete later, check the format and refresh state first.',
            'Save profile',
            ['Paste URL', 'Save profile', 'Return to list'],
            'Save profile',
            {
              src: CLASH_META_SCREENSHOTS.saveConfiguration,
              alt: 'Save profile in Clash Meta for Android',
            },
          ),
          createStep(
            'connect',
            'Start the proxy and allow VPN last',
            'After the profile has loaded, start the proxy and accept Android’s VPN permission prompt.',
            'If nodes are visible but traffic still fails, this permission is the first thing to re-check.',
            'Start proxy',
            ['Start proxy', 'Allow VPN', 'Test in browser'],
            'Connect',
            {
              src: CLASH_META_SCREENSHOTS.startProxy,
              alt: 'Start proxy in Clash Meta for Android',
            },
          ),
        ],
  };
}

function decorateGuideWithRealScreenshots(
  guide: ClientGuide,
  clientId: ClientId,
  platform: GuidePlatform,
  isZh: boolean,
): ClientGuide {
  if (clientId === 'flClash' && ['windows', 'macos', 'linux', 'android'].includes(platform)) {
    return buildRealFlClashGuide(getPlatformLabel(platform, isZh), isZh);
  }

  if (clientId === 'v2rayN' && (platform === 'windows' || platform === 'linux')) {
    return buildRealV2RayNGuide(isZh);
  }

  if (clientId === 'clashVerge' && (platform === 'windows' || platform === 'macos')) {
    return buildRealClashVergeGuide(getPlatformLabel(platform, isZh), isZh);
  }

  if (clientId === 'sparkle' && ['windows', 'macos', 'linux'].includes(platform)) {
    return buildRealSparkleGuide(getPlatformLabel(platform, isZh), isZh);
  }

  if (clientId === 'v2rayNG' && platform === 'android') {
    return buildRealV2RayNGGuide(isZh);
  }

  if (clientId === 'clashMeta' && platform === 'android') {
    return buildRealClashMetaGuide(isZh);
  }

  if (clientId === 'singBox' && platform === 'android') {
    return buildRealSingBoxAndroidGuide(isZh);
  }

  if (clientId === 'shadowrocket' && platform === 'ios') {
    return buildRealShadowrocketGuide(isZh);
  }

  if (clientId === 'surge' && platform === 'ios') {
    return buildRealSurgeGuide(isZh);
  }

  if (clientId === 'singBox' && (platform === 'ios' || platform === 'macos')) {
    return buildRealSingBoxAppleGuide(platform, isZh);
  }

  if (clientId === 'clashBox' && platform === 'harmonyos') {
    return buildRealClashBoxGuide(isZh);
  }

  if (clientId === 'hiddify') {
    return buildRealHiddifyGuide(getPlatformLabel(platform, isZh), isZh);
  }

  return guide;
}

export function SubscriptionTab({ initialFocus = 'overview', subId }: SubscriptionTabProps) {
  const { language } = useI18n();
  const isZh = language === 'zh-CN';
  const downloadsRef = useRef<HTMLElement>(null);
  const [activePlatform, setActivePlatform] = useState<GuidePlatform>(() =>
    detectInitialPlatform(),
  );
  const [activeClientId, setActiveClientId] = useState<ClientId>(() =>
    getRecommendedClientId(detectInitialPlatform()),
  );
  const [activeFormat, setActiveFormat] = useState<SubscriptionFormat>('universal');
  const [showFormatOptions, setShowFormatOptions] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);
  const [hasMarkedConnected, setHasMarkedConnected] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const subscriptionLinks = useMemo(
    () => ({
      universal: subId ? buildSubscriptionUrl(subId, 'universal') : '',
      clash: subId ? buildSubscriptionUrl(subId, 'clash') : '',
      v2ray: subId ? buildSubscriptionUrl(subId, 'v2ray') : '',
      singbox: subId ? buildSubscriptionUrl(subId, 'singbox') : '',
      surge: subId ? buildSubscriptionUrl(subId, 'surge') : '',
    }),
    [subId],
  );
  const hasSubscription = Boolean(subscriptionLinks.universal);

  const formatOptions = useMemo(
    () => [
      {
        key: 'universal' as const,
        label: 'Universal',
        desc: isZh ? '适合大多数客户端' : 'Works with most clients',
      },
      {
        key: 'clash' as const,
        label: 'Clash',
        desc: isZh ? '更适合 Clash 系列' : 'Best for Clash-based clients',
      },
      {
        key: 'v2ray' as const,
        label: 'V2Ray',
        desc: isZh ? '适合 V2Ray 客户端' : 'For V2Ray clients',
      },
      {
        key: 'singbox' as const,
        label: 'Singbox',
        desc: isZh ? '适合 sing-box 客户端' : 'For sing-box clients',
      },
      {
        key: 'surge' as const,
        label: 'Surge',
        desc: isZh ? '适合 Surge 客户端' : 'For Surge clients',
      },
    ],
    [isZh],
  );

  const clients = useMemo<ClientCard[]>(
    () =>
      CLIENT_META.map((client) => {
        const preferredPlatform = client.platforms.includes(activePlatform)
          ? activePlatform
          : ((client.recommendedFor[0] ?? client.platforms[0]) as ClientDownloadPlatform);
        const useEnglishDescription =
          isZh &&
          ((client.id === 'v2rayN' && activePlatform === 'linux') ||
            client.id === 'flClash' ||
            client.id === 'clashMeta' ||
            client.id === 'sparkle' ||
            client.id === 'singBox');
        return {
          id: client.id,
          name:
            client.id === 'singBox'
              ? preferredPlatform === 'ios'
                ? 'Sing-box VT'
                : preferredPlatform === 'macos'
                  ? 'Singbox for Mac'
                  : preferredPlatform === 'linux'
                    ? 'Singbox for Linux'
                    : client.name
              : client.name,
          icon: client.icon,
          os: client.os,
          platforms: client.platforms,
          recommendedFor: client.recommendedFor,
          desc: useEnglishDescription ? client.descEn : isZh ? client.descZh : client.descEn,
          links: getClientDownloadLinks(client.id, preferredPlatform),
        };
      }),
    [activePlatform, isZh],
  );

  const visibleClients = useMemo(() => {
    const preferredOrder = PLATFORM_CLIENT_ORDER[activePlatform];

    return [...clients]
      .filter(
        (client) => client.platforms.includes(activePlatform) && preferredOrder.includes(client.id),
      )
      .sort((left, right) => {
        const leftIndex = preferredOrder.indexOf(left.id);
        const rightIndex = preferredOrder.indexOf(right.id);
        const normalizedLeftIndex = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
        const normalizedRightIndex = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
        return normalizedLeftIndex - normalizedRightIndex;
      });
  }, [activePlatform, clients]);
  const recommendedClientId = useMemo(
    () => getRecommendedClientId(activePlatform),
    [activePlatform],
  );

  useEffect(() => {
    if (!visibleClients.some((client) => client.id === activeClientId)) {
      setActiveClientId(recommendedClientId);
    }
  }, [activeClientId, recommendedClientId, visibleClients]);

  const activeClient =
    visibleClients.find((client) => client.id === activeClientId) ??
    visibleClients[0] ??
    clients[0];
  const alternativeClients = visibleClients.filter((client) => client.id !== recommendedClientId);
  const guidePlatform: GuidePlatform = activeClient.platforms.includes(activePlatform)
    ? activePlatform
    : (activeClient.recommendedFor[0] ?? activeClient.platforms[0] ?? 'windows');
  const guidePlatformLabel = getPlatformLabel(guidePlatform, isZh);
  const guide = decorateGuideWithRealScreenshots(
    buildClientGuide(activeClient.id, guidePlatform, guidePlatformLabel, isZh),
    activeClient.id,
    guidePlatform,
    isZh,
  );
  const activeSubUrl = subscriptionLinks[activeFormat];
  const activeFormatOption =
    formatOptions.find((item) => item.key === activeFormat) ?? formatOptions[0];
  const recommendedFormatOption =
    formatOptions.find((item) => item.key === guide.recommendedFormat) ?? formatOptions[0];
  const usesRealGuideScreenshots = guide.steps.some((step) => Boolean(step.screenshot));

  useEffect(() => {
    setActiveFormat(guide.recommendedFormat);
    setShowFormatOptions(false);
  }, [guide.recommendedFormat, activeClient.id]);

  useEffect(() => {
    const target = initialFocus === 'downloads' ? downloadsRef.current : null;
    if (!target) return;
    const timer = window.setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [initialFocus]);

  const handlePlatformSelect = useCallback((platform: GuidePlatform) => {
    setActivePlatform(platform);
    setActiveClientId(getRecommendedClientId(platform));
  }, []);

  const handleCopy = useCallback((text: string, key: string) => {
    if (!text) return;
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setHasCopied(true);
      window.setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current));
      }, COPY_RESET_DELAY_MS);
    });
  }, []);

  const openDownload = useCallback((url: string, clientId?: ClientId) => {
    if (!url) return;
    if (clientId) setActiveClientId(clientId);
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  return (
    <div className="space-y-6" data-testid="portal-setup-tab">
      <section className="space-y-6">
        <section className="surface-card space-y-5 p-6 md:p-7" data-testid="portal-setup-platforms">
          <StepHeader
            step={1}
            icon={Monitor}
            title={isZh ? '先选你的设备平台' : 'Start with your device'}
            description={
              isZh
                ? '先选你最常用的设备，下面的推荐客户端、订阅格式和导入步骤会一起切到更合适的路径。'
                : 'Choose the device you use most and the recommended client, format, and guide will switch together.'
            }
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {PLATFORM_OPTIONS.map((platform) => (
              <button
                key={platform.key}
                type="button"
                onClick={() => handlePlatformSelect(platform.key)}
                data-testid={`portal-setup-platform-${platform.key}`}
                className={cn(
                  'rounded-[24px] border px-4 py-4 text-left transition-colors',
                  activePlatform === platform.key
                    ? 'border-emerald-500/40 bg-emerald-500/10'
                    : 'border-[color:var(--border-subtle)] bg-[var(--surface-panel)] hover:border-[color:var(--border-strong)]',
                )}
              >
                <p className="text-sm font-medium text-zinc-50">
                  {isZh ? platform.zhLabel : platform.label}
                </p>
                <p className="mt-1 text-xs leading-6 text-zinc-400">
                  {getPlatformBlurb(platform.key, isZh)}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section
          ref={downloadsRef}
          className="surface-card space-y-5 p-6 md:p-7"
          data-testid="portal-setup-clients"
        >
          <StepHeader
            step={2}
            icon={Download}
            title={isZh ? '下载推荐客户端' : 'Download a recommended client'}
            description={
              isZh
                ? '先从推荐客户端开始，下面也保留了常见备选，切换后教程会同步更新。'
                : 'Start with the recommended client. Common alternatives stay below and the guide updates when you switch.'
            }
          />
          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <ClientHighlightCard
              client={clients.find((item) => item.id === recommendedClientId) ?? activeClient}
              activePlatform={activePlatform}
              isZh={isZh}
              isActive={activeClient.id === recommendedClientId}
              onSelect={setActiveClientId}
              onOpenDownload={openDownload}
            />
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                {isZh ? '备选客户端' : 'Alternatives'}
              </p>
              {alternativeClients.length > 0 ? (
                alternativeClients.map((client) => (
                  <div key={client.id}>
                    <ClientCompactCard
                      client={client}
                      isZh={isZh}
                      isActive={client.id === activeClient.id}
                      onSelect={setActiveClientId}
                      onOpenDownload={openDownload}
                    />
                  </div>
                ))
              ) : (
                <div className="surface-panel rounded-[24px] p-4 text-sm leading-6 text-zinc-400">
                  {isZh
                    ? '这个平台用当前推荐客户端就足够，直接继续下一步即可。'
                    : 'The recommended client is enough for this platform, so you can continue.'}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="surface-card space-y-5 p-6 md:p-7" data-testid="portal-setup-link">
          <StepHeader
            step={3}
            icon={LinkIcon}
            title={isZh ? '复制匹配好的订阅链接' : 'Copy the matched subscription link'}
            description={
              isZh
                ? '下面这条链接会优先匹配当前客户端；如果你熟悉格式，也可以手动切换。'
                : 'The link below is matched to the current client first, but you can still switch formats manually.'
            }
          />
          <div className="flex flex-col gap-3 rounded-[24px] border border-[color:var(--border-subtle)] bg-[var(--surface-panel)] p-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-300">
                  {activeFormat === guide.recommendedFormat
                    ? isZh
                      ? '\u5df2\u6309\u5f53\u524d\u5ba2\u6237\u7aef\u81ea\u52a8\u5339\u914d'
                      : 'Auto-matched to current client'
                    : isZh
                      ? '\u5df2\u624b\u52a8\u5207\u6362\u683c\u5f0f'
                      : 'Manual format override'}
                </span>
                <span className="rounded-full border border-[color:var(--border-subtle)] bg-black/10 px-2.5 py-1 text-[11px] text-zinc-300">
                  {activeClient.name} / {recommendedFormatOption.label}
                  {activeFormat === guide.recommendedFormat
                    ? ''
                    : isZh
                      ? ' \u63a8\u8350'
                      : ' recommended'}
                </span>
              </div>
              <p className="text-sm text-zinc-300">
                {activeFormat === guide.recommendedFormat
                  ? isZh
                    ? `\u73b0\u5728\u663e\u793a\u7684\u662f ${activeClient.name} \u5bf9\u5e94\u7684 ${recommendedFormatOption.label} \u8ba2\u9605\uff0c\u53ef\u4ee5\u76f4\u63a5\u590d\u5236\u3002`
                    : `You are seeing the ${recommendedFormatOption.label} link for ${activeClient.name}, ready to copy.`
                  : isZh
                    ? `\u4f60\u76ee\u524d\u624b\u52a8\u5207\u6362\u5230\u4e86 ${activeFormatOption.label} \u683c\u5f0f\u3002\u5982\u679c\u60f3\u56de\u5230\u9ed8\u8ba4\u63a8\u8350\uff0c\u5207\u6362\u5ba2\u6237\u7aef\u540e\u4f1a\u81ea\u52a8\u6062\u590d\u3002`
                    : `You have manually switched to the ${activeFormatOption.label} format. Changing the client will reset this back to the recommended format.`}
              </p>
            </div>
            <Button
              type="button"
              variant={showFormatOptions ? 'secondary' : 'outline'}
              size="sm"
              className="shrink-0 gap-2"
              onClick={() => setShowFormatOptions((current) => !current)}
              data-testid="portal-setup-toggle-formats"
            >
              {showFormatOptions
                ? isZh
                  ? '\u6536\u8d77\u5176\u4ed6\u683c\u5f0f'
                  : 'Hide other formats'
                : isZh
                  ? '\u5207\u6362\u5176\u4ed6\u683c\u5f0f'
                  : 'Switch format'}
              {showFormatOptions ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </Button>
          </div>
          {showFormatOptions ? (
            <div className="grid gap-2 md:grid-cols-5">
              {formatOptions.map((format) => (
                <button
                  key={format.key}
                  type="button"
                  onClick={() => setActiveFormat(format.key)}
                  data-testid={`portal-setup-format-${format.key}`}
                  className={cn(
                    'rounded-[20px] border p-3 text-left transition-colors',
                    activeFormat === format.key
                      ? 'border-emerald-500/40 bg-emerald-500/10'
                      : 'border-[color:var(--border-subtle)] bg-[var(--surface-panel)] hover:border-[color:var(--border-strong)]',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-zinc-50">{format.label}</p>
                    {guide.recommendedFormat === format.key ? (
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                        {isZh ? '当前推荐' : 'Recommended'}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[11px] leading-5 text-zinc-400">{format.desc}</p>
                </button>
              ))}
            </div>
          ) : null}
          <div className="surface-panel space-y-4 rounded-[28px] p-4 md:p-5">
            {hasSubscription ? (
              <>
                <div className="flex items-center gap-1 text-xs text-zinc-400">
                  <span>{isZh ? '可直接导入的链接' : 'Ready-to-import link'}</span>
                  <InfoTooltip
                    content={
                      isZh
                        ? '复制后直接粘贴到客户端即可。'
                        : 'Copy it, then paste it into your client.'
                    }
                  />
                </div>
                <p
                  className="break-all rounded-[20px] border border-[color:var(--border-subtle)] bg-black/10 px-4 py-3 font-mono text-xs leading-6 text-zinc-300"
                  data-testid="subscription-active-url"
                >
                  {activeSubUrl}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="gap-2"
                    onClick={() => handleCopy(activeSubUrl, `active-${activeFormat}`)}
                    data-testid="portal-setup-copy-link"
                  >
                    <Copy className="h-4 w-4" />
                    {copiedKey === `active-${activeFormat}`
                      ? isZh
                        ? '已复制'
                        : 'Copied'
                      : isZh
                        ? '复制订阅链接'
                        : 'Copy subscription link'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => setShowQr((current) => !current)}
                  >
                    <QrCode className="h-4 w-4" />
                    {showQr ? (isZh ? '隐藏二维码' : 'Hide QR') : isZh ? '显示二维码' : 'Show QR'}
                    {showQr ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                {showQr ? <QrCodeCanvas url={activeSubUrl} isZh={isZh} /> : null}
              </>
            ) : (
              <div
                className="space-y-2 rounded-[20px] border border-dashed border-amber-500/30 bg-amber-500/5 px-4 py-5 text-sm leading-7 text-zinc-300"
                data-testid="portal-setup-not-ready"
              >
                <p className="font-medium text-zinc-100">
                  {isZh ? '订阅还在准备中' : 'Your subscription is still being prepared'}
                </p>
                <p>
                  {isZh
                    ? '你可以先下载客户端并预览下面的导入步骤，等订阅准备好后再回来复制链接。'
                    : 'You can download the client and preview the import steps now, then come back once the subscription is ready.'}
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="surface-card space-y-5 p-6 md:p-7" data-testid="portal-setup-guide">
          <StepHeader
            step={4}
            icon={Terminal}
            title={isZh ? '按步骤导入并连接' : 'Import and connect'}
            description={
              isZh
                ? `下面是 ${activeClient.name} 在 ${guidePlatformLabel} 上更接近真实界面的导入流程。`
                : `These cards show a more realistic flow for ${activeClient.name} on ${guidePlatformLabel}.`
            }
          />
          <div className="surface-panel rounded-[24px] p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <span>{isZh ? '这个客户端建议使用的格式' : 'Best format for this client'}</span>
                  <InfoTooltip
                    content={
                      isZh
                        ? '如果导入不顺利，可以回到上一步试试其他格式。'
                        : 'If import does not go smoothly, come back and try another format.'
                    }
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
                    {formatOptions.find((item) => item.key === guide.recommendedFormat)?.label ??
                      'Universal'}
                  </span>
                  <span className="text-xs text-zinc-400">{guide.note}</span>
                  {guide.sourceUrl ? (
                    <a
                      href={guide.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-emerald-300 hover:text-emerald-200"
                    >
                      {guide.sourceLabel ?? 'Source'}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </div>
              </div>
              <div className="rounded-[20px] border border-[color:var(--border-subtle)] bg-black/10 px-4 py-3 text-right">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                  {isZh ? '当前教程' : 'Current guide'}
                </p>
                <p className="mt-2 text-sm font-medium text-zinc-100">
                  {activeClient.name} / {guidePlatformLabel}
                </p>
              </div>
            </div>
          </div>
          {usesRealGuideScreenshots ? (
            <div className="space-y-4">
              {guide.steps.map((step, index) => (
                <div key={`${activeClient.id}-${step.tone}-${index}`}>
                  <GuideScreenshotStepCard step={step} index={index} />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-[20px] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100">
                {isZh
                  ? '当前客户端暂时只有简化步骤，没有站内真机图文教程。'
                  : 'This client currently uses a simplified text guide without on-site screenshots.'}
              </div>
              <div className="grid gap-4 xl:grid-cols-3">
                {guide.steps.map((step, index) => (
                  <div key={`${activeClient.id}-${step.tone}-${index}`}>
                    <GuideStepCard step={step} index={index} />
                  </div>
                ))}
              </div>
            </div>
          )}
          <Button
            type="button"
            variant={hasMarkedConnected ? 'secondary' : 'outline'}
            size="sm"
            className="gap-2"
            onClick={() => setHasMarkedConnected((current) => !current)}
          >
            <Check className="h-4 w-4" />
            {hasMarkedConnected
              ? isZh
                ? '已标记为导入完成'
                : 'Marked as completed'
              : isZh
                ? '导入成功后点此标记'
                : 'Mark this after you connect successfully'}
          </Button>
        </section>
      </section>
    </div>
  );
}

function StepHeader({
  step,
  icon: Icon,
  title,
  description,
}: {
  step: number;
  icon: typeof Monitor;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-sm font-medium text-emerald-300">
          {step}
        </span>
        <div className="flex items-center gap-2 text-lg font-semibold text-zinc-50">
          <Icon className="h-4 w-4 text-emerald-400" />
          <span>{title}</span>
        </div>
      </div>
      <p className="max-w-3xl text-sm leading-7 text-zinc-400">{description}</p>
    </div>
  );
}

function GuideStepCard({ step, index }: { step: GuideStep; index: number }) {
  const toneClasses =
    step.tone === 'launch'
      ? {
          border: 'border-sky-500/25',
          panel: 'border-sky-500/20 bg-sky-500/8',
          badge: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
          icon: 'text-sky-300',
        }
      : step.tone === 'import'
        ? {
            border: 'border-amber-500/25',
            panel: 'border-amber-500/20 bg-amber-500/8',
            badge: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
            icon: 'text-amber-300',
          }
        : {
            border: 'border-emerald-500/25',
            panel: 'border-emerald-500/20 bg-emerald-500/8',
            badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
            icon: 'text-emerald-300',
          };

  const VisualIcon = step.tone === 'launch' ? Monitor : step.tone === 'import' ? LinkIcon : Check;

  return (
    <article className={cn('rounded-[28px] border p-5', toneClasses.border)}>
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full border border-[color:var(--border-subtle)] bg-[var(--surface-panel)] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-zinc-400">
          {`Step ${index + 1}`}
        </span>
        <span className={cn('rounded-full border px-3 py-1 text-[11px]', toneClasses.badge)}>
          {step.visualLabel}
        </span>
      </div>
      <div className="mt-4 space-y-2">
        <h3 className="text-base font-semibold text-zinc-50">{step.title}</h3>
        <p className="text-sm leading-7 text-zinc-400">{step.description}</p>
      </div>
      <div className={cn('mt-5 rounded-[24px] border p-4', toneClasses.panel)}>
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/10">
              <VisualIcon className={cn('h-4 w-4', toneClasses.icon)} />
            </span>
            <span className="text-sm font-medium text-zinc-100">{step.visualLabel}</span>
          </div>
          <span className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-[11px] text-zinc-300">
            {step.ctaLabel}
          </span>
        </div>
        <div className="mt-4 space-y-2">
          {step.visualItems.map((item) => (
            <div
              key={item}
              className="flex items-center justify-between rounded-[18px] border border-white/10 bg-black/10 px-3 py-2"
            >
              <span className="text-xs text-zinc-200">{item}</span>
              <span className="h-2 w-2 rounded-full bg-white/50" />
            </div>
          ))}
        </div>
      </div>
      <p className="mt-4 text-xs leading-6 text-zinc-500">{step.helper}</p>
    </article>
  );
}

function GuideScreenshotStepCard({ step, index }: { step: GuideStep; index: number }) {
  if (!step.screenshot) {
    return <GuideStepCard step={step} index={index} />;
  }

  const [naturalImageSize, setNaturalImageSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const naturalRatio = naturalImageSize ? naturalImageSize.width / naturalImageSize.height : null;
  const highlights = GUIDE_SCREENSHOT_HIGHLIGHTS[step.screenshot.src] ?? [];
  const screenshotLayout =
    naturalRatio !== null && naturalRatio < 0.7
      ? 'narrowPortrait'
      : naturalRatio !== null && naturalRatio < 1.05
        ? 'portrait'
        : 'landscape';
  const screenshotLayoutMaxWidth =
    screenshotLayout === 'narrowPortrait' ? 320 : screenshotLayout === 'portrait' ? 448 : null;
  const screenshotRenderMaxWidth = naturalImageSize
    ? Math.min(naturalImageSize.width * 1.25, screenshotLayoutMaxWidth ?? Number.POSITIVE_INFINITY)
    : screenshotLayoutMaxWidth;
  const toneClasses =
    step.tone === 'launch'
      ? {
          border: 'border-sky-500/25',
          panel: 'border-sky-500/20 bg-sky-500/8',
          badge: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
        }
      : step.tone === 'import'
        ? {
            border: 'border-amber-500/25',
            panel: 'border-amber-500/20 bg-amber-500/8',
            badge: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
          }
        : {
            border: 'border-emerald-500/25',
            panel: 'border-emerald-500/20 bg-emerald-500/8',
            badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
          };

  return (
    <article className={cn('rounded-[28px] border p-4 md:p-5', toneClasses.border)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-[color:var(--border-subtle)] bg-[var(--surface-panel)] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-zinc-400">
            {`Step ${index + 1}`}
          </span>
          <span className={cn('rounded-full border px-3 py-1 text-[11px]', toneClasses.badge)}>
            {step.visualLabel}
          </span>
        </div>
        <a
          href={step.screenshot.src}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-100"
        >
          {step.ctaLabel}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.85fr)] lg:items-start">
        <a
          href={step.screenshot.src}
          target="_blank"
          rel="noreferrer"
          className={cn(
            'overflow-hidden rounded-[24px] border p-3 transition-colors hover:border-[color:var(--border-strong)]',
            toneClasses.panel,
          )}
        >
          <div className="flex justify-center">
            <div
              className="relative w-full overflow-hidden rounded-[18px] border border-white/10 bg-white/5"
              style={screenshotRenderMaxWidth ? { maxWidth: screenshotRenderMaxWidth } : undefined}
            >
              <img
                src={step.screenshot.src}
                alt={step.screenshot.alt}
                loading="lazy"
                className="block h-auto w-full"
                onLoad={(event) => {
                  const { naturalWidth, naturalHeight } = event.currentTarget;
                  if (!naturalWidth || !naturalHeight) return;
                  setNaturalImageSize({ width: naturalWidth, height: naturalHeight });
                }}
              />
              {highlights.length ? (
                <div className="pointer-events-none absolute inset-0">
                  {highlights.map((highlight, highlightIndex) => (
                    <div
                      key={`${step.screenshot?.src}-${highlightIndex}`}
                      className="absolute rounded-[16px] border-2 border-red-500/95 bg-red-500/10 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_16px_40px_rgba(220,38,38,0.18)]"
                      style={{
                        left: `${highlight.x}%`,
                        top: `${highlight.y}%`,
                        width: `${highlight.w}%`,
                        height: `${highlight.h}%`,
                      }}
                    >
                      <span className="absolute left-2 top-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-semibold text-white shadow-lg">
                        {highlightIndex + 1}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </a>

        <div className={cn('rounded-[24px] border p-4', toneClasses.panel)}>
          <h3 className="text-base font-semibold text-zinc-50">{step.title}</h3>
          <p className="mt-2 text-sm leading-7 text-zinc-300">{step.description}</p>
          <div className="mt-4 space-y-2">
            {step.visualItems.map((item, itemIndex) => (
              <div
                key={`${step.title}-${item}`}
                className="flex items-start gap-3 rounded-[18px] border border-white/10 bg-black/10 px-3 py-3"
              >
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-[11px] text-zinc-200">
                  {itemIndex + 1}
                </span>
                <span className="text-sm leading-6 text-zinc-100">{item}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-6 text-zinc-400">{step.helper}</p>
        </div>
      </div>
    </article>
  );
}

function isClientCardActionTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest('[data-client-action]'));
}

function ClientHighlightCard({
  client,
  activePlatform,
  isZh,
  isActive,
  onSelect,
  onOpenDownload,
}: {
  client: ClientCard;
  activePlatform: GuidePlatform;
  isZh: boolean;
  isActive: boolean;
  onSelect: (clientId: ClientId) => void;
  onOpenDownload: (url: string, clientId?: ClientId) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isActive}
      onClick={(event) => {
        if (isClientCardActionTarget(event.target)) return;
        onSelect(client.id);
      }}
      onKeyDown={(event) => {
        if (isClientCardActionTarget(event.target)) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onSelect(client.id);
      }}
      className={cn(
        'cursor-pointer rounded-[28px] border p-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)]',
        isActive
          ? 'border-emerald-500/40 bg-emerald-500/10'
          : 'border-[color:var(--border-subtle)] bg-[var(--surface-panel)] hover:border-[color:var(--border-strong)]',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-300">
            {isZh ? '主推荐' : 'Primary pick'}
          </span>
          <div className="flex items-center gap-3">
            <client.icon className="h-5 w-5 text-zinc-300" />
            <div>
              <p className="text-base font-semibold text-zinc-50">{client.name}</p>
              <p className="text-xs leading-6 text-zinc-400">{client.os}</p>
            </div>
          </div>
          <p className="max-w-xl text-sm leading-7 text-zinc-300">{client.desc}</p>
          <p className="text-xs leading-6 text-zinc-500">
            {isZh
              ? `当前按 ${getPlatformLabel(activePlatform, true)} 给你推荐这款客户端。`
              : `Recommended for ${getPlatformLabel(activePlatform, false)} right now.`}
          </p>
        </div>
        <Button
          type="button"
          variant={isActive ? 'secondary' : 'outline'}
          size="sm"
          className="hidden"
          onClick={() => onSelect(client.id)}
        >
          {isZh ? '使用这个客户端' : 'Use this client'}
        </Button>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-2"
          onClick={() => onOpenDownload(client.links.github, client.id)}
          data-testid="portal-setup-download-primary"
          data-client-action="true"
          disabled={!client.links.github}
        >
          <Download className="h-4 w-4" />
          {isZh ? '下载客户端' : 'Download client'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => onOpenDownload(client.links.github, client.id)}
          data-client-action="true"
          disabled={!client.links.github}
        >
          <ExternalLink className="h-4 w-4" />
          {isZh ? '官方源' : 'Official'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => onOpenDownload(client.links.vps, client.id)}
          data-client-action="true"
          disabled={!client.links.vps}
        >
          <ExternalLink className="h-4 w-4" />
          {isZh ? '镜像下载' : 'Mirror'}
        </Button>
      </div>
    </div>
  );
}

function ClientCompactCard({
  client,
  isZh,
  isActive,
  onSelect,
  onOpenDownload,
}: {
  client: ClientCard;
  isZh: boolean;
  isActive: boolean;
  onSelect: (clientId: ClientId) => void;
  onOpenDownload: (url: string, clientId?: ClientId) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isActive}
      onClick={(event) => {
        if (isClientCardActionTarget(event.target)) return;
        onSelect(client.id);
      }}
      onKeyDown={(event) => {
        if (isClientCardActionTarget(event.target)) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onSelect(client.id);
      }}
      className={cn(
        'surface-panel cursor-pointer rounded-[24px] border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)]',
        isActive
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : 'hover:border-[color:var(--border-strong)]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <client.icon className="h-4 w-4 text-zinc-400" />
          <div>
            <p className="text-sm font-medium text-zinc-100">{client.name}</p>
            <p className="text-xs leading-6 text-zinc-400">{client.desc}</p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="hidden"
          onClick={() => onSelect(client.id)}
        >
          {isZh ? '切换' : 'Select'}
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => onOpenDownload(client.links.github, client.id)}
          data-client-action="true"
          disabled={!client.links.github}
        >
          <ExternalLink className="h-4 w-4" />
          {isZh ? '官方' : 'Official'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => onOpenDownload(client.links.vps, client.id)}
          data-client-action="true"
          disabled={!client.links.vps}
        >
          <ExternalLink className="h-4 w-4" />
          {isZh ? '镜像' : 'Mirror'}
        </Button>
      </div>
    </div>
  );
}

function QrCodeCanvas({ url, isZh }: { url: string; isZh: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  const render = useCallback(
    (canvas: HTMLCanvasElement, targetUrl: string) => {
      import('qrcode')
        .then((mod) => {
          const qrModule = (mod as { default?: unknown }).default ?? mod;
          return (
            qrModule.toCanvas as (
              element: HTMLCanvasElement,
              text: string,
              options: object,
            ) => Promise<void>
          )(canvas, targetUrl, {
            width: 200,
            margin: 2,
            color: { dark: '#d4d4d8', light: '#18181b' },
          });
        })
        .then(() => setError(null))
        .catch(() => setError(isZh ? '生成二维码失败' : 'Failed to generate QR code'));
    },
    [isZh],
  );

  useEffect(() => {
    if (canvasRef.current && url) {
      render(canvasRef.current, url);
    }
  }, [url, render]);

  if (error) {
    return <p className="text-xs text-red-400">{error}</p>;
  }

  return (
    <div className="flex justify-start pt-2">
      <div className="surface-panel overflow-hidden rounded-[22px] p-2">
        <canvas ref={canvasRef} className="block" />
      </div>
    </div>
  );
}
