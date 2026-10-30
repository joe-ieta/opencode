# dev-my：V2 桌面发行线

## 定位与当前进度

跟随官方 `upstream/dev`，发行完整 OpenCode My 桌面应用，并保留本仓库尚未被上游接纳的功能和修复。它不用于替代两条 Qt/headless 内核发行线。

- 源码已同步官方 `dev@92b2ca0dd727942e00aba3523ed141d53e78ea28`，内核基于 V2 2.2.2；本次源码标签 `v2.2.2-dev-my.1`，尚无该标签的新安装包。二进制与源码同步记录见 [releases.md](releases.md)。
- 最近 Windows amd64 发行：[v2.2.1-dev-my.2](https://github.com/joe-ieta/opencode/releases/tag/v2.2.1-dev-my.2)，2026-10-30，修复无发布日期的自定义模型默认隐藏。
- 最近 Linux x64 发行：[v2.2.1-dev-my.1](https://github.com/joe-ieta/opencode/releases/tag/v2.2.1-dev-my.1)，2026-10-29，含 Ubuntu AppImage/deb。
- macOS 暂无本 fork 发行验证；`release-my.ts` 当前仅支持 Windows/Linux x64。
- 最近 Windows 验证：应用单元测试 933 项、根检查 35 个任务、应用正式 TypeScript 检查通过；正式构建的默认显示/手动隐藏/手动显示、旧日期筛选及模型选择流程通过。CLI 模型目录、服务发现及 V1 迁移冒烟通过。详细日志留在本地 `.cache/model-date-*.log`，不纳入 Git。

## 已维护的行为

### Side tabs

Running sessions 独立展示运行任务，包含项目、所在工作目录的当前分支和紧凑运行时长。Recent sessions 与首页共享项目/会话历史，默认按最近操作排序；显式设置的排序继续生效。

Recent sessions 默认使用 By project 分组，已有偏好优先。按项目分组默认显示 5 条，超出可展开；分组数量使用紧凑最近/总数表示，hint 展示更完整信息，线程 hint 包含可获得的最近运行时间。关闭侧栏条目只隐藏，不删除历史；搜索仍可找到，重新打开后恢复。真正删除会话需走删除操作。

Side tabs 上游稿在 #60446，设计建议在 #60241；“新用户默认使用 Side tabs”是待审核建议，不等于已经改变所有用户的默认布局。已有布局偏好会被记忆。

多任务并行沿用官方 worktree 机制：同一工作目录里的会话共享代码和当前分支；独立 worktree 才隔离文件。新建 worktree 的分支选择是起点，内置 Git 策略默认 detached HEAD，不自动创建命名任务分支。Side tabs 展示这些任务，不改变其 Git 归属。

当前工作区的后续优化（尚未发行）：线程 hint 按需读取所在工作目录的当前分支，并展示所属工作树路径；项目分组计数后可直接新建预选该项目的会话。Recent sessions 只列主会话，恢复的子智能体标签也不再作为独立历史行，子智能体仍从父会话进入，Running sessions 保留运行任务观察能力。Home 与侧栏均显示服务器项目历史，避免官方客户端与本 fork 的 GUI 本地状态独立导致 Home 缺项目；显式隐藏项目会被单独记忆，重新使用该项目后恢复显示。

### V1 升级与可靠性

保留单向 V1→V2 升级确认、迁移清理批次提交和恢复、SQLite 错误分类与 Layer 依赖诊断。迁移相关 PR 未合并前，不能因上游同步或 PR 关闭丢弃本地实现。

### 自定义模型

`%USERPROFILE%\.config\opencode\opencode.jsonc` 中的自定义模型可由后台读取。已修复的缺陷在界面日期转换：`released: 0` 被误转为 `1970-01-01`，进而隐藏。现在保留未知日期，使用现有默认可见规则；手动隐藏仍然优先。上游 #60496 已合并。

## 桌面身份、服务与配置

| 项目                | 约定                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| 源码分支 / 版本后缀 | `dev-my` / `<V2版本>-dev-my.<N>`                                                                  |
| 桌面产品名          | `OpenCode My`                                                                                     |
| 桌面 appId          | `ai.opencode.desktop.dev-my`                                                                      |
| 后台运行渠道        | **`dev`**，不能改成 `dev-my`                                                                      |
| 服务和历史          | 使用官方 dev 约定的 `service.json`、`opencode.db`；GUI 本地状态属于独立 appId                     |
| 更新来源            | 本 fork 对应 release tag 的 feed，不使用官方桌面更新源                                            |
| 自动更新限制        | 当前 feed 固定在当前 tag；后续 fork 版本需手动下载安装                                            |
| 构建产物            | `dist/releases/v<version>/`；Windows NSIS，Linux AppImage/deb，附更新清单、SHA256SUMS、build.json |

早期 `v2.2.0-dev-my.1` 曾误用自定义后台渠道，选择独立的服务注册和空历史库，导致桌面发现失败。后续版本修正了该约定；排查历史或配置缺失时，先核对正在运行的 CLI 路径、版本、服务注册和真实加载的配置，不要先改用户数据库或配置。

## 后续工作

- #60496 的最终合并实现与测试已随本次同步吸收，继续保持自定义模型可见性回归覆盖。
- #60446 等设计批准后，更新纯 Side tabs 提交并处理冲突。
- 跟踪 #56929、#60084 和其他未被官方等价实现的可靠性补丁。
- 自定义模型配置界面仍为 [Proposal](https://github.com/anomalyco/opencode/issues/33704#issuecomment-6515528622)，尚未在本 fork 实现。

构建命令、提交与发布步骤见 [维护方法](../maintenance.md)，上游状态见 [PR 跟踪](../upstream-prs.md)。
