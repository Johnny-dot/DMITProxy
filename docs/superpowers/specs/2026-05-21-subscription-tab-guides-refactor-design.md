# SubscriptionTabGuides 重构设计

- 日期: 2026-05-21
- 目标文件: [src/pages/portal/SubscriptionTabGuides.ts](../../../src/pages/portal/SubscriptionTabGuides.ts) (2765 行)
- 消费方: [src/pages/portal/SubscriptionTab.tsx:37](../../../src/pages/portal/SubscriptionTab.tsx)(唯一调用方)
- 输出范围: 两个 PR(PR1 删 dead code,PR2 数据驱动 + i18n)

## 背景

`SubscriptionTabGuides.ts` 当前承担两层职责:

1. **`buildClientGuide(clientId, platform, ...)`** — 通用引导生成,11 个客户端的"无截图版本",通过 `if/else if` 分支分发,文案以 `isZh ? '...' : '...'` 形式硬编码在代码中。
2. **15 个 `buildReal*Guide(...)` 函数** — 真实截图版引导,每步附 UI 截图和高亮框,内容更详尽,针对特定 `(clientId × platform)` 组合。
3. **`decorateGuideWithRealScreenshots(...)`** — 调度器,从通用结果"升级"到真实截图版本(若存在),否则原样返回。

调用方式固定为:`decorateGuideWithRealScreenshots(buildClientGuide(...))`。

## 关键发现:大部分 generic 是不可达代码

将 [SubscriptionTabData.ts](../../../src/pages/portal/SubscriptionTabData.ts) 的 `CLIENT_META.platforms`(声明支持的平台)与 `decorateGuideWithRealScreenshots` 实际拦截的 `(clientId, platform)` 组合做差集后,只有 3 个组合会真正显示 generic 引导:

| 组合                 | 原因                                                            |
| -------------------- | --------------------------------------------------------------- |
| `clashVerge × linux` | CLIENT_META 声明支持 linux,但 real 版本仅覆盖 windows/macos     |
| `singBox × linux`    | CLIENT_META 声明支持 linux,但 real 版本仅覆盖 android/ios/macos |
| `exclave × android`  | exclave 完全没做 real 版本                                      |

其余约 450 行的 generic 分支(flClash / clashMeta / sparkle / clashBox / surge / shadowrocket / v2rayN / v2rayNG)永远被 real 版本覆盖,**属于 dead code**。

## 目标

1. 删除不可达的 generic 分支,降低文件体积和阅读成本。
2. 把剩下的 18 个引导(15 real + 3 generic fallback)从命令式构造改为**声明式数据 + 通用 builder**。
3. 把双语文案从代码迁出,接入现有 `src/i18n/locales/` 的命名空间体系。
4. 顺手补齐当前 generic 分支中缺失的中文翻译(flClash/clashMeta/sparkle/clashBox 当前全英文)。

## 非目标(明确不做)

- 不改 [SubscriptionTabData.ts](../../../src/pages/portal/SubscriptionTabData.ts):`CLIENT_META`、截图常量、URL 常量保持原位
- 不改 [SubscriptionTab.tsx](../../../src/pages/portal/SubscriptionTab.tsx) 调用方
- 不改步骤呈现 UI([SubscriptionTabCards.tsx](../../../src/pages/portal/SubscriptionTabCards.tsx) 不动)
- 不补缺失的引导内容(如 clashVerge × linux 不顺手做 real 版)
- 不动"一键导入"逻辑(`oneClickImportUrl`)
- bundle 体积分析、测试覆盖率提升属于另外的项

## 交付物划分

### PR1: 删除不可达 generic 分支

**改动:**

- 修改 [SubscriptionTabGuides.ts](../../../src/pages/portal/SubscriptionTabGuides.ts) 中 `buildClientGuide`:删除以下不可达分支
  - flClash / clashMeta / sparkle / clashBox(合并块,行 48-98)
  - v2rayN(后续单独分支)
  - v2rayNG
  - surge
  - shadowrocket
- 保留分支:`clashVerge`、`singBox`、`exclave`(linux/android fallback 仍可达)
- 替换文件末尾的隐含 fallback:若走到末尾说明是 unsupported 组合(理论上 UI 不会触发,因为 `PLATFORM_CLIENT_ORDER` 限制了组合),显式返回一个 `MINIMAL_FALLBACK_GUIDE`(`recommendedFormat: 'clash'`、空 `steps: []`、`note` 提示"暂无此平台引导,请切换平台或客户端"),避免 TS 把返回值推断为可能 `undefined`,也方便调试

