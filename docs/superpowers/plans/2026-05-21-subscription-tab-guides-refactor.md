# SubscriptionTabGuides 重构 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 [src/pages/portal/SubscriptionTabGuides.ts](../../../src/pages/portal/SubscriptionTabGuides.ts)(2765 行)删除 dead code 并迁移为数据驱动 + i18n 结构,在不改 UI、不改调用方的前提下大幅降低维护成本。

**Architecture:** 分两个 PR。PR1 纯删除 8 个不可达的 generic 分支(~450 行)并加占位 fallback,引入 vitest 快照锁定行为。PR2 在 `src/pages/portal/guides/` 下建立数据 + builder + i18n 架构,旧文件改为 re-export shim,所有公共导出签名保持不变。

**Tech Stack:** TypeScript / React 19 / Vitest / 现有 `I18nContext`(zh-CN / en-US locale)/ better-sqlite3 后端不涉及。

**Spec:** [docs/superpowers/specs/2026-05-21-subscription-tab-guides-refactor-design.md](../specs/2026-05-21-subscription-tab-guides-refactor-design.md)

---

# PR1: 删除不可达 generic 分支

**目标:** 通过快照测试锁定 3 个 reachable 组合的输出,然后删除 8 个 unreachable 分支,最后用 `MINIMAL_FALLBACK_GUIDE` 替换末尾的 unreachable 兜底 return。

**预计变更:** [SubscriptionTabGuides.ts](../../../src/pages/portal/SubscriptionTabGuides.ts) 从 2765 行减至约 2300 行。零逻辑变化。

## Task 1.1: 加快照测试,锁定 3 个 reachable generic 输出

**Files:**

- Create: `src/pages/portal/SubscriptionTabGuides.reachable.test.ts`

- [ ] **Step 1: 创建测试文件**

```ts
import { describe, expect, it } from 'vitest';
import { buildClientGuide, decorateGuideWithRealScreenshots } from './SubscriptionTabGuides';
import { getPlatformLabel } from './SubscriptionTabData';

const REACHABLE_GENERIC_CASES: Array<{
  clientId: 'clashVerge' | 'singBox' | 'exclave';
  platform: 'linux' | 'android';
}> = [
  { clientId: 'clashVerge', platform: 'linux' },
  { clientId: 'singBox', platform: 'linux' },
  { clientId: 'exclave', platform: 'android' },
];

describe('reachable generic guides (regression snapshot)', () => {
  for (const { clientId, platform } of REACHABLE_GENERIC_CASES) {
    for (const isZh of [true, false]) {
      it(`${clientId} × ${platform} × ${isZh ? 'zh' : 'en'} stays stable`, () => {
        const label = getPlatformLabel(platform, isZh);
        const generic = buildClientGuide(clientId, platform, label, isZh);
        const final = decorateGuideWithRealScreenshots(generic, clientId, platform, isZh);
        expect(final).toMatchSnapshot();
      });
    }
  }
});
```

- [ ] **Step 2: 第一次跑,生成快照**

Run: `npm test -- SubscriptionTabGuides.reachable`
Expected: PASS,生成 `src/pages/portal/__snapshots__/SubscriptionTabGuides.reachable.test.ts.snap`(6 个快照)

- [ ] **Step 3: 确认快照内容是中英双语都有步骤、note 非空**

Run: `cat src/pages/portal/__snapshots__/SubscriptionTabGuides.reachable.test.ts.snap | head -50`
Expected: 看到 `recommendedFormat`、`note`、`steps` 数组,非空

- [ ] **Step 4: Commit 快照(作为锁定基线)**

```bash
git add src/pages/portal/SubscriptionTabGuides.reachable.test.ts src/pages/portal/__snapshots__/
git commit -m "test: snapshot reachable generic subscription guides as deletion baseline"
```

## Task 1.2: 定义 MINIMAL_FALLBACK_GUIDE

**Files:**

