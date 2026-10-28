# qtui 与上游库跟踪（Upstream Tracker）

> 长期维护：每次与上游交互（提交 issue/PR、合并上游、政策变化）后更新本文。
> 相关背景见 `KB/architecture.md`（维护策略）与 `KB/history.md`（问题处理历史）。

## 基本信息

| 项目 | 值 |
|---|---|
| 上游仓库 | https://github.com/anomalyco/opencode （remote `upstream`） |
| 本仓库（fork） | https://github.com/joe-ieta/opencode （remote `origin`） |
| 跟踪分支 | `qt-headless` |
| 同步工具 | `bun run qtoc:sync`（见 `../ops/qtoc-build.md` 第 4 节） |
| 上游同步源 | `upstream/v1`（V1 维护线，1.19.x）；`upstream/dev` 于 2026-10-10 晋升 V2/2.x（无 `packages/opencode`），本线不同步 |
| 当前内核版本 | `1.19.5`（channel `qt-headless`；上游 2026-10-29 同步） |

## 上游政策备忘

- **Issue-first**：所有 PR 必须关联已有 issue（描述中写 `Closes #<n>`），否则 `check-standards` 机器人要求补充，**2 小时内未处理自动关闭**。
- **PR 模板**：`.github/pull_request_template.md` 要求包含 Issue 关联、变更类型、做了什么、如何验证、截图、Checklist；避免粘贴大段 AI 生成描述。
- **机器人检查**：`check-standards`、`check-compliance`、`check-duplicates`、`add-contributor-label`。
- 首次贡献者的 `test` / `typecheck` 工作流可能需要维护者批准后才运行。
- `mergeStateStatus: BLOCKED` 且无 reviewDecision 属于"等待维护者 review"的正常状态。
- **分支策略（2026-10-10 起）**：`dev`/`production` 已晋升 V2（2.x，包结构重构，无 `packages/opencode`）；V1 线由 `v1` 分支维护（1.19.x）。本发行线同步源切换为 `upstream/v1`；V2 适配与补丁迁移由其他线程推进（见「本地 delta」）。

## 我方 Issues

