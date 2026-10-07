---
name: qtoc-release
description: Use when performing an opencode qtoc_core release on the qt-headless branch (发布 qtoc_core / 新发布 / 同步并发布) — syncing upstream/dev, building the headless binary, tagging qt-headless-v*, monitoring the CI matrix and recording results. Triggers on qtoc:sync, qtoc:build, qt-headless-v* 标签, release runbook.
---

# qtoc_core 发布技能

规范全文（必须遵守）：`packages/qtui/docs/ops/release-runbook.md`。本技能是快速执行路径，冲突处理、记录格式与验收清单以规范为准。

## 前置检查

- 分支 `qt-headless`、工作区干净；`origin`=joe-ieta/opencode（推送目标），`upstream`=anomalyco/opencode（同步来源）。
- Bun ≥ 1.3.14。
- 本机无全局 git 身份，执行合并/附注标签前设置环境变量，否则报 `Committer identity unknown`：

```powershell
$env:GIT_AUTHOR_NAME="frank"; $env:GIT_AUTHOR_EMAIL="48937772+joe-ieta@users.noreply.github.com"
$env:GIT_COMMITTER_NAME="frank"; $env:GIT_COMMITTER_EMAIL="48937772+joe-ieta@users.noreply.github.com"
$env:GIT_MERGE_AUTOEDIT="no"
```

- `gh` 已登录；所有 gh 命令带 `-R joe-ieta/opencode`。

## 执行流程（顺序）

### 1. 拉取

```powershell
git status --short
git fetch --all --prune
git pull --ff-only
git log --oneline HEAD..upstream/dev
```

### 2. 同步上游

```powershell
bun run qtoc:sync
```

- 非删除类冲突会中止并列出文件。`bun.lock`：`git checkout --theirs bun.lock; git add bun.lock; git commit --no-edit`，之后 `bun install` 重建并提交。`.gitignore`：取上游 `/artifacts/`。其余热点（`package.json`/`index.ts`/`build.ts`/`turbo.json`/`test.yml`）人工合并。
- 收尾：`bun run qtoc:trim`（0 变更）→ `bun install` → `bun run typecheck`（18/18）；有变更提交 `chore(qtui): reapply trim and lockfile after upstream sync <短号>`。
- 检查协议：`git diff <上一发布点>..HEAD -- packages/sdk/openapi.json packages/sdk/js/src/v2/gen/types.gen.ts`。

### 3. 构建与本地冒烟

```powershell
bun run qtoc:build --skip-install --skip-typecheck
```

冒烟（Windows；其他平台等价）：

```powershell
$env:OPENCODE_SERVER_PASSWORD="smoke-secret"; $env:OPENCODE_CLIENT="desktop"
Start-Process artifacts\qtoc\qtoc_core.exe -ArgumentList "serve","--hostname","127.0.0.1","--port","4096"
curl.exe -s -u opencode:smoke-secret http://127.0.0.1:4096/global/health          # {"healthy":true,...}
curl.exe -s -u opencode:smoke-secret http://127.0.0.1:4096/experimental/tool/ids # 含 question
curl.exe -N --max-time 3 -u opencode:smoke-secret http://127.0.0.1:4096/event     # server.connected
```

验收：`--version` 正确、health 正常、含 `question`、SSE 有 `server.connected`、stderr 空；结束后 `Stop-Process`。

### 4. 推送与打标签

```powershell
git push origin qt-headless
```

- 版本未变（迭代）：新建 `qt-headless-v<version>.<N+1>`，并 `git tag -f -a qt-headless-v<version>` 移动发行线标签；两个都推送（`git push origin <新标签>`；`git push -f origin <发行线标签>`）。
- 版本变化（新发行线）：新建 `qt-headless-v<新版本>` 与 `qt-headless-v<新版本>.1`，均普通推送；旧发行线保留。
- 推送标签即触发 CI；GitHub 偶发 500 时重试。迭代标签不可变，修复发新 `.N`。

### 5. 监控 CI

```powershell
gh run list -R joe-ieta/opencode --workflow=qtoc.yml --limit 5
gh run watch <id> -R joe-ieta/opencode --exit-status --interval 30
gh run rerun <id> -R joe-ieta/opencode --failed
```

- 通过标准：三平台构建成功且产物上传、Linux 冒烟通过。
- Linux 冒烟偶发挂起（runner 环境），重跑即可；同提交其他运行通过即判定偶发。

### 6. 记录（发布的一部分，必须完成）

- `packages/qtui/docs/KG/upstream.md`：追加「上游合并记录」与「发布记录」行（含失败迭代"未采用"）。
- `packages/qtui/docs/ops/qtoc-build.md`：标签表追加；新问题补「已知问题与修复」。

```powershell
git add packages/qtui/docs/KG/upstream.md packages/qtui/docs/ops/qtoc-build.md
git commit -m "docs(qtui): record <version> sync and release results"
git push origin qt-headless
```

### 7. 完成标准

- CI 三平台全绿、产物可下载；记录已提交；工作区干净；发行线标签指向最新验证提交。

## 关键约束

- 不交叉编译：发布产物一律 CI 矩阵原生构建；本机构建只产出当前平台。
- 领域能力不参与编译：单一二进制 + 运行期配置（见 `packages/qtui/docs/KG/data-agent-faq.md`）。
- 记录与验收清单以 `release-runbook.md` 第 8/9 节为准。