- Modify: `src/pages/portal/SubscriptionTabGuides.ts:38-42`(buildClientGuide 函数开头)

- [ ] **Step 1: 在 buildClientGuide 之前加常量**

把以下代码插入到 [SubscriptionTabGuides.ts:37](../../../src/pages/portal/SubscriptionTabGuides.ts#L37) 与 `export function buildClientGuide(...)` 之间:

```ts
const MINIMAL_FALLBACK_GUIDE: ClientGuide = {
  recommendedFormat: 'universal',
  note: '',
  steps: [],
};
```

注意:`note: ''` 是占位 — 这个 guide 理论上 UI 不会显示(因为 `PLATFORM_CLIENT_ORDER` 限制了合法 client × platform 组合)。如果走到这里说明数据契约出问题。

- [ ] **Step 2: 验证 typecheck**

Run: `npm run typecheck`
Expected: PASS

## Task 1.3: 删除 dead branches(8 个)

每个分支单独 commit,便于 review 和 git bisect。

### Task 1.3.a: 删除 `flClash || clashMeta || sparkle || clashBox` 合并块

**Files:**

- Modify: `src/pages/portal/SubscriptionTabGuides.ts:48-98`

- [ ] **Step 1: 删除行 48-98 的整个 if 块**

定位:`if (clientId === 'flClash' || clientId === 'clashMeta' || clientId === 'sparkle' || clientId === 'clashBox') { ... return { ... } }`,包括前后空行收紧。

- [ ] **Step 2: 跑快照测试**

Run: `npm test -- SubscriptionTabGuides.reachable`
Expected: PASS(快照不变 — 这些 clientId 都被 decorate 替换,改 generic 不影响输出)

- [ ] **Step 3: Commit**

```bash
git add src/pages/portal/SubscriptionTabGuides.ts
git commit -m "refactor: remove unreachable flClash/clashMeta/sparkle/clashBox generic branch"
```

### Task 1.3.b: 删除 `surge` 分支

**Files:**

- Modify: `src/pages/portal/SubscriptionTabGuides.ts`(原行 213-279,删完前一个 task 后行号会变)

- [ ] **Step 1: 找到并删除 `if (clientId === 'surge') { ... }` 整块**

Run 定位: `grep -n "if (clientId === 'surge')" src/pages/portal/SubscriptionTabGuides.ts`

- [ ] **Step 2: 跑快照测试**

Run: `npm test -- SubscriptionTabGuides.reachable`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/pages/portal/SubscriptionTabGuides.ts
git commit -m "refactor: remove unreachable surge generic branch"
```

### Task 1.3.c: 删除 `shadowrocket` 分支

- [ ] **Step 1: 找到并删除 `if (clientId === 'shadowrocket') { ... }` 整块**
- [ ] **Step 2: 跑快照测试**(同上,PASS)
- [ ] **Step 3: Commit**

```bash
git commit -m "refactor: remove unreachable shadowrocket generic branch"
```

### Task 1.3.d: 删除 `v2rayNG` 分支

- [ ] **Step 1: 删除 `if (clientId === 'v2rayNG') { ... }`**
- [ ] **Step 2: 跑快照测试,PASS**
- [ ] **Step 3: Commit**

```bash
git commit -m "refactor: remove unreachable v2rayNG generic branch"
```

### Task 1.3.e: 删除 `v2rayN` 分支

- [ ] **Step 1: 删除 `if (clientId === 'v2rayN') { ... }`**
- [ ] **Step 2: 跑快照测试,PASS**
- [ ] **Step 3: Commit**

```bash
git commit -m "refactor: remove unreachable v2rayN generic branch"
```

## Task 1.4: 把末尾 unreachable 兜底 return 替换为 MINIMAL_FALLBACK_GUIDE

**Files:**

- Modify: `src/pages/portal/SubscriptionTabGuides.ts`(原行 547-609 那块大 `return { ... }`)

- [ ] **Step 1: 找到 `buildClientGuide` 末尾的兜底 return(`exclave` 分支之后)**

Run 定位:函数末尾大概是 `if (clientId === 'exclave') { ... }` 后面的 `return { recommendedFormat: 'universal', note, steps: [...] }`。

- [ ] **Step 2: 把整段 return 替换为**

```ts
  return MINIMAL_FALLBACK_GUIDE;
}
```

(整个函数体应该止于此)

- [ ] **Step 3: 同时清理变量 `note`**

如果删除 dead branches 后,顶部那个 `const note = isZh ? ... : ...;`(原行 44-46)不再被任何剩余分支用到,删除它(检查 `clashVerge` 和 `singBox`、`exclave` 是否还在用 `note`)。

Run 检查: `grep -n "note," src/pages/portal/SubscriptionTabGuides.ts | head -20`

- [ ] **Step 4: 跑快照测试**

Run: `npm test -- SubscriptionTabGuides.reachable`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/portal/SubscriptionTabGuides.ts
git commit -m "refactor: replace unreachable buildClientGuide tail with MINIMAL_FALLBACK_GUIDE"
```

