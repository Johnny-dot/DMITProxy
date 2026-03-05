# 大变更拆分执行手册

## 方案一（推荐）：`reset --mixed` + `git add -p` 分片提交

适用场景：当前分支是一个“大工作区改动”，尚未切成小提交。

```bash
# 1) 先做安全快照分支
git switch -c codex/split-snapshot-20260305
git add -A
git commit -m "chore(wip): snapshot before split"

# 2) 回到“未暂存状态”，开始分片
git reset --mixed HEAD~1

# 3) 按 PR 主题分片暂存并提交（示例：先治理，再机械，再功能）
git add .github package.json package-lock.json eslint.config.mjs .husky .lintstagedrc.cjs .prettierrc.json
git commit -m "chore(guardrails): add CI, pre-commit, lint boundaries and codeowners"

git add -p .gitignore .gitattributes .editorconfig docs
git commit -m "chore(repo): reduce noise and document split strategy"

# 4) 后续继续按功能域重复 add -p + commit
git add -p server src/api
git commit -m "feat(server): add local admin proxy api"

git add -p src/context src/pages/Login.tsx src/pages/user
git commit -m "feat(auth): add portal auth flow"
```

关键技巧：

- 先 `git add -N <file>`，再 `git add -p <file>`，可按 hunk 精准切片。
- 出现“同文件里既有重构又有功能”时，用 `git add -p` 的 `s`（split）拆块提交。
- 每个 commit 对应一个 PR 主题，避免一个 commit 同时包含机械和功能改动。

## 方案二：`rebase -i` 重写历史

适用场景：当前分支已经有很多混杂 commit。

```bash
git fetch origin
git rebase -i origin/main
```

在交互列表中：

- 用 `reword` 统一语义化提交信息；
- 用 `edit` 停下来执行 `git reset HEAD^` + `git add -p` 重新拆片；
- 用 `squash/fixup` 合并同类小修补提交；
- 完成后 `git push --force-with-lease`。

## 如何避免格式化噪音

1. 只格式化当前改动文件，不做全仓格式化：

```bash
npx prettier --write <changed-files>
```

2. pre-commit 仅处理 staged 文件（本仓库已配置 `lint-staged`）。

3. 纯格式化提交单独成 PR（可选），并把提交 SHA 加入 `.git-blame-ignore-revs`。

4. 避免混入行尾差异：

- 已配置 `.gitattributes` 与 `.editorconfig`；
- 不在功能 PR 中做 EOL 大规模重写。

5. Review 时优先用：

```bash
git diff --word-diff
git diff -w
```

## PR 提交建议（便于审阅）

- 标题格式：`type(scope): summary`
- 描述固定三段：`为什么改` / `改了什么` / `如何验证`
- 如果是行为改动，附：
  - 自动化测试命令；
  - 或最小可复现手工验证步骤。
