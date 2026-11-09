# 文档来源与整理范围

整理日期：2026-10-30。顶层 [FORK.md](../../FORK.md)是项目入口，本目录的维护方法、PR 表与三个分支概览为当前说明。

## 来源与边界

- 在当前 dev-my 工作区汇集两条 headless 分支的全部 `packages/qtui/**/*.md`：V2 9 份、V1 21 份。仅取文档，不引入 Qt 客户端、构建脚本或其他运行时代码。
- 取自 `oc-headless@bd848794de` 与 `qt-headless@81c50bd59a`。每份资料附原始提交/路径，正文保留原版本与状态，仅调整导航；旧操作记录中的命令、CI、策略与待办不能覆盖当前概览。
- 原根目录 `docs/opencode-qt-integration.md` 和 `docs/opencode-qt-integration-methodology.md` 已移至本目录 V1 的 legacy 子目录，保留 1.18.31 设计背景。
- 原 README 中的 fork 分支说明整理为顶层入口；原 `packages/desktop/README.md` 的 Fork releases 内容整理进 dev-my 概览及维护方法，从包的通用文档移除。
- 上游通用文档、CONTRIBUTING、AGENTS、CONTEXT/STATS 等原有说明不搬动；操作脚本及 `.opencode/skills/qtoc-release/SKILL.md` 等需要发现机制的功能入口保持原位。
- 这是 dev-my 上的文档汇集；两条 headless 原分支中的原路径尚未更改。将来传播此文档结构时使用文档专用提交，在对应分支更新引用，不整分支合入 dev-my，也不重复维护两份不注明来源的说明。

## dev 镜像对齐核对（2026-11-02）

本仓库默认分支已切换为 `dev-my`，`origin/dev` 仅用于镜像官方 `upstream/dev`。本次核对时，旧 `origin/dev@2d17a1bdef` 相对官方有七笔同步合并提交及两笔 Qt 文档提交：

- `e29515c957`：新增 Qt 集成方案与方法论文档。
- `79c6ea981b`：补充业务上下文注入与 Qt 端点面。

两笔提交均为本地及远端 `qt-headless@81c50bd59a` 的祖先，原始历史完整保留。`dev-my` 已分别收录为 [Qt 集成方案](qt-headless/legacy/opencode-qt-integration.md) 与 [方法论](qt-headless/legacy/opencode-qt-integration-methodology.md)；排除归档说明、路径调整和 Markdown 表格排版后，两份正文与旧 `origin/dev` 一致。它们是 V1 设计资料，无需将原提交再次合入 V2 维护线。

旧镜像提交保存在本地 `refs/archive/2026-11-02/heads/dev`；本次对齐目标为官方 `dev@ef6dd07aab`。仅更新本仓库的 `dev` 镜像引用，不将这些文档重新放入镜像，也不改变三条维护线的上游同步进度。

## 首页与界面截图