## Task 1.5: PR1 总体验证 + 开 PR

- [ ] **Step 1: 跑完整 ci:verify**

Run: `npm run ci:verify`
Expected: 全部 PASS(test + lint + typecheck + build)

- [ ] **Step 2: 手工 smoke test**

```bash
npm run dev  # 启动前端
# 后端单独窗口: npm run server:watch
```

打开浏览器 → 登入 user portal → 在订阅页切换以下组合,确认引导步骤可见:

- clashVerge × Linux
- sing-box × Linux
- exclave × Android
- flClash × macOS(real 版,应该显示截图)
- v2rayN × Windows(real 版)
- Shadowrocket × iOS(real 版)

- [ ] **Step 3: 计行数变化**

Run: `git diff --stat main -- src/pages/portal/SubscriptionTabGuides.ts`
Expected: 删除约 450 行

- [ ] **Step 4: 推送并开 PR**

```bash
git push -u origin <current-branch>
gh pr create --title "refactor: delete unreachable generic branches in SubscriptionTabGuides" --body "$(cat <<'EOF'
## Summary
- 通过快照测试锁定 3 个仍 reachable 的 generic 引导(clashVerge × linux、singBox × linux、exclave × android)
- 删除 8 个被 \`decorateGuideWithRealScreenshots\` 完全遮蔽的 generic 分支
- 兜底 return 替换为 \`MINIMAL_FALLBACK_GUIDE\`(理论上 UI 不会触发,见 \`PLATFORM_CLIENT_ORDER\`)

## Test plan
- [x] \`npm run ci:verify\` 全 PASS
- [x] 快照测试覆盖 3 个 reachable 组合 × 2 语言 = 6 条
- [x] 手工 smoke:上述组合在 portal 切换时引导正常显示

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

# PR2: 数据驱动 + i18n 重构

**目标:** 把剩下的 ~2300 行(15 real + 3 generic fallback)迁移到 `src/pages/portal/guides/`,按数据 + 通用 builder + i18n 三层组织。

**先决条件:** PR1 已合并到 main 并 pull 到当前分支。

**关键安全网:** Task 2.3 的等价性测试,遍历所有 client × platform × lang 组合,新旧实现输出必须深度相等。

## Task 2.1: 建目录骨架 + 类型 + 静态 fallback

**Files:**

- Create: `src/pages/portal/guides/types.ts`
- Create: `src/pages/portal/guides/index.ts`
- Create: `src/pages/portal/guides/builder.ts`
- Create: `src/pages/portal/guides/registry.ts`

- [ ] **Step 1: 创建 `types.ts`**

```ts
import type {
  GuidePlatform,
  GuideScreenshotHighlight,
  GuideTone,
  ClientGuide,
} from '../SubscriptionTabData';
import type { SubscriptionFormat } from '../types';
import type { ClientCard } from '../types';

