# dev-my 发行与源码同步记录

二进制发行以 [GitHub Releases](https://github.com/joe-ieta/opencode/releases) 的完整资产为准。自 2026-11-02 起，所有平台仅使用本仓库 GitHub 的完整安装包与更新清单；旧镜像和分卷流程已停用。源码标签只证明提交已标记，不代表为该版本构建或上传了安装包。环境准备、构建和排障见 [发布环境与多架构构建](../KB/release-environment.md)。

## 当前下载

| 通道         | 版本              | 平台               | 下载                                                                               |
| ------------ | ----------------- | ------------------ | ---------------------------------------------------------------------------------- |
| Windows 测试 | `v2.2.5-my.3`     | Windows x64        | [GitHub 完整安装包](https://github.com/joe-ieta/opencode/releases/tag/v2.2.5-my.3) |
| Linux 测试   | `v2.2.5-dev-my.2` | Ubuntu amd64/arm64 | [GitHub](https://github.com/joe-ieta/opencode/releases/tag/v2.2.5-dev-my.2)        |

本次 GitHub 稳定 Latest 接口返回 404，以上仅列出已核验的测试版下载。本次使用 `--latest=false`。全部平台统一使用 GitHub 完整安装包，Gitee 已停用。需要独立下载源时可参考 [自建发布物存储](../KB/self-hosted-release-storage.md) 草案，当前尚未接入。历史源码标签不代表旧 Release 资产仍可下载。

## v2.2.5-my.3 Windows x64 测试预发行

- [GitHub Release](https://github.com/joe-ieta/opencode/releases/tag/v2.2.5-my.3) 于 2026/11/3 15:28:47（Asia/Shanghai）公开，`draft=false`、`prerelease=true`；仅发布 Windows x64，本轮未重建 Linux。
- 不可变构建源码为 `97c429b635882143714d13702defda324b3d818f`，版本号改为 `2.2.5-my.3`，应用标识仍为 `ai.opencode.desktop.dev-my`。后续文档合并提交不作为二进制构建来源。
- 修复模型执行结束后后台 Shell 未纳入会话活动汇总的问题。兼容旧后端活动接口 404，侧栏、Running 与根会话标题跟随 Shell 活动显示和清除；模型执行、排队和中断状态保持独立。只读现场核验确认模型空闲、Shell 运行时汇总仍忙碌，服务注册未改变。
- 包含项目名称排序、独立固定区域及 40% 上限、滚动条、折叠未读提示、底部最多五行 Running 区域、无占位的悬浮操作、草稿标识，以及右键菜单 Close。
- 自动验证：根检查 35/35；Home/tabs 73/73、零重试；客户端相关测试 40/40；桌面打包相关测试 24/24。应用及客户端官方 TypeScript 检查通过，E2E 仍有原有 13 处类型诊断。
- Bun 1.4.4 构建；模型目录比较覆盖 7,657 个模型，CLI 服务发现、V1 升级确认与历史迁移冒烟通过。实际 ASAR/CLI 版本、既有 31 个中文词条、更新源、NSIS 完整性及 latest.yml 的 SHA512/大小均已核验。
- 安装器 `opencode-desktop-win-x64.exe` 为 279,878,027 字节，SHA256 `a8b78309bdd88521d6831cedc081c3dd36c1fe193a4b26596aa093259f77fe96`。四个远端资产大小及 SHA256 与本地一致；四个公开下载文件再次核对一致。
- 安装包未签名，等待安装后的人工验收。PR #60867 与来源 `sidebar-mode@b88b94a75d` 保持冻结，未发送测试邀请，未重启用户应用或后台。
- 合并了 GitHub 上并行的文档更新；Gitee 不再作为远端或发行目标，未上传本版任何数据，也未清理历史远端资产。

> 以下为历史发行事实。出现的旧 Gitee、分卷及远端名称只用于来源追溯，不是当前配置或发布步骤；以顶层 [AGENTS.md](../../../AGENTS.md) 为准。

## v2.2.5-dev-my.2 Windows / Linux 测试预发行

- [GitHub Release](https://github.com/joe-ieta/opencode/releases/tag/v2.2.5-dev-my.2) 于 2026-11-02 17:09:40（Asia/Shanghai）公开，`draft=false`、`prerelease=true`；十个资产均已完成服务端 SHA256/大小独立核对。三份公开更新清单与本地字节一致（HTTP 200），Windows 安装包与两架构 AppImage 的公开入口及 PE/ELF 文件头验证通过（HTTP 206）。稳定 Latest 独立查询仍为 `v2.2.3-dev-my.3`。

- 构建源码与不可变标签：`3777b783c5647651707cccc939c25ccdb09e27ff` / `v2.2.5-dev-my.2`。同步官方 `dev@ff90ed9160`（V2 2.2.5），相对前次 `69269e4ebe` 新增 53 个提交；先以 `0779e086ec` 整合既有 Side bar 贡献历史，再以 `3777b783c5` 合并上游。Windows x64 与 Linux x64/arm64 均从此提交构建。
- 保留项目整组收起/展开及持久化、项目内与平面列表排序、深层子智能体祖先状态恢复、相反文字方向标题修复和既有 31 个中文词条。官方 Top tabs、Side tabs、Inbox 及原有布局偏好保持原语义。
- 验证：Windows 和 Ubuntu 根检查各 35/35；最终 PR 分支两平台根检查各 35/35、应用单元 948 项、Linux browser 条件 303 项（默认超时）、生产 Home/标签回归 67/67（五 workers、无重试）。发行源码的应用正式 TypeScript 检查通过；Windows 安装器/打包配置 18 项通过。Windows browser 条件测试在并行构建期间对实际启动子进程采用 30 秒预算后 303/303 通过，测试断言与产品代码未为此修改。
- 使用 Bun 1.4.4；三个目标的模型目录均完整比较 7,653 个模型，服务发现、共享 V1 数据库、升级确认及迁移历史冒烟通过。Windows 的一次独立目录冒烟遇到五秒插件激活超时，随后复用同一已编译 CLI，以已有 `--via-server` 路径通过，继续执行相同桌面打包阶段。
- 实际 Windows ASAR/CLI 版本、四种模式、收起状态键、中文词条、固定标签更新源、NSIS 7-Zip 完整性与清单 SHA512/大小均已核对；Linux 两架构的 AppImage/deb 已实际解包，ASAR 内容一致，ELF/deb 架构、版本、桌面/metainfo、更新源与两份更新清单均通过核验。
- [Gitee Windows 测试版](https://gitee.com/ieta/opencode-my/releases/tag/v2.2.5-dev-my.2) 已公开为预览版本，八个附件全部从公开下载入口读回并比较大小和 SHA256。三卷分别为 94,371,840、94,371,840、91,118,164 字节，均小于 100 MB；合并 SHA256 与完整安装包相同。GitHub 提供全部平台完整资产，Gitee 仅提供 Windows 分卷及清单。
- 用户已于 2026-11-02 确认此前 Windows 2.2.5 测试包手工测试通过；本次同步后的新包尚未执行安装后 GUI 人工验收，Linux/原生 ARM64 GUI 未人工验收。所有目标未签名，Windows Authenticode 为 `NotSigned`；固定标签更新源的后续版本需手动下载安装。
- 用户确认本次二进制只包含冻结时已提交的内容。并行任务随后提交的 Session activity / goal state 工作保留于维护线 `dev-my`，并通过 `453084892e` 合回本次源码同步；它不属于 `v2.2.5-dev-my.2` 标签或安装包。合回后客户端重新生成无差异，完整检查 35/35、客户端回归 40 项、核心活动回归 2 项通过；维护线与记录分别推送 GitHub/Gitee，源码标签保持固定。
- [PR #60867](https://github.com/anomalyco/opencode/pull/60867) 已按用户本次明确要求更新到 `b88b94a75d3d517c3bbd417274392e326b7cb1e7`，基线 `ff90ed9160`，仅 35 个应用层文件。项目收起、后代活动、RTL 标题与原有分组/排序回归已同步；未混入 fork 发行、品牌或 Session activity 协议改动。本地 `sidebar-mode` 分支已删除，远端仅冻结保留 PR 来源引用，不再并行开发；旧 `sidebar-projects` 在 GitHub/Gitee 均已删除。本地旧项目工作区原以 `dev` 指向 `966e97bf71`，现已转为 detached 历史检出并删除该旧本地分支；文件及 `refs/archive/sidebar-projects` 归档引用保留。未发送测试邀请。

| 安装包                                   |        字节 | SHA256                                                             |
| ---------------------------------------- | ----------: | ------------------------------------------------------------------ |
| `opencode-desktop-win-x64.exe`           | 279,861,844 | `e664ea654fa54e781595626318c45bdfed60d299d80100a39f3ddf3c8734e304` |
| `opencode-desktop-linux-x86_64.AppImage` | 326,174,875 | `fe36733779c9ef098c4b2a5718d9fd9838af7b0abeae5b8ed868d46ad37ae436` |
| `opencode-desktop-linux-amd64.deb`       | 272,189,848 | `5209067a4d95d8005e9661648ba20608b728208073b6ea0c30357685a6d281de` |
| `opencode-desktop-linux-arm64.AppImage`  | 326,049,295 | `97a145f3534fb02349e92ad5335ae4c8a18d85527fe02bb2fa25e76f7d3f9212` |
| `opencode-desktop-linux-arm64.deb`       | 261,869,328 | `b81c0547499adb7430a1c2aae44a114342feedebdae965fa4b1f79bf84c325ac` |

## v2.2.5 源码同步（2026-11-01）

- 同步目标 `upstream/dev-my@8593792301`，相对上次共同基线 `3747a8caa9` 吸收 84 个上游提交；官方基线由 V2 2.2.3 `dev@e7acf85bb7` 推进到 V2 2.2.5 `dev@69269e4ebe`（官方段 81 个提交），并包含 fork 的 `ca18869aaa`（深层子智能体状态与项目整组收起）和 `8593792301`（Windows 2.2.5 测试包准备记录）。
- 上游 2.2.4 的主要变化：持久桌面终端及其重命名、实验性交互 artifacts、Claude Agent 引导安装、worktree 基础分支快捷键等。
- 上游 2.2.5 的主要变化：worktree 与 Shell 模式快捷键、引用弹窗直接发送、`compaction.buffer` 支持百分比，以及 MCP/stdio、上下文压缩和推理恢复等修复；完整清单见 `CHANGELOG.md` 的 v2.2.4 与 v2.2.5。
- 本地保留独立 Side bar、Gitee Windows 分卷、V1 升级与迁移、SQLite/Layer 诊断和桌面发行脚本；本次未改动两条 headless 分支。文档继续按 Gitee `origin` 与 GitHub fork `upstream` 的关系维护。
- 验证：`bun install --frozen-lockfile` 无依赖变化；`bun run check` 35/35 通过（本机需以 `NODE_OPTIONS=--experimental-strip-types` 加载 oxlint 的 TypeScript 插件）；从 `packages/client` 重新执行 `bun run generate`，生成客户端与合并结果一致。
- 本次只同步源码并更新发行记录，不构建或发布新安装包；Windows `2.2.5-dev-my.1` 仍为未公开的发行草稿。

## v2.2.5-dev-my.1 Windows x64 测试包准备

- 构建源码：`ca18869aaa1b8c92e93c7db5a1d803e78830eefc`。合并官方 `dev@69269e4ebe309a08919b3c9be7948b9fd699c3a4`（V2 2.2.5），相对前次上游基线新增 81 个提交；合并提交为 `a7b90e8444`。SQLite 冲突采用上游官方客户端并保留数据库文件名错误诊断，V1 迁移文档保留本地确认与备份说明。
- 修复深层子智能体执行时，因祖先元数据缺失而使顶层会话错误显示空闲的问题；Home 与 Side bar 同步受益。仅按需读取元数据，不读取祖先对话内容或改写服务器执行状态。
- 项目标题增加整组收起/展开，按服务器及项目路径保存状态；收起后仅保留标题、计数和新建入口，与五条预览/More 独立。List 和运行概览继续保留，新建时展开项目。两个新增无障碍标签先提供英文源，既有 31 个中文词条保留。
- 动画问题已定位：本机 Windows 客户端区域动画关闭，应用设置为跟随系统，因此主会话和子智能体图标均按官方减少动态效果设计保持静态。应用内将“减少动态效果”设为关闭即可允许动画。本轮没有覆盖系统偏好或修改共用 Spinner。
- 验证：完整根检查 35/35；应用单元 948 项、browser 条件 303 项；数据库 67 项通过、2 项 Windows 条件跳过；完整生产 Home/标签回归 67 项无重试，最终无障碍标题/分组/状态/动画专项 5 项无重试；Windows 安装器及打包配置 22 项通过。新回归在修复前复现了缺失整组收起与深层子智能体状态错误。
- 生产导航基准修改前后三次：内容首次显示中位数 386.2 → 382.0 ms，稳定显示中位数 432.2 → 432.3 ms。小样本未见明显退化，不作为通用性能保证。
- Bun 1.4.4 完成 Windows x64 构建；模型目录完整比较 7,656 个模型，服务发现、V1 确认与迁移历史冒烟通过。实际 ASAR/CLI 版本、Side bar 功能标记、31 个中文值、固定标签更新源、清单 SHA512/大小及 7-Zip 完整性均已核对；Authenticode 为 `NotSigned`。尚未完成安装后的 GUI 人工验收。
- 安装器 `opencode-desktop-win-x64.exe`：279,868,420 字节，SHA256 `d5a3eea642d70fadc007d96a5dc8b88b94d23bc2f68f17fcc142f0d25d197cdc`。本地目录为 `dist/releases/v2.2.5-dev-my.1`。
- [发行草稿](https://github.com/joe-ieta/opencode/releases/tag/untagged-883f9a89dc0f7c23428d) 的四个资产已全部上传并独立核对服务端 SHA256/大小与本地一致，`draft=true`、`prerelease=true`、`published_at=null`；尚未公开，不能使用公开下载入口。稳定 Latest `.3`、Windows 最新公开测试版 `.6`、Linux 最新公开测试版 `.5` 均保留。临时传输探针资产已清理。
- 继续维护于 `dev-my`，未修改或新建 PR，未发送测试邀请。

## v2.2.3-dev-my.6 Windows x64 中文测试预发行

- 发行页：[v2.2.3-dev-my.6](https://github.com/joe-ieta/opencode/releases/tag/v2.2.3-dev-my.6)，2026/10/31 22:12（Asia/Shanghai）已公开，`draft=false`、`prerelease=true`。稳定 Latest 仍为 `v2.2.3-dev-my.3`，Linux 最新测试版仍为 `v2.2.3-dev-my.5`。
- Gitee Windows 分卷：[v2.2.3-dev-my.6](https://gitee.com/ieta/opencode-my/releases/tag/v2.2.3-dev-my.6)，仅含 Windows 分卷和 Windows 清单；Linux/macOS 走上游。
- 构建源码：`9506fb6d69e9470cd97e3bb834339bf5f82120bf`；只增加前次缺少的 29 个 Side bar 简体中文词条及翻译核对记录。相关键现有中文 31/31，占位符与英文源一致，英文源和其他语言未修改。术语、语义和参考语料见 [中文翻译核对](sidebar-zh.md)。
- Windows 包含独立 Side bar 及此前的标题方向修复；官方三种模式、后台项目登记、会话历史和权限模型不变。Linux `.5` 安装包未重新构建，不包含本次新增中文词条。
- 验证：完整根检查 35/35；既有语言测试 21/21（467 项断言）；Windows 安装器/打包配置测试 18/18。隔离生产界面覆盖 0/1/2 个运行会话、小时/天、空项目、分组/列表、更多/收起、隐藏提示、项目新建、悬浮详情及设置卡片；截图已复核。
- 使用 Bun 1.4.4 完成正式 Windows x64 构建；本轮 CLI 模型目录比较覆盖 7,646 个模型，服务发现、V1 升级确认及迁移历史冒烟通过。实际 ASAR 内的 31 个相关中文值均已核验，ASAR/CLI/安装器版本正确，7-Zip 完整性、固定标签更新源及 `latest.yml` 的 SHA512/大小均通过。
- 安装器 `opencode-desktop-win-x64.exe`：277,954,927 字节，SHA256 `ae83752b76955f50406c225f178aefe98427ca784d89a6fbeb4ef3fec258ce26`。四个 GitHub 资产的大小、SHA256 与本地一致；公开清单内容与本地一致，安装器公开下载和 PE 文件头已验证。产物未签名，本版尚未完成安装后的 Windows GUI 人工验收。
- 继续维护于 `dev-my`；本次未修改或新建 PR，未发送测试邀请，后续也不再发送。
- 沿用已确认的保留策略，在 `.6` 公开并核验后删除被替代的 Windows `v2.2.3-dev-my.4` Release 及 4 个资产（277,958,267 字节），源码标签保留。现保留稳定 `.3`、Linux 测试 `.5`、Windows 测试 `.6`；旧 `.4` 的历史发行页/下载链接失效，人工验收记录仍保留。

## v2.2.3-dev-my.5 Linux amd64/arm64 测试预发行

- 发行页：[v2.2.3-dev-my.5](https://github.com/joe-ieta/opencode/releases/tag/v2.2.3-dev-my.5)，2026/10/31 21:32（Asia/Shanghai）已公开，`draft=false`、`prerelease=true`；稳定 Latest 仍为 `v2.2.3-dev-my.3`，Windows 最新测试版仍为 `v2.2.3-dev-my.4`。
- Gitee 不保存本 Linux 版本资产，请使用上述上游 Release。
- 构建源码：`31d67160e0d5c96f760227ab7b9f4ab65258c919`，基于 V2 2.2.3，使用 Bun 1.4.4 在 WSL Ubuntu 24.04 的独立原生工作区构建；amd64 原生编译，arm64 经 QEMU/binfmt 交叉构建。标签固定在构建源码，发行记录另行提交到维护主线 `dev-my`。
- 提供独立 Side bar 模式，保留官方 Top tabs、Side tabs（vertical）和 Inbox。相对 Windows `.4` 增加相反文字方向标题的对齐修复，仅作用于 Side bar，不修改官方模式、后台 Project 登记或公开 API。
- 国际化核对：31 个相关英文词条、63 个语言字典；未发现硬编码可见文案、缺失英文回退或占位符不一致。非英语界面中仍有 29 个相关词条使用英文回退，本轮未批量翻译。语言测试 21/21（467 项断言），英语/简体中文/法语/阿拉伯语生产界面及 RTL 截图已核对。
- 验证：Windows 与本轮 WSL 根检查均 35/35；方向修复生产构建 Home/标签回归 65/65，无重试。两架构 CLI 版本正确，模型目录各完整比较 7,648 个模型，服务发现、V1 升级确认与迁移历史冒烟均通过。Linux 发行工具复用已有 `--via-server` 路径等待插件激活；合成凭据触发的外网发现仅在目录冒烟进程中限制，其他构建下载使用现有本机代理。
- 官方 V2 模型目录经 Windows 实时取得并通过现有 schema 校验，再由临时本地镜像供 WSL 构建读取；使用同一份快照比较内置目录。临时镜像和代理地址未固化到产品，不作为运行时更新源。环境设置与辅助文件均未提交。
- 两架构 AppImage/deb 已实际解包，ASAR 内容一致，四模式与 RTL 修复标记存在；ASAR/内置 CLI 版本、ELF/deb 架构、deb 元数据、桌面文件、metainfo、固定标签更新源、两份更新清单 SHA512/大小及 SHA256SUMS 均通过核验。
- 8 个 GitHub 资产的服务端大小与 SHA256 均匹配本地；公开下载的两份更新清单与本地完全一致，两个 AppImage 的公开下载入口及 ELF 文件头已核对。安装包未签名，本轮未执行 Linux GUI 人工验收，arm64 GUI 未在原生机器运行。
- 交叉环境的 ARM 系统根缺少 AppImage 自解包所需 `libz.so`，arm64 AppImage 内容使用原生 `unsquashfs` 核验；该 AppImage 的运行时/GUI 启动不作为本轮通过项。两架构 Electron/CLI 的 ELF 头均正确，AppImage 与 deb 内置 CLI 哈希一致。

| 安装包                                   |        字节 | SHA256                                                             |
| ---------------------------------------- | ----------: | ------------------------------------------------------------------ |
| `opencode-desktop-linux-x86_64.AppImage` | 324,071,050 | `4ea250b92bcf22b11dc6a1b609184c3875d1f27960c511986d617d85d7719244` |
| `opencode-desktop-linux-amd64.deb`       | 270,318,772 | `21a6a8d997a422713f0dadcff07a1135e3ab642a906cba0a1e880a34c79cca16` |
| `opencode-desktop-linux-arm64.AppImage`  | 324,087,839 | `7ecac70310165527e48d5f56e3a068e01eb4f2808e95ef7775b1f671c4591474` |
| `opencode-desktop-linux-arm64.deb`       | 260,156,184 | `57c014465d45863c27a0d809603718e266bf500db52e388c4e53bc6eb5798e3a` |

本轮不修改、新建 PR；未发送测试邀请，后续也不再发送。维护约束见 [维护方法](../maintenance.md)。

## 历史发行清理（2026-10-31）

按用户确认，保留稳定 Latest `v2.2.3-dev-my.3`、Windows 最新测试版 `v2.2.3-dev-my.4`，并保留后续各平台最新测试发行。已删除以下 9 个历史 GitHub Release 及全部资产：`v2.2.3-dev-my.2`、`v2.2.3-dev-my.1`、`v2.2.2-dev-my.2`、`v2.2.1-dev-my.2`、`v2.2.1-dev-my.1`、`v2.2.0-dev-my.4`、`v2.2.0-dev-my.3`、`v2.2.0-dev-my.2`、`v2.2.0-dev-my.1`。累计清理 3,168,724,360 字节（约 2.95 GiB）；独立核验 9 个远端源码标签仍在，Latest 仍为 `.3`。

以下历史条目保留当时的构建和验证事实；上述版本的发行页、安装包链接已失效，不再表示可下载。源码可通过 Git 标签查看。未清理 headless 的分支、标签或 Actions artifacts。

## v2.2.3-dev-my.4 Windows x64 测试预发行

- 发行页：[v2.2.3-dev-my.4](https://github.com/joe-ieta/opencode/releases/tag/v2.2.3-dev-my.4)，2026-10-31 16:42（Asia/Shanghai）已公开，标记为预发行；稳定 Latest 仍为 `v2.2.3-dev-my.3`。
- 构建源码：`0b82c40bff512f3c7a88c612d1caa5d2cceebfef`；功能提交为 `feat(app): add independent Side bar interface mode`，已推送到 `dev-my`。标签固定在该构建提交，发行记录另行提交。
- 保留官方 Top tabs、Side tabs（`vertical`）和 Inbox，新增独立 Side bar（`sidebar`）。官方标签组件恢复到已合入的上游基线；项目分组/简单列表、最近历史、Running sessions、扩展悬浮信息与 Home 服务器项目清单仅在新模式中启用。后台项目登记、会话及权限模型不变。
- 已有 `vertical` 偏好不会自动变成 `sidebar`。安装后需在设置 → 通用 → 界面选择 Side bar；已有分组、排序与隐藏状态保留。
- 验证：根检查 35/35；应用单元测试 945 项、browser 条件测试 303 项；最新生产构建 Home/标签回归 63/63；设置/预览专项 4/4；Windows 打包与安装器测试 20/20。CLI 模型目录检查覆盖 7,646 个模型，隔离服务发现、V1 升级确认和历史迁移冒烟通过。
- 实际 ASAR/CLI 版本、四种模式标记、固定更新源、7-Zip 安装包完整性、`latest.yml` 大小与 SHA512 均通过核验。Windows x64 安装包 `opencode-desktop-win-x64.exe` 为 277,957,439 字节，SHA256 为 `374e365cda476f1a853df72473198998c280f5a453f76ddd5b36df4c3dc9b684`。
- 四个 GitHub 资产（安装包、`latest.yml`、`SHA256SUMS`、`build.json`）的服务端大小与 SHA256 均与本地一致。产物未签名；本次仅构建 Windows x64，Linux/macOS 未构建。
- 发布时等待人工测试；2026-10-31 用户确认通过后，已提交独立模式 [Draft PR #60867](https://github.com/anomalyco/opencode/pull/60867)，目标官方 dev，等待上游设计审核。旧 #60446 已关闭，维护主线仍为 dev-my。

## v2.2.3-dev-my.3 Windows AMD64 + Ubuntu AMD64/ARM64 发行

- 发行页：[v2.2.3-dev-my.3](https://github.com/joe-ieta/opencode/releases/tag/v2.2.3-dev-my.3)，2026-10-31 15:03（Asia/Shanghai）已公开；`draft=false`、`prerelease=false`，并设为 Latest。
- 源码提交：`393c371b654e6afa75828e602bfda70085e1d587`；使用 Bun 1.4.4，Windows 原生构建，Linux 在 WSL2 Ubuntu 24.04 x64 构建；后台渠道为 `dev`，appId 为 `ai.opencode.desktop.dev-my`。
- 相对 `.2` 新增发行工具链支持：`release-my.ts` 的 `--arch=x64|arm64|all`、Linux arm64 目标和 `latest-linux-arm64.yml`，以及 QEMU 下可重试的 `catalog-smoke --via-server`。Windows 与 Linux 产品代码未改变；源码另外包含 Home 页文档提交。
- Ubuntu 24.04 LTS 为本轮重点验证基线，提供 amd64 与 arm64 的 AppImage、deb。x64 原生构建；arm64 在 x64 WSL 上通过 `qemu-user-static`、`libc6-dev-arm64-cross` 和 binfmt 交叉构建，CLI 通过 `QEMU_LD_PREFIX=/usr/aarch64-linux-gnu` 执行。
- 验证结果：Windows 与 WSL 的根检查均 35/35；Windows NSIS、ASAR/CLI 版本、7-Zip 完整性、`latest.yml` SHA512 通过；Linux x64/arm64 的模型目录冒烟各覆盖 7,646 个模型，desktop CLI 服务发现、V1 升级确认和迁移历史冒烟均通过；两架构 ASAR/CLI 版本、AppImage/deb 架构、deb 元数据、更新清单 SHA512/大小和 `SHA256SUMS` 均已核对。
- ARM64 GUI 未在原生 arm64 上运行；本版 ARM64 属于 QEMU 交叉构建和 CLI 冒烟验证，正式 ARM64 GUI 验收仍需原生机器或 runner。Windows GUI 回归也未在本轮重复运行。
- 五个安装包：Windows x64 `277,953,147` 字节，SHA256 `44a32f97461eea5e76f01199fc5022a4628b5557837bc8daeab413c6eb5c9f84`；Linux amd64 AppImage `324,058,263` 字节，SHA256 `a01a26c1176e57213b580325cf0de61d2bd96798debb8f9eb0710060879839bd`；amd64 deb `270,314,328` 字节，SHA256 `6662af88cf532d7d99bcddd65f253835a8000f0a08bffd956bf39ec3e40341a3`；arm64 AppImage `324,077,892` 字节，SHA256 `d873cdf82d17bd3e46b5afb32aefafc4d977ef839aeb0300b864df12b8489ba2`；arm64 deb `260,152,112` 字节，SHA256 `484f8d126836103289cc7c841e4bd89f9edbdaab23970b51ccd4e688e4571fe3`。
- 随包提供 `latest.yml`、`latest-linux.yml`、`latest-linux-arm64.yml`、`SHA256SUMS` 和 `build.json`。10 个资产的服务端大小与 SHA256 均与本地一致。产物未签名，更新源固定于本标签；后续版本手动下载安装。
- Gitee Windows 分卷：[v2.2.3-dev-my.3](https://gitee.com/ieta/opencode-my/releases/tag/v2.2.3-dev-my.3)，含 `part1`–`part3`、Windows `latest.yml`、`SHA256SUMS`、`build.json` 和 `WINDOWS-README.txt`；Linux 资产不在 Gitee，走上游 GitHub Release。

## v2.2.3-dev-my.2 Windows AMD64 发行

- 发行页：[v2.2.3-dev-my.2](https://github.com/joe-ieta/opencode/releases/tag/v2.2.3-dev-my.2)，2026-10-31 13:07（Asia/Shanghai）已公开。按不可变迭代标签约定，在 `.1` 测试预发行之后使用新标签；相对 `.1` 的构建源码 `52e000fc52`，本次构建源码 `f587b0f8a7` 仅多一个发行记录文档提交，功能内容一致。
- 源码提交：`f587b0f8a7755ef1abe51efd19615a906cdc3422`；在 Windows x64 干净克隆以 Bun 1.4.4 构建，后台渠道为 `dev`，appId 为 `ai.opencode.desktop.dev-my`。
- `bun install --frozen-lockfile` 安装 1777 个包；根检查 35/35 通过。本机 Node 22.16 默认无法加载 oxlint 的 TypeScript 插件，需以 `NODE_OPTIONS=--experimental-strip-types` 运行检查；该参数只影响本机 lint 工具加载，不改变构建产物。
- 正式构建完成：更新模型目录；从同一源码构建 baseline CLI；CLI 版本、模型目录与桌面冒烟通过；Electron 构建和 NSIS 打包成功。
- 实际打包的 ASAR 版本为 `2.2.3-dev-my.2`，内置 CLI 为 `opencode v2.2.3-dev-my.2`，Side tabs 文案存在；`app-update.yml` 指向本标签。安装包 `opencode-desktop-win-x64.exe` 为 277,959,249 字节，SHA256 为 `638c4567af5e2732453f92ca5d9880b8dd5118427a3bd106d82f96eff23b3757`；`latest.yml` 的 SHA512 与安装包一致，`SHA256SUMS`、`build.json` 和 7-Zip 完整性均通过。
- 四个资产的服务端大小与 SHA256 均与本地一致；`draft=false`、`prerelease=false`，并设为 Latest。本次未重复运行 `.1` 已完成的完整应用单元测试、browser 条件测试和正式构建 GUI 回归，不把历史结果当作本次验证。
- 随包提供 `latest.yml`、`SHA256SUMS` 与 `build.json`。产物未签名，更新源固定于当前标签；后续版本手动下载安装。本次仅构建 Windows AMD64。

## v2.2.3-dev-my.1 Windows AMD64 测试发行

- 2026-10-30，在独立 `dev-my` 工作区合并官方 `dev@e7acf85bb75fb121c4c53561333938ab91bf1ba1`；相对上次维护分支新增 28 个上游提交，保留已发行历史。本次自动合并没有文本冲突。
- 保留 Side tabs 后续优化：常驻运行区、分支/工作树和运行时长、共享项目与会话历史、每项目默认 5 条和展开、项目新建会话入口、显式隐藏和重新打开恢复。两条 headless 维护线没有改动。
- 桌面维护与发行统一以 `dev-my` 为准；`sidetab-overview` 保持纯上游贡献范围，旧 `sidebar-projects` 仅作原始实现的历史参考。
- 从合并后的协议运行 `packages/client` 的 `bun run generate`，生成结果没有额外差异。根检查 35/35、应用单元测试 945 项、browser 条件测试 303 项、迁移/SQLite/Layer 重点测试 45 项、桌面打包配置 14 项，以及应用/桌面正式 TypeScript 检查通过。
- 验证过程中修正两个已有 E2E 的时序：远端先轮换密码再输入新凭据，避免健康预检查缓存旧服务的拒绝；终端首次连接完成后再刷新，避免误算重连次数。两个场景各重复 10 次（5 workers、无重试），20/20 通过；产品逻辑与断言范围保持原样。
- 正式构建的首页、标签/Side tabs 与持久终端完整浏览器回归 83/83 通过（3 workers、无重试）。
- 构建源码：`52e000fc52b82792e6e1dda8b528c84d9b3b8747`；标签 `v2.2.3-dev-my.1` 固定指向该提交，桌面与内置 CLI 均为 `2.2.3-dev-my.1`，不使用后续文档提交冒充构建来源。
- 实际 ASAR 已核对 Running/Recent、项目分组、新建会话与工作树提示；CLI 模型目录、隔离服务发现、V1 升级确认和迁移历史冒烟通过。固定更新源与本标签一致；7-Zip 安装包完整性、SHA256SUMS 及更新清单的 SHA512/大小均通过校验。
- 安装包 `opencode-desktop-win-x64.exe` 为 277,957,195 字节，SHA256：`1d4a207c611c7f872b9f81238816ce6bd4271a371af892be2aca0462ffd7e376`；随包提供 `latest.yml`、`SHA256SUMS` 和 `build.json`。仅构建 Windows x64，未签名，不替用户安装或重启现有应用/服务。
- 补充服务器 API 回归在 Git Bash 下为 5 项通过、0 项失败；默认 PowerShell 不支持用例中的 `printf` 等 Unix 命令，6 项持久终端测试按上游规则在 Windows 跳过，未记作通过。
- 发布状态：2026-10-31 00:12（Asia/Shanghai）已公开 [Windows 测试预发行](https://github.com/joe-ieta/opencode/releases/tag/v2.2.3-dev-my.1)。四个资产的服务端大小与 SHA256 均与本地一致，`draft=false`、`prerelease=true`；稳定版 Latest 标记保持不变。

| 日期       | 标签                                                                                   | 类型                           | 说明                                                                                                                     |
| ---------- | -------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| 2026-10-31 | [`v2.2.3-dev-my.3`](https://github.com/joe-ieta/opencode/releases/tag/v2.2.3-dev-my.3) | Windows amd64 + Ubuntu 双架构  | 新增 Linux arm64 发行工具链；源码 `393c371b65`，Windows 与 Ubuntu amd64/arm64 同步发行并设为 Latest                      |
| 2026-10-31 | [`v2.2.3-dev-my.2`](https://github.com/joe-ieta/opencode/releases/tag/v2.2.3-dev-my.2) | Windows amd64 二进制发行       | 在 `.1` 测试版之后按不可变标签重新构建；源码 `f587b0f8a7`，正式发行并设为 Latest                                         |
| 2026-10-31 | [`v2.2.3-dev-my.1`](https://github.com/joe-ieta/opencode/releases/tag/v2.2.3-dev-my.1) | Windows AMD64 测试预发行       | 同步官方 V2 2.2.3 的 `e7acf85bb7`；源码 `52e000fc52`，预发行，Latest 保持不变                                            |
| 2026-10-30 | `v2.2.2-dev-my.1`                                                                      | 源码同步标签                   | 同步官方 V2 2.2.2 的 `92b2ca0dd7`，吸收 107 个新上游提交及已合并 PR #60496；包含 fork 文档整理。此轮不构建或发布新安装包 |
| 2026-10-30 | [`v2.2.1-dev-my.2`](https://github.com/joe-ieta/opencode/releases/tag/v2.2.1-dev-my.2) | Windows amd64 二进制发行       | 本地修复未知发布日期模型默认隐藏；源码 `d28cf55b08`，安装包、更新清单、SHA256SUMS、build.json 已发布                     |
| 2026-10-29 | [`v2.2.1-dev-my.1`](https://github.com/joe-ieta/opencode/releases/tag/v2.2.1-dev-my.1) | Windows / Linux x64 二进制发行 | 同步 V2 2.2.1，并补充 Ubuntu AppImage/deb 构建支持                                                                       |
| 2026-10-29 | [`v2.2.0-dev-my.4`](https://github.com/joe-ieta/opencode/releases/tag/v2.2.0-dev-my.4) | Windows amd64 二进制发行       | Side tabs 项目计数、最近活动与任务观察窗完善；旧发行作为历史参考                                                         |

## v2.2.2-dev-my.2 Windows AMD64 发行

- 发行页：[v2.2.2-dev-my.2](https://github.com/joe-ieta/opencode/releases/tag/v2.2.2-dev-my.2)，2026-10-30。
- 源码提交：`8a6320092373addc2ba9ef67b19287e43ff53399`；在独立工作区以 Bun 1.4.4 构建，后台渠道为 `dev`，appId 为 `ai.opencode.desktop.dev-my`。
- 包含 V2 2.2.2 上游同步、服务器项目历史与显式隐藏状态、Side tabs 的分支/工作树提示和项目新建会话入口；Recent sessions 仅列主会话。
- 根检查 35 个任务、应用单元测试 941 项、正式 TypeScript 检查、正式构建首页/标签回归 62 项通过；CLI 模型目录、服务发现、V1 升级确认与迁移历史冒烟通过。
- 实际打包的 ASAR 已核对项目隐藏与侧栏新入口/工作树提示、应用版本；安装包 `opencode-desktop-win-x64.exe` 为 277,917,998 字节，SHA256 为 `d8ef81e2757f7a831a0882623e403df2d967b8655fd744117c2af5a3ce5326da`。
- 随包提供 `latest.yml`、`SHA256SUMS` 与 `build.json`。产物未签名，更新源固定于当前标签；后续版本手动下载安装。本次仅构建 Windows AMD64。

## v2.2.2-dev-my.1 同步内容

- 上游基线：`92b2ca0dd727942e00aba3523ed141d53e78ea28`，相对上一发行源码新增 107 个可达上游提交。
- 已接受的贡献：[#60496](https://github.com/anomalyco/opencode/pull/60496)，最终合并提交 `986221af346f`。模型适配器及其测试采用最终上游版本，保留已知/未知日期回归与新推理能力测试。
- 其他上游进展包含 Claude Agent provider、OpenTUI 0.8.0、托管策略与接口演进、桌面窗口恢复、HTTP 来源兼容和界面性能修复；完整列表以两次上游基线之间的 Git 日志为准。
- 本地保留 Side tabs、V1 单向升级确认、迁移清理批次提交/恢复、SQLite 错误分类、Layer 依赖诊断，以及独立桌面身份/同源码 CLI 打包约定。
- 会话缓存冲突合并了两端行为：保留侧栏轻量投影使用的删除过滤器，同时采用上游成功删除后的缓存/活动清理。lockfile 保留新 OpenTUI 0.8.0 条目；从合并后的协议重新生成客户端，未手改生成文件。
- 三个维护分支的专属说明已集中到 [docs/fork](../README.md)，本次只同步 dev-my，不改变两条 headless 的基线或发行标签。

## v2.2.2-dev-my.1 验证

集成提交：`1dfa6ca79c`；后续文档记录提交与该集成提交一起纳入源码标签。

- `bun run check`：35 个任务全部通过。
- 应用单元测试：941 项通过。
- V1 迁移、SQLite 与 Layer 依赖校验重点测试：45 项通过。
- 桌面打包配置测试：14 项通过。
- 应用 `bun run typecheck:tsc`：通过。
- 正式构建的首页、标签/Side tabs、模型选择 Playwright 回归：64 项通过，3 workers、无重试。
- 从合并后协议执行 `packages/client` 的 `bun run generate`；模型适配器和测试与最终上游版本一致。
- 项目文档共 41 份，388 个内部链接与 30 个来源固定引用检查通过；格式检查通过。

本轮未运行新的 headless 三平台构建，也未生成新的桌面安装包；这些验证不替代后续二进制发行的 CLI/安装包冒烟。

本轮合并范围：[上一源码标签到本次标签](https://github.com/joe-ieta/opencode/compare/v2.2.1-dev-my.2...v2.2.2-dev-my.1)。详细本地检查日志位于 `.cache/dev-my-sync-*.log`，不随源码提交。
