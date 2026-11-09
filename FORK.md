# OpenCode fork 项目说明

## 仓库关系

以下约定自 2026-11-02 起生效，顶层约束见 [AGENTS.md](AGENTS.md)，覆盖仓库旧文档中的远端、同步和发布配置。

- 远端 `origin`：`git@gitee.com:ieta/opencode-my.git`，本仓库唯一的发布目标；源码、标签及所有平台发布物只推送到这里。
- 上游 `upstream`：<https://github.com/joe-ieta/opencode>，代码同步来源；V2 同步源码从 `upstream/dev` 获取。它不是发布目标。
- 本项目与 <https://github.com/anomalyco/opencode> 没有关系，不配置、不拉取、不推送、不发布到该仓库；文档中的相关链接仅作历史来源追溯。
- 仅长期维护 `dev-my`、`oc-headless`、`qt-headless`，分别跟踪 `origin` 同名分支；三条发行线独立合并、构建和验证。
- 源码、标签及所有平台发布物统一使用 `origin` 的 Releases。超过 origin 单附件大小限制时按分卷发布并附合并说明与校验值；历史发布仅作来源追溯。
- 其他本地/远端分支和关联 worktree 先盘点，获用户明确确认后再清理；上游分支不属于清理范围。

### 上游交互规则

- 本机具备 `upstream` 的写权限，但禁止直接推送维护分支（`dev-my`、`oc-headless`、`qt-headless`）、发布标签或 fork 元数据；已有上游分支保持只读，不改写其历史。
- 与上游的变更只通过 PR（或等价评审流程）进行：从对应上游基线创建范围单一的主题分支，仅推送该主题分支并打开 PR，不合并维护分支。
- `AGENTS.md` 与 `FORK.md` 是 fork 本地策略文件，必须从上游 PR 分支中排除，也不得推送到 `upstream`。`docs/fork/` 的 fork 专属说明同样不进入上游 PR，除非 PR 本身讨论这些文档；提交前用 `git diff --name-only <upstream-base>...HEAD` 核对。

本项目独立维护三个发行分支：V2 桌面应用、V2 headless 内核、V1 headless 内核。Qt 客户端消费内核协议，桌面应用沿用 OpenCode 的 Electron 架构。

> 桌面维护与 #60867 更新于 2026-11-06。其他 PR 和分支分别核对于 2026-10-31 和 2026-10-30，日期均为 Asia/Shanghai。查询方法见[维护指南](docs/fork/maintenance.md)。

## 三个维护分支

