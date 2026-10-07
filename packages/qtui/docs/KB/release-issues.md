# qtoc_core 编译发布问题记录（KB）：1.18.31.6 → 1.18.34.2 阶段

> 定位：汇总本阶段（2026-09-18 ~ 2026-10-06，`qt-headless-v1.18.31.6` → `v1.18.34.2`）qtoc_core 编译与发布过程中**实际出现**的问题：现象、根因、处理与预防。
> 用法：与 `../ops/release-runbook.md`（统一发布规范）配套；发布前速览本文可避开全部已知坑。
> 关联文档：`../ops/release-runbook.md`（标准步骤）、`history.md`（早期集成问题 KB-001…）、`upstream.md`（同步与发布记录）、`architecture.md`（维护策略）。

## 摘要

| 编号 | 问题 | 影响阶段 | 状态 |
|---|---|---|---|
| KB-R01 | Bun 版本低于要求，构建直接失败 | 首次本地构建 | 已解决（升级 1.4.2） |
| KB-R02 | `bun.lock` 每轮同步必冲突 | 每轮 `qtoc:sync` | 已惯例化（取上游 + 重建） |
| KB-R03 | `.gitignore` 冲突（上游新增 `/artifacts/`） | 1.18.34 同步 | 已解决（采用上游） |
| KB-R04 | 本机 git 身份缺失，merge/tag 失败 | 每轮发布 | 已惯例化（环境变量） |
| KB-R05 | CI Linux 冒烟偶发挂起 | .6/.5/32.3/34.1 多轮 | 已缓解（工作流加固 + 重跑） |
| KB-R06 | macOS codesign 路径漂移，构建失败 | 1.18.34.1 | 已修复（build.ts + trim 守卫） |
| KB-R07 | 标签推送 GitHub 500 | 1.18.32.4 | 已处理（重试） |
| KB-R08 | 上游新增文件穿过删除（stats/console） | 多次同步 | 已处理（trim 清理） |
| KB-R09 | 失败迭代的发布处理（流程） | 1.18.34.1→.2 | 已惯例化（新迭代 + 记录） |

---

## KB-R01 Bun 版本低于要求，构建直接失败

**现象**

```
error: This script requires bun@^1.3.14, but you are using bun@1.3.11
      at packages/script/src/index.ts:17
```

**根因**：本机 Bun 1.3.11 低于仓库 `packageManager` 声明（`bun@1.3.14`）；`qtoc:build` 脚本仅比较 major/minor（1.3 ≥ 1.3）未拦截，实际在 `packages/script` 的 semver 守卫处失败。

**处理**：`bun upgrade` 自替换报 `EPERM` → 用官方脚本重装指定版本：

```powershell
iex "& {$(irm https://bun.com/install.ps1)} -Version 1.4.2"
bun --version   # 1.4.2（需新终端）
```

**预防**：发布前置检查 Bun ≥ 1.3.14（`release-runbook.md` 第 2 节）。

---

## KB-R02 `bun.lock` 每轮同步必冲突

**现象**：`bun run qtoc:sync` 报 `UU bun.lock` 并中止（非删除类冲突）。

**根因**：上游 lockfile 包含全部包（app/console/stats 等）；本分支裁剪后 workspaces 不同，双方同时改依赖时必然冲突。

**处理**（已惯例化）：

```powershell
git checkout --theirs bun.lock      # 取上游
git add bun.lock
git commit --no-edit                # 完成合并
bun install                         # 重建裁剪版 lockfile
# 提交重建结果：chore(qtui): trim bun.lock after upstream sync <短号>
```

**预防**：视为同步标准步骤；不要尝试人工合并 lockfile 内容。

---

## KB-R03 `.gitignore` 冲突（上游新增 `/artifacts/`）

**现象**：1.18.34 同步时 `UU .gitignore`：本地为 `/artifacts/qtoc/`（窄），上游新增 `/artifacts/`（整目录）。

**根因**：双方在同位置新增规则，形成内容冲突。

**处理**：采用上游 `/artifacts/`（完整覆盖本地条目），收敛本地 delta。

**预防**：热点文件清单见 `release-runbook.md` Step 1 冲突表；原则是"能用上游就用上游"。

---

## KB-R04 本机 git 身份缺失，merge/tag 失败

**现象**：合并提交或创建附注标签报 `Committer identity unknown`（本机无全局 `user.name`/`user.email`）。

**处理**：命令前注入环境变量（与历史提交身份一致）：

```powershell
$env:GIT_AUTHOR_NAME="frank"; $env:GIT_AUTHOR_EMAIL="48937772+joe-ieta@users.noreply.github.com"
$env:GIT_COMMITTER_NAME="frank"; $env:GIT_COMMITTER_EMAIL="48937772+joe-ieta@users.noreply.github.com"
$env:GIT_MERGE_AUTOEDIT="no"   # 防止 merge 打开编辑器阻塞
```

