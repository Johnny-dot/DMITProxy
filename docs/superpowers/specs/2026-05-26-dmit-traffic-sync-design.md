# DMIT 流量数据同步设计

**日期**: 2026-05-26
**状态**: 已确认设计，待实施

## 背景与动机

订阅节点展示的 `机器余量` 取自 3X-UI 上报的 `inbound.total` 减去所有客户端累计用量。3X-UI 在 xray 应用层计数，而 DMIT 在 VPS 网卡层计费，两者长期存在约 9-10% 的差距（协议开销、ACK、重传、服务器自身流量等）。结果是订阅里显示"机器还剩 367G"，实际 DMIT 后台只剩 305G。差距随累计用量线性扩大。

目标：让订阅展示的机器余量与 DMIT 计费一致。

## 范围

- ✅ 同步 DMIT 真实流量数据到本地
- ✅ 替换 `机器余量` 显示为 DMIT 口径
- ✅ Admin 面板手动兜底
- ✅ 从 DMIT API 推断 billing day，首次自动同步 `xui_inbound_billing`，后续仅提示不强改
- ❌ 多 VPS 支持（单 VPS 设计，未来按 `service_id` 主键扩展）
- ❌ 自动登录 DMIT / 服务器端调 DMIT API（Cloudflare + HttpOnly 限制）
- ❌ 用户个人用量按 DMIT 口径换算（保留 3X-UI 应用层数字，更贴近 v2rayN 客户端测量）

## 整体架构

```
┌─────────────────────────┐
│ 用户浏览器（任意机器）    │
│ 访问 dmit.io 后:        │
│ Tampermonkey 自动:       │
│  ① fetch DMIT API        │
│  ② POST 结果到 backend   │
└────────────┬────────────┘
             │ POST /local/dmit/traffic
             │ Authorization: Bearer <token>
             ▼
┌─────────────────────────┐
│  DMITProxy (Linux)       │
│  SQLite: dmit_traffic    │
│  订阅生成时:              │
│   • 有 DMIT 数据 → 用它   │
│   • 无 → 回退 3X-UI       │
└─────────────────────────┘
```

## 数据模型

新增 SQLite 表：

```sql
CREATE TABLE IF NOT EXISTS dmit_traffic (
  service_id      INTEGER PRIMARY KEY,
  bwusage_mb      INTEGER NOT NULL,
  bwlimit_mb      INTEGER NOT NULL,
  bwusage_in_mb   INTEGER,
  bwusage_out_mb  INTEGER,
  usage_percentage REAL,
  next_reset_day  INTEGER,             -- 1-31, 从 DMIT 推断的 UTC 重置日
  next_reset_at   INTEGER,             -- 下次重置的 unix ms（用于精确显示）
  auto_applied_billing_day INTEGER,    -- 标记是否已经"首次自动应用"过 billing day
  updated_at      INTEGER NOT NULL,    -- unix milliseconds
  source          TEXT NOT NULL CHECK (source IN ('tampermonkey','manual'))
);
```

单 VPS 时只有一行记录（`service_id` 来自 DMIT 服务 ID）。每次同步 `UPSERT`，覆盖同 `service_id` 的旧数据。

字段说明：

- `bwusage_mb` / `bwlimit_mb` — 已用 / 总量（MB，对应 DMIT API 返回的整数字段）
- `bwusage_in_mb` / `bwusage_out_mb` — 入站 / 出站（可选，DMIT 计费方式为双向）
- `usage_percentage` — DMIT 计算的使用率，用于 Admin 显示
- `next_reset_day` — DMIT 月度流量重置日（UTC，1-31），从 API 推断
- `next_reset_at` — 下次重置的精确时间戳（UTC ms），用于"还有 X 天"显示
- `auto_applied_billing_day` — 自动应用过的 billing day（同 `next_reset_day`）。非空时表示"首次自动同步已执行"，后续不再自动覆盖 `xui_inbound_billing`
- `source` — `tampermonkey`（自动同步）或 `manual`（手动输入）

