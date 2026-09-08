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

片段不含 TLS server 块、证书签发和防火墙，需按主机配置。应用默认仅信任回环代理的转发头；多级代理/CDN 应通过 TRUST_PROXY 配置准确的受信地址，并检查反向代理对来路头的处理。不要直接开放应用端口。生产 HTTPS 保持 COOKIE_SECURE=true。

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
- 界面备份入口使用 SQLite 在线备份，在完整性校验后返回成功；本地备份仍需配合异地副本和恢复演练。
- .env、数据库、日志和实际订阅不得进入 Git；备份需独立存储并限制读取。

## 发布工作流

推送 main 后先运行 CI，CI 成功才触发 Deploy。部署使用通过检查的完整 SHA，忽略已被更新 main 取代的 CI 结果；手动部署也要求对应 SHA 已有成功 CI。需要时可先手动运行 CI，再运行 Deploy。

自己的部署需要 VPS_HOST、VPS_USER、VPS_SSH_PRIVATE_KEY，以及可选 VPS_PORT。远端目录、Node 版本、进程名必须按自己的环境调整。脚本要求 Linux、flock、Node/npm、Git 和 PM2，生产 checkout 必须干净。

脚本先在 .git/prism-deploy 下安装锁定依赖、构建并备份数据库。验证成功后才更新 checkout、切换 node_modules/dist、重启目标 Node 应用，并检查版本及可用订阅。它不会自动 stash 或重放生产源码补丁；有本地修改时会中止并保留修改。

安装、构建或备份失败时保持旧应用；切换后的启动或订阅检查失败时恢复上一份代码、依赖与构建，并验证旧版本。运行数据库不自动回退，schema 变更必须向后兼容。上一份运行产物保留在 .git/prism-deploy/previous。意外断电等超出脚本异常处理的情况，仍需人工恢复演练。

自动部署只重启 PM2_NAME 指定的 Node 应用；subconverter 的安装与升级单独执行。重跑已健康运行的同一提交不会再次重启。详细故障验证与账期恢复说明见 [RELIABILITY.md](RELIABILITY.md)。

/local/version 返回进程启动时提交标识；还应验证登录、只读 API、订阅解析和代理连接，不能仅凭首页 HTTP 200 判断业务可用。