export type ClientId = ClientCard['id'];

export interface StepDef {
  tone: GuideTone;
  titleKey: string;
  descriptionKey: string;
  helperKey: string;
  visualLabel: string; // 软件 UI 上的真实标签(英文),保留原文不翻译
  visualItemsKey: string; // i18n key,指向 string[] 数组(因为旧代码 visualItems 中英文不同,需保留体验)
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

export const MINIMAL_FALLBACK_GUIDE: ClientGuide = {
  recommendedFormat: 'universal',
  note: '',
  steps: [],
};
```

注意:如果 `SubscriptionTabData.ts` 没有 `export type ClientGuide`,需要在那个文件里加 `export` 关键字(类型已经定义,可能只是没 export)。先 grep 验证。

Run: `grep -n "interface ClientGuide\b" src/pages/portal/SubscriptionTabData.ts`

- [ ] **Step 2: 创建 `builder.ts`**

```ts
import { zhCN } from '@/src/i18n/locales/zh-CN';
import { enUS } from '@/src/i18n/locales/en-US';
import type { ClientGuide, GuidePlatform } from '../SubscriptionTabData';
import { CLIENT_GUIDE_REGISTRY } from './registry';
import { MINIMAL_FALLBACK_GUIDE, type ClientId, type StepDef } from './types';

function resolveRawKey(locale: Record<string, unknown>, key: string): unknown {
  const parts = key.split('.');
  let current: unknown = locale;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      if (import.meta.env?.DEV) {
        throw new Error(`Missing i18n key: ${key}`);
      }
      return undefined;
    }
  }
  return current;
}

function resolveKey(locale: Record<string, unknown>, key: string): string {
  const value = resolveRawKey(locale, key);
  return typeof value === 'string' ? value : key;
}

function resolveStringArrayKey(locale: Record<string, unknown>, key: string): string[] {
  const value = resolveRawKey(locale, key);
  return Array.isArray(value) ? (value as string[]) : [];
}

function resolveStep(step: StepDef, locale: Record<string, unknown>) {
  return {
    tone: step.tone,
    title: resolveKey(locale, step.titleKey),
    description: resolveKey(locale, step.descriptionKey),
    helper: resolveKey(locale, step.helperKey),
    visualLabel: step.visualLabel,
    visualItems: resolveStringArrayKey(locale, step.visualItemsKey),
    ctaLabel: resolveKey(locale, step.ctaLabelKey),
    screenshot: step.screenshot
      ? { src: step.screenshot.src, alt: resolveKey(locale, step.screenshot.altKey) }
      : undefined,
    screenshotHighlights: step.screenshotHighlights,
  };
}

export function buildClientGuide(
  clientId: ClientId,
  platform: GuidePlatform,
  _platformLabel: string,
  isZh: boolean,
): ClientGuide {
  const def = CLIENT_GUIDE_REGISTRY[clientId]?.byPlatform[platform];
  if (!def) return MINIMAL_FALLBACK_GUIDE;
  const locale = (isZh ? zhCN : enUS) as Record<string, unknown>;
  return {
    recommendedFormat: def.recommendedFormat,
    note: resolveKey(locale, def.noteKey),
    steps: def.steps.map((step) => resolveStep(step, locale)),
    sourceLabel: def.sourceLabel,
    sourceUrl: def.sourceUrl,
  };
}

export function decorateGuideWithRealScreenshots(
  guide: ClientGuide,
  _clientId: ClientId,
  _platform: GuidePlatform,
  _isZh: boolean,
): ClientGuide {
  return guide;
}
```

注意:`_platformLabel` 不再需要(新模型里 platform 直接索引数据),但为了保持 [SubscriptionTab.tsx:199-204](../../../src/pages/portal/SubscriptionTab.tsx#L199) 调用签名不变,保留参数名加下划线表示 unused。同理 `decorateGuideWithRealScreenshots` 现在是 no-op shim。

- [ ] **Step 3: 创建 `registry.ts`(暂时空注册表)**

```ts
import type { ClientGuideDef, ClientId } from './types';

