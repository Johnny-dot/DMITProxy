import {
  type ClientGuide,
  type ClientId,
  type GuidePlatform,
  type GuideStep,
  CLASH_VERGE_GUIDE_SOURCE_URL,
  CLASH_VERGE_SCREENSHOTS,
  CLASHBOX_GUIDE_SOURCE_URL,
  CLASHBOX_SCREENSHOTS,
  CLASH_META_GUIDE_SOURCE_URL,
  CLASH_META_SCREENSHOTS,
  FLCLASH_ANDROID_GUIDE_SOURCE_URL,
  FLCLASH_ANDROID_SCREENSHOTS,
  FLCLASH_GUIDE_SOURCE_URL,
  FLCLASH_MACOS_GUIDE_SOURCE_URL,
  FLCLASH_MACOS_SCREENSHOTS,
  FLCLASH_SCREENSHOTS,
  SHADOWROCKET_GUIDE_SOURCE_URL,
  SHADOWROCKET_SCREENSHOTS,
  SINGBOX_ANDROID_GUIDE_SOURCE_URL,
  SINGBOX_ANDROID_SCREENSHOTS,
  SINGBOX_APPLE_GUIDE_SOURCE_URL,
  SINGBOX_APPLE_SCREENSHOTS,
  SPARKLE_OFFICIAL_ISSUES_SOURCE_URL,
  SPARKLE_WINDOWS_SCREENSHOTS,
  SURGE_GUIDE_SOURCE_URL,
  SURGE_SCREENSHOTS,
  V2RAYN_GUIDE_SOURCE_URL,
  V2RAYN_LINUX_GUIDE_SOURCE_URL,
  V2RAYN_LINUX_SCREENSHOTS,
  V2RAYN_WINDOWS_SCREENSHOTS,
  V2RAYNG_GUIDE_SOURCE_URL,
  V2RAYNG_SCREENSHOTS,
  createStep,
  getPlatformLabel,
} from './SubscriptionTabData';

export function buildClientGuide(
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

  return {
    recommendedFormat: 'universal',
    note,
    steps: isZh
      ? [
          createStep(
            'launch',
            `先打开 ${platformLabel} 上的客户端并找到导入入口`,
            '导入入口通常会在首页、订阅页、配置页或者右上角加号附近。',
            '第一次启动如果先弹初始化、权限或欢迎页，先完成它们再继续。',
            platformLabel,
            ['首页', '订阅 / 配置', '导入入口'],
            '找到导入入口',
          ),
          createStep(
            'import',
            '优先导入当前页面匹配好的订阅链接',
            '如果客户端支持 URL 导入，就优先粘贴当前页面生成的订阅链接；支持一键导入时也可以直接唤起。',
            '如果规则、节点或分组显示不完整，先回到这里确认订阅格式选对了。',
            'Import profile',
            ['匹配的订阅格式', 'URL / 剪贴板 / 一键导入', '保存或更新配置'],
            '导入订阅',
          ),
          createStep(
            'connect',
            '保存后刷新配置、选择节点，再开启连接',
            '先确认节点、策略组或配置资源已经加载出来，再打开系统代理、VPN 或连接开关。',
            '如果导入成功但浏览器还是直连，通常就是这一步的系统权限还没放行。',
            'Connect',
            ['刷新配置', '选择节点', '允许系统权限并连接'],
            '连接并测试',
          ),
        ]
      : [
          createStep(
            'launch',
            `Open the client on ${platformLabel} and find its import entry`,
            'The import entry usually lives on the home screen, profiles page, config page, or behind a plus button.',
            'If the app starts with a welcome flow, permissions, or initialization, finish that first.',
            platformLabel,
            ['Home', 'Profiles / Config', 'Import entry'],
            'Find import entry',
          ),
          createStep(
            'import',
            'Import the matched subscription link first',
            'If the client supports URL import, paste the matched subscription link from this page. If it supports one-click import, you can launch it directly from here instead.',
            'If nodes, groups, or rules look incomplete afterward, the first thing to re-check is the selected format.',
            'Import profile',
            ['Matched format', 'URL / Clipboard / One-click import', 'Save or update profile'],
            'Import subscription',
          ),
          createStep(
            'connect',
            'Refresh, pick a node, then connect',
            'Make sure profiles, nodes, or rule resources have loaded before enabling system proxy, VPN, or the main connect switch.',
            'If import worked but traffic is still direct, the missing step is usually the system permission or proxy toggle.',
            'Connect',
            ['Refresh profile', 'Select node', 'Allow permission and connect'],
            'Connect and test',
          ),
        ],
  };
}

