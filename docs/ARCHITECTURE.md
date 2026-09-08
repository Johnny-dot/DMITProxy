# 架构与运行流程

Prism 为单机 Web 应用。React 负责页面，Express 提供本地 API、上游代理和订阅输出，SQLite 保存本地业务状态。

```mermaid
flowchart LR
    B[浏览器 React] --> P[Prism Express]
    P -->|用户 / 邀请 / 会话 / 设置| DB[(SQLite)]
    P -->|管理员 Cookie 或服务账号| X[独立 3X-UI 面板]
    C[订阅客户端] -->|subId| P
    P -->|通用 / Clash / sing-box| C
    P -->|可选 Surge 转换| S[本地 subconverter]
    N[NIC 同步代理] -->|Bearer token| P
    P -->|可选节点探测| R[本地临时 Xray]
    R --> O[真实代理节点]
```

## 身份与数据

| 身份/数据      | 位置                            | 说明                         |
| -------------- | ------------------------------- | ---------------------------- |
| 管理员会话     | 浏览器 3X-UI Cookie + 上游      | 不使用本地管理员密码         |
| 普通用户       | SQLite users                    | 邀请注册，密码 scrypt+盐     |
| 用户会话       | 浏览器 pd_session + SQLite 哈希 | 过期或密码重置后失效         |
| 邀请/重置链接  | SQLite                          | 重置令牌哈希保存，管理员签发 |
| 客户端与流量   | 3X-UI                           | 本地用户通过 subId 关联      |
| 设置/公告/资源 | SQLite app_settings             | 管理员修改                   |
| DMIT 快照      | SQLite dmit_traffic             | 与应用层统计区分来源         |

## 用户注册

```mermaid
sequenceDiagram
    participant U as 用户
    participant P as Prism
    participant D as SQLite
    participant X as 3X-UI
    U->>P: 用户名、密码、邀请码
    P->>D: 事务内创建用户并消费邀请码
    opt 开启自动创建
        P->>X: 创建客户端
        X-->>P: subId
        P->>D: 绑定 subId
    end
    P-->>U: 注册结果
    U->>P: 登录进入用户门户
```

普通异常有回滚逻辑。跨进程中断和“上游成功、响应丢失”的恢复仍需持久化对账。

## 演示环境

scripts/demo/runtime.ts 不调用生产入口，不加载 .env。先启动本地模拟 3X-UI，再为真实 Express app 设置独立 DATA_DIR，最后创建回环 Vite 前端。演示操作只影响临时数据。

模拟状态在页面上明确标注。节点使用 example.invalid 和文档地址；外部探测、镜像下载、DMIT 写入与需边车的转换在入口处拦截。演示不是代理服务。

## 分层

- src/types：共享类型。
- src/api、src/utils：接口适配与前端业务函数。
- src/pages、src/components、src/context：页面、交互、主题与身份状态。
- server：路由、存储、订阅和上游通信。
- scripts/demo：独立演示和浏览器验证，生产入口不导入。

## 已实现的可靠性保护

上游 HTTP 共用限时传输层，覆盖完整响应体、重定向、大小限制和客户端中断。只读服务请求在明确认证失效后重新登录并重试一次；缓存按容量/TTL 限制，旧的在途统计不能覆盖写操作后的新结果。

账期任务保存在 SQLite，记录周期、已确认阶段、次数、错误与下次重试时间。明确失败采用 1–15 分钟退避；网络结果不明的写入停止自动重试。在线备份校验后才返回成功。

发布链为 main push → CI 成功 → 同一 SHA 部署。安装和构建先在临时目录完成，再切换应用；失败恢复上一份应用，不自动回退运行数据库。详见 [RELIABILITY.md](RELIABILITY.md)。

## 后续改进

本轮完成 UI 层次整理、演示隔离、浏览器基础回归、订阅默认选择修正、客户端去重、依赖更新和回环默认监听。后续优先处理：

1. 扩展请求 schema、审计日志与管理员任务状态界面。
2. 增加异地备份、保留策略和灾难恢复演练。
3. 拆分大型页面，提高组件及错误状态覆盖。
4. 扩展代理内核、物理设备和真实网络兼容性记录。
5. 对 NIC 代理、镜像下载和大规模数据量进行专项验证。

网站运行、模拟测试、真实出口探测和生产部署是不同证据范围，发布记录应分别报告。
