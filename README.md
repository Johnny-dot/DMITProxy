# DMITProxy

DMITProxy is a 3X-UI management frontend with a local Express backend, an invite-based user portal, and SQLite-backed local state.

DMITProxy 是一个面向 3X-UI 的管理前端，配套本地 Express 后端、邀请码注册用户门户，以及基于 SQLite 的本地状态存储。

## Overview / 项目简介

This project combines the admin console and end-user portal into one deployable service:

- Admin login is delegated to the upstream 3X-UI panel.
- End users register and sign in through local invite-based accounts.
- The user portal provides subscriptions, client downloads, announcements, shared resources, and community links.
- The production server serves both the API layer and the built frontend.

这个项目把管理员控制台和终端用户门户整合成了一个可部署服务：

- 管理员登录依赖上游 3X-UI 面板会话。
- 普通用户通过本地邀请码注册和登录。
- 用户门户提供订阅信息、客户端下载、公告、共享资源和社区入口。
- 生产环境下由同一个服务同时提供 API 和前端页面。

## Core Features / 核心能力

- 3X-UI admin authentication / 3X-UI 管理员认证
- Invite-based user registration / 邀请码注册用户体系
- Local user portal with subscription tools / 本地用户门户与订阅工具
- Shared resources and community entry management / 共享资源与社群入口管理
- Market data and news modules / 市场数据与资讯模块
- SQLite-backed sessions, settings, and invite data / 基于 SQLite 的会话、设置和邀请码数据

## Tech Stack / 技术栈

- Frontend: React 19, TypeScript, Vite, Tailwind CSS v4
- Backend: Express, better-sqlite3, tsx
- Charts and UI: Recharts, Lucide, Motion
- Auth model: 3X-UI admin cookies + local user sessions

- 前端：React 19、TypeScript、Vite、Tailwind CSS v4
- 后端：Express、better-sqlite3、tsx
- 图表与界面：Recharts、Lucide、Motion
- 认证模型：3X-UI 管理员 Cookie + 本地用户会话

## Project Layout / 目录结构

```text
src/        React frontend, admin pages, user portal, shared UI
server/     Express server, local APIs, SQLite logic, upstream 3X-UI integration
public/     Static assets and guides
data/       Runtime data directory, including prism.db
docs/       Project notes and architecture documents
```

```text
src/        React 前端、后台页面、用户门户、通用 UI
server/     Express 服务、本地 API、SQLite 逻辑、3X-UI 集成
public/     静态资源和引导图片
data/       运行时数据目录，包含 prism.db
docs/       项目说明和架构文档
```

## Quick Start / 本地开发

### 1. Requirements / 环境要求

- Node.js 22 LTS recommended
- npm
- A reachable 3X-UI panel

- 推荐使用 Node.js 22 LTS
- 需要 npm
- 需要一个可访问的 3X-UI 面板

### 2. Install dependencies / 安装依赖

```bash
npm install
```

### 3. Create environment file / 创建环境变量文件

```bash
cp .env.example .env
```

Fill at least these variables:

至少填写以下变量：

- `VITE_3XUI_SERVER`
- `VITE_3XUI_BASE_PATH`
- `VITE_SUB_URL`
- `XUI_ADMIN_USERNAME`
- `XUI_ADMIN_PASSWORD`

### 4. Start development services / 启动开发服务

Backend:

后端：

```bash
npm run server
```

Frontend:

前端：

```bash
npm run dev
```

Default local addresses:

默认本地地址：

- Frontend / 前端: `http://localhost:3000`
- Backend / 后端: `http://localhost:3001`

## Environment Variables / 关键环境变量

For the full list, see [`.env.example`](./.env.example).

完整列表请查看 [`.env.example`](./.env.example)。

