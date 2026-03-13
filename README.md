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

| Variable / 变量               | Required / 必填 | Description / 说明                                                                                                           |
| ----------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `SERVER_PORT`                 | No              | Local server listen port. Default is `3001`. / 本地服务监听端口，默认 `3001`。                                               |
| `VITE_3XUI_SERVER`            | Yes             | Upstream 3X-UI server URL. / 上游 3X-UI 服务地址。                                                                           |
| `VITE_3XUI_BASE_PATH`         | Yes             | 3X-UI panel base path. / 3X-UI 面板基础路径。                                                                                |
| `VITE_SUB_URL`                | Yes             | Subscription host used by the portal and admin tools. / 用户门户和后台使用的订阅地址。                                       |
| `XUI_ADMIN_USERNAME`          | Yes             | 3X-UI admin username. / 3X-UI 管理员用户名。                                                                                 |
| `XUI_ADMIN_PASSWORD`          | Yes             | 3X-UI admin password. / 3X-UI 管理员密码。                                                                                   |
| `XUI_AUTO_CREATE_ON_REGISTER` | No              | Auto-create a 3X-UI client after invite registration. / 邀请注册成功后自动创建 3X-UI 客户端。                                |
| `COOKIE_SECURE`               | No              | Force secure cookies. In production, keep HTTPS and leave this enabled. / 是否强制安全 Cookie。生产环境建议配合 HTTPS 使用。 |
| `DATA_DIR`                    | No              | Runtime data path. Defaults to `./data`. / 运行数据目录，默认 `./data`。                                                     |

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

Important:

注意：

- Do not use `npm ci --omit=dev` for the current production flow.
- The `npm start` command uses `tsx`, which is currently installed from `devDependencies`.

- 当前生产流程不要使用 `npm ci --omit=dev`。
- 现在的 `npm start` 依赖 `tsx`，而它目前在 `devDependencies` 中。

### 3. Configure environment / 配置环境变量

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

### 4. Build and start / 构建并启动

```bash
npm run build
npm start
```

Or use PM2 with the included config:

也可以直接使用仓库自带的 PM2 配置：

```bash
npm run build
pm2 start ecosystem.config.cjs
pm2 save
```

### 5. Enable auto-start / 设置开机自启

```bash
pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

Run the command printed by PM2, then save again:

执行 PM2 回显的那条命令后，再保存一次：

```bash
pm2 save
```

### 6. Reverse proxy / 反向代理

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
- Proxy-quality checks now run through the actual node path by launching a temporary local `xray` client. Keep `xray` installed on the server running DMITProxy, or set `XRAY_BIN` when it lives outside `PATH`.

- 管理员认证来自 3X-UI，不使用本地 SQLite 管理员密码。
- 普通用户会话、邀请码和设置保存在本地。
- 迁移服务前，请优先备份 `data/` 目录。
