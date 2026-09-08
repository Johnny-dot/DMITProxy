# Playwright 网站显示检查

> 当前推荐入口为 `npm run test:e2e`，使用 `scripts/demo/screenshots.ts` 自动启动隔离的本地演示。`pw:flow` 与 `pw:flow:local` 已指向该入口。它不使用生产 `.env`、不终止现有端口上的服务。以下保留旧脚本的历史说明；其中独立后端地址和旧门户分区不再作为当前回归范围。最新范围见 [运行指南](GETTING_STARTED.md) 与 [贡献说明](../CONTRIBUTING.md)。

这套脚本会在本地隔离环境下启动前后端，然后执行一轮真实浏览器显示检查，覆盖：

- 公共页：`/login`、`/register`、`/reset-password`
- 用户页：`/my-subscription` 的 `Overview`、`Subscription & Clients`、`Notifications`
- 兼容路径：`/portal -> /my-subscription`
- 视口：桌面 `1440x960`、移动端 `390x844`
- 语言：中文主流程，英文抽查 `login`、`overview`、`subscription`

## 一次性准备

```powershell
npm install
npm run pw:install
```

## 运行命令

推荐直接跑隔离环境：

```powershell
npm run pw:flow:local
```

可视化浏览器执行过程：

```powershell
npm run pw:flow:local:headed
```

如果你已经手动启动了应用，也可以直接跑脚本：

```powershell
npm run pw:flow -- --base-url http://127.0.0.1:3300 --data-dir .tmp/playwright-data
```

## 输出位置

每次运行都会生成到：

```text
output/playwright/<timestamp>/
```

产物包括：

- `steps/*.png`
- `site-display-audit-trace.zip`
- `summary.json`
- `console.json`
- `network.json`
- `page-errors.json`

## 结果说明

当前脚本把这些记录为“观察项”而不是失败：

- `/local/auth/me` 的匿名 `401`
- `/api/panel/api/server/status` 的 `404`

只要页面显示、导航和关键区块都正常，这两类噪音不会让本次检查判失败。