| Variable / 变量                             | Required / 必填 | Description / 说明                                                                                                                                                                                                                                |
| ------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SERVER_PORT`                               | No              | Local server listen port. Default is `3001`. / 本地服务监听端口，默认 `3001`。                                                                                                                                                                    |
| `VITE_3XUI_SERVER`                          | Yes             | Upstream 3X-UI server URL. / 上游 3X-UI 服务地址。                                                                                                                                                                                                |
| `VITE_3XUI_BASE_PATH`                       | Yes             | 3X-UI panel base path. / 3X-UI 面板基础路径。                                                                                                                                                                                                     |
| `VITE_SUB_URL`                              | Yes             | Subscription host used by the portal and admin tools. / 用户门户和后台使用的订阅地址。                                                                                                                                                            |
| `VITE_SUB_URL_TEMPLATE`                     | No              | Explicit subscription URL template with `{subId}` placeholder. Use `http://` when accessing by bare IP to avoid TLS certificate errors. / 自定义订阅 URL 模板，含 `{subId}` 占位符。裸 IP 访问时使用 `http://` 以避免证书验证失败。               |
| `XUI_ADMIN_USERNAME`                        | Yes             | 3X-UI admin username. / 3X-UI 管理员用户名。                                                                                                                                                                                                      |
| `XUI_ADMIN_PASSWORD`                        | Yes             | 3X-UI admin password. / 3X-UI 管理员密码。                                                                                                                                                                                                        |
| `XUI_AUTO_CREATE_ON_REGISTER`               | No              | Auto-create a 3X-UI client after invite registration. / 邀请注册成功后自动创建 3X-UI 客户端。                                                                                                                                                     |
| `XRAY_BIN`                                  | No              | Path to the Xray binary when it is not in `PATH`. Example: `/usr/local/bin/xray`. / Xray 不在 PATH 时的二进制路径，例如 `/usr/local/bin/xray`。                                                                                                   |
| `NODE_QUALITY_ALLOW_SERVER_EGRESS_FALLBACK` | No              | Set `true` to fall back to a direct server-egress probe when proxy-outbound fails. Disabled by default — leave it off so failures surface as errors. / 设为 `true` 时，代理探测失败后会降级为服务器出口探测。默认关闭，建议保持关闭以便错误可见。 |
| `COOKIE_SECURE`                             | No              | Force secure cookies. In production, keep HTTPS and leave this enabled. / 是否强制安全 Cookie。生产环境建议配合 HTTPS 使用。                                                                                                                      |
| `DATA_DIR`                                  | No              | Runtime data path. Defaults to `./data`. / 运行数据目录，默认 `./data`。                                                                                                                                                                          |

## Production Deployment / 生产部署

### Deployment model / 部署方式

In production, the server serves `dist/` directly, so you only need one Node.js process.

生产环境下，服务端会直接托管 `dist/` 前端文件，所以只需要维护一个 Node.js 进程。

Runtime data is stored under `./data`, and the SQLite database lives at `./data/prism.db`.

运行时数据保存在 `./data` 下，SQLite 数据库文件位于 `./data/prism.db`。

### 1. Clone the project on the VPS / 在 VPS 上拉取项目

```bash
mkdir -p ~/apps
cd ~/apps
git clone https://github.com/Johnny-dot/DMITProxy.git
cd DMITProxy
git checkout main
```

### 2. Install dependencies / 安装依赖

```bash
npm ci
```

Notes:

注意：

- `tsx` is in `dependencies` because `npm start` uses it at runtime; `npm ci --omit=dev` will work, but you will need a separate build step (e.g. `npm install` + `npm run build`) before deploying.
- `vite` is build-time only (`devDependencies`).

- `tsx` 在 `dependencies` 中，因为 `npm start` 在运行时依赖它；`npm ci --omit=dev` 可以正常运行，但部署前需要单独执行构建（例如 `npm install` + `npm run build`）。
- `vite` 只在构建阶段使用，放在 `devDependencies`。

### 3. Install Xray (required for node quality probing) / 安装 Xray（节点质量检测必需）

The node quality probe works by launching a temporary local Xray process on the **DMITProxy server** to connect through each proxy node and measure its real exit quality. Xray must be installed on the machine running DMITProxy — not on the 3X-UI/proxy server.

节点质量检测的原理是在运行 **DMITProxy 的服务器**上启动一个临时 Xray 进程，通过代理节点发出请求，检测节点真实的出口质量。Xray 必须安装在运行 DMITProxy 的机器上，而不是 3X-UI / 代理服务器上。

> **Typical split-deployment scenario / 典型分离部署场景**
>
> If DMITProxy runs on a separate VPS (e.g. Oracle Free Tier) while 3X-UI runs on a dedicated proxy server (e.g. DMIT), Xray is **not** present on the DMITProxy machine by default. Install it independently:
>
> 如果 DMITProxy 部署在独立 VPS（如 Oracle Free Tier），3X-UI 部署在专用代理服务器（如 DMIT），Xray 默认不存在于 DMITProxy 机器上，需要单独安装：

```bash
# Install Xray core only (no 3X-UI panel) / 仅安装 Xray 核心，不含 3X-UI 面板
bash <(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh) install

# Verify / 验证
xray version
```