**验证:**

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- 手动 smoke:Portal 切换 (client × platform) 各组合(尤其 clashVerge × linux、singBox × linux、exclave × android),确认引导仍正常显示

**预期收益:** 文件约从 2765 行减至约 2300 行,纯删除、零逻辑变化、风险低。

### PR2: 数据驱动 + i18n 重构

**新增目录结构:**

```
src/pages/portal/guides/
  index.ts          # 对外保持原有签名: buildClientGuide / decorateGuideWithRealScreenshots
  builder.ts        # 通用 build 函数(~80 行)
  registry.ts       # 11 个客户端的 ClientGuideDef 注册表
  types.ts          # 数据类型
  data/
    flClash.ts      # windows/macos/linux/android
    v2rayN.ts       # windows/linux
    clashVerge.ts   # windows/macos + linux(generic fallback)
    sparkle.ts      # windows/macos/linux
    v2rayNG.ts      # android
    clashMeta.ts    # android
    singBox.ts      # android/ios/macos + linux(generic fallback)
    shadowrocket.ts # ios/macos
    surge.ts        # ios
    clashBox.ts     # harmonyos
    exclave.ts      # android(generic)
```

**类型 schema:**

```ts
// guides/types.ts
import type { SubscriptionFormat } from '../types';
import type { GuidePlatform, GuideTone, GuideScreenshotHighlight } from '../SubscriptionTabData';

export interface StepDef {
  tone: GuideTone;
  titleKey: string;
  descriptionKey: string;
  helperKey: string;
  visualLabel: string; // 保留为原文,不进 i18n
  visualItems: string[]; // 同上,UI 上的真实按钮/选项名
  ctaLabelKey: string;
  screenshot?: { src: string; altKey: string };
  screenshotHighlights?: GuideScreenshotHighlight[];
}

export interface PlatformGuideDef {
  recommendedFormat: SubscriptionFormat;
  noteKey: string;
  steps: StepDef[];
  sourceLabel?: string;
  sourceUrl?: string;
}

export interface ClientGuideDef {
  byPlatform: Partial<Record<GuidePlatform, PlatformGuideDef>>;
}
```

**关键决策说明:**

- `visualLabel` / `visualItems`(UI 按钮、菜单项名称)**保留原文**,不接 i18n。因为这些是软件 UI 上的真实文字,翻译反而误导用户。
- `screenshot.src` 继续引用现有 [SubscriptionTabData.ts](../../../src/pages/portal/SubscriptionTabData.ts) 中的截图常量,不重新设计。
- 不引入 `default + override` 模板机制,每个 platform 平铺一份 — 因为各 platform 引导差异大,模板化无收益。

**i18n key 规则:**

新增 `guides` 命名空间到 [src/i18n/locales/zh-CN.ts](../../../src/i18n/locales/zh-CN.ts) 和 [src/i18n/locales/en-US.ts](../../../src/i18n/locales/en-US.ts):

```ts
guides: {
  flClash: {
    macos: {
      note: '...',
      launch: { title: '...', description: '...', helper: '...', ctaLabel: '...' },
      import: { title: '...', description: '...', helper: '...', ctaLabel: '...' },
      connect: { title: '...', description: '...', helper: '...', ctaLabel: '...' },
      screenshots: {
        launch: { alt: '...' },
        // ...
      },
    },
    windows: { ... },
    linux: { ... },
    android: { ... },
  },
  // 其余 10 个客户端
}
```

locale 文件结构与数据结构形状一致(`client → platform → step`),漏翻译能一眼看出。预计 `zh-CN.ts` / `en-US.ts` 各增加约 600 行,但结构化排列比当前散落 ad-hoc 字符串更好维护。

**辅助函数 `resolveKey`:**

i18n locale 是嵌套对象(`guides.flClash.macos.launch.title`),`resolveKey(t, 'guides.flClash.macos.launch.title')` 按点拆分递归取值:

- 命中:返回字符串
- 未命中:**开发模式 throw**(在 builder.test.ts 里能立刻发现);**生产模式 fallback** 到 key 字符串本身(避免白屏)
- 该函数与现有 `I18nContext` 的取值机制独立,因为 builder 是 pure function 没有 React 上下文。如果 [I18nContext.tsx](../../../src/context/I18nContext.tsx) 已经提供等价 helper,直接复用;否则在 `guides/builder.ts` 里实现 ~10 行的版本

**builder 实现要点:**

