# ProxyDog Admin — AI 交接文档

## 项目目标

为运行 **3X-UI v2.8.10**（MHSanaei fork）的 VPS 代理服务构建自定义管理界面，替代 3X-UI 默认 UI。
支持 admin 管理，以及 10 个朋友通过邀请码注册账号、登录查看自己的订阅链接。

---

## 服务器信息

- **3X-UI 地址**：`http://64.186.227.197:49675`
- **面板根路径**：`/s3Av3p0dGLYIXbkG59/`（在 3X-UI 面板设置 → 面板url根路径可查）
- **协议**：HTTP（不是 HTTPS，443 端口 404）

---

## 技术栈

| 层     | 技术                                           |
| ------ | ---------------------------------------------- |
| 前端   | React 19 + TypeScript + Vite + Tailwind CSS v4 |
| 图标   | Lucide React                                   |
| 图表   | Recharts                                       |
| 后端   | Express + better-sqlite3                       |
| TS运行 | tsx                                            |

---

## 启动方式

### 开发（需要两个终端）

```bash
# 终端 1
npm run server:watch   # Express 后端，端口 3001

# 终端 2
npm run dev            # Vite 前端，端口 3000
```

### 生产

```bash
npm run build          # 构建 React → dist/
npm start              # Express 统一服务（端口 3001），含静态文件 + API 代理
```

---

## .env 配置

```env
SERVER_PORT=3001
ADMIN_USERNAME=admin
ADMIN_PASSWORD=changeme123        # Express 后端 admin 账号（非 3X-UI 密码）

VITE_3XUI_SERVER=http://64.186.227.197:49675
VITE_3XUI_BASE_PATH=/s3Av3p0dGLYIXbkG59
VITE_SUB_URL=http://64.186.227.197:2096   # 订阅端口，在 3X-UI 订阅设置里查
```

---

## 路由结构

```
/login          → Admin 登录（调用 3X-UI /api/login）
/user/login     → 朋友登录（调用 Express /local/auth/login）
/register       → 邀请码注册（/register?invite=xxx 可预填码）
/portal         → 朋友的订阅门户（需登录，显示订阅链接+客户端下载）

/              → Admin 面板（需 3X-UI session，未登录跳 /login）
  /inbounds        入站管理（已接真实 API）
  /users           用户管理（仍用 mock 数据）
  /nodes           节点管理（仍用 mock 数据）
  /online          在线用户（仍用 mock 数据）
  /traffic         流量统计（仍用 mock 数据）
  /subscriptions   订阅页面
  /user-accounts   邀请码管理 + 给用户分配 subId（★ 新功能）
  /settings        设置
```

---

## Vite Proxy 配置（开发用）

```
/api/*   → http://64.186.227.197:49675/s3Av3p0dGLYIXbkG59/*  （3X-UI）
/local/* → http://localhost:3001/*                             （Express 后端）
```

---

## 关键文件

```
.env                                  服务器配置（不提交 git）
vite.config.ts                        Vite + proxy 配置
package.json                          scripts: dev / server:watch / build / start

server/
  index.ts                            Express 入口：/local/* 路由 + 生产环境代理 /api/* + serve dist/
  db.ts                               SQLite schema（users/invite_codes/sessions）+ 工具函数
  routes/auth.ts                      POST /local/auth/register|login|logout，GET /local/auth/me
  routes/admin.ts                     GET|POST|DELETE /local/admin/invite，GET|PATCH /local/admin/users

src/
  api/client.ts                       3X-UI API 封装（login/logout/getServerStatus/getInbounds/deleteInbound）
  context/AuthContext.tsx             Admin 登录状态（通过 /api/xui/server/status 验证 session）
  App.tsx                             路由配置
  components/layout/Sidebar.tsx       侧边栏导航（含新增的 User Accounts 入口）

  pages/
    Login.tsx                         Admin 登录页（调 /api/login，form-urlencoded）
    Dashboard.tsx                     仪表盘（Server Status 已接真实 API，5秒轮询）
    Inbounds.tsx                      入站管理（已接真实 API，含真实 Delete）
    UserPortal.tsx                    朋友门户（需 /local/auth/me session，显示 subId 订阅链接）
    user/UserLogin.tsx                朋友登录页
    user/UserRegister.tsx             邀请码注册页（注册成功后自动登录跳转 /portal）
    admin/UsersManagement.tsx         Admin：生成邀请码 + 给用户分配 subId
```

---

## 数据库 Schema（SQLite，data/proxydog.db）

```sql
users         (id, username, password_hash, salt, sub_id, role, created_at)
invite_codes  (id, code, used_by, used_at, expires_at, created_at)
sessions      (id, user_id, token, created_at, expires_at)
```

- Admin 账号在首次启动时从 `.env` 的 `ADMIN_USERNAME/ADMIN_PASSWORD` 自动 seed
- 用户密码用 Node.js 内置 `crypto.scryptSync` 哈希，无外部依赖
- Session token 7天过期，存在 `sessions` 表，以 cookie `pd_session` 传输

---

## Admin 路由鉴权方式

`server/routes/admin.ts` 的 `requireAdmin` 中间件：
转发请求方的 cookie 到 3X-UI `/xui/server/status`，若返回 `success: true` 则认为是已登录的 Admin。

---

## 当前状态（已处理）

### 登录代理报错（已修复）

**根因**：`VITE_3XUI_SERVER` 使用 `http://...:49675` 时，上游返回非标准 `HTTP/0.0 307`，Node/Vite 会报 `Invalid HTTP version`。

**已落地修复**：

1. `vite.config.ts`：开发态 `/api` 不再直连 3X-UI，统一代理到本地 Express（`localhost:3001`）。
2. `server/index.ts`：`/api/*` 在开发和生产都由 Express 代理，且按 `VITE_3XUI_SERVER` 协议选择 HTTP/HTTPS。
3. `server/routes/admin.ts`：`requireAdmin` 鉴权请求同样改为按协议发起。
4. `.env`：`VITE_3XUI_SERVER` 改为 `https://64.186.227.197:49675`。

**备注**：若后续出现 404/空响应，优先检查 `VITE_3XUI_BASE_PATH` 是否与 3X-UI 面板实际根路径一致。

---

## 用户使用流程（完成后）

1. Admin 进入 `/user-accounts` → 点 Generate 生成邀请码 → 复制注册链接发给朋友
2. 朋友访问注册链接 → 填用户名+密码 → 账号创建
3. Admin 在 3X-UI 入站里为该朋友创建 Client，复制其 `subId`
4. Admin 在 `/user-accounts` 用户列表里点 "Assign subId" 粘贴
5. 朋友登录 `/user/login` → 进入 `/portal` → 看到订阅链接，复制到代理客户端使用
