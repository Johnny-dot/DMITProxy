# 模块分层与依赖约束

## 分层定义

| 层级          | 目录映射                                                                                            | 职责                               |
| ------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `domain`      | `src/types/**`                                                                                      | 纯类型与领域模型，不依赖其它业务层 |
| `application` | `src/api/**`, `src/utils/**`                                                                        | 用例编排、接口适配、前端业务工具   |
| `infra`       | `server/**`                                                                                         | 本地服务、存储、路由与外部系统接入 |
| `ui`          | `src/pages/**`, `src/components/**`, `src/context/**`, `src/i18n/**`, `src/App.tsx`, `src/main.tsx` | 视图和交互                         |

## 依赖规则

- `domain` 不可依赖 `application/infra/ui`。
- `application` 不可直接依赖 `infra/ui`。
- `infra` 不可依赖 `ui`。
- `ui` 不可直接依赖 `infra`，必须通过 `application` 调用。

## 代码护栏

分层规则已在 [`eslint.config.mjs`](/E:/desktop/myFiles/DMITProxy/eslint.config.mjs) 中落地，通过 `no-restricted-imports` 在 `npm run lint` 阶段阻断违规依赖。