## 配置（.env）

```
# DMIT 流量同步（可选）
DMIT_SYNC_TOKEN=your-random-token-here
DMIT_SERVICE_ID=168117
```

`DMIT_SYNC_TOKEN` 用 32+ 字符随机串，Tampermonkey 脚本里硬编码。`DMIT_SERVICE_ID` 用于 Admin 面板和 Tampermonkey 模板预填。

未配置 `DMIT_SYNC_TOKEN` 时，POST 路由直接返回 503 — 整个特性关闭，回退到现有 3X-UI 行为。

## 后端 API

### POST `/local/dmit/traffic` — Tampermonkey 同步入口

**鉴权**：`Authorization: Bearer <DMIT_SYNC_TOKEN>`

**请求体**：

```json
{
  "service_id": 168117,
  "bwusage": 712482,
  "bwlimit": 1024000,
  "bwusage_in": 355266,
  "bwusage_out": 357216,
  "usage_percentage": 69.58,
  "next_reset_at": 1780358400000,
  "next_reset_day": 3
}
```

`bwusage`/`bwlimit` 等字段为 MB（与 DMIT API 原始返回一致，不做单位转换以减少出错可能）。

`next_reset_at` 是 Tampermonkey 端从 DMIT API `rules[].conditions` 里提取 `auto_min_days_until_due`（"X.XX 天" 字符串）并加上当前时间算出来的精确时间戳，`next_reset_day` 是它的 UTC 日期分量（1-31）。两者均可选，缺失时跳过 billing day 同步逻辑。

**响应**：

- `200 { ok: true, updated_at: <ms>, billing_day_action: 'applied'|'noop'|'mismatch' }` — 成功
  - `applied`：本次首次自动配置了 billing day
  - `noop`：billing day 一致或未启用同步
  - `mismatch`：检测到不一致，未自动改（提示前端显示警告）
- `401` — token 缺失或不匹配
- `400` — 请求体校验失败
- `503` — `DMIT_SYNC_TOKEN` 未配置

**校验**：

- `service_id`：正整数，**必须等于 `DMIT_SERVICE_ID` env**，否则返回 400（防止误写入其他 service_id 的行污染数据）
- `bwusage`、`bwlimit`：非负整数
- `next_reset_day`：1-31 整数或缺失
- `next_reset_at`：unix ms 或缺失，且必须在未来（防止时钟漂移注入历史时间）
- 其他字段可选，非法值忽略

**CORS**：允许 `https://www.dmit.io` 作为来源（Tampermonkey 的 `GM_xmlhttpRequest` 实际绕过 CORS，但保留 CORS 配置以防未来用 bookmarklet）。

### GET `/local/admin/dmit/traffic` — Admin 面板查询

**鉴权**：现有 admin session（XUI cookie）

**响应**：

```json
{
  "exists": true,
  "data": {
    "service_id": 168117,
    "bwusage_mb": 712482,
    "bwlimit_mb": 1024000,
    "bwusage_in_mb": 355266,
    "bwusage_out_mb": 357216,
    "usage_percentage": 69.58,
    "updated_at": 1779705225083,
    "source": "tampermonkey",
    "is_stale": false
  }
}
```

`is_stale = (now - updated_at) > 7 * 24 * 3600 * 1000`。

### POST `/local/admin/dmit/traffic/manual` — Admin 手动输入

**鉴权**：现有 admin session

**请求体**：同 `/local/dmit/traffic`，写入时 `source = 'manual'`。

## 集成：`subscription-usage.ts`

新增可选输入字段：

```typescript
export interface SubscriptionUsageSummaryInput {
  // ...existing...
  dmitMachineUsed?: number; // bytes
  dmitMachineTotal?: number; // bytes
}
```

`buildSubscriptionUsageSummary` 修改：