- 根 README 顶部为 OpenCode My 简介，包含项目定位、上游来源、本地模型支持和 Side bar 截图；官方 OpenCode 首页原文附在其后，随上游同步保留。
- `dev-my/sidetab-overview-light.png` 与 `dev-my/sidetab-overview-dark.png` 取自 [PR #60446](https://github.com/anomalyco/opencode/pull/60446) 的 after 截图，原始文件位于贡献分支提交 `58b91857b0849d2aea7d8ecbeda066f435fd85b6`。画面使用合成项目与会话，三个标签打开、两个任务运行；该布局现在由本地 Side bar 承载，展示 Running sessions 与按项目分组，项目 `+` 快捷入口在后续提交中补充，不作为当前用户数据或逐像素基线。
- 截图放在 fork 目录内并由本站 Markdown 引用，不依赖外部图片地址；更新界面后按同样方式替换，并在本节记录新来源提交。

## 归档文档清单

| 本目录文件                                                                                                 | 来源分支    | 原始文件（固定提交）                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [oc-headless/tooling.md](oc-headless/tooling.md)                                                           | oc-headless | [packages/qtui/README.md](https://github.com/joe-ieta/opencode/blob/bd848794de13cc596c4e73768f7fbb8fee889e43/packages/qtui/README.md)                                                                       |
| [oc-headless/client/README.md](oc-headless/client/README.md)                                               | oc-headless | [packages/qtui/client/README.md](https://github.com/joe-ieta/opencode/blob/bd848794de13cc596c4e73768f7fbb8fee889e43/packages/qtui/client/README.md)                                                         |
| [oc-headless/KB/branch-strategy.md](oc-headless/KB/branch-strategy.md)                                     | oc-headless | [packages/qtui/docs/KB/branch-strategy.md](https://github.com/joe-ieta/opencode/blob/bd848794de13cc596c4e73768f7fbb8fee889e43/packages/qtui/docs/KB/branch-strategy.md)                                     |
| [oc-headless/KB/releases.md](oc-headless/KB/releases.md)                                                   | oc-headless | [packages/qtui/docs/KB/releases.md](https://github.com/joe-ieta/opencode/blob/bd848794de13cc596c4e73768f7fbb8fee889e43/packages/qtui/docs/KB/releases.md)                                                   |
| [oc-headless/KB/v2-api-drift.md](oc-headless/KB/v2-api-drift.md)                                           | oc-headless | [packages/qtui/docs/KB/v2-api-drift.md](https://github.com/joe-ieta/opencode/blob/bd848794de13cc596c4e73768f7fbb8fee889e43/packages/qtui/docs/KB/v2-api-drift.md)                                           |
| [oc-headless/KB/v2-upgrade-roadmap.md](oc-headless/KB/v2-upgrade-roadmap.md)                               | oc-headless | [packages/qtui/docs/KB/v2-upgrade-roadmap.md](https://github.com/joe-ieta/opencode/blob/bd848794de13cc596c4e73768f7fbb8fee889e43/packages/qtui/docs/KB/v2-upgrade-roadmap.md)                               |
| [oc-headless/ops/contract-gate.md](oc-headless/ops/contract-gate.md)                                       | oc-headless | [packages/qtui/docs/ops/contract-gate.md](https://github.com/joe-ieta/opencode/blob/bd848794de13cc596c4e73768f7fbb8fee889e43/packages/qtui/docs/ops/contract-gate.md)                                       |
| [oc-headless/ops/dual-line-release.md](oc-headless/ops/dual-line-release.md)                               | oc-headless | [packages/qtui/docs/ops/dual-line-release.md](https://github.com/joe-ieta/opencode/blob/bd848794de13cc596c4e73768f7fbb8fee889e43/packages/qtui/docs/ops/dual-line-release.md)                               |
| [oc-headless/ops/release-runbook.md](oc-headless/ops/release-runbook.md)                                   | oc-headless | [packages/qtui/docs/ops/release-runbook.md](https://github.com/joe-ieta/opencode/blob/bd848794de13cc596c4e73768f7fbb8fee889e43/packages/qtui/docs/ops/release-runbook.md)                                   |
| [qt-headless/tooling.md](qt-headless/tooling.md)                                                           | qt-headless | [packages/qtui/README.md](https://github.com/joe-ieta/opencode/blob/81c50bd59afb419c7fd3da1a0553b3d59d3cd473/packages/qtui/README.md)                                                                       |
| [qt-headless/client/README.md](qt-headless/client/README.md)                                               | qt-headless | [packages/qtui/client/README.md](https://github.com/joe-ieta/opencode/blob/81c50bd59afb419c7fd3da1a0553b3d59d3cd473/packages/qtui/client/README.md)                                                         |
| [qt-headless/KB/architecture.md](qt-headless/KB/architecture.md)                                           | qt-headless | [packages/qtui/docs/KB/architecture.md](https://github.com/joe-ieta/opencode/blob/81c50bd59afb419c7fd3da1a0553b3d59d3cd473/packages/qtui/docs/KB/architecture.md)                                           |
| [qt-headless/KB/branch-strategy.md](qt-headless/KB/branch-strategy.md)                                     | qt-headless | [packages/qtui/docs/KB/branch-strategy.md](https://github.com/joe-ieta/opencode/blob/81c50bd59afb419c7fd3da1a0553b3d59d3cd473/packages/qtui/docs/KB/branch-strategy.md)                                     |
| [qt-headless/KB/data-agent-faq.md](qt-headless/KB/data-agent-faq.md)                                       | qt-headless | [packages/qtui/docs/KB/data-agent-faq.md](https://github.com/joe-ieta/opencode/blob/81c50bd59afb419c7fd3da1a0553b3d59d3cd473/packages/qtui/docs/KB/data-agent-faq.md)                                       |
| [qt-headless/KB/history.md](qt-headless/KB/history.md)                                                     | qt-headless | [packages/qtui/docs/KB/history.md](https://github.com/joe-ieta/opencode/blob/81c50bd59afb419c7fd3da1a0553b3d59d3cd473/packages/qtui/docs/KB/history.md)                                                     |
| [qt-headless/KB/release-issues.md](qt-headless/KB/release-issues.md)                                       | qt-headless | [packages/qtui/docs/KB/release-issues.md](https://github.com/joe-ieta/opencode/blob/81c50bd59afb419c7fd3da1a0553b3d59d3cd473/packages/qtui/docs/KB/release-issues.md)                                       |
| [qt-headless/KB/upstream.md](qt-headless/KB/upstream.md)                                                   | qt-headless | [packages/qtui/docs/KB/upstream.md](https://github.com/joe-ieta/opencode/blob/81c50bd59afb419c7fd3da1a0553b3d59d3cd473/packages/qtui/docs/KB/upstream.md)                                                   |
| [qt-headless/archive-index.md](qt-headless/archive-index.md)                                               | qt-headless | [packages/qtui/docs/README.md](https://github.com/joe-ieta/opencode/blob/81c50bd59afb419c7fd3da1a0553b3d59d3cd473/packages/qtui/docs/README.md)                                                             |
| [qt-headless/api/qtoc-http-api.md](qt-headless/api/qtoc-http-api.md)                                       | qt-headless | [packages/qtui/docs/api/qtoc-http-api.md](https://github.com/joe-ieta/opencode/blob/81c50bd59afb419c7fd3da1a0553b3d59d3cd473/packages/qtui/docs/api/qtoc-http-api.md)                                       |
| [qt-headless/capabilities/text2sql.md](qt-headless/capabilities/text2sql.md)                               | qt-headless | [packages/qtui/docs/capabilities/text2sql.md](https://github.com/joe-ieta/opencode/blob/81c50bd59afb419c7fd3da1a0553b3d59d3cd473/packages/qtui/docs/capabilities/text2sql.md)                               |
| [qt-headless/guide/client-tour.md](qt-headless/guide/client-tour.md)                                       | qt-headless | [packages/qtui/docs/guide/client-tour.md](https://github.com/joe-ieta/opencode/blob/81c50bd59afb419c7fd3da1a0553b3d59d3cd473/packages/qtui/docs/guide/client-tour.md)                                       |
| [qt-headless/guide/qt-shell-guide.md](qt-headless/guide/qt-shell-guide.md)                                 | qt-headless | [packages/qtui/docs/guide/qt-shell-guide.md](https://github.com/joe-ieta/opencode/blob/81c50bd59afb419c7fd3da1a0553b3d59d3cd473/packages/qtui/docs/guide/qt-shell-guide.md)                                 |
| [qt-headless/integration/data-agent-design.md](qt-headless/integration/data-agent-design.md)               | qt-headless | [packages/qtui/docs/integration/data-agent-design.md](https://github.com/joe-ieta/opencode/blob/81c50bd59afb419c7fd3da1a0553b3d59d3cd473/packages/qtui/docs/integration/data-agent-design.md)               |
| [qt-headless/integration/dual-engine-architecture.md](qt-headless/integration/dual-engine-architecture.md) | qt-headless | [packages/qtui/docs/integration/dual-engine-architecture.md](https://github.com/joe-ieta/opencode/blob/81c50bd59afb419c7fd3da1a0553b3d59d3cd473/packages/qtui/docs/integration/dual-engine-architecture.md) |
| [qt-headless/integration/implementation.md](qt-headless/integration/implementation.md)                     | qt-headless | [packages/qtui/docs/integration/implementation.md](https://github.com/joe-ieta/opencode/blob/81c50bd59afb419c7fd3da1a0553b3d59d3cd473/packages/qtui/docs/integration/implementation.md)                     |
| [qt-headless/integration/methodology.md](qt-headless/integration/methodology.md)                           | qt-headless | [packages/qtui/docs/integration/methodology.md](https://github.com/joe-ieta/opencode/blob/81c50bd59afb419c7fd3da1a0553b3d59d3cd473/packages/qtui/docs/integration/methodology.md)                           |
| [qt-headless/ops/bun-install.md](qt-headless/ops/bun-install.md)                                           | qt-headless | [packages/qtui/docs/ops/bun-install.md](https://github.com/joe-ieta/opencode/blob/81c50bd59afb419c7fd3da1a0553b3d59d3cd473/packages/qtui/docs/ops/bun-install.md)                                           |
| [qt-headless/ops/qt-headless.md](qt-headless/ops/qt-headless.md)                                           | qt-headless | [packages/qtui/docs/ops/qt-headless.md](https://github.com/joe-ieta/opencode/blob/81c50bd59afb419c7fd3da1a0553b3d59d3cd473/packages/qtui/docs/ops/qt-headless.md)                                           |
| [qt-headless/ops/qtoc-build.md](qt-headless/ops/qtoc-build.md)                                             | qt-headless | [packages/qtui/docs/ops/qtoc-build.md](https://github.com/joe-ieta/opencode/blob/81c50bd59afb419c7fd3da1a0553b3d59d3cd473/packages/qtui/docs/ops/qtoc-build.md)                                             |
| [qt-headless/ops/release-runbook.md](qt-headless/ops/release-runbook.md)                                   | qt-headless | [packages/qtui/docs/ops/release-runbook.md](https://github.com/joe-ieta/opencode/blob/81c50bd59afb419c7fd3da1a0553b3d59d3cd473/packages/qtui/docs/ops/release-runbook.md)                                   |

## 发布与验证证据

桌面发行和资产以 [origin Releases](https://gitee.com/ieta/opencode-my/releases) 为准；headless 标签与历史构建、Qt 验收记录见本目录各分支的 KB/ops。来源文档的“CI 待补”保留原记录，本次核对 Actions 设置已启用，没有重新运行或冒充通过。

[upstream-prs.md](upstream-prs.md) 是历史 PR 快照，仅作来源追溯，不再通过 GitHub 查询或更新。