export const CLIENT_GUIDE_REGISTRY: Partial<Record<ClientId, ClientGuideDef>> = {};
```

- [ ] **Step 4: 创建 `index.ts`(公共出口)**

```ts
export { buildClientGuide, decorateGuideWithRealScreenshots } from './builder';
```

- [ ] **Step 5: 跑 typecheck**

Run: `npm run typecheck`
Expected: PASS(此时新模块自洽,只是注册表为空 — builder 始终返回 MINIMAL_FALLBACK)

- [ ] **Step 6: Commit**

```bash
git add src/pages/portal/guides/
git commit -m "feat(guides): scaffold data-driven guide module with empty registry"
```

## Task 2.2: 写等价性测试(关键安全网)

**Files:**

- Create: `src/pages/portal/guides/builder.equivalence.test.ts`

- [ ] **Step 1: 写测试**

```ts
import { describe, expect, it } from 'vitest';
import { CLIENT_META, PLATFORM_OPTIONS, getPlatformLabel } from '../SubscriptionTabData';
import * as OldImpl from '../SubscriptionTabGuides';
import * as NewImpl from './index';

describe('new guides module ≡ old SubscriptionTabGuides', () => {
  for (const clientMeta of CLIENT_META) {
    for (const platformOption of PLATFORM_OPTIONS) {
      const platform = platformOption.key;
      if (!clientMeta.platforms.includes(platform)) continue;
      for (const isZh of [true, false]) {
        it(`${clientMeta.id} × ${platform} × ${isZh ? 'zh' : 'en'}`, () => {
          const label = getPlatformLabel(platform, isZh);
          const oldGeneric = OldImpl.buildClientGuide(clientMeta.id, platform, label, isZh);
          const oldFinal = OldImpl.decorateGuideWithRealScreenshots(
            oldGeneric,
            clientMeta.id,
            platform,
            isZh,
          );
          const newFinal = NewImpl.buildClientGuide(clientMeta.id, platform, label, isZh);
          expect(newFinal).toEqual(oldFinal);
        });
      }
    }
  }
});
```

- [ ] **Step 2: 跑测试,确认全部失败**

Run: `npm test -- builder.equivalence`
Expected: 大量 FAIL(因为新 registry 是空的,所有返回 MINIMAL_FALLBACK,与旧实现不同)

- [ ] **Step 3: Commit(失败的测试也 commit,作为后续目标)**

```bash
git add src/pages/portal/guides/builder.equivalence.test.ts
git commit -m "test(guides): add equivalence test against old SubscriptionTabGuides"
```

## Task 2.3: 迁移第一个客户端 — clashVerge(作为参考模板)

clashVerge 选作参考模板,因为它同时覆盖 real(windows/macos)和 generic fallback(linux),把所有难点都涵盖了。后续客户端按这个模式 follow。

**Files:**

- Create: `src/pages/portal/guides/data/clashVerge.ts`
- Modify: `src/pages/portal/guides/registry.ts`
- Modify: `src/i18n/locales/zh-CN.ts`(新增 `guides.clashVerge.*`)
- Modify: `src/i18n/locales/en-US.ts`(新增 `guides.clashVerge.*`)

- [ ] **Step 1: 阅读旧代码以提取内容**

参考来源:

- Generic clashVerge(linux fallback):[SubscriptionTabGuides.ts](../../../src/pages/portal/SubscriptionTabGuides.ts) 中 `if (clientId === 'clashVerge')` 整块
- Real clashVerge:同文件 `buildRealClashVergeGuide(platformLabel, isZh)` 函数

- [ ] **Step 2: 创建 `src/pages/portal/guides/data/clashVerge.ts`**

```ts
import type { ClientGuideDef } from '../types';
import { CLASH_VERGE_GUIDE_SOURCE_URL, CLASH_VERGE_SCREENSHOTS } from '../../SubscriptionTabData';