export function buildRealV2RayNGuide(isZh: boolean): ClientGuide {
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

export function buildRealV2RayNLinuxGuide(isZh: boolean): ClientGuide {
  return {
    recommendedFormat: 'universal',
    note: isZh
      ? '这组步骤使用 v2rayN Linux 真实界面截图；公开资料只找到了订阅设置和节点列表，因此其余部分保留为文字提示。'
      : 'These steps use real Linux v2rayN screenshots. Public source material only covered the subscription settings and node list, so the rest stays text-first.',
    sourceLabel: isZh ? 'v2rayN 官方 Linux 截图来源' : 'Official v2rayN Linux screenshot source',
    sourceUrl: V2RAYN_LINUX_GUIDE_SOURCE_URL,
    steps: isZh
      ? [
          createStep(
            'launch',
            '先进入订阅分组设置',
            '从顶部菜单打开 Subscription Group，进入订阅分组设置窗口。Linux 版导入订阅也是从这里开始。',
            '如果你当前只看到托盘图标，先把主窗口重新展开，再进入这个设置页。',
            '订阅分组设置',
            ['打开 Subscription Group', '进入订阅设置窗口', '准备填写 URL'],
            '打开设置',
            {
              src: V2RAYN_LINUX_SCREENSHOTS.subscriptionGroupSettings,
              alt: 'v2rayN Linux 订阅分组设置窗口',
            },
          ),
          createStep(
            'import',
            '填入订阅地址，必要时补 User Agent',
            '把这里复制的订阅链接粘到 URL(optional)。如果你的订阅服务会按客户端返回不同内容，可以像截图一样在 User Agent 里填 V2ray 或服务端要求的值，然后点击 Confirm。',
            '这是 Linux 版比较容易漏掉的差异项；有些服务端不给合适的 User Agent，就不会返回正确节点列表。',
            '填写订阅',
            ['粘贴订阅 URL', '按需填写 User Agent', '点击 Confirm'],
            '保存订阅',
            {
              src: V2RAYN_LINUX_SCREENSHOTS.subscriptionGroupSettings,
              alt: '在 v2rayN Linux 里填写订阅地址和 User Agent',
            },
          ),
          createStep(
            'connect',
            '更新订阅并确认节点真正加载出来',
            '回到主窗口后执行 Update subscriptions without proxy。刷新完成后，列表应像截图这样出现真实节点，而不是只得到一串 json 文件名。',
            '如果刷新后内容仍然不对，先回头检查 URL、User Agent 和订阅格式，再重试更新。',
            '节点列表',
            ['更新订阅', '等待节点加载', '确认列表内容正常'],
            '刷新订阅',
            {
              src: V2RAYN_LINUX_SCREENSHOTS.serverList,
              alt: 'v2rayN Linux 节点列表',
            },
          ),
          createStep(
            'connect',
            '选中节点，再启用 TUN 或系统代理',
            '节点加载正常后，在列表里选一个节点作为当前连接，再根据你的桌面环境启用底部的 TUN 或系统代理相关开关。',
            'Linux 上接管流量的方式会因桌面环境不同而略有差异；如果浏览器仍然直连，优先检查 TUN、系统代理和桌面网络设置。',
            '开始连接',
            ['选择节点', '启用 TUN 或系统代理', '回到浏览器测试'],
            '连接并测试',
            {
              src: V2RAYN_LINUX_SCREENSHOTS.serverList,
              alt: 'v2rayN Linux 选择节点后准备连接',
            },
          ),
        ]
      : [
          createStep(
            'launch',
            'Open subscription group settings first',
            'Use the top Subscription Group menu to open the subscription settings window. On Linux, this is still where URL imports begin.',
            'If the app is minimized to tray, bring the main window back before trying to open this page.',
            'Subscription settings',
            ['Open Subscription Group', 'Enter the settings window', 'Prepare the URL field'],
            'Open settings',
            {
              src: V2RAYN_LINUX_SCREENSHOTS.subscriptionGroupSettings,
              alt: 'v2rayN Linux subscription group settings window',
            },
          ),
          createStep(
            'import',
            'Paste the subscription URL and add User Agent when needed',
            'Paste the copied subscription link into URL (optional). If your provider changes the response by client, fill the User Agent field with V2ray or whatever value the provider expects, then confirm.',
            'This is the Linux-specific detail most people miss. Some providers will not return the correct node list without a matching User Agent.',
            'Fill subscription',
            ['Paste the subscription URL', 'Fill User Agent if needed', 'Click Confirm'],
            'Save subscription',
            {
              src: V2RAYN_LINUX_SCREENSHOTS.subscriptionGroupSettings,
              alt: 'Fill subscription URL and User Agent in v2rayN Linux',
            },
          ),
          createStep(
            'connect',
            'Refresh subscriptions and verify the node list',
            'Go back to the main window and run Update subscriptions without proxy. After refresh, the list should look like the screenshot with real nodes loaded, not just JSON filenames.',
            'If the result still looks wrong, re-check the URL, the User Agent, and the selected subscription format before retrying.',
            'Node list',
            ['Refresh subscriptions', 'Wait for nodes to load', 'Verify the list content'],
            'Refresh nodes',
            {
              src: V2RAYN_LINUX_SCREENSHOTS.serverList,
              alt: 'v2rayN Linux node list',
            },
          ),
          createStep(
            'connect',
            'Choose a node, then enable TUN or system proxy',
            'After the nodes are loaded correctly, select the node you want to use and then enable the bottom TUN or system-proxy related controls that fit your Linux desktop setup.',
            'Traffic takeover differs a bit across Linux desktops. If the browser is still direct, check TUN, system proxy, and desktop network settings first.',
            'Connect',
            ['Choose a node', 'Enable TUN or system proxy', 'Test in the browser'],
            'Connect and test',
            {
              src: V2RAYN_LINUX_SCREENSHOTS.serverList,
              alt: 'Select a node and prepare to connect in v2rayN Linux',
            },
          ),
        ],
  };
}

export function buildRealClashVergeGuide(platformLabel: string, isZh: boolean): ClientGuide {
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

export function buildRealV2RayNGGuide(isZh: boolean): ClientGuide {
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

export function buildRealShadowrocketGuide(isZh: boolean): ClientGuide {
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
            '在 Shadowrocket 首页点右上角加号，类型选 Subscribe，把当前页面复制的订阅链接填进 URL，并在备注里填写 PrismProxy。',
            '备注不要留空；Shadowrocket 不会自动采用服务端标题，留空时可能把订阅 ID 当成本地名称。',
            '新增订阅',
            ['点右上角加号', '类型选 Subscribe', '粘贴 URL', '备注填 PrismProxy 并保存'],
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
            'Tap the top-right plus button on the Shadowrocket home screen, choose Subscribe, paste the copied URL, and set Remark to PrismProxy.',
            'Do not leave Remark empty. Shadowrocket does not automatically adopt the server profile title and may use the subscription ID as the local name.',
            'Add subscription',
            [
              'Tap the top-right plus button',
              'Choose Subscribe',
              'Paste the URL',
              'Set Remark to PrismProxy and save',
            ],
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

export function buildRealFlClashGuide(platformLabel: string, isZh: boolean): ClientGuide {
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

export function buildRealFlClashMacGuide(isZh: boolean): ClientGuide {
  return {
    recommendedFormat: 'clash',
    note: isZh
      ? '这组步骤使用 macOS 平台上的 FlClash 真实界面截图，和当前平台的窗口样式一致。'
      : 'These steps use real FlClash screenshots from the macOS flow, so the window chrome and layout match the platform.',
    sourceLabel: isZh ? 'FlClash macOS 图文教程来源' : 'FlClash macOS tutorial source',
    sourceUrl: FLCLASH_MACOS_GUIDE_SOURCE_URL,
    steps: isZh
      ? [
          createStep(
            'launch',
            '先打开 FlClash 主界面',
            '确认客户端已经成功安装并能正常打开，后面的配置、节点选择和系统代理都会在这个界面完成。',
            '如果第一次启动仍然被系统拦截，先在 macOS 的隐私与安全性里放行。',
            '主界面',
            ['打开 FlClash', '确认仪表盘可见', '准备进入配置页面'],
            '打开客户端',
            {
              src: FLCLASH_MACOS_SCREENSHOTS.main,
              alt: 'FlClash macOS 主界面',
            },
          ),
          createStep(
            'import',
            '进入配置页，通过 URL 导入订阅',
            '切到配置页后点击右下角加号，选择 URL 导入，再把当前页面复制的 Clash 订阅地址粘贴进去。',
            '这里要用 Clash 格式的订阅，不要把 Universal 链接贴进来。',
            '配置导入',
            ['打开配置页', '点击加号', '选择 URL 并粘贴订阅'],
            '导入订阅',
            {
              src: FLCLASH_MACOS_SCREENSHOTS.config,
              alt: 'FlClash macOS 通过 URL 导入配置',
            },
          ),
          createStep(
            'connect',
            '先去代理页选一个节点',
            '订阅加载完成后，切到代理页确认节点和策略组已经出来，再选中你要用的节点。',
            '先把节点选好，再开系统代理，排错会简单很多。',
            '节点选择',
            ['打开代理页', '选择节点或策略组', '确认当前节点已切换'],
            '选择节点',
            {
              src: FLCLASH_MACOS_SCREENSHOTS.chooseProxy,
              alt: 'FlClash macOS 节点选择界面',
            },
          ),
          createStep(
            'connect',
            '最后开启系统代理并点击运行',
            '回到仪表盘后打开系统代理，再点击右下角运行按钮，让浏览器和系统流量真正经过 FlClash。',
            '只导入订阅不打开系统代理时，浏览器不会真正走代理。',
            '开始连接',
            ['打开系统代理', '点击运行按钮', '回到浏览器测试'],
            '开始连接',
            {
              src: FLCLASH_MACOS_SCREENSHOTS.startProxy,
              alt: 'FlClash macOS 开启系统代理与运行按钮',
            },
          ),
        ]
      : [
          createStep(
            'launch',
            'Open the FlClash main screen first',
            'Make sure the app is installed correctly and opens to the dashboard before importing anything.',
            'If macOS still blocks the app on first launch, allow it in Privacy & Security first.',
            'Main screen',
            ['Open FlClash', 'Confirm the dashboard is visible', 'Prepare to enter Config'],
            'Open client',
            {
              src: FLCLASH_MACOS_SCREENSHOTS.main,
              alt: 'FlClash macOS main screen',
            },
          ),
          createStep(
            'import',
            'Go to Config and import by URL',
            'Open the config page, click the plus button, choose URL import, and paste the Clash subscription link from this page.',
            'Use the Clash-formatted link here, not the Universal link.',
            'Config import',
            ['Open Config', 'Click +', 'Choose URL and paste the subscription'],
            'Import subscription',
            {
              src: FLCLASH_MACOS_SCREENSHOTS.config,
              alt: 'FlClash macOS URL import flow',
            },
          ),
          createStep(
            'connect',
            'Choose a node on the Proxy page',
            'After the subscription loads, switch to Proxy and select the node or policy group you want to use.',
            'Selecting the node before enabling system proxy makes troubleshooting much easier.',
            'Node selection',
            ['Open Proxy', 'Choose a node or group', 'Confirm the active node changed'],
            'Select node',
            {
              src: FLCLASH_MACOS_SCREENSHOTS.chooseProxy,
              alt: 'FlClash macOS node selection',
            },
          ),
          createStep(
            'connect',
            'Enable system proxy and click Run last',
            'Return to the dashboard, enable System Proxy, then click the Run button so browser and system traffic actually go through FlClash.',
            'Importing the subscription alone does not route traffic until proxy mode is enabled.',
            'Connect',
            ['Enable System Proxy', 'Click Run', 'Test again in the browser'],
            'Connect',
            {
              src: FLCLASH_MACOS_SCREENSHOTS.startProxy,
              alt: 'Enable system proxy and run FlClash on macOS',
            },
          ),
        ],
  };
}

export function buildRealFlClashAndroidGuide(isZh: boolean): ClientGuide {
  return {
    recommendedFormat: 'clash',
    note: isZh
      ? '这组步骤使用 FlClash Android 教程里的真实真机截图，导入入口、节点选择和启动代理都和应用界面一致。'
      : 'These steps use real FlClash Android screenshots, so the import entry, node selection, and connect flow match the app.',
    sourceLabel: isZh ? 'FlClash Android 图文教程来源' : 'FlClash Android tutorial source',
    sourceUrl: FLCLASH_ANDROID_GUIDE_SOURCE_URL,
    steps: isZh
      ? [
          createStep(
            'launch',
            '先进入配置页，再点右下角加号',
            '打开 FlClash 后先切到配置页，右下角加号就是新建或导入订阅的入口。',
            '如果第一次启动先弹核心初始化或权限提示，先完成它们再继续导入。',
            '配置入口',
            ['打开配置页', '确认右下角加号可见', '准备新建订阅'],
            '打开配置入口',
            {
              src: FLCLASH_ANDROID_SCREENSHOTS.import,
              alt: 'FlClash Android 配置页和添加入口',
            },
          ),
          createStep(
            'import',
            '选择 URL 导入，并粘贴 Clash 订阅链接',
            '点加号后选择 URL，把当前页面复制的 Clash 订阅地址粘贴进去再提交。',
            '这里要用 Clash 格式，不要把 Universal 链接直接贴到 FlClash 里。',
            'URL 导入',
            ['点击 URL', '粘贴 Clash 链接', '提交导入'],
            '导入订阅',
            {
              src: FLCLASH_ANDROID_SCREENSHOTS.import,
              alt: 'FlClash Android 通过 URL 导入订阅',
            },
          ),
          createStep(
            'connect',
            '确认导入成功后，去代理页选节点',
            '订阅导入完成后先确认配置已经出现，再切到代理页选择要用的节点或策略组。',
            '先把节点选好，再启动代理，排错会更直接。',
            '节点选择',
            ['确认配置已出现', '切到代理页', '选择节点或策略组'],
            '选择节点',
            {
              src: FLCLASH_ANDROID_SCREENSHOTS.connect,
              alt: 'FlClash Android 配置已导入并进入代理页',
            },
          ),
          createStep(
            'connect',
            '最后回到仪表盘启动代理',
            '节点选好后回到仪表盘，点击右下角启动按钮；如果 Android 弹出 VPN 权限，也要一并放行。',
            '只导入订阅不启动代理时，浏览器和系统流量不会真正走 FlClash。',
            '开始连接',
            ['回到仪表盘', '点击启动按钮', '允许 VPN 并回浏览器测试'],
            '启动代理',
            {
              src: FLCLASH_ANDROID_SCREENSHOTS.connect,
              alt: 'FlClash Android 启动代理并连接',
            },
          ),
        ]
      : [
          createStep(
            'launch',
            'Open Config first, then tap the plus button',
            'After FlClash opens, switch to Config. The floating plus button is the entry for creating or importing a subscription.',
            'If first launch still asks for core initialization or permissions, finish that before importing.',
            'Config entry',
            ['Open Config', 'Confirm the plus button is visible', 'Prepare to add a profile'],
            'Open config entry',
            {
              src: FLCLASH_ANDROID_SCREENSHOTS.import,
              alt: 'FlClash Android config page and add entry',
            },
          ),
          createStep(
            'import',
            'Choose URL import and paste the Clash subscription link',
            'Tap the plus button, choose URL, then paste the Clash-formatted subscription link from this page.',
            'Use the Clash link here instead of the Universal link.',
            'URL import',
            ['Tap URL', 'Paste the Clash link', 'Submit import'],
            'Import subscription',
            {
              src: FLCLASH_ANDROID_SCREENSHOTS.import,
              alt: 'FlClash Android URL import flow',
            },
          ),
          createStep(
            'connect',
            'Confirm the profile loaded, then choose a node on Proxy',
            'After import finishes, make sure the profile appears, then switch to Proxy and select the node or policy group you want.',
            'Choosing the node before starting the proxy makes troubleshooting much easier.',
            'Node selection',
            ['Confirm the profile is visible', 'Open Proxy', 'Choose a node or group'],
            'Select node',
            {
              src: FLCLASH_ANDROID_SCREENSHOTS.connect,
              alt: 'FlClash Android imported profile and proxy page',
            },
          ),
          createStep(
            'connect',
            'Return to Dashboard and start the proxy last',
            'Once the node is selected, go back to Dashboard and tap the start button. If Android shows a VPN permission prompt, allow it.',
            'Importing the subscription alone does not route traffic until the proxy is actually started.',
            'Connect',
            ['Return to Dashboard', 'Tap the start button', 'Allow VPN and test again'],
            'Start proxy',
            {
              src: FLCLASH_ANDROID_SCREENSHOTS.connect,
              alt: 'Start the proxy in FlClash on Android',
            },
          ),
        ],
  };
}

export function buildRealSparkleWindowsGuide(isZh: boolean): ClientGuide {
  return {
    recommendedFormat: 'clash',
    note: isZh
      ? '这组截图来自 Sparkle 官方仓库 issue 里的真实 Windows 界面。不同版本的按钮顺序可能略有变化，但“订阅管理 -> 导入 -> 远程配置 -> 开启系统代理”的路径是一致的。'
      : 'These screenshots come from real Sparkle Windows builds posted in the official repository issues. Button order may shift by version, but the flow stays the same: subscription management, import, remote config, then system proxy.',
    sourceLabel: isZh ? 'Sparkle 官方 issue 截图来源' : 'Sparkle official issue screenshot source',
    sourceUrl: SPARKLE_OFFICIAL_ISSUES_SOURCE_URL,
    steps: isZh
      ? [
          createStep(
            'launch',
            '先打开订阅管理',
            '启动 Sparkle 后，先进入订阅管理页，确认左侧规则区和顶部导入入口都正常显示。',
            '如果第一次启动先弹权限、证书或内核提示，先处理完再导入订阅。',
            '订阅管理',
            ['左侧规则页', '订阅卡片', '顶部导入按钮'],
            '打开订阅页',
            {
              src: SPARKLE_WINDOWS_SCREENSHOTS.subscriptionManagement,
              alt: 'Sparkle Windows 订阅管理界面',
            },
          ),
          createStep(
            'import',
            '点导入，选择远程配置',
            '在订阅管理右上角点击“导入”，再选择“导入远程配置”。',
            '如果你看到加号按钮，也是在同一区域新建配置，不需要切到别的页面。',
            '导入菜单',
            ['导入', '导入远程配置', '新增配置'],
            '打开远程导入',
            {
              src: SPARKLE_WINDOWS_SCREENSHOTS.importMenu,
              alt: 'Sparkle Windows 导入远程配置菜单',
            },
          ),
          createStep(
            'import',
            '粘贴当前页面的 Clash 链接并导入',
            '把本页生成的 Clash 订阅链接粘贴到远程配置 URL 输入框里，保存后再手动刷新一次订阅。',
            'Sparkle 走的是 Mihomo / Clash 配置，别切成 Sing-box 或 V2Ray 格式。',
            '远程配置 URL',
            ['Clash 格式', '粘贴 URL', 'Import / Refresh'],
            '导入并刷新',
            {
              src: SPARKLE_WINDOWS_SCREENSHOTS.remoteConfigUrl,
              alt: 'Sparkle Windows 远程配置 URL 输入框',
            },
          ),
          createStep(
            'connect',
            '回到主界面并开启系统代理',
            '订阅刷新完成后，回到规则主页，先打开 System Proxy；如果你更习惯全局接管，再决定要不要同时开虚拟网卡。',
            '第一次测试先跑通系统代理就够了，确认节点和策略组正常后再研究其他模式。',
            '系统代理',
            ['回到规则页', '开启 System Proxy', '重新打开网页测试'],
            '开始连接',
            {
              src: SPARKLE_WINDOWS_SCREENSHOTS.systemProxy,
              alt: 'Sparkle Windows 系统代理开关',
            },
          ),
        ]
      : [
          createStep(
            'launch',
            'Open subscription management first',
            'Launch Sparkle, then open the subscription management page and confirm the rule area plus the top import entry are visible.',
            'If first-run prompts show up for permissions, certificates, or the core, clear those before importing.',
            'Subscription management',
            ['Rule area', 'Subscription card', 'Top import button'],
            'Open subscriptions',
            {
              src: SPARKLE_WINDOWS_SCREENSHOTS.subscriptionManagement,
              alt: 'Sparkle Windows subscription management',
            },
          ),
          createStep(
            'import',
            'Open Import and choose remote config',
            'Use the Import button in the top-right corner, then choose the remote-config entry.',
            'If your build shows a plus button as well, it still creates the profile from the same area.',
            'Import menu',
            ['Import', 'Remote config', 'New profile'],
            'Open remote import',
            {
              src: SPARKLE_WINDOWS_SCREENSHOTS.importMenu,
              alt: 'Sparkle Windows remote import menu',
            },
          ),
          createStep(
            'import',
            'Paste the Clash link from this page and import',
            'Paste the Clash subscription link from this page into the remote-config URL field, then import and refresh the subscription once.',
            'Sparkle expects a Mihomo / Clash profile here, so do not switch this page to Sing-box or V2Ray for this step.',
            'Remote config URL',
            ['Clash format', 'Paste URL', 'Import / Refresh'],
            'Import and refresh',
            {
              src: SPARKLE_WINDOWS_SCREENSHOTS.remoteConfigUrl,
              alt: 'Sparkle Windows remote config URL field',
            },
          ),
          createStep(
            'connect',
            'Return home and enable system proxy',
            'After the subscription refreshes, go back to the rule view and enable System Proxy. Turn on the virtual NIC only if you actually need full-device capture.',
            'For the first test, system proxy is the cleanest path. Confirm the node or group works before enabling more advanced modes.',
            'System proxy',
            ['Return to rules', 'Enable System Proxy', 'Reload a page and test'],
            'Connect',
            {
              src: SPARKLE_WINDOWS_SCREENSHOTS.systemProxy,
              alt: 'Sparkle Windows system proxy toggle',
            },
          ),
        ],
  };
}

export function buildTextOnlySparkleGuide(platformLabel: string, isZh: boolean): ClientGuide {
  return {
    recommendedFormat: 'clash',
    note: isZh
      ? `Sparkle 官方公开来源里暂时没有对齐 ${platformLabel} 的完整导入截图。为了避免继续混用 Windows 或其他客户端的界面，这里先只保留文字步骤。`
      : `Sparkle does not currently have a complete public import screenshot set for ${platformLabel}. To avoid mixing in Windows or third-party client UI, this guide intentionally stays text-only for now.`,
    steps: isZh
      ? [
          createStep(
            'launch',
            '先进入订阅或配置入口',
            '打开 Sparkle 后，先去订阅、配置或 Profiles 区域，确认能看到导入入口。',
            '不同版本的侧栏命名可能略有差异，但远程订阅入口通常都在这里。',
            '订阅入口',
            ['订阅', '配置', 'Profiles'],
            '打开导入入口',
          ),
          createStep(
            'import',
            '选择远程配置并保持 Clash 格式',
            '回到本页后保持 Clash 格式，再在 Sparkle 里选择按 URL 导入远程配置。',
            '如果导入后看不到策略组，优先检查是不是用了别的格式。',
            '远程导入',
            ['Clash 格式', '远程配置', '粘贴 URL'],
            '导入 Clash 配置',
          ),
          createStep(
            'connect',
            '刷新订阅后选择策略组',
            '导入成功后先手动刷新一次订阅，再确认当前规则组或节点已经切到可用选项。',
            '只导入不切换活动组时，流量通常不会按预期走代理。',
            '策略组',
            ['刷新订阅', '选择节点', '确认活动组'],
            '确认节点',
          ),
          createStep(
            'connect',
            '最后开启系统代理',
            '确认订阅已经拉取成功后，再打开 System Proxy；需要全局接管时再考虑虚拟网卡或 TUN。',
            '第一次接入先跑通系统代理最稳，后面再按需求补其他模式。',
            '连接开关',
            ['System Proxy', '虚拟网卡 / TUN', '重新测试网络'],
            '开始连接',
          ),
        ]
      : [
          createStep(
            'launch',
            'Open the subscription or profile area first',
            'After Sparkle launches, go to the subscriptions, configs, or Profiles area and confirm the import entry is available.',
            'The exact sidebar label may vary, but the remote-subscription entry normally stays there.',
            'Subscription entry',
            ['Subscriptions', 'Configs', 'Profiles'],
            'Open import entry',
          ),
          createStep(
            'import',
            'Choose remote config and keep this page on Clash',
            'Keep this portal page on the Clash format, then use Sparkle to import a remote config by URL.',
            'If policy groups do not appear after import, the first thing to check is whether the wrong format was used.',
            'Remote import',
            ['Clash format', 'Remote config', 'Paste URL'],
            'Import Clash profile',
          ),
          createStep(
            'connect',
            'Refresh the subscription and choose a group',
            'Once the import succeeds, refresh the subscription manually and confirm the active node or policy group is usable.',
            'Importing alone is not enough if no active group is selected afterwards.',
            'Policy group',
            ['Refresh subscription', 'Choose node', 'Confirm active group'],
            'Confirm node',
          ),
          createStep(
            'connect',
            'Enable system proxy last',
            'After the subscription is confirmed, enable System Proxy. Turn on the virtual NIC or TUN only if you actually need fuller traffic capture.',
            'For the first test, system proxy is the safest path. Add other modes later if needed.',
            'Connection toggle',
            ['System Proxy', 'Virtual NIC / TUN', 'Retest network'],
            'Connect',
          ),
        ],
  };
}

export function buildRealSurgeGuide(isZh: boolean): ClientGuide {
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

export function buildRealSingBoxAppleGuide(platform: 'ios' | 'macos', isZh: boolean): ClientGuide {
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

export function buildRealSingBoxAndroidGuide(isZh: boolean): ClientGuide {
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

export function buildRealClashBoxGuide(isZh: boolean): ClientGuide {
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

export function buildRealClashMetaGuide(isZh: boolean): ClientGuide {
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

export function decorateGuideWithRealScreenshots(
  guide: ClientGuide,
  clientId: ClientId,
  platform: GuidePlatform,
  isZh: boolean,
): ClientGuide {
  if (clientId === 'flClash' && platform === 'macos') {
    return buildRealFlClashMacGuide(isZh);
  }

  if (clientId === 'flClash' && platform === 'android') {
    return buildRealFlClashAndroidGuide(isZh);
  }

  if (clientId === 'flClash' && ['windows', 'linux'].includes(platform)) {
    return buildRealFlClashGuide(getPlatformLabel(platform, isZh), isZh);
  }

  if (clientId === 'v2rayN' && platform === 'windows') {
    return buildRealV2RayNGuide(isZh);
  }

  if (clientId === 'v2rayN' && platform === 'linux') {
    return buildRealV2RayNLinuxGuide(isZh);
  }

  if (clientId === 'clashVerge' && (platform === 'windows' || platform === 'macos')) {
    return buildRealClashVergeGuide(getPlatformLabel(platform, isZh), isZh);
  }

  if (clientId === 'sparkle' && platform === 'windows') {
    return buildRealSparkleWindowsGuide(isZh);
  }

  if (clientId === 'sparkle' && (platform === 'macos' || platform === 'linux')) {
    return buildTextOnlySparkleGuide(getPlatformLabel(platform, isZh), isZh);
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

  return guide;
}