The installer places the binary at `/usr/local/bin/xray`, which DMITProxy detects automatically. If you install Xray elsewhere, set `XRAY_BIN` in `.env`.

安装脚本会将二进制文件放在 `/usr/local/bin/xray`，DMITProxy 会自动找到它。如果安装到其他路径，在 `.env` 中设置 `XRAY_BIN`。

### 4. Configure environment / 配置环境变量

```bash
cp .env.example .env
mkdir -p logs data
```

If you are testing with plain HTTP or direct IP access only, you may temporarily set:

如果你只是临时用纯 HTTP 或直接用 IP 测试，可以临时设置：

```env
COOKIE_SECURE=false
```

For a real deployment, use HTTPS and keep secure cookies enabled.

正式部署建议使用 HTTPS，并保持安全 Cookie 开启。

### 5. Build and start / 构建并启动

```bash
npm run build
npm start
```

Or use PM2 with the included config:

也可以直接使用仓库自带的 PM2 配置：

```bash
npm run build
bash scripts/install-subconverter.sh   # one-time, downloads the subconverter sidecar
pm2 start ecosystem.config.cjs
pm2 save
```

The PM2 ecosystem manages two processes: `dmit-proxy` (the Node app on `:3001`) and `dmit-subconverter` (the [Aethersailor/SubConverter-Extended](https://github.com/Aethersailor/SubConverter-Extended) sidecar bound to `127.0.0.1:25500`). The sidecar renders Clash YAML / sing-box JSON / Surge config from the upstream subscription with DMITProxy's local minimal template (`server/templates/dmit-default.toml`): one `PROXY` select group, one `auto` url-test group, LAN/CN bypass rules, and `FINAL` to `PROXY`. We use this fork (not the upstream `tindy2013/subconverter`) because it integrates the mihomo (Clash.Meta) parsing kernel and properly handles VLESS + Reality nodes, which mainline rejects with "No nodes were found!". On first run, `bash scripts/install-subconverter.sh` downloads the pinned binary into `vendor/subconverter/`; the deploy script (step 7) calls it on every deploy and is idempotent.

PM2 同时管理两个进程：`dmit-proxy`（Node 服务，监听 `:3001`）和 `dmit-subconverter`（[Aethersailor/SubConverter-Extended](https://github.com/Aethersailor/SubConverter-Extended) 边车，绑定在 `127.0.0.1:25500`）。后者负责把上游订阅渲染成 Clash YAML / sing-box JSON / Surge 配置，并套用 DMITProxy 本地极简模板（`server/templates/dmit-default.toml`）：一个 `PROXY` 手动选择组、一个 `auto` 延迟测试组、LAN/CN 直连规则，以及 `FINAL` 走 `PROXY`。之所以用这个 fork 而不是 `tindy2013/subconverter` 主线，是因为它内置 mihomo（Clash.Meta）解析内核，能正确处理 VLESS + Reality 节点；主线对此直接报 "No nodes were found!"。首次部署需手动执行 `bash scripts/install-subconverter.sh` 下载二进制到 `vendor/subconverter/`，后续每次部署由脚本自动复用。

### 6. Enable auto-start / 设置开机自启

```bash
pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

Run the command printed by PM2, then save again:

执行 PM2 输出的命令后，再执行一次保存：

```bash
pm2 save
```

### 7. GitHub Actions auto deploy / GitHub Actions 自动部署

The repository includes [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml), which deploys every push to `main`.

仓库内置了 [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml)，每次 push 到 `main` 时都会自动部署。

Required GitHub repository secrets:

需要在 GitHub 仓库里配置以下 Secrets：

- `VPS_HOST` - production VPS public IP or hostname
- `VPS_USER` - SSH user, for example `ubuntu`
- `VPS_SSH_PRIVATE_KEY` - private key matching the VPS authorized key
- `VPS_PORT` - optional SSH port, defaults to `22`

The workflow SSHes into the VPS and runs [`scripts/deploy/remote-deploy.sh`](./scripts/deploy/remote-deploy.sh), which:

工作流会通过 SSH 登录 VPS 并执行 [`scripts/deploy/remote-deploy.sh`](./scripts/deploy/remote-deploy.sh)，它会：

- stash the protected local production patches in `server/app.ts` and `server/index.ts`
- `git pull --ff-only origin main`
- run `npm ci`
- run `bash scripts/install-subconverter.sh` (idempotent; no-op when already installed)
- run `npm run build`
- restart all PM2 apps in the ecosystem (`dmit-proxy` + `dmit-subconverter`)
- run a local health check against `http://127.0.0.1:3001`

After deploy, validate a Clash subscription on the VPS before testing a GUI client:

```bash
npm run sub:check -- <subscription-id>
```

The check fails if the generated YAML has neither inline `proxies` entries nor
public `proxy-providers` used by the `PROXY` / `auto` groups. Provider URLs that
point at `127.0.0.1`, `localhost`, or `/sub/_raw/*` are treated as invalid
because GUI clients would try to fetch them from the user's own machine.

To make deployment fail fast on the Linux box, set `SUBCONVERTER_SMOKE_SUB_ID`
as a GitHub Actions repository secret. The deploy workflow passes it into the
Linux deploy script, which runs the same check against `http://127.0.0.1:3001`
after PM2 restart and healthcheck.

If the server already contains extra uncommitted changes outside the protected files, clean them up before relying on auto deploy.

如果服务器上还存在受保护文件以外的未提交修改，建议先清理，再依赖自动部署。

执行 PM2 回显的那条命令后，再保存一次：

```bash
pm2 save
```

### 8. Reverse proxy / 反向代理

Nginx is the recommended front door for production.

生产环境建议使用 Nginx 作为入口。

Recommended flow:

推荐流程：

1. Proxy traffic from `80/443` to `127.0.0.1:3001`
2. Enable HTTPS with Certbot
3. Forward `Host`, `X-Forwarded-For`, and `X-Forwarded-Proto`

4. 将 `80/443` 流量反代到 `127.0.0.1:3001`
5. 使用 Certbot 配置 HTTPS
6. 透传 `Host`、`X-Forwarded-For` 和 `X-Forwarded-Proto`

## Updating on the VPS / VPS 更新代码

```bash
cd ~/apps/DMITProxy
git pull origin main
npm ci
npm run build
pm2 restart dmit-proxy --update-env
```

## Useful Scripts / 常用脚本

| Command                | Description                                             |
| ---------------------- | ------------------------------------------------------- |
| `npm run dev`          | Start the Vite frontend in development / 启动开发前端   |
| `npm run server`       | Start the local backend in development / 启动开发后端   |
| `npm run server:watch` | Start the backend with file watching / 监听模式启动后端 |
| `npm run build`        | Build the frontend bundle / 构建前端产物                |
| `npm start`            | Start the production server / 启动生产服务              |
| `npm run test`         | Run tests / 运行测试                                    |
| `npm run lint`         | Run ESLint / 运行 ESLint                                |
| `npm run typecheck`    | Run TypeScript type checks / 运行 TypeScript 类型检查   |
| `npm run ci:verify`    | Run test + lint + typecheck + build / 运行完整校验流程  |

## Documentation / 相关文档

- [docs/system-flow.md](./docs/system-flow.md)
- [docs/architecture-layers.md](./docs/architecture-layers.md)
- [docs/playwright-invite-flow.md](./docs/playwright-invite-flow.md)

## Notes / 备注

- Admin authentication comes from 3X-UI; local SQLite admin credentials are not used.
- End-user sessions, invite codes, and settings are stored locally.
- If you migrate the service, back up the `data/` directory first.
- Node quality probing launches a temporary Xray process on the DMITProxy server to route test traffic through the proxy node. Xray must be installed on the DMITProxy host — not the 3X-UI server. See the [Install Xray](#3-install-xray-required-for-node-quality-probing--安装-xray节点质量检测必需) step above.
- If `VITE_SUB_URL_TEMPLATE` points to an HTTPS endpoint using a bare IP address, TLS certificate validation will fail and the probe cannot resolve nodes. Use `http://` in that case.

- 管理员认证来自 3X-UI，不使用本地 SQLite 管理员密码。
- 普通用户会话、邀请码和设置保存在本地。
- 迁移服务前，请优先备份 `data/` 目录。
- 节点质量检测会在 DMITProxy 服务器上启动临时 Xray 进程，通过代理节点发出探测请求。Xray 必须安装在运行 DMITProxy 的主机上，而不是 3X-UI 服务器上。详见上方[安装 Xray](#3-install-xray-required-for-node-quality-probing--安装-xray节点质量检测必需) 步骤。
- 如果 `VITE_SUB_URL_TEMPLATE` 使用 HTTPS 加裸 IP 地址，TLS 证书验证会失败，导致探测无法获取节点。此时应改用 `http://`。