```typescript
const machineTotal = safeNonNegativeInt(input.dmitMachineTotal ?? input.machineTotal);
const usedForRemaining = safeNonNegativeInt(input.dmitMachineUsed ?? totalUsed);
const machineRemaining = Math.max(0, machineTotal - usedForRemaining);
```

`本月消耗` / `他人消耗` 计算完全不变 — 它们继续展示 3X-UI 应用层数据。

新建 `server/dmit-traffic-store.ts`：

```typescript
export interface DmitTrafficSnapshot {
  serviceId: number;
  bwusageBytes: number; // bwusage_mb * 1024 * 1024
  bwlimitBytes: number;
  updatedAt: number;
  source: 'tampermonkey' | 'manual';
}

export function getDmitTrafficForCurrentService(): DmitTrafficSnapshot | null;
export function upsertDmitTraffic(input: DmitTrafficInput): void;
```

`subscription-builder.ts` 在 `buildSubscriptionPayload` 里调用 `getDmitTrafficForCurrentService()`，把字节数传给 `buildSubscriptionUsageSummary` 的新字段。

读取路径有简单的内存缓存（30 秒 TTL），避免每次订阅请求都打 SQLite。`upsertDmitTraffic` 写入后立即让缓存失效，新数据立刻生效。

## Billing Day 自动同步

DMIT API 返回的 `rules[].conditions` 里有 `auto_min_days_until_due` 条件，`current` 字段形如 `"8.57 天"`。Tampermonkey 端在前端解析并算出：

```js
const cond = rules?.[0]?.conditions?.find((c) => c.key === 'auto_min_days_until_due');
const match = cond?.current?.match(/^([\d.]+)\s*天/);
const days = match ? parseFloat(match[1]) : null;
const next_reset_at = days != null ? Date.now() + days * 86400_000 : null;
const next_reset_day = next_reset_at ? new Date(next_reset_at).getUTCDate() : null;
```

把 `next_reset_at` 和 `next_reset_day` 一并 POST 到 backend。

### 后端处理逻辑（POST `/local/dmit/traffic` 内）

伪代码：

```
upsert dmit_traffic 行（含 next_reset_day / next_reset_at）

if !req.next_reset_day:
  return billing_day_action: 'noop'

existing = SELECT auto_applied_billing_day FROM dmit_traffic WHERE service_id = ?

if existing.auto_applied_billing_day IS NULL:
  // 首次自动同步：对所有 3X-UI inbound（getInbounds）应用 DMIT 重置日
  for inbound in xui_inbounds:
    if !getBillingConfig(inbound.id):  // 仅未配置者，不覆盖用户手动配置
      setBillingDay(inbound.id, req.next_reset_day)
  UPDATE dmit_traffic SET auto_applied_billing_day = req.next_reset_day
  return billing_day_action: 'applied'

else:
  // 之后只检测，不改
  if existing.auto_applied_billing_day != req.next_reset_day:
    // DMIT 端可能改了重置日
    return billing_day_action: 'mismatch'
  // 已应用值仍然一致，检查 3X-UI 当前配置是否也一致
  any_mismatch = listBillingConfigs().some(c => c.billingDay != req.next_reset_day)
  return billing_day_action: any_mismatch ? 'mismatch' : 'noop'
```

### 关键规则

- **首次自动应用**仅对**无 billing_day 配置**的 inbound 生效 — 已有配置的 inbound 不动，避免覆盖用户手动设置
- 之后**只读取检测**，不强改 — 不一致时通过 `billing_day_action: 'mismatch'` 上报，由 Admin 面板提示用户
- Admin 面板提供"一键同步"按钮，调用单独路由 `POST /local/admin/dmit/billing-day/sync` 强制把所有 inbound 的 billing_day 设成 `next_reset_day`

### Admin 强制同步路由

`POST /local/admin/dmit/billing-day/sync`

**鉴权**：admin session

**行为**：读取 `dmit_traffic.next_reset_day`，对所有 3X-UI inbound 调用 `setBillingDay(inboundId, day)`。响应返回更新的 inbound 数量。

## Admin 面板