export const clashVergeGuide: ClientGuideDef = {
  byPlatform: {
    // ===== Real guide for Windows =====
    windows: {
      recommendedFormat: 'clash',
      noteKey: 'guides.clashVerge.windows.note',
      sourceLabel: undefined, // 旧代码里 sourceLabel 在 isZh 分支里写死,看实际值
      sourceUrl: CLASH_VERGE_GUIDE_SOURCE_URL,
      steps: [
        {
          tone: 'launch',
          titleKey: 'guides.clashVerge.windows.launch.title',
          descriptionKey: 'guides.clashVerge.windows.launch.description',
          helperKey: 'guides.clashVerge.windows.launch.helper',
          visualLabel: 'Profiles',
          visualItems: ['Profile list', 'Import button'],
          ctaLabelKey: 'guides.clashVerge.windows.launch.ctaLabel',
          screenshot: {
            src: CLASH_VERGE_SCREENSHOTS.profiles,
            altKey: 'guides.clashVerge.windows.launch.screenshotAlt',
          },
        },
        // ...其余 steps(import / connect),按旧 buildRealClashVergeGuide 内容填充
      ],
    },
    // ===== Real guide for macOS =====
    macos: {
      // 与 windows 类似,从 buildRealClashVergeGuide 中提取 macOS 特定的步骤、截图、note
    },
    // ===== Generic guide for Linux (fallback) =====
    linux: {
      recommendedFormat: 'clash',
      noteKey: 'guides.clashVerge.linux.note',
      steps: [
        {
          tone: 'launch',
          titleKey: 'guides.clashVerge.linux.launch.title',
          descriptionKey: 'guides.clashVerge.linux.launch.description',
          helperKey: 'guides.clashVerge.linux.launch.helper',
          visualLabel: 'Profiles',
          visualItems: ['配置列表', '新建配置', '导入入口'],
          ctaLabelKey: 'guides.clashVerge.linux.launch.ctaLabel',
        },
        // ...其余 import / connect,按旧 generic clashVerge 分支内容填充
      ],
    },
  },
};
```

**关于 visualItems:**

- 旧代码里 `visualItems` 中英文不同(zh: `['配置列表', ...]` vs en: `['Profile list', ...]`)
- 新 schema 用 `visualItemsKey` 指向 i18n 数组(types/builder 已经在 Task 2.1 定义),所以 zh-CN.ts 和 en-US.ts 各自存对应语言的数组
- `visualLabel`(单个字符串,通常是英文 UI 标签如 'Profiles')保留原文,不进 i18n

- [ ] **Step 3: 把 i18n 内容加到 `src/i18n/locales/zh-CN.ts`**

在 `zhCN` 对象末尾加(以 `clashVerge` 为例):

```ts
guides: {
  clashVerge: {
    windows: {
      note: '...',
      launch: {
        title: '...',
        description: '...',
        helper: '...',
        ctaLabel: '...',
        visualItems: ['...', '...'],
        screenshotAlt: '...',
      },
      import: { /* ... */ },
      connect: { /* ... */ },
    },
    macos: { /* ... */ },
    linux: { /* ... */ },
  },
},
```

文案直接从旧代码的 `isZh ? '...' : '...'` 中 zh 分支搬过来。

- [ ] **Step 4: 同样改 `src/i18n/locales/en-US.ts`**,把 en 分支搬过来。

- [ ] **Step 5: 在 `registry.ts` 注册**

```ts
import { clashVergeGuide } from './data/clashVerge';

