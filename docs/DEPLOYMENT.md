# 自托管部署

推荐 Node.js 24 LTS 和 HTTPS 反向代理。Prism 与 3X-UI 可分离部署，PUBLIC_NODE_HOST 指向实际代理节点。以下地址均为占位示例。

## 构建与启动

```bash
git clone https://github.com/Johnny-dot/DMITProxy.git
cd DMITProxy
cp .env.example .env
# 编辑 .env，填写自己的配置
npm ci
npm run ci:verify
NODE_ENV=production npm start
```

ci:verify 包含构建，默认监听 127.0.0.1:3001。启动会初始化 SQLite 并启用清理、账期后台任务，先在测试环境确认配置。

PowerShell 生产启动：

```powershell
$env:NODE_ENV = 'production'
npm start
```

Windows 可用于本地运行；PM2、subconverter 安装和 SSH 部署脚本按 Linux 设计。

## HTTPS 反向代理

用自己的域名配置 Nginx/Caddy，将请求转发至回环 3001。Nginx 的 location 示例：

```nginx
location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 60s;
}
```

片段不含 TLS server 块、证书签发和防火墙，需按主机配置。应用目前按一跳代理解释来源 IP，多级代理/CDN 需单独核对；不要直接开放应用端口。生产 HTTPS 保持 COOKIE_SECURE=true。

## PM2 与可选服务

PM2 需预先安装并能通过 PATH 使用。仅需要通用/Clash/sing-box：

```bash
pm2 start ecosystem.config.cjs --only dmit-proxy
pm2 save
```

需要 Surge 时先安装 Linux subconverter：

```bash
bash scripts/install-subconverter.sh
pm2 start ecosystem.config.cjs
pm2 save
```

按当前 Linux 用户执行 pm2 startup 输出的命令以配置系统服务。无需公开 25500 端口。

真实节点质量检测还需要在 **Prism 主机**安装 Xray 并设置 XRAY_BIN，远端 3X-UI 自带 Xray 不满足这个条件。

## 数据与备份

- SQLite 位于 DATA_DIR/prism.db，并可能有 WAL/SHM 文件。
- 镜像缓存也位于 DATA_DIR，不能作为唯一备份。
- 运行中的 WAL 数据库不能简单当单文件复制。使用在线备份或在确认停服后做一致性备份，并测试恢复。
- 当前界面备份入口仍需完善并发与恢复验证，不应作为唯一恢复手段。
- .env、数据库、日志和实际订阅不得进入 Git；备份需独立存储并限制读取。

## 发布工作流

现有 .github/workflows/deploy.yml 在推送 main 或手动触发时运行，通过 SSH 执行远端脚本。自己的部署需要 VPS_HOST、VPS_USER、VPS_SSH_PRIVATE_KEY，以及可选 VPS_PORT。远端目录、Node 版本、进程名必须按自己的环境调整。

目前部署流程尚未绑定 CI 成功与精确提交，也没有完整自动回滚。Fork 后先阅读、调整工作流，再配置生产 Secrets。开源发布和生产部署应分别安排。

/local/version 返回进程启动时提交标识；还应验证登录、只读 API、订阅解析和代理连接，不能仅凭首页 HTTP 200 判断业务可用。