新页面 `/admin/dmit-sync`（Sidebar 加入口）。

### 状态卡片

- 当前已用 / 总量 / 百分比（柱状图或圆环）
- 入站 / 出站
- 最后同步时间（相对时间，超过 7 天显示警告色）
- 数据来源（`tampermonkey` / `manual`）

### Billing Day 状态卡片

- **DMIT 重置日**：`next_reset_day`（例：`每月 3 日 UTC`），含相对时间提示（`8.57 天后重置`）
- **3X-UI 当前 billing_day**：列出所有 inbound 的 billing_day，逐个对比
- **一致性指示**：全部一致 → 绿色对勾；有不一致 → 黄色警告 + "一键同步" 按钮（调 `POST /local/admin/dmit/billing-day/sync`）
- **首次自动应用提示**：若 `auto_applied_billing_day` 刚刚被设置，显示 toast "已自动配置 3X-UI billing day = X，与 DMIT 保持一致"

### 同步配置

- **Token**：脱敏显示（`da42…3f1a`），点击"显示"切换
- **Service ID**：来自 `DMIT_SERVICE_ID` env
- **复制 Tampermonkey 脚本** 按钮：把完整脚本（含 token、service_id、当前 backend URL）放到剪贴板
- **安装指南**：链接到 Tampermonkey 扩展，三步说明

### 手动同步表单

- 输入字段：bwusage (GB)、bwlimit (GB)、bwusage_in、bwusage_out
- 提交按钮：调 `/local/admin/dmit/traffic/manual`
- 提示信息："仅在 Tampermonkey 同步失败时使用，提交后立即生效"

## Tampermonkey 用户脚本

```javascript
// ==UserScript==
// @name         DMITProxy Traffic Sync
// @version      1.0.0
// @match        https://www.dmit.io/clientarea.php*
// @grant        GM_xmlhttpRequest
// @connect      your-dmitproxy-host.example.com
// ==/UserScript==

(async function () {
  'use strict';
  const SERVICE_ID = 168117;
  const BACKEND = 'https://your-dmitproxy-host.example.com/local/dmit/traffic';
  const TOKEN = 'PLACEHOLDER_REPLACE_ME';

  try {
    const r = await fetch(
      `/index.php?m=reset_traffic&modaction=get_rules&service_id=${SERVICE_ID}`,
      { credentials: 'same-origin' },
    );
    const j = await r.json();
    if (j.code !== 0 || !j.data?.traffic_info) {
      console.warn('[DMITProxy Sync] DMIT API 返回异常', j);
      return;
    }
    const t = j.data.traffic_info;

    // 提取下次重置时间（用于 billing day 自动同步）
    let next_reset_at = null;
    let next_reset_day = null;
    const cond = j.data.rules?.[0]?.conditions?.find((c) => c.key === 'auto_min_days_until_due');
    const m = cond?.current?.match(/^([\d.]+)\s*天/);
    if (m) {
      const days = parseFloat(m[1]);
      if (Number.isFinite(days) && days >= 0) {
        next_reset_at = Date.now() + Math.round(days * 86400_000);
        next_reset_day = new Date(next_reset_at).getUTCDate();
      }
    }

    GM_xmlhttpRequest({
      method: 'POST',
      url: BACKEND,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
      },
      data: JSON.stringify({
        service_id: SERVICE_ID,
        bwusage: t.bwusage,
        bwlimit: t.bwlimit,
        bwusage_in: t.bwusage_in,
        bwusage_out: t.bwusage_out,
        usage_percentage: t.usage_percentage,
        next_reset_at,
        next_reset_day,
      }),
      onload: (res) => {
        if (res.status === 200) console.log('[DMITProxy Sync] 同步成功');
        else console.error('[DMITProxy Sync] 后端返回', res.status, res.responseText);
      },
      onerror: (err) => console.error('[DMITProxy Sync] 请求失败', err),
    });
  } catch (e) {
    console.error('[DMITProxy Sync] 异常', e);
  }
})();
```