export const CLIENT_GUIDE_REGISTRY: Partial<Record<ClientId, ClientGuideDef>> = {
  clashVerge: clashVergeGuide,
};
```

- [ ] **Step 6: 跑等价性测试 — 应该 clashVerge × {windows,macos,linux} × {zh,en} 6 个 case PASS,其他客户端依然 FAIL**

Run: `npm test -- builder.equivalence -t clashVerge`
Expected: PASS(只跑 clashVerge 相关 case)

如果某个 case FAIL,看 diff 调整 data 文件或 i18n,直到 PASS。

- [ ] **Step 7: Commit**

```bash
git add src/pages/portal/guides/data/clashVerge.ts src/pages/portal/guides/registry.ts src/pages/portal/guides/builder.ts src/pages/portal/guides/types.ts src/i18n/locales/zh-CN.ts src/i18n/locales/en-US.ts
git commit -m "feat(guides): migrate clashVerge to data-driven model"
```

## Task 2.4-2.13: 按相同模式迁移其余 10 个客户端

对以下每个客户端,重复 Task 2.3 的步骤(读旧代码 → 建 data 文件 → 加 i18n → 注册 → 跑等价性测试 → commit)。每个客户端一个独立 commit。

**迁移清单 + 旧代码定位:**

| Task | clientId     | 平台                              | 旧代码位置                                                                                                            | 备注                               |
| ---- | ------------ | --------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 2.4  | flClash      | windows / macos / linux / android | `buildRealFlClashGuide` (1332行) + `buildRealFlClashMacGuide` (1478) + `buildRealFlClashAndroidGuide` (1598)          | 4 个平台都是 real,无 fallback      |
| 2.5  | v2rayN       | windows / linux                   | `buildRealV2RayNGuide` (612) + `buildRealV2RayNLinuxGuide` (792)                                                      | 2 个平台都是 real                  |
| 2.6  | sparkle      | windows / macos / linux           | `buildRealSparkleWindowsGuide` (1718) + `buildTextOnlySparkleGuide` (1838)                                            | windows real,macos/linux text-only |
| 2.7  | shadowrocket | ios / macos                       | `buildRealShadowrocketGuide` (1238)                                                                                   | 两个平台共用同一个 guide           |
| 2.8  | surge        | ios                               | `buildRealSurgeGuide` (1924)                                                                                          | 单平台                             |
| 2.9  | singBox      | android / ios / macos / linux     | `buildRealSingBoxAppleGuide` (2070) + `buildRealSingBoxAndroidGuide` (2336) + 旧 generic singBox 分支(linux fallback) | 3 real + 1 generic                 |
| 2.10 | v2rayNG      | android                           | `buildRealV2RayNGGuide` (1088)                                                                                        | 单平台                             |
| 2.11 | clashMeta    | android                           | `buildRealClashMetaGuide` (2576)                                                                                      | 单平台                             |
| 2.12 | clashBox     | harmonyos                         | `buildRealClashBoxGuide` (2482)                                                                                       | 单平台                             |
| 2.13 | exclave      | android                           | 旧 generic exclave 分支(行 ~413)                                                                                      | 单平台,只有 generic                |

每个 task 的步骤:

- [ ] 读旧代码,提取 steps / note / screenshot / sourceUrl
- [ ] 建 `src/pages/portal/guides/data/<clientId>.ts`
- [ ] 加 `guides.<clientId>.*` 到 zh-CN.ts 和 en-US.ts
- [ ] 在 `registry.ts` 注册
- [ ] 跑 `npm test -- builder.equivalence -t <clientId>`,直到 PASS
- [ ] `git commit -m "feat(guides): migrate <clientId> to data-driven model"`

**注意 sourceUrl 和 sourceLabel 的处理:** 旧代码里 `sourceLabel: isZh ? '中文版' : 'English version'` 是按语言切换的。新模型把 `sourceLabelKey` 作为 i18n key,或者(更简单)在 data 层只放 sourceUrl,sourceLabel 转成 i18n。

## Task 2.14: 所有 11 个客户端等价性测试 PASS

- [ ] **Step 1: 跑完整等价性测试**

Run: `npm test -- builder.equivalence`
Expected: 全部 PASS(约 38 个 case = 13 个 client × 平台支持组合 × 2 lang)

- [ ] **Step 2: 跑全套 ci:verify**

Run: `npm run ci:verify`
Expected: PASS

## Task 2.15: 切换入口 — 旧 SubscriptionTabGuides.ts 改为 shim

**Files:**

- Replace全部内容: `src/pages/portal/SubscriptionTabGuides.ts`

- [ ] **Step 1: 把整个文件内容替换为**

```ts
export { buildClientGuide, decorateGuideWithRealScreenshots } from './guides';
```

(只剩 ~3 行)

- [ ] **Step 2: 删除快照测试文件**(PR1 留下的)

```bash
git rm src/pages/portal/SubscriptionTabGuides.reachable.test.ts
git rm -r src/pages/portal/__snapshots__/  # 如果只剩这一个测试的快照
```

如果 `__snapshots__/` 还有其他文件,只删对应那个 `.snap`。

- [ ] **Step 3: 删除 equivalence test**

```bash
git rm src/pages/portal/guides/builder.equivalence.test.ts
```

它作为迁移期的安全网已完成使命,新模型本身有 builder 的单元测试覆盖即可。**或者**保留它,只是修改为从同一模块跑(测试自身的稳定性)。**默认删除**,因为旧实现已不存在。

- [ ] **Step 4: 跑 ci:verify**

Run: `npm run ci:verify`
Expected: PASS

- [ ] **Step 5: 跑 dev server 手工 smoke**

```bash
npm run dev
```

切换若干 (client × platform) 组合,确认引导显示正确,中英文切换正常,截图加载正常。

- [ ] **Step 6: Commit**

```bash
git add src/pages/portal/SubscriptionTabGuides.ts
git rm src/pages/portal/guides/builder.equivalence.test.ts src/pages/portal/SubscriptionTabGuides.reachable.test.ts
# 如果有 __snapshots__/ 残留,也 git rm
git commit -m "refactor(guides): switch SubscriptionTabGuides.ts to re-export shim"
```

## Task 2.16: PR2 开 PR

- [ ] **Step 1: 计行数**

```bash
git diff --stat main -- src/pages/portal/SubscriptionTabGuides.ts src/pages/portal/guides/ src/i18n/
```

预期:`SubscriptionTabGuides.ts` -2300 行,新 `guides/` 目录 +1500 行(11 个 data 文件 + builder + types + registry + index),i18n 文件 +1200 行(中英各 +600)。净减少 ~1600 行,但更结构化。

- [ ] **Step 2: 推送 + 开 PR**

```bash
git push
gh pr create --title "refactor(guides): data-driven SubscriptionTabGuides with i18n" --body "$(cat <<'EOF'
## Summary
- 把 \`SubscriptionTabGuides.ts\` 从 2300 行命令式 builder 拆为:
  - \`src/pages/portal/guides/\` 数据 + builder + registry
  - i18n locale 新增 \`guides\` namespace,中英文案集中
- 公共 API(\`buildClientGuide\` / \`decorateGuideWithRealScreenshots\`)签名不变,调用方零改动
- 顺手补齐之前 flClash/clashMeta/sparkle/clashBox 缺失的中文文案

## Test plan
- [x] 迁移期 equivalence test 覆盖 11 clients × 平台 × 双语,全 PASS
- [x] \`npm run ci:verify\` PASS
- [x] 手工 smoke:portal 页面切换若干组合,引导显示正确

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

# 完成标准

- ✅ PR1 合并,`SubscriptionTabGuides.ts` 从 2765 → ~2300 行
- ✅ PR2 合并,`SubscriptionTabGuides.ts` 仅余 3 行 shim,逻辑全在 `guides/` 目录
- ✅ i18n locale 文件新增 `guides` namespace(zh-CN 和 en-US 同步)
- ✅ Portal UI 表现完全一致(equivalence test 把关)
- ✅ flClash/clashMeta/sparkle/clashBox 在所有保留的平台上都有中文文案
