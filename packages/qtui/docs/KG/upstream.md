# qtui 与上游库跟踪（Upstream Tracker）

> 长期维护：每次与上游交互（提交 issue/PR、合并上游、政策变化）后更新本文。
> 相关背景见 `KG/architecture.md`（维护策略）与 `KG/history.md`（问题处理历史）。

## 基本信息

| 项目 | 值 |
|---|---|
| 上游仓库 | https://github.com/anomalyco/opencode （remote `upstream`，默认分支 `dev`） |
| 本仓库（fork） | https://github.com/joe-ieta/opencode （remote `origin`） |
| 跟踪分支 | `qt-headless` |
| 同步工具 | `bun run qtoc:sync`（见 `../ops/qtoc-build.md` 第 4 节） |
| 当前内核版本 | `1.18.31`（channel `qt-headless`） |

## 上游政策备忘

- **Issue-first**：所有 PR 必须关联已有 issue（描述中写 `Closes #<n>`），否则 `check-standards` 机器人要求补充，**2 小时内未处理自动关闭**。
- **PR 模板**：`.github/pull_request_template.md` 要求包含 Issue 关联、变更类型、做了什么、如何验证、截图、Checklist；避免粘贴大段 AI 生成描述。
- **机器人检查**：`check-standards`、`check-compliance`、`check-duplicates`、`add-contributor-label`。
- 首次贡献者的 `test` / `typecheck` 工作流可能需要维护者批准后才运行。
- `mergeStateStatus: BLOCKED` 且无 reviewDecision 属于"等待维护者 review"的正常状态。

## 我方 Issues

| Issue | 标题 | 状态 | 关联 PR | 备注 |
|---|---|---|---|---|
| [#49685](https://github.com/anomalyco/opencode/issues/49685) | Compiled builds crash on first prompt: undefined layer node from filesystem search import cycle | OPEN | #49683 | 编译版崩溃根因（KG-001） |
| [#49686](https://github.com/anomalyco/opencode/issues/49686) | LayerNode graph should fail with a named error when a dependency is undefined | OPEN | #49684 | 诊断性改进（KG-001 的定位手段） |

## 我方 PRs

| PR | 分支 | 标题 | 状态 | 检查 | 备注 |
|---|---|---|---|---|---|
| [#49683](https://github.com/anomalyco/opencode/pull/49683) | `filesystem-search-cycle` | fix(core): break filesystem search import cycle | OPEN（BLOCKED，待 review） | 合规检查通过 | 上游合并后删除本地补丁 |
| [#49684](https://github.com/anomalyco/opencode/pull/49684) | `layer-node-validation` | fix(core): validate layer node dependencies | OPEN（BLOCKED，待 review） | 合规检查通过；含单测 | 上游合并后删除本地补丁 |

状态取值：`OPEN` / `CHANGES_REQUESTED` / `MERGED` / `CLOSED`；`BLOCKED` 表示等待维护者 review。

## 上游合并记录（同步历史）

| 日期 | 上游 ref | 提交范围 | 结果 |
|---|---|---|---|
| 2026-09-17 | `upstream/dev` | `88c6c7abc..b02acc1e30`（2 个提交） | `qtoc:sync` 自动解决 3 个删除冲突；trim 0 变更；typecheck 18/18；构建与冒烟通过 |
| 2026-09-18 | `upstream/dev` | 已是最新（无新提交） | `qtoc:sync` 无冲突；trim 0 变更；typecheck 18/18 |
| 2026-09-18 | `upstream/dev` | `b02acc1e30..3dd1b30539`（3 个提交） | `qtoc:sync` 自动解决 59 个删除冲突；trim 0 变更；typecheck 18/18；`openapi.json`/`types.gen.ts` 无变化（188 端点基线不变） |
| 2026-09-20 | `upstream/dev` | `3dd1b30539..ebb7b76eca`（18 个提交） | `qtoc:sync` 自动解决 32 个删除冲突；trim 移除 packages/web、packages/console 的上游新增文件（2 处）；typecheck 18/18；协议无变化（188 端点） |
| 2026-09-20 | `upstream/dev` | `ebb7b76eca..70a24697ea`（10 个提交） | `qtoc:sync` 自动解决 25 个删除冲突；`bun.lock` 手动冲突（取上游版本后 `bun install` 重建）；trim 0 变更；typecheck 18/18；协议无变化（188 端点） |

## 发布记录

| 版本标签 | 内容 | 冒烟结果 |
|---|---|---|
| `qt-headless-v1.18.31.4` | `qtoc:sync` 自动化、架构 KG、上游合并 | 构建 smoke 通过 |
| `qt-headless-v1.18.31.5` | 上游同步（已最新）+ 重新构建 | `--version` 1.18.31；`/global/health` 正常；tool ids 含 `question`；SSE `server.connected`；真实 DeepSeek 回复完成（`finish: stop`）；无 ERROR |
| `qt-headless-v1.18.31.6` | 上游同步 `b02acc1e30..3dd1b30539` + 文档重组（docs 索引 / qtoc HTTP API 参考 / KG 上游跟踪）；Bun 1.4.2 本地构建；标签指向 `616a6c0b03` | `--version` 1.18.31；`/global/health` 正常；tool ids 含 `question`；SSE `server.connected`；CI 三平台（Windows/Linux/macOS）构建通过（Linux smoke 首次 runner 偶发挂起，重跑通过） |

## 本地 delta 与上游化状态

| 本地改动 | 类型 | 上游化状态 | 上游合并后的动作 |
|---|---|---|---|
| `packages/core/src/filesystem/search.ts` | 可上游化（bug fix） | PR #49683 | 删除本地补丁，采用上游版本 |
| `packages/core/src/effect/layer-node.ts` | 可上游化（诊断） | PR #49684 | 删除本地补丁 |
| `packages/opencode/script/build.ts`（`QTOC_MINIFY` / `qtoc_core` 产物名 / headless 默认） | 发行定制 | 不上游 | 保留，由 `trim` 维护 |
| `packages/opencode/src/index.ts`（命令注销） | 裁剪 | 不上游 | 由 `trim` 维护 |
| `package.json` / `turbo.json` / `test.yml` / workspaces | 裁剪配置 | 不上游 | 由 `trim` 维护 |

## 待办清单（长期）

- [ ] 跟进 #49683 / #49684 的 review 意见（分支：`filesystem-search-cycle` / `layer-node-validation`）
- [ ] 上游合并任一 PR 后：`bun run qtoc:sync` → 删除本地对应补丁 → 更新本文与 `KG/architecture.md`
- [ ] 若上游提供官方打包/版本注入方案，评估替换本地 `build.ts` 定制
- [ ] 每次同步后更新「上游合并记录」与「本地 delta」表
- [ ] 关注上游 V2 API / 事件协议变化（客户端适配层）
- [ ] 评估阶段 4：使用 npm 发布二进制 + 纯 Qt 客户端的可行性（见 `KG/architecture.md`）

## 监控命令

```bash
# PR / Issue 状态
gh pr view 49683 --repo anomalyco/opencode --json state,mergeStateStatus,reviewDecision
gh pr checks 49683 --repo anomalyco/opencode
gh issue view 49685 --repo anomalyco/opencode --json state

# 上游新提交（决定是否同步）
git fetch upstream dev && git log --oneline qt-headless..upstream/dev

# 同步
bun run qtoc:sync
```

## 新增记录模板

| 日期 | 类型 | 链接 | 标题 | 状态 | 备注 |
|---|---|---|---|---|---|
| YYYY-MM-DD | issue / PR / merge | URL | … | … | … |