| 分支                                           | 定位与跟踪源                                                           | 当前进度                                                                                                                                                                                                                  |
| ---------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [dev-my](docs/fork/dev-my/README.md) | 桌面唯一维护主线，发行 OpenCode My | Windows [v2.2.5-my.5](https://github.com/joe-ieta/opencode/releases/tag/v2.2.5-my.5) 的自动检查及下载校验通过，安装后人工验收待完成，构建源码 `02457d62e2`。Linux 发行版为 `v2.2.5-dev-my.2`。 |
| [oc-headless](docs/fork/oc-headless/README.md) | 跟随 `upstream/dev`，发行 V2 `oc_core`，供 Qt/C++ 或其他客户端接入 | 已同步至 V2 2.2.0；标签 `oc-headless-v2.2.0`，本地 Windows 构建、协议门禁和冒烟通过；Qt 传输与会话测试已完成，GUI 权限/表单人工验收仍待完成                                                                               |
| [qt-headless](docs/fork/qt-headless/README.md) | 以 `origin/v1` 为 V1 基线维护 `qtoc_core` 和 Qt 集成                 | 已同步至 V1 1.19.5；迭代标签 `qt-headless-v1.19.5.1`；Windows 构建、类型检查和服务冒烟通过，后续以 V1 修复维护为主                                                                                                        |

三条线独立构建、标记和验收。不要把 `dev-my` 的 GUI 改动整分支合入 headless，也不要把 V2 的协议、目录和迁移假设套用到 V1。桌面现有脚本支持 Windows x64 与 Linux x64/arm64；Linux arm64 可在 Ubuntu 24.04 x64 上交叉构建并用 QEMU 做 CLI 冒烟。macOS 虽属于官方桌面架构支持的平台，目前没有本 fork 的该脚本构建与发行验证。

## 本仓库维护的主要能力

- **桌面任务观察窗**：独立 Side bar 模式的 Running sessions 与按项目组织的 Recent sessions；最近列表默认每项目 5 条、可展开，展示分支、运行时长、最近操作和会话数量。首页与侧栏共享历史索引；关闭侧栏条目保留历史，重新打开后恢复。
- **升级与恢复**：V1→V2 单向升级确认、迁移清理批次提交与恢复、SQLite 错误分类、Layer 依赖诊断等补丁按分支需要保留；上游未接纳或 PR 关闭不代表可以删除。
- **自定义模型可见性**：保留未知发布日期，防止模型被错误识别为 1970 年旧模型而隐藏。此修复已随桌面 `.2` 发行，并已合入官方。
- **Qt/headless 工具链**：V1 裁剪与 V2 最小差异构建分开，产物分别命名为 `qtoc_core`、`oc_core`，不互相替代。

## 历史 PR 记录（仅追溯）

> 下表链接指向历史第三方仓库，仅作来源追溯，不表示本项目与其存在上游或协作关系。

| PR                                                                                | 当前状态                                               | 后续处理                                                                                                         |
| --------------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| [#60496](https://github.com/anomalyco/opencode/pull/60496) 自定义模型未知发布日期 | **MERGED**，2026-10-30；上游合并提交 `986221af346f`    | 已随本次上游同步吸收最终实现与回归测试；后续不重复移植本地修复                                                   |
| [#56929](https://github.com/anomalyco/opencode/pull/56929) V1 迁移清理批次提交    | **OPEN**，非 Draft；曾关闭，核对时已重新打开           | 继续跟踪审核；发行分支保留本地有效实现                                                                           |
| [#60084](https://github.com/anomalyco/opencode/pull/60084) 单向 V1 升级确认       | **CLOSED / Draft**，未合并，2026-10-30                 | 本地发行继续保留；关闭不表示已被上游接纳                                                                         |
| [#60867](https://github.com/anomalyco/opencode/pull/60867) 独立 Side bar 模式 | **OPEN / Draft**，head `2de04af2cd`，目标 `dev` | 已将活动快照等待接入上游 Inbox 状态机。GitHub 合并检测通过，等待设计评审。 |
| [#60446](https://github.com/anomalyco/opencode/pull/60446) 原 Side tabs 概览      | **CLOSED**，未合并，2026-10-31                         | 由 #60867 替代；旧分支已于 2026-11-02 清理，原设计与本地提交归档保留                                             |

完整历史 PR、设计建议和补丁去留规则见 [历史跟踪](docs/fork/upstream-prs.md)。本项目当前不向 anomalyco/opencode 查询、提交或推送贡献；日常维护基于 `origin` 对应维护分支，V2 同步源码从 `upstream/dev` 获取。三条发行线通过 merge 保留已发布历史。

## 文档、构建与发布入口

全部 fork 专属说明集中在 [docs/fork](docs/fork/README.md)：

- [维护、同步、验证、标签和发布](docs/fork/maintenance.md)
- [发布环境与多架构构建](docs/fork/KB/release-environment.md)
- [自建发布物存储](docs/fork/KB/self-hosted-release-storage.md)
- [dev-my 桌面发行与运行时约定](docs/fork/dev-my/README.md)
- [oc-headless：V2 内核、协议门禁、Qt 适配与发行记录](docs/fork/oc-headless/README.md)
- [qt-headless：V1 内核、Qt 集成、协议、维护与历史记录](docs/fork/qt-headless/README.md)
- [文档来源与整理边界](docs/fork/sources.md)

保留上游 README、CONTRIBUTING、AGENTS、官网文档及包的通用说明；根 README 顶部为本 fork 简介与 Side bar 运行界面截图，官方 OpenCode 首页原文附在其后保留。两条 headless 线尚在各自分支里的操作脚本和技能入口保持原位；本目录汇集其文档版本，并标注来源提交，不引入对应分支的运行时代码。

Qt 文档归档来源为 `dev-my@d28cf55b08`、`oc-headless@bd848794de`、`qt-headless@81c50bd59a`；随后 dev-my 已同步上游基线 `dev@e7acf85bb7`（V2 2.2.3），Windows 测试版构建源码为 `52e000fc52`。本次没有同步两条 headless 发行分支。源码标签与二进制发行分开记录，见 [桌面发行与源码同步记录](docs/fork/dev-my/releases.md)。
