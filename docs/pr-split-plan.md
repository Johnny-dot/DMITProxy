# 需求 N：仓库大变更拆分方案

## 拆分原则

- 每个 PR 只做一件事，类型固定为：`机械改动` / `纯重构` / `功能改动`。
- PR 以“可独立审阅”为约束，避免混入无关格式化和临时调试产物。
- 行为变化必须附带测试或验证脚本。

## 建议 PR 序列（按顺序执行）

| PR    | 类型     | 建议分支                          | 范围                                                                                                               | 验收点                                                       | 回滚策略                                   |
| ----- | -------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------ |
| PR-00 | 机械改动 | `codex/pr-00-governance`          | `.github/workflows/ci.yml`、`eslint.config.mjs`、`.husky/`、`.lintstagedrc.cjs`、`CODEOWNERS`、`docs/`（治理文档） | CI 跑通 `test/lint/typecheck/build`；本地提交触发 pre-commit | 直接 `revert` 整个 PR，不影响业务代码      |
| PR-01 | 机械改动 | `codex/pr-01-repo-hygiene`        | `.gitignore`、`.gitattributes`、`.editorconfig`、删除或忽略 `tmp_*`、`.tmp/`、`data/*.db*`                         | `git status` 干净；不再把临时文件带入 diff                   | `revert` 后重新应用 ignore 规则            |
| PR-02 | 纯重构   | `codex/pr-02-frontend-structure`  | 仅做前端结构迁移（如类型与工具拆分、文件移动、import 路径调整），不改逻辑                                          | 页面行为无变化；`npm run typecheck && npm run build` 通过    | 逐提交回滚，或整 PR 回滚到迁移前结构       |
| PR-03 | 功能改动 | `codex/pr-03-backend-local-api`   | `server/` 与本地 API 相关改动（db、routes、xui admin 封装）                                                        | 后端启动成功；关键接口可用（可用脚本/手测路径）              | 回滚该 PR 后前端仍可在 mock/旧接口模式工作 |
| PR-04 | 功能改动 | `codex/pr-04-auth-and-session`    | `src/context/AuthContext.tsx`、登录/会话相关页面与路由                                                             | 登录、登出、会话失效处理可复现验证                           | 回滚后恢复到无会话或旧会话逻辑             |
| PR-05 | 功能改动 | `codex/pr-05-admin-data-pages`    | 管理端数据页（Dashboard/Inbounds/Nodes/Users/Traffic）与 `src/api/client.ts` 对接                                  | 每个页面“加载/空态/错误态”可验证，关键操作有回归验证         | 按页面子提交回滚，确保不影响其余页面       |
| PR-06 | 功能改动 | `codex/pr-06-user-portal`         | 用户侧页面（UserPortal/Profile/User\*）与订阅链接/客户端下载                                                       | 用户入口路径可用；订阅链接生成符合预期                       | 独立回滚用户侧，不影响管理侧               |
| PR-07 | 功能改动 | `codex/pr-07-settings-i18n-theme` | 设置、通知、主题、国际化相关页面与组件                                                                             | 中英文切换、主题切换、设置保存与读取可验证                   | 回滚后保留基础管理功能                     |

## 每个 PR 的提交说明模板（必须）

- `为什么改`：当前问题、风险或业务目标。
- `改了什么`：文件范围、核心行为变化。
- `如何验证`：命令 + 手工路径（包含预期结果）。

## 变更门禁

- 合并前必须通过：`npm run test`、`npm run lint`、`npm run typecheck`、`npm run build`。
- 关键行为改动必须新增测试，或在 PR 描述附带可复现验证脚本。

## GitHub 合入阻断配置（一次性）

1. 打开仓库 `Settings -> Branches -> Add branch protection rule`，目标分支填 `main`。
2. 勾选 `Require a pull request before merging`。
3. 勾选 `Require status checks to pass before merging`，选择检查项 `CI / verify`。
4. 可选：勾选 `Require branches to be up to date before merging`，避免旧基线误合入。