进入 `clientarea.php` 任何子页面即触发同步。无 UI 反馈（控制台 log）。

## 错误处理与回退

| 情况                     | 行为                                       |
| ------------------------ | ------------------------------------------ |
| `DMIT_SYNC_TOKEN` 未配置 | POST 返回 503，订阅生成走纯 3X-UI 路径     |
| `dmit_traffic` 表无记录  | 订阅生成走 3X-UI 路径                      |
| Token 错误               | POST 返回 401，Tampermonkey 控制台报错     |
| 请求体非法               | POST 返回 400，已有 DB 数据不变            |
| DMIT API 改版            | Tampermonkey 静默失败，DB 保留旧数据继续用 |
| 数据 > 7 天未更新        | 订阅继续用旧数据，Admin 显示警告色         |
| SQLite 错误              | POST 返回 500，订阅回退 3X-UI              |

订阅路径绝不抛错 — DMIT 数据缺失 / 异常一律视为"没有"，回退到当前行为。

## 安全考虑

- **Token 长度**：建议 32+ 字符随机串。`.env.example` 给出 `openssl rand -hex 32` 命令示范。
- **Token 在脚本里硬编码**：泄漏后果是攻击者可以 POST 假流量数据，影响 `机器余量` 显示但不会泄漏其他数据。轮换方式：改 `.env` 重启服务 + 更新 Tampermonkey 脚本。
- **CORS**：仅允许 `https://www.dmit.io`，防止任意网站调接口。
- **请求体大小限制**：POST body 限制 1KB（防滥用）。
- **速率限制**：可选 — 同 service_id 每分钟最多 6 次（够用，防止脚本异常循环刷接口）。v1 先不做，观察是否需要。

## 测试

### 单元测试

- `subscription-usage.test.ts`：传入 `dmitMachineUsed/Total` 时 `machineRemaining` 正确，其他字段不受影响
- `dmit-traffic-store.test.ts`：UPSERT、staleness 判断、字段校验
- `dmit-billing-day-sync.test.ts`：
  - 首次同步且 inbound 无 billing_day → 自动应用，`auto_applied_billing_day` 被写入
  - 首次同步但 inbound 已有 billing_day → 不覆盖该 inbound
  - 二次同步检测到 DMIT 重置日变化 → 返回 `mismatch`，不动 DB
  - `next_reset_day` 缺失 → noop，不影响主流量同步

### 集成测试

- POST `/local/dmit/traffic`：token 鉴权、字段校验、写入 DB、`billing_day_action` 返回正确
- GET `/local/admin/dmit/traffic`：admin 鉴权、返回格式
- POST `/local/admin/dmit/billing-day/sync`：admin 鉴权、所有 inbound 的 billing_day 被更新
- 订阅端到端：DB 有 DMIT 数据 → 订阅 `机器余量` 用 DMIT；DB 无数据 → 用 3X-UI

### 手动测试

- Tampermonkey 在 DMIT clientarea 页面安装运行成功
- Admin 面板：状态、复制按钮、手动表单、billing day 卡片都工作
- v2rayN 刷新订阅看到 `机器余量` 变化
- 首次同步后查 `xui_inbound_billing` 表，billing_day 已自动设置

## 实施顺序建议

1. SQLite 表（含 billing day 字段）+ `dmit-traffic-store.ts`
2. POST `/local/dmit/traffic` 路由 + token 鉴权（不含 billing day 逻辑）+ 单测
3. 修改 `subscription-usage.ts` 接入 `dmitMachine*` 字段 + 单测
4. 修改 `subscription-builder.ts` 读 DB 注入
5. Billing day 自动同步逻辑（嵌入 POST 路由）+ 单测
6. Admin GET / 手动 POST / billing-day sync 路由
7. Admin 面板新页面 UI（含 billing day 卡片）
8. Tampermonkey 脚本（含 `auto_min_days_until_due` 解析）
9. 端到端手动验证

每一步完成后跑完整测试套件再继续。
