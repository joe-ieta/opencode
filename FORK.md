# OpenCode fork 项目说明

本仓库是 [joe-ieta/opencode](https://github.com/joe-ieta/opencode)，上游为 [anomalyco/opencode](https://github.com/anomalyco/opencode)。独立维护三个发行分支：V2 桌面应用、V2 headless 内核、V1 headless 内核。Qt 客户端消费内核协议，桌面应用沿用官方 Electron 架构。

> 桌面发行与 PR 状态：2026-10-31；其他分支快照：2026-10-30（Asia/Shanghai）。状态会变化；更新时按 [维护方法](docs/fork/maintenance.md)重新查询，不把本页快照当成实时状态。

## 三个维护分支

| 分支                                           | 定位与跟踪源                                                       | 当前进度                                                                                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| [dev-my](docs/fork/dev-my/README.md)           | 桌面唯一维护主线，跟随官方 upstream/dev，发行 OpenCode My          | 主线基于 V2 2.2.3；Windows 测试版 .6 已补齐 Side bar 29 个简体中文词条；旧 .4 曾通过人工测试。Linux 测试版 .5 已发布；稳定 Latest 为 .3，贡献 #60867 单独基于官方 2.2.5       |
| [oc-headless](docs/fork/oc-headless/README.md) | 跟随 `upstream/dev`，发行 V2 `oc_core`，供 Qt/C++ 或其他客户端接入 | 已同步至 V2 2.2.0；标签 `oc-headless-v2.2.0`，本地 Windows 构建、协议门禁和冒烟通过；Qt 传输与会话测试已完成，GUI 权限/表单人工验收仍待完成 |
| [qt-headless](docs/fork/qt-headless/README.md) | 跟随 `upstream/v1`，维护 V1 `qtoc_core` 和 Qt 集成                 | 已同步至 V1 1.19.5；迭代标签 `qt-headless-v1.19.5.1`；Windows 构建、类型检查和服务冒烟通过，后续以 V1 修复维护为主                          |

三条线独立构建、标记和验收。不要把 `dev-my` 的 GUI 改动整分支合入 headless，也不要把 V2 的协议、目录和迁移假设套用到 V1。桌面现有脚本支持 Windows x64 与 Linux x64/arm64；Linux arm64 可在 Ubuntu 24.04 x64 上交叉构建并用 QEMU 做 CLI 冒烟。macOS 虽属于官方桌面架构支持的平台，目前没有本 fork 的该脚本构建与发行验证。

## 本仓库维护的主要能力

- **桌面任务观察窗**：独立 Side bar 模式的 Running sessions 与按项目组织的 Recent sessions；最近列表默认每项目 5 条、可展开，展示分支、运行时长、最近操作和会话数量。首页与侧栏共享历史索引；关闭侧栏条目保留历史，重新打开后恢复。
- **升级与恢复**：V1→V2 单向升级确认、迁移清理批次提交与恢复、SQLite 错误分类、Layer 依赖诊断等补丁按分支需要保留；上游未接纳或 PR 关闭不代表可以删除。
- **自定义模型可见性**：保留未知发布日期，防止模型被错误识别为 1970 年旧模型而隐藏。此修复已随桌面 `.2` 发行，并已合入官方。
- **Qt/headless 工具链**：V1 裁剪与 V2 最小差异构建分开，产物分别命名为 `qtoc_core`、`oc_core`，不互相替代。

## 上游贡献与合并策略

| PR                                                                                | 当前状态                                            | 后续处理                                                                   |
| --------------------------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------- |
| [#60496](https://github.com/anomalyco/opencode/pull/60496) 自定义模型未知发布日期 | **MERGED**，2026-10-30；上游合并提交 `986221af346f` | 已随本次官方 dev 同步吸收最终实现与回归测试；后续不重复移植本地修复        |
| [#56929](https://github.com/anomalyco/opencode/pull/56929) V1 迁移清理批次提交    | **OPEN**，非 Draft；曾关闭，核对时已重新打开        | 继续跟踪审核；发行分支保留本地有效实现                                     |
| [#60084](https://github.com/anomalyco/opencode/pull/60084) 单向 V1 升级确认       | **CLOSED / Draft**，未合并，2026-10-30              | 本地发行继续保留；关闭不表示已被上游接纳                                   |
| [#60867](https://github.com/anomalyco/opencode/pull/60867) 独立 Side bar 模式     | **OPEN / Draft**，head `a18285fedb`；目标 dev       | 等待上游设计审核，保持原三种模式；dev-my 为维护主线，sidebar-mode 仅供贡献 |
| [#60446](https://github.com/anomalyco/opencode/pull/60446) 原 Side tabs 概览      | **CLOSED**，未合并，2026-10-31                      | 由 #60867 替代，原设计和分支保留作历史参考                                 |

完整 Issue、历史 PR、设计建议和补丁去留规则见 [上游跟踪](docs/fork/upstream-prs.md)。上游贡献从官方 `upstream/dev` 新建小分支，PR 目标为官方 `dev`，仅提交相关变更；三条发行线通过 merge 吸收各自上游，保留已发布历史。

## 文档、构建与发布入口

全部 fork 专属说明集中在 [docs/fork](docs/fork/README.md)：

- [维护、同步、验证、标签和发布](docs/fork/maintenance.md)
- [发布环境与多架构构建](docs/fork/KB/release-environment.md)
- [dev-my 桌面发行与运行时约定](docs/fork/dev-my/README.md)
- [oc-headless：V2 内核、协议门禁、Qt 适配与发行记录](docs/fork/oc-headless/README.md)
- [qt-headless：V1 内核、Qt 集成、协议、维护与历史记录](docs/fork/qt-headless/README.md)
- [文档来源与整理边界](docs/fork/sources.md)

保留上游 README、CONTRIBUTING、AGENTS、官网文档及包的通用说明；根 README 顶部为本 fork 简介与 Side tabs 运行界面截图，官方 OpenCode 首页原文附在其后保留。两条 headless 线尚在各自分支里的操作脚本和技能入口保持原位；本目录汇集其文档版本，并标注来源提交，不引入对应分支的运行时代码。

Qt 文档归档来源为 `dev-my@d28cf55b08`、`oc-headless@bd848794de`、`qt-headless@81c50bd59a`；随后 dev-my 已同步官方 `dev@e7acf85bb7`（V2 2.2.3），Windows 测试版构建源码为 `52e000fc52`。本次没有同步两条 headless 发行分支。源码标签与二进制发行分开记录，见 [桌面发行与源码同步记录](docs/fork/dev-my/releases.md)。
