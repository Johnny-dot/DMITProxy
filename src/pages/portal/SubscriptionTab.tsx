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
  { key: 'android', label: 'Android', zhLabel: 'Android' },
  { key: 'ios', label: 'iPhone / iPad', zhLabel: 'iPhone / iPad' },
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
    os: 'Windows',
    platforms: ['windows'],
    recommendedFor: ['windows'],
    descZh: 'Windows 上最直接的传统选择。',
    descEn: 'A straightforward classic choice for Windows.',
  },
  {
    id: 'clashVerge',
    name: 'Clash Verge',
    icon: Monitor,
    os: 'Windows / macOS',
    platforms: ['windows', 'macos'],
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
    recommendedFor: ['android'],
    descZh: 'Android 上成熟稳定，适合日常使用。',
    descEn: 'A stable Android option for everyday use.',
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
    id: 'hiddify',
    name: 'Hiddify',
    icon: Smartphone,
    os: 'Windows / macOS / Android / iPhone / iPad',
    platforms: ['windows', 'macos', 'android', 'ios'],
    recommendedFor: ['windows', 'android', 'ios'],
    descZh: '上手最快，支持 URL、剪贴板和二维码导入。',
    descEn: 'Fastest to onboard with URL, clipboard, and QR import.',
  },
];

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

const SHADOWROCKET_GUIDE_SOURCE_URL = 'https://help.jegovpn.com/';
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
  [SHADOWROCKET_SCREENSHOTS.addSubscription]: [
    { x: 26.5, y: 3.5, w: 7.5, h: 13 },
    { x: 51.5, y: 14.5, w: 22, h: 10 },
    { x: 44.5, y: 29.5, w: 24, h: 11 },
  ],
  [SHADOWROCKET_SCREENSHOTS.connectNode]: [
    { x: 2.5, y: 18, w: 94, h: 18 },
    { x: 82, y: 18, w: 16, h: 18 },
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
  if (ua.includes('android')) return 'android';
  if (ua.includes('iphone') || ua.includes('ipad')) return 'ios';
  if (ua.includes('mac os') || ua.includes('macintosh')) return 'macos';
  return 'windows';
}

function getPlatformLabel(platform: GuidePlatform, isZh: boolean) {
  return (
    PLATFORM_OPTIONS.find((item) => item.key === platform)?.[isZh ? 'zhLabel' : 'label'] ??
    'Windows'
  );
}

function getRecommendedClientId(platform: GuidePlatform): ClientId {
  return (
    CLIENT_META.find((client) => client.recommendedFor.includes(platform))?.id ??
    CLIENT_META.find((client) => client.platforms.includes(platform))?.id ??
    'hiddify'
  );
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

function decorateGuideWithRealScreenshots(
  guide: ClientGuide,
  clientId: ClientId,
  platform: GuidePlatform,
  isZh: boolean,
): ClientGuide {
  if (clientId === 'v2rayN' && platform === 'windows') {
    return buildRealV2RayNGuide(isZh);
  }

  if (clientId === 'clashVerge' && (platform === 'windows' || platform === 'macos')) {
    return buildRealClashVergeGuide(getPlatformLabel(platform, isZh), isZh);
  }

  if (clientId === 'v2rayNG' && platform === 'android') {
    return buildRealV2RayNGGuide(isZh);
  }

  if (clientId === 'shadowrocket' && platform === 'ios') {
    return buildRealShadowrocketGuide(isZh);
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
    ],
    [isZh],
  );

  const clients = useMemo<ClientCard[]>(
    () =>
      CLIENT_META.map((client) => {
        const preferredPlatform = client.platforms.includes(activePlatform)
          ? activePlatform
          : ((client.recommendedFor[0] ?? client.platforms[0]) as ClientDownloadPlatform);
        return {
          id: client.id,
          name: client.name,
          icon: client.icon,
          os: client.os,
          platforms: client.platforms,
          recommendedFor: client.recommendedFor,
          desc: isZh ? client.descZh : client.descEn,
          links: getClientDownloadLinks(client.id, preferredPlatform),
        };
      }),
    [activePlatform, isZh],
  );

  const visibleClients = useMemo(
    () => clients.filter((client) => client.platforms.includes(activePlatform)),
    [activePlatform, clients],
  );
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
  const usesRealGuideScreenshots = guide.steps.some((step) => Boolean(step.screenshot));

  useEffect(() => {
    setActiveFormat(guide.recommendedFormat);
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
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                  {platform.key === 'windows'
                    ? isZh
                      ? '适合电脑端日常使用。'
                      : 'A solid choice for desktop use.'
                    : platform.key === 'macos'
                      ? isZh
                        ? '适合偏好规则和策略控制。'
                        : 'Best if you prefer rules and policy control.'
                      : platform.key === 'android'
                        ? isZh
                          ? '适合手机上快速导入。'
                          : 'Great for quick setup on your phone.'
                        : isZh
                          ? '适合 iPhone 和 iPad 导入。'
                          : 'Best for import on iPhone and iPad.'}
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
          <div className="grid gap-2 md:grid-cols-4">
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
            <div className="grid gap-4 xl:grid-cols-3">
              {guide.steps.map((step, index) => (
                <div key={`${activeClient.id}-${step.tone}-${index}`}>
                  <GuideStepCard step={step} index={index} />
                </div>
              ))}
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

  const highlights = GUIDE_SCREENSHOT_HIGHLIGHTS[step.screenshot.src] ?? [];
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
          <div className="relative overflow-hidden rounded-[18px] border border-white/10 bg-white/5">
            <img
              src={step.screenshot.src}
              alt={step.screenshot.alt}
              loading="lazy"
              className="h-auto w-full object-contain"
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
      className={cn(
        'rounded-[28px] border p-5 transition-colors',
        isActive
          ? 'border-emerald-500/40 bg-emerald-500/10'
          : 'border-[color:var(--border-subtle)] bg-[var(--surface-panel)]',
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
      className={cn(
        'surface-panel rounded-[24px] border p-4 transition-colors',
        isActive && 'border-emerald-500/30 bg-emerald-500/5',
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
        <Button type="button" variant="ghost" size="sm" onClick={() => onSelect(client.id)}>
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