| Issue | 标题 | 状态 | 关联 PR | 备注 |
|---|---|---|---|---|
| [#49685](https://github.com/anomalyco/opencode/issues/49685) | Compiled builds crash on first prompt: undefined layer node from filesystem search import cycle | **CLOSED**（2026-09-21，由上游 #50439 修复） | #49683 | 编译版崩溃根因（KB-001），已上游化 |
| [#49686](https://github.com/anomalyco/opencode/issues/49686) | LayerNode graph should fail with a named error when a dependency is undefined | **OPEN** | **#54467（V2）** | 诊断性改进（KB-001 的定位手段）；V1 PR #49684 被政策关闭后改向 V2 移植；同类 #48819 一并覆盖 |
| [#54129](https://github.com/anomalyco/opencode/issues/54129) | Auto-compaction recovery still publishes session.error, so clients show a model error instead of the compaction notice | **CLOSED**（2026-10-10，not planned：V1 政策） | #54131 | 桌面端误报模型错误；修复已本地化（`81f5b2cdef`，随 1.18.35.2 发布）；V2 语义已符合预期（仅摘要溢出时报错） |

## 我方 PRs

| PR | 分支 | 标题 | 状态 | 检查 | 备注 |
|---|---|---|---|---|---|
| [#49683](https://github.com/anomalyco/opencode/pull/49683) | `filesystem-search-cycle` | fix(core): break filesystem search import cycle | **CLOSED**（2026-10-11，V1 政策；修复已随上游 #50439 进入 V1） | 合规检查通过 | 本地补丁已移除（2026-09-22） |
| [#49684](https://github.com/anomalyco/opencode/pull/49684) | `layer-node-validation` | fix(core): validate layer node dependencies | **CLOSED**（2026-10-11，V1 政策，要求移植 V2） | 合规检查通过；含单测 | 已由 #54467（V2）取代 |
| [#54131](https://github.com/anomalyco/opencode/pull/54131) | `overflow-compaction-notice` | fix(opencode): stop flagging auto-compaction recovery as a session error | **CLOSED**（2026-10-09，V1 政策 `v1_not_accepted`） | 4 项机器人检查全部通过 | 修复已本地化 `81f5b2cdef`（随 1.18.35.2 发布）；V2 已具备预期语义 |
| [#54467](https://github.com/anomalyco/opencode/pull/54467) | `validate-layer-node` | fix(util): validate layer node dependencies | **OPEN**（BLOCKED＝待 review） | 4 项机器人检查通过 | V2 移植（`packages/util/src/effect/layer-node.ts` + 单测）；`Closes #49686`；本地 25 pass / typecheck 干净；如需修改在 V2 worktree 追加提交 |

上游代提交（我方修复）：
| PR | 作者 | 标题 | 状态 | 备注 |
|---|---|---|---|---|
| [#50439](https://github.com/anomalyco/opencode/pull/50439) | `rekram1-node`（署名含 `frank`） | fix(core): break filesystem search import cycle | **MERGED**（2026-09-21） | 内容与我方 #49683 完全一致（同一 blob），已随上游进入 1.18.32 |

状态取值：`OPEN` / `CHANGES_REQUESTED` / `MERGED` / `CLOSED`；`BLOCKED` 表示等待维护者 review。

## 上游合并记录（同步历史）

| 日期 | 上游 ref | 提交范围 | 结果 |
|---|---|---|---|
| 2026-09-17 | `upstream/dev` | `88c6c7abc..b02acc1e30`（2 个提交） | `qtoc:sync` 自动解决 3 个删除冲突；trim 0 变更；typecheck 18/18；构建与冒烟通过 |
| 2026-09-18 | `upstream/dev` | 已是最新（无新提交） | `qtoc:sync` 无冲突；trim 0 变更；typecheck 18/18 |
| 2026-09-18 | `upstream/dev` | `b02acc1e30..3dd1b30539`（3 个提交） | `qtoc:sync` 自动解决 59 个删除冲突；trim 0 变更；typecheck 18/18；`openapi.json`/`types.gen.ts` 无变化（188 端点基线不变） |
| 2026-09-20 | `upstream/dev` | `3dd1b30539..ebb7b76eca`（18 个提交） | `qtoc:sync` 自动解决 32 个删除冲突；trim 移除 packages/web、packages/console 的上游新增文件（2 处）；typecheck 18/18；协议无变化（188 端点） |
| 2026-09-20 | `upstream/dev` | `ebb7b76eca..70a24697ea`（10 个提交） | `qtoc:sync` 自动解决 25 个删除冲突；`bun.lock` 手动冲突（取上游版本后 `bun install` 重建）；trim 0 变更；typecheck 18/18；协议无变化（188 端点） |
| 2026-09-22 | `upstream/dev` | `70a24697ea..fe3f3a41f7`（6 个提交，含上游 #50439 = 我方 #49683） | `qtoc:sync` 自动解决 57 个删除冲突；`bun.lock` 手动冲突（取上游后 `bun install` 重建）；trim 0 变更；typecheck 18/18；`search.ts` 本地补丁移除（与上游一致）；版本同步至 `1.18.32`；构建 `qtoc_core-1.18.32-windows-x64.exe` 并冒烟通过 |
| 2026-09-23 | `upstream/dev` | `fe3f3a41f7..18ef3cc7c5`（7 个提交） | `qtoc:sync` 自动解决 25 个删除冲突；`bun.lock` 手动冲突（取上游后 `bun install` 重建）；trim 0 变更；typecheck 18/18；协议无变化（188 端点） |
| 2026-09-24 | `upstream/dev` | `18ef3cc7c5..0f549842ee`（9 个提交） | `qtoc:sync` 自动解决 64 个删除冲突；`bun.lock` 手动冲突（取上游后 `bun install` 重建并提交 `b2945b2a45`）；trim 0 变更；typecheck 18/18；协议无变化（188 端点） |
| 2026-09-26 | `upstream/dev` | `18ef3cc7c5..a42f393c85`（9 个提交） | `qtoc:sync` 自动解决 62 个删除冲突；`bun.lock` 手动冲突（取上游后 `bun install` 重建）；trim 清理 1 处上游新增 `packages/stats` 残留文件；typecheck 18/18；协议无变化（188 端点） |
| 2026-09-27 | `upstream/dev` | `a42f393c85..b471c2b449`（1 个提交） | `qtoc:sync` 无冲突；trim 0 变更；typecheck 18/18；协议无变化（188 端点） |
| 2026-10-06 | `upstream/dev` | `b471c2b449..4ac0d9c3d1`（58 个提交） | `qtoc:sync` 自动解决 133 个删除冲突；手动冲突 2 个：`.gitignore`（采用上游 `/artifacts/`，收敛本地 delta）、`bun.lock`（取上游后 `bun install` 重建）；trim 清理 console/stats 上游新增文件（19 个）；typecheck 18/18；协议无变化（188 端点）；版本同步至 `1.18.34` |
| 2026-10-07 | `upstream/dev` | `4ac0d9c3d1..ecc4916b5a`（6 个提交） | `qtoc:sync` 自动解决 37 个删除冲突；手动冲突 `bun.lock`（取上游后 `bun install` 重建并提交 `6250d63db6`）；trim 0 变更；typecheck 18/18；协议无变化（188 端点）；版本同步至 `1.18.35` |
| 2026-10-09 | `upstream/dev` | `ecc4916b5a..388406238b`（15 个提交） | `qtoc:sync` 自动解决 66 个删除冲突；无手动冲突；trim 清理 `packages/console` 残留 1 文件（提交 `7dca58eab6`）；typecheck 18/18；协议无变化（188 端点）；版本保持 `1.18.35`；本地修复可恢复上下文溢出误报 session error（提交 `81f5b2cdef`，已上游化 PR #54131） |
| 2026-10-11 | `upstream/v1` | `388406238b..dfb56f76c7`（10 个提交） | **同步源切换**：上游 `dev`/`production` 于 2026-10-10 晋升 V2（2.0.26，无 `packages/opencode`），本线改跟随 `upstream/v1`；`qtoc:sync --branch v1` 自动解决 23 个删除冲突；`bun.lock` 手动冲突（取上游后 `bun install` 重建并提交 `6e8c1c4618`）；trim 0 变更；typecheck 18/18；协议 1 行描述文本变化（`autoupdate` 文案）；版本同步至 `1.19.0`；`qtoc:sync` 默认分支与流程文档同步切换（提交 `4816da8244`） |
| 2026-10-18 | `upstream/v1` | `dfb56f76c7..a1f604bbe0`（9 个提交） | `qtoc:sync` 自动解决 38 个删除冲突；`bun.lock` 手动冲突（取上游后 `bun install` 重建并提交 `ad5666f7da`）；trim 0 变更；typecheck 18/18；协议 162 端点不变，新增字段 `reasoning_options`（模型变体）；版本同步至 `1.19.3` |
| 2026-10-29 | `upstream/v1` | `a1f604bbe0..006d837c50`（16 个提交） | `qtoc:sync` 自动解决 28 个删除冲突；`bun.lock` 手动冲突（取上游后 `bun install` 重建并提交 `b01b5e5053`）；trim 0 变更；typecheck 18/18；Bun 升级至 1.4.4；版本同步至 `1.19.5` |

## 发布记录

| 版本标签 | 内容 | 冒烟结果 |
|---|---|---|
| `qt-headless-v1.18.31.4` | `qtoc:sync` 自动化、架构 KB、上游合并 | 构建 smoke 通过 |
| `qt-headless-v1.18.31.5` | 上游同步（已最新）+ 重新构建 | `--version` 1.18.31；`/global/health` 正常；tool ids 含 `question`；SSE `server.connected`；真实 DeepSeek 回复完成（`finish: stop`）；无 ERROR |
| `qt-headless-v1.18.31.6` | 上游同步 `b02acc1e30..3dd1b30539` + 文档重组（docs 索引 / qtoc HTTP API 参考 / KB 上游跟踪）；Bun 1.4.2 本地构建；标签指向 `616a6c0b03` | `--version` 1.18.31；`/global/health` 正常；tool ids 含 `question`；SSE `server.connected`；CI 三平台（Windows/Linux/macOS）构建通过（Linux smoke 首次 runner 偶发挂起，重跑通过） |
| `qt-headless-v1.18.32.1` | 上游同步 `70a24697ea..fe3f3a41f7`（6 个提交，含 #50439 上游化 `search.ts`，本地补丁移除）+ 文档基线更新至 1.18.32；标签指向 `3a5adb45cc` | `--version` 1.18.32；构建内建 smoke 通过；`/global/health` 正常；tool ids 含 `question`；监听行正常 |
| `qt-headless-v1.18.32.2` | **双核架构设计结点**：双引擎底座架构 v1（`integration/dual-engine-architecture.md`）+ Text-to-SQL 能力包设计（`capabilities/text2sql.md`，验证 Demo）+ 文档索引更新；标签指向 `d30bcdf233`（纯文档，无二进制变更） | 文档评审通过（设计里程碑） |
| `qt-headless-v1.18.32.3` | 上游同步 `fe3f3a41f7..18ef3cc7c5`（7 个提交）+ 1.18.32 构建与冒烟；标签指向 `218bcad093`；推送标签触发 CI 矩阵（Linux/Windows/macOS）构建与产物上传 | `--version` 1.18.32；构建内建 smoke 通过；`/global/health` 正常；tool ids 含 `question`；监听行正常；stderr 空；CI 三平台构建通过并上传产物（Linux smoke 首跑偶发挂起，重跑通过；`qtoc_core-Linux/macOS/Windows`） |
| `qt-headless-v1.18.32.4` | 上游同步 `18ef3cc7c5..0f549842ee`（9 个提交）+ 裁剪版 `bun.lock` 重建；标签指向 `b2945b2a45`；推送标签触发 CI 矩阵（Linux/Windows/macOS）构建与产物上传 | `--version` 1.18.32；构建内建 smoke 通过；`/global/health` 正常；tool ids 含 `question`；SSE `server.connected`；stderr 空；CI 三平台构建通过并上传产物（Linux smoke 首跑偶发挂起，重跑通过） |
| `qt-headless-v1.18.32.5` | 上游同步 `18ef3cc7c5..a42f393c85`（9 个提交）+ trim/lockfile 重建；标签指向 `e3060c9f1b`；推送标签触发 CI 矩阵（Linux/Windows/macOS）构建与产物上传 | `--version` 1.18.32；构建内建 smoke 通过；`/global/health` 正常；tool ids 含 `question`；SSE `server.connected`；stderr 空；CI `.5` 运行三平台构建通过并上传产物（同提交主标签重复运行 Linux smoke 连发 3 次偶发挂起，Windows/macOS 正常；冒烟步骤已加固） |
| `qt-headless-v1.18.32.6` | 上游同步 `a42f393c85..b471c2b449`（1 个提交）+ 1.18.32 构建与冒烟；标签指向 `4a45554d05`；推送标签触发 CI 矩阵（Linux/Windows/macOS）构建与产物上传 | `--version` 1.18.32；构建内建 smoke 通过；`/global/health` 正常；tool ids 含 `question`；监听行正常；stderr 空；CI 三平台**一次通过**并上传产物（`qtoc_core-Linux` 89.5 MB / `macOS` 68.9 MB / `Windows` 96.5 MB） |
| `qt-headless-v1.18.34.1` | 首个 1.18.34 发布（上游同步 `b471c2b449..4ac0d9c3d1`（58 个提交）+ trim/lockfile 重建）；标签指向 `5222a954fc` | **CI 失败（未采用）**：上游新增 macOS ad-hoc `codesign` 引用 `bin/opencode`，与 `qtoc_core` 产物名冲突，macOS 构建报 `No such file or directory`；Windows/Linux 构建通过 |
| `qt-headless-v1.18.34.2` | 修复 macOS codesign（`build.ts` 签名路径改为 `qtoc_core`；`trim.ts` 增加替换模式 + `bin/opencode` 残留守卫防再漂移）；标签指向 `66112673f9` | `--version` 1.18.34；CI `.2` 与主标签两次运行**三平台一次全通过**并上传产物（Linux 1m35s/1m10s、Windows 2m32s/2m36s、macOS 25m21s/27m44s）；本地构建 119.5 MB + health/question/SSE/stderr 空 |
| `qt-headless-v1.18.35.1` | 首个 1.18.35 发布（上游同步 `4ac0d9c3d1..ecc4916b5a`（6 个提交）+ trim/lockfile 重建）；标签指向 `6250d63db6` | `--version` 1.18.35；CI `.1` 与主标签两次运行三平台通过并上传产物（主标签 Linux 1m31s / Windows 2m26s / macOS 19m33s；`.1` Windows 首跑 Setup Bun `TypeError: fetch failed` 基础设施偶发，重跑通过）；本地构建 119.5 MB + health/question/SSE/stderr 空 |
| `qt-headless-v1.18.35.2` | 上游同步 `ecc4916b5a..388406238b`（15 个提交）+ 修复可恢复上下文溢出被误报为 session error（上游 PR #54131）；标签指向 `81f5b2cdef` | `--version` 1.18.35；构建内建 smoke 通过；`/global/health` 正常；tool ids 含 `question`；SSE `server.connected`；stderr 空；CI `.2` 与主标签两次运行**三平台全通过**并上传产物（`.2`：Linux 1m30s / Windows 2m38s / macOS 14m10s；主标签：Linux 1m5s / Windows 2m37s / macOS 23m51s；产物 Linux 89.7 MB / macOS 68.1 MB / Windows 96.8 MB） |
| `qt-headless-v1.19.0.1` | 首个 1.19.0 发布（上游 `upstream/v1` 同步 `388406238b..dfb56f76c7`（10 个提交）+ trim/lockfile 重建 + 同步源切换 v1）；标签指向 `4816da8244` | `--version` 1.19.0；构建内建 smoke 通过；`/global/health` 正常；tool ids 含 `question`；SSE `server.connected`；stderr 空；CI `.1` 与主标签两次运行**三平台一次全通过**并上传产物（`.1`：Linux 1m26s / Windows 3m30s / macOS 5m44s；主标签：Linux 1m23s / Windows 3m7s / macOS 17m52s）；本地构建 119.6 MB |
| `qt-headless-v1.19.3.1` | 首个 1.19.3 发布（上游 `upstream/v1` 同步 `dfb56f76c7..a1f604bbe0`（9 个提交）+ trim/lockfile 重建）；标签指向 `ad5666f7da` | `--version` 1.19.3；构建内建 smoke 通过；`/global/health` 正常；tool ids 含 `question`；SSE `server.connected`；stderr 空；本地构建 120.3 MB；CI **待补**：仓库 GitHub Actions 被禁用（标签推送/手动 dispatch 均 HTTP 422），恢复后补跑 |
| `qt-headless-v1.19.5.1` | 首个 1.19.5 发布（上游 `upstream/v1` 同步 `a1f604bbe0..006d837c50`（16 个提交）+ trim/lockfile 重建 + Bun 1.4.4）；标签指向本次记录提交 | `--version` 1.19.5；构建内建 smoke 通过；`/global/health` 返回 `{"healthy":true,"version":"1.19.5"}`；tool ids 含 `question`（冷启动约 50s）；SSE `server.connected`；stderr 空；本地构建 155.5 MB；CI **待补**：仓库 GitHub Actions 仍被禁用（dispatch HTTP 422），恢复后补跑 |

## 本地 delta 与上游化状态

| 本地改动 | 类型 | 上游化状态 | 上游合并后的动作 |
|---|---|---|---|
| `packages/core/src/filesystem/search.ts` | 可上游化（bug fix） | **已上游化**（上游 #50439，2026-09-21 合并；内容与 #49683 一致） | 本地补丁已移除（2026-09-22），与上游一致 |
| `packages/core/src/effect/layer-node.ts`（`validateNodes`，`9f3419b9da` 引入） | 可上游化（诊断） | V1 线不再接受（#49684 被政策关闭）；已移植 V2：**PR #54467（OPEN）** | 本地补丁保留（qt-headless 走 V1 线，V2 合并不回灌；若未来切 V2 线再对齐） |
| `packages/opencode/script/build.ts`（`QTOC_MINIFY` / `qtoc_core` 产物名 / headless 默认 / macOS codesign 路径） | 发行定制 | 不上游 | 保留，由 `trim` 维护（2026-10-06 适配上游新增的 macOS ad-hoc 签名，trim 增加残留守卫） |
| `packages/opencode/src/index.ts`（命令注销） | 裁剪 | 不上游 | 由 `trim` 维护 |
| `package.json` / `turbo.json` / `test.yml` / workspaces | 裁剪配置 | 不上游 | 由 `trim` 维护 |

## 待办清单（长期）

- [x] #49683：上游 #50439 已进入 V1；我方 PR 已关闭（2026-10-11）；本地 `search.ts` 补丁已移除（2026-09-22）
- [ ] 跟进 V2 PR #54467（`validate-layer-node`，base `dev`）：review/合并；如需修改，在本地 V2 worktree（临时目录 `opencode-v2`）追加提交
- [ ] #54467 合并后：确认 #49686、#48819 关闭；清理 V2 worktree（`git worktree remove`；如需后续 V2 移植可保留）
- [ ] V1 维护线策略：同步固定 `upstream/v1`；V1 仅提 critical 修复，其余问题在 V2 处理
- [ ] 1.19.0 收尾：补记 2026-10-11 V1 同步到「上游合并记录」（`388406238b..dfb56f76c7`），按发布规范决定是否发行并更新「发布记录」
- [ ] 若上游提供官方打包/版本注入方案，评估替换本地 `build.ts` 定制
- [ ] 每次同步后更新「上游合并记录」与「本地 delta」表
- [ ] 关注上游 V2 API / 事件协议变化（客户端适配层；V2 已上 dev，长期迁移另行立项）
- [ ] 评估阶段 4：使用 npm 发布二进制 + 纯 Qt 客户端的可行性（见 `KB/architecture.md`）

## 监控命令

```bash
# PR / Issue 状态
gh pr view 54467 --repo anomalyco/opencode --json state,mergeStateStatus,reviewDecision
gh pr checks 54467 --repo anomalyco/opencode
gh issue view 49686 --repo anomalyco/opencode --json state
gh issue view 48819 --repo anomalyco/opencode --json state

# 上游新提交（同步源：V1 维护线）
git fetch upstream v1 && git log --oneline qt-headless..upstream/v1

# 同步
bun run qtoc:sync
```

## 新增记录模板

| 日期 | 类型 | 链接 | 标题 | 状态 | 备注 |
|---|---|---|---|---|---|
| YYYY-MM-DD | issue / PR / merge | URL | … | … | … |