**预防**：写入 `release-runbook.md` 第 2 节与 `qtoc-release` 技能前置检查；勿修改全局 git config。

---

## KB-R05 CI Linux 冒烟偶发挂起

**现象**：`qtoc_core serve` 已输出 `opencode server listening on ...`，但首个 HTTP 请求无响应；旧工作流 curl 无超时，请求挂满步骤 3 分钟，最终报 `Empty reply from server` + 步骤超时。多轮复现（`.6`、`.5` 主标签、`1.18.32.3`、`1.18.34.1`），**同提交的另一运行/其他平台全部通过**。

**根因**：GitHub runner 环境偶发（非构建缺陷）；同提交在别的 runner 上冒烟正常。

**处理**

1. 失败后直接重跑对应任务（`gh run rerun <id> -R joe-ieta/opencode --failed`）；
2. 2026-09-26 加固工作流（提交 `f66d3bc3a7`）：
   - `curl --connect-timeout 2 --max-time 5`（请求有界，不再挂满步骤）；
   - 服务输出重定向 `qtoc-smoke.log`，失败时打印内核日志；
   - 进程存活检查（提前退出立即失败）；
   - 步骤超时 3 → 5 分钟。

**预防**：遇到"已监听但无响应"的特征先重跑，勿改代码；加固后未再复现。

---

## KB-R06 macOS codesign 路径漂移，构建失败

**现象**：`v1.18.34.1` CI macOS 在 **Build** 阶段失败：

```
codesign --force --sign - dist/opencode-darwin-arm64/bin/opencode
dist/opencode-darwin-arm64/bin/opencode: No such file or directory
```

**根因**：本阶段上游 #52183 新增 macOS ad-hoc 签名（`packages/opencode/script/build.ts:209` 引用 `bin/opencode`），而本发行定制产物名为 `bin/qtoc_core`；`trim.ts` 原有替换模式只覆盖 `outfile` 与 `binaryPath`，未覆盖新签名行，漂移未被拦截。

**处理**（提交 `66112673f9`）：

1. `build.ts` 签名路径改为 `dist/${name}/bin/qtoc_core`；
2. `trim.ts` 增加 codesign 替换模式，并新增 `bin/opencode` 残留守卫（存在即 fail-fast，提示更新 trim）；
3. `v1.18.34.2` CI 三平台一次全通过。

**预防**：trim 守卫已兜底；本机非 macOS 时，macOS 构建问题只能通过 CI 暴露，发布后务必核对 macOS 任务日志。

---

## KB-R07 标签推送 GitHub 500

**现象**：推送 `qt-headless-v1.18.32.4` 时 `remote: Internal Server Error` → `! [remote rejected]`。

**处理**：稍后原样重试推送成功（GitHub 瞬时错误）。

**预防**：标签推送失败先判断是否 500/网络类错误，重试即可；勿删除或重建标签。

---

## KB-R08 上游新增文件穿过删除（stats/console）

**现象**：上游在已删除的包（`packages/stats`、`packages/console`）中新增文件，merge 无冲突直接带入工作区（单轮最多 19 个文件，如 `compare-radar.test.ts`、`go-plan-chart.tsx`）。

**根因**：git 对"我在本地删除、上游新添加"的文件不产生 modify/delete 冲突，会直接新增。

**处理**：`bun run qtoc:trim` 会按目录规则清理；清理结果需提交（`chore(qtui): reapply trim and lockfile after upstream sync <短号>`）。

**预防**：同步后必跑 trim 并检查其输出（`qtoc trim: N change(s)`）；trim 对关键模式 fail-fast，模式漂移会显式报错。

---

## KB-R09 失败迭代的发布处理（流程）

**场景**：标签已推送但 CI 失败（如 `v1.18.34.1` 的 macOS codesign）。

**处理原则**（已惯例化）：

1. 迭代标签**不可变**，不删除、不移动失败标签；
2. 修复后创建下一迭代标签（`.1` → `.2`）；
3. 移动主发行线标签（`qt-headless-v<version>`）到最新验证提交（force push）；
4. 在 `upstream.md` 发布记录中标注失败迭代"未采用"及原因。

**预防**：标签推送前完成本地构建 + 冒烟；CI 失败先分类（构建缺陷 vs runner 偶发），构建缺陷走上述流程，runner 偶发直接重跑。

---

## 变更记录

| 日期 | 内容 |
|---|---|
| 2026-10-06 | 首版：汇总 1.18.31.6 → 1.18.34.2 阶段编译发布问题（KB-R01…KB-R09）；随知识库目录更名为 `KB/` 建立 |
