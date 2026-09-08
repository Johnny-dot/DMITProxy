# 运行指南

## 选择运行方式

| 方式                         | 需要上游账号 | 用途                    | 地址                 |
| ---------------------------- | ------------ | ----------------------- | -------------------- |
| npm run demo                 | 否           | 查看页面、体验、贡献 UI | 127.0.0.1:4173       |
| npm run server + npm run dev | 是           | 开发调试                | 前端 3000，API 3001  |
| 构建后 npm start             | 是           | 自托管                  | 页面与 API 共用 3001 |

推荐 Node.js 24 LTS，最低 22.12。首次安装运行 `npm ci`。Windows 的 better-sqlite3 优先使用预编译二进制；平台没有对应二进制时，需要 Python 和 Visual Studio C++ 构建工具。

## 本地演示

```bash
npm ci
npm run demo
```

访问 http://127.0.0.1:4173。用户账号为 `demo`，管理员为 `admin`，演示密码均为 `prism-demo-2026`。邀请注册填写 `PRISM-DEMO`。

演示实际运行 React、Express、SQLite 和本地模拟上游，因此注册、登录、订阅绑定、公告编辑等本地操作可体验。模拟上游只支持展示所需的读取操作，真实入站修改和外部网络能力未开放。

使用新建的系统临时目录，不复用仓库 data，不加载 `.env`。重启会生成新数据。终端 Ctrl+C 关闭。端口占用时可设置 DEMO_PORT：

```powershell
# PowerShell
$env:DEMO_PORT = '4174'
npm run demo
```

```bash
# Linux / macOS
DEMO_PORT=4174 npm run demo
```

## 创建自己的配置

```powershell
# PowerShell
Copy-Item .env.example .env
```

```bash
# Linux / macOS
cp .env.example .env
```

| 变量                                                   | 用途                                                 |
| ------------------------------------------------------ | ---------------------------------------------------- |
| SERVER_HOST / SERVER_PORT                              | Prism 监听地址与端口，默认回环 / 3001                |
| VITE_3XUI_SERVER                                       | 面板 origin，含协议及非标准端口                      |
| VITE_3XUI_BASE_PATH                                    | 面板自定义路径，例如 /panel-secret；根路径部署可为空 |
| XUI_ADMIN_USERNAME / XUI_ADMIN_PASSWORD                | 后端读取统计、生成订阅、自动建号的服务账号           |
| XUI_AUTO_CREATE_ON_REGISTER                            | 邀请注册时是否自动创建上游客户端                     |
| VITE_SUB_URL                                           | 对外 Prism 地址，推荐 HTTPS                          |
| PUBLIC_NODE_HOST                                       | 写进订阅的实际代理节点主机                           |
| DATA_DIR                                               | SQLite 和缓存目录，默认 ./data                       |
| COOKIE_SECURE                                          | 生产 HTTPS 为 true，本地 HTTP 为 false               |
| XUI_AUTO_INBOUND_ID                                    | 可选，指定自动建号目标入站                           |
| XUI_AUTO_CLIENT_TOTAL_GB / XUI_AUTO_CLIENT_EXPIRY_DAYS | 可选，新建客户端的流量/到期默认值                    |

`VITE_*` 是前端可见变量命名空间，不应放入密码或令牌。服务凭据使用 `XUI_ADMIN_*`，不要改名为 `VITE_XUI_ADMIN_PASSWORD`。

## 启动与首次使用

```bash
# 终端 1
npm run server
# 终端 2
npm run dev
```

打开 http://127.0.0.1:3000。Vite 将 /api、/local、/sub 转发至本地 API。

1. 用自己的 3X-UI 管理员账号登录。
2. 打开用户中心，创建邀请码并复制邀请链接。
3. 在没有管理员 Cookie 的浏览器会话中注册普通用户。
4. 开启自动创建时注册后取得订阅；否则在用户中心给用户绑定已有 3X-UI subId。
5. 用户进入“使用订阅”，确认设备、安装客户端，然后复制或导入链接。

密码找回由管理员给指定用户生成短期重置链接，不依赖邮箱发送功能。

## 订阅格式与可选服务

| 格式/能力    | 服务依赖                     | 验证边界                                                        |
| ------------ | ---------------------------- | --------------------------------------------------------------- |
| 通用协议链接 | Node + 3X-UI                 | base64 协议链接                                                 |
| Clash        | Node + 3X-UI                 | 使用支持所需协议的 Mihomo/Clash.Meta 客户端                     |
| sing-box     | Node + 3X-UI                 | 已移除旧 block outbound；需核对客户端是否补齐入口/DNS等运行配置 |
| Surge        | Node + 3X-UI + subconverter  | 安装脚本面向 Linux；并非全部协议都能转换                        |
| 节点质量     | Xray 位于 Prism 主机         | 真实代理发请求；网页可达不等于服务账号可用                      |
| 下载镜像     | Prism 可访问 GitHub Releases | 缓存保存在 DATA_DIR                                             |
| DMIT 流量    | NIC 同步代理或显式输入       | 区分网络层账单和应用层客户端统计                                |

Xray 可通过 XRAY_BIN 指定。保留 TLS 校验；自签证书应先配置为受信任证书，不要为了绕过错误而随意关闭校验。

## 常见问题

| 现象                    | 检查方式                                                                    |
| ----------------------- | --------------------------------------------------------------------------- |
| 演示无法启动            | Node 版本、npm ci、DEMO_PORT；NODE_ENV 不能是 production                    |
| 管理员登录失败          | 面板地址、base path、上游 Cookie、HTTPS、账号                               |
| 用户显示准备中          | subId、自动创建开关、目标入站、服务账号权限                                 |
| 用量暂不可用            | 检查上游连通性与服务会话                                                    |
| 订阅可打开但不能连接    | 节点域名/端口、内核协议支持、到期与流量限制                                 |
| 本机外无法访问开发页    | 默认回环；可信局域网用 dev:lan，生产用 HTTPS 反向代理                       |
| Playwright 找不到浏览器 | npm run pw:install；Linux CI 用 npx playwright install --with-deps chromium |
| better-sqlite3 安装失败 | 推荐 Node 和匹配架构，避免复用其他系统的 node_modules                       |

更多：[部署](DEPLOYMENT.md) · [架构](ARCHITECTURE.md) · [贡献](../CONTRIBUTING.md)。