```ts
// guides/builder.ts
export function buildClientGuide(
  clientId: ClientId,
  platform: GuidePlatform,
  platformLabel: string,
  isZh: boolean,
): ClientGuide {
  const def = REGISTRY[clientId]?.byPlatform[platform];
  if (!def) {
    return MINIMAL_FALLBACK_GUIDE;
  }
  const t = isZh ? zhCN.guides : enUS.guides;
  return {
    recommendedFormat: def.recommendedFormat,
    note: resolveKey(t, def.noteKey),
    steps: def.steps.map((step) => ({
      tone: step.tone,
      title: resolveKey(t, step.titleKey),
      description: resolveKey(t, step.descriptionKey),
      helper: resolveKey(t, step.helperKey),
      visualLabel: step.visualLabel,
      visualItems: step.visualItems,
      ctaLabel: resolveKey(t, step.ctaLabelKey),
      screenshot: step.screenshot
        ? { src: step.screenshot.src, alt: resolveKey(t, step.screenshot.altKey) }
        : undefined,
    })),
    sourceLabel: def.sourceLabel,
    sourceUrl: def.sourceUrl,
  };
}
```

`decorateGuideWithRealScreenshots` 在数据驱动模型下变成 no-op(因为 builder 已经直接返回 client × platform 对应的 def,没有"先 generic 再 decorate"两步),但**保留导出做兼容**(直接返回入参),避免改 [SubscriptionTab.tsx:199](../../../src/pages/portal/SubscriptionTab.tsx)。后续 PR 再清理调用方,移除 shim。

**等价性测试(关键安全网):**

加 `src/pages/portal/guides/builder.test.ts`,内容:

```ts
// 遍历所有 11 clients × 6 platforms,对比旧实现和新实现输出的 ClientGuide 结构一致(深度相等)
for (const clientId of ALL_CLIENT_IDS) {
  for (const platform of ALL_PLATFORMS) {
    for (const isZh of [true, false]) {
      it(`${clientId} × ${platform} × ${isZh ? 'zh' : 'en'}`, () => {
        const old = OLD.buildClientGuide(clientId, platform, label, isZh);
        const oldFinal = OLD.decorateGuideWithRealScreenshots(old, clientId, platform, isZh);
        const newGuide = NEW.buildClientGuide(clientId, platform, label, isZh);
        expect(newGuide).toEqual(oldFinal);
      });
    }
  }
}
```

测试通过后保留为 regression test 跑一段时间;旧 [SubscriptionTabGuides.ts](../../../src/pages/portal/SubscriptionTabGuides.ts) 在 PR2 中转为 re-export shim(`export { buildClientGuide, decorateGuideWithRealScreenshots } from './guides'`),下一个 PR 再删除文件本身。

**验证:**

- `npm run ci:verify`(test + lint + typecheck + build)
- 新的 builder.test.ts 全部通过(等价性证明)
- 手动 smoke 同 PR1

## 中文文案补齐范围

PR1 删除以下分支后,这些客户端的 generic 中文缺失问题自动消除(代码被删了):

- flClash, clashMeta, sparkle, clashBox(英文 generic 分支属 dead code,删除即修复)

PR2 迁移时,所有保留的 18 个 guide(15 real + 3 generic fallback)在新 locale 中必须**同时有 zh 和 en**。具体审查清单:

- `clashVerge × linux`(generic fallback,目前有中文 ✓)
- `singBox × linux`(generic fallback,需检查)
- `exclave × android`(generic fallback,需检查)
- 其他 15 个 real 引导:都在双语 if/else 块中,迁移时直接复用现有翻译

## 风险与缓解

| 风险                                              | 缓解                                                                                |
| ------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 数据迁移出错导致某个 (client × platform) 显示异常 | 等价性测试(深度相等对比 18 × 2 语言 = 36 个 case)                                   |
| i18n key 拼写错或漏定义                           | builder 收到 undefined 时显式 throw(开发阶段)/ fallback 到 key 字符串(production)   |
| locale 文件变大影响 bundle                        | 后续 #4 bundle 分析时一并评估;若需拆分可按 lazy import 引 locale,但当前 scope 不做  |
| PR2 范围大、review 困难                           | PR2 自身可拆为多个 commit:先建目录骨架 + 测试框架 → 逐客户端迁移 → 切换 entry point |

## 任务清单(执行阶段输入)

**PR1:**

1. 列出所有不可达分支(精确行号)
2. 删除分支,补占位 fallback
3. 跑 ci:verify + 手工 smoke
4. 开 PR

**PR2:**

1. 创建 `src/pages/portal/guides/` 目录骨架(types / builder / registry)
2. 写等价性测试(覆盖所有 client × platform × lang)
3. 逐客户端建 data 文件 + 补 i18n key(11 个客户端,可一个个加同时跑测试)
4. 旧文件改为 re-export shim
5. 跑 ci:verify + 手工 smoke
6. 开 PR
