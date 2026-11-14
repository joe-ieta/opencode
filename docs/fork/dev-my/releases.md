# dev-my 发行与源码同步记录

二进制发行以 [GitHub Releases](https://github.com/joe-ieta/opencode/releases) 的完整资产为准。自 2026-11-02 起，所有平台仅使用本仓库 GitHub 的完整安装包与更新清单；旧镜像和分卷流程已停用。源码标签只证明提交已标记，不代表为该版本构建或上传了安装包。环境准备、构建和排障见 [发布环境与多架构构建](../KB/release-environment.md)。

## 当前下载

| 通道         | 版本              | 平台               | 下载                                                                               |
| ------------ | ----------------- | ------------------ | ---------------------------------------------------------------------------------- |
| Windows | `v2.2.6-my.1` | Windows x64 | [NSIS 安装包](https://github.com/joe-ieta/opencode/releases/tag/v2.2.6-my.1) |
| Linux | `v2.2.6-my.1` | Ubuntu amd64/arm64 | [AppImage / deb](https://github.com/joe-ieta/opencode/releases/tag/v2.2.6-my.1) |

`v2.2.6-my.1` 为 Windows 和 Linux 的正式发行，已设为 GitHub Latest。全部平台统一使用 GitHub 完整安装包，Gitee 已停用。需要独立下载源时可参考 [自建发布物存储](../KB/self-hosted-release-storage.md) 草案，当前尚未接入。历史源码标签不代表旧 Release 资产仍可下载。

## 2026-11-14：同步官方 dev 至 2.3.0 源码

- 从 `upstream/dev` 合入 `f0089856c07eded13396a0a0d05f19f1718be7b9`，相对上一基线新增 227 个提交；`origin/dev` 同步为该官方提交的镜像。
- 保留独立 Side bar、项目计数、完整会话索引与 Running，接入上游共享会话排序、新侧栏分组和 Recent 视图；适配后台作业活动通知及子会话测试依赖。
- 修正本地与上游隐藏会话词条重名，以及新增灰阶检查在 Windows 路径下无法匹配既有例外的问题。公共协议合并后重新运行客户端生成器。
- 验证通过：根目录 `bun run check`（35/35 项）、App 官方 TypeScript 检查、应用单元测试 2,723 项、核心作业/活动/执行/子会话测试 94 项，以及生产 Chromium 的 Home/标签/Side bar 回归 113 项（无重试）。共享索引和侧栏排序用例重复 10 次，合计 210 项通过。浏览器回归验证了重命名缓存、关闭菜单及执行完成后的重排。
- 额外的 `typecheck:e2e` 未通过：共 190 条诊断，包含其他回归用例的旧字段、未使用变量及 E2E 配置缺少 CSS/Vite 类型等；本轮修改的 Home/tabs 用例和 mock-server 未报类型错误。Home 性能基准 `exp_d319fa` 因测试浏览器 CDP 连接中断而未完成，不据此作性能结论。
- 本次为源码同步，已验收的 `v2.2.6-my.1` 安装包、标签与 Latest 发行保持原样。

## v2.2.6-my.1 Windows x64 与 Linux amd64/arm64 正式发行

- 2026-11-10 18:45:29（Asia/Shanghai）公开为测试预发行，`draft=false`、`prerelease=true`，发布时设置 `--latest=false`。[GitHub Release](https://github.com/joe-ieta/opencode/releases/tag/v2.2.6-my.1)
- 2026-11-10，用户确认 Windows 本地验证通过；沿用同一源码标签和四个已验证资产，转为正式发行（`prerelease=false`）并设为 GitHub Latest。
- 构建源码为 `231de37312ef7172cb6be387ea89d6a427934555`。维护分支 `dev-my` 合入官方 `dev@57719d7fd400721783a059fee78c7d33a21cd9b6`，相对上次官方基线新增 78 个提交，版本更新为 2.2.6。
- Side bar 增加项目计数、固定项目下置及按需显示的 origin/upstream 提示。保留 my.7 的 Home/Side bar 共享项目缓存、会话索引和 Running 分支加载实现，避免引入旧贡献稿的重复逻辑。
- 合入官方会话已读/未读菜单、侧面板关闭与恢复快捷键、GitHub Copilot Auto、OpenAI/Google/Vertex 嵌入模型入口，以及 OAuth 刷新、Claude Agent 会话、缓存预热和会话生成用量统计修复。
- 简洁性审阅：远程提示复用现有 VCS 缓存，不增加独立轮询或持久化；Copilot Auto 复用模型解析 hook，嵌入模型复用请求执行器。新增远程信息放入 `experimental.remotes`，客户端与 OpenAPI 由生成器更新；修正带凭据和端口的 HTTPS 地址被误判为 SCP 地址的问题，提示移除凭据、查询参数和片段，并保留端口。地址回归用例已验证修复前失败、修复后通过。
- 按本仓库明确约束保留服务端非阻塞插件加载，未采纳官方本轮临时等待插件并超时返回 503 的补丁。
- 根检查 34/34 项、App 官方 TypeScript 检查、相关单元测试 222 项、生产 Chromium 回归 115 项及 Side bar 重点重复回归 40 项通过；浏览器测试均无重试。VCS 套件在本机默认 30 秒预算下出现真实 Git 进程超时及随后清理临时目录的 `EBUSY`，诊断运行中的远程信息用例通过，未将整套 VCS 测试记为通过。
- Bun 1.4.4 构建，模型目录比较覆盖 7,676 个模型；CLI 服务发现、V1 升级确认与历史迁移冒烟通过。NSIS 完整性、实际 ASAR/CLI 版本、项目管理资源、固定标签更新源及清单 SHA512/大小已核验。
- 安装包 `opencode-desktop-win-x64.exe` 为 281,699,674 字节，SHA256 为 `cadb9c9c32c8ce331e8c19d5482a9318632e7a07ec6c504096f3cbd8c4cdc9dd`。本地路径为 `dist/releases/v2.2.6-my.1/opencode-desktop-win-x64.exe`。安装包未签名，Windows 本地安装验证已由用户确认通过；初次发布仅含 Windows x64，Linux 追加记录见下。
- Windows 初次发行时，四个 GitHub 资产的服务端大小及 SHA256 与本地一致；三份清单的完整公开下载、安装器公开下载入口、总大小和 65,536 字节文件头均核验通过。源码标签固定在上述构建提交，发行文档另行提交。
- 原 `origin/dev@171d675ae1a233c891c13f47e68003bc99aeb3a7` 的 fork 历史已完整保存到 `origin/dev-my`，随后使用租约校验将 `origin/dev` 恢复为上述官方提交的镜像。默认分支仍为 `dev-my`。
- 2026-11-13（Asia/Shanghai），在同一正式 Release 追加 Linux amd64/arm64 的 AppImage、deb 和两份更新清单。构建使用同一不可变源码标签及 Windows 模型快照，快照 SHA256 为 `6a14794d0dc259042e56fc52b1e974cdd091247a99c3ba23d1c9490e330ed087`。
- Linux 环境为 Ubuntu 24.04.5 容器、Node 24.15.0、Bun 1.4.4。完整检查 34/34 项通过；两个架构各比较 7,676 个模型，并通过 CLI 服务发现、V1 升级确认和历史迁移冒烟。
- 四个安装包均已实际解包，核验 Electron、CLI、终端组件的架构、ASAR 版本与界面资源、桌面入口、metainfo 及更新源；同架构 AppImage/deb 的 ASAR 与 CLI 相同，包内 CLI 与构建所用二进制一致。两份 Linux 更新清单的 SHA512、文件大小和目标架构匹配。
- ARM64 AppImage 沿用静态启动器（`toolsets.appimage=1.0.3`）。ARM64 CLI 及 AppImage 解包通过 QEMU 执行。
- 2026-11-13（Asia/Shanghai），用户确认 Linux 本地验证通过；Windows 与 Linux 的本地验收均已完成。
- 联合 `SHA256SUMS` 覆盖全部 5 个安装包，`build.json` 记录三个构建目标。全部 10 个 GitHub 资产的大小及 SHA256 均已验证，公开清单完整下载与各安装包的 65,536 字节范围下载均匹配本地。原 Windows 安装包与 `latest.yml` 的资产 ID、大小及摘要保持一致；Release 仍为正式版及 Latest。

| 安装包 | 字节 | SHA256 |
| --- | ---: | --- |
| `opencode-desktop-linux-x86_64.AppImage` | 328,499,886 | `886b4fa551c18ed4cb8e40560bdf542351044a74df5436db6f02ac1a4559fd04` |
| `opencode-desktop-linux-amd64.deb` | 274,221,356 | `9719ce99d315e19ee8d777e3c256b714c5a79110bd13c60696ff17929c84f8d9` |
| `opencode-desktop-linux-arm64.AppImage` | 306,429,237 | `3b9cebd88087adf8a86bef9daa07690ce430deaeb7cf6df847b86041b0c4ea8f` |
| `opencode-desktop-linux-arm64.deb` | 263,897,780 | `d7052aeb250c5814d2f12d1ff7feadc7a2c0c5786c7f2d9eb40e375ca9c422ae` |

## v2.2.5-my.7 Windows x64 与 Linux amd64/arm64 正式发行

- 2026-11-09 17:23:21（Asia/Shanghai）公开为 Windows x64 测试预发行，`draft=false`、`prerelease=true`，设置 `--latest=false`。[GitHub Release](https://github.com/joe-ieta/opencode/releases/tag/v2.2.5-my.7)
- 构建源码为 `5e4e2bd7033fa86e3beaf8026f25e26ec5fab21f`，已合入官方 `dev@12a661ea40`。Side bar 的项目、会话行、草稿和 Running 各有独立模块。Home 和 Side bar 共用项目操作与会话索引，项目清单与保留的会话行共用一个缓存快照。
- Running 保留全局后台活动与子会话显示，复用 Inbox 的分支重试和时长格式化，按会话行加载信息及待处理请求。
- 完整检查 33 项、正式 App TypeScript 检查、相关单元测试 46 项和生产 Chromium 回归 102 项通过。模型目录比较覆盖 7,645 个模型，CLI 服务发现与 V1 历史迁移冒烟通过。
- NSIS 完整性、ASAR 和内置 CLI 版本、固定标签更新源、清单和四个远端资产摘要已核验。安装包 `opencode-desktop-win-x64.exe` 为 281,676,454 字节，SHA256 为 `9b3ea0ef4cc60199b462c8b247d41bc2ea805522c5142089529c88f13cfc5826`。安装包未签名。
- 2026-11-09（Asia/Shanghai），用户确认 Windows x64 安装和 Side bar 项目管理手工测试均通过。
- Windows 验收通过后，以同一不可变标签和同一模型快照在 Ubuntu 24.04 容器中构建 Linux x64、ARM64 的 AppImage 和 deb。ARM64 AppImage 使用 Electron Builder 的静态启动器（`toolsets.appimage=1.0.3`）。GitHub Release 已转为正式发行并设为 Latest。
- Linux 完整检查 33 项通过。两种架构的 7,645 个模型目录、服务发现、V1 迁移及历史冒烟通过。已从实际安装包核验 ELF、ASAR、CLI、原生终端组件和更新源。ARM64 冒烟使用模拟环境，Linux 桌面未做人工验收。
- 两份 Linux 更新清单和全部 10 个 GitHub 资产的大小与摘要已核对。联合 `SHA256SUMS` 覆盖 5 个安装包，`build.json` 记录三种构建目标。安装包未签名。

## v2.2.5-my.6 Windows x64 测试预发行

- 2026-11-09 00:36:36（Asia/Shanghai）公开为 Windows x64 测试预发行，`draft=false`、`prerelease=true`，发布时设置 `--latest=false`。[GitHub Release](https://github.com/joe-ieta/opencode/releases/tag/v2.2.5-my.6)
- 构建源码为 `ca61e332a34fa4bd2aa1eeef9c11930817bbf3ba`，基于已同步官方 `dev@caf8d6a554ecd988767c08f1f15508849eff8728` 的 `dev-my`。用户于 2026-11-08 确认 Windows 安装后的手工测试通过，`project-management` 随后快进合入 `dev-my`。
- 吸收 [PR #2](https://github.com/joe-ieta/opencode/pull/2) 的 Home 项目管理共享思路：Side bar 增加相同的项目菜单及添加项目入口，支持编辑、复制路径、关闭/重新打开、导入/新建会话及导出会话。Side bar 只按项目显示，栏目使用 Projects，保留草稿和运行会话；同时修复新草稿在冷加载时未及时持久化的问题。
- 合入前完整根检查 33 项、相关单元测试 35 项、生产 Chromium Home/标签回归 102 项及重点重复回归 30 项通过；浏览器回归均无重试。
- 合入后重新构建生产界面，6/6 Chromium 冒烟通过（三 workers、无重试），覆盖 Home/Side bar 项目共享、项目菜单与编辑、关闭/重新打开后的草稿及运行会话保留、整组收起、历史同步和旧 List 设置兼容。
- 使用 Bun 1.4.4 构建。模型目录完整比较 7,660 个模型；单次请求遇到五秒插件激活超时后，通过已有 `--via-server` 模式复验。隔离的服务发现、V1 升级确认及迁移历史冒烟通过。
- 实际安装包的 ASAR/CLI 版本、项目管理资源、NSIS 完整性、固定标签更新源、SHA256SUMS 和更新清单 SHA512/大小均通过校验；产物未签名。
- 安装包位于 `dist/releases/v2.2.5-my.6/opencode-desktop-win-x64.exe`，281,873,709 字节，SHA256 为 `5bd579bd793ca7671e33e6b9f57d7aacb53ba5f5b85241aff05b3a12408223bb`。源码标签固定在构建提交，四个 GitHub 资产的服务端大小及 SHA256 与本地一致。
- 三份清单的完整公开下载与本地一致；安装器公开下载入口、总大小及 65,536 字节文件头均已验证。稳定 Latest 接口仍返回 404，本次未改变 Latest。临时分支 `project-management` 的本地和远程引用已在确认完全合入且无开放 PR 后删除。

## v2.2.5-my.5 Windows x64 测试预发行

- 2026-11-06 01:27:28（Asia/Shanghai）公开为 Windows x64 测试预发行，设置 `--latest=false`。[GitHub Release](https://github.com/joe-ieta/opencode/releases/tag/v2.2.5-my.5)
- 构建源码 `02457d62e2dc12674041aaf5dc6dedcea04e1291` 合入官方 `dev@1009033569e3a31bcfc1dab857c2a66db82dbdeb` 和 PR `2de04af2cd0ca555b8393ecb1411e46663d694bb`。应用标识为 `ai.opencode.desktop.dev-my`，更新源固定在本发行标签。
- Inbox 首屏通过上游状态机等待活动快照和工作会话的权限及表单查询。超时后展示已有内容，之后的活动更新继续刷新现有界面。
- PR 根检查 35 项、应用相关单测 22 项、客户端会话数据测试 35 项、生产 Chromium 回归 19 项通过。修复前的两次隔离对照均复现 Inbox 提前展示。发行源码根检查 35 项和生产 Chromium 回归 21 项通过。
- Bun 1.4.4 构建，比较 7,658 个模型，通过服务发现、V1 升级确认和历史迁移冒烟。NSIS、内置 ASAR 与 CLI、固定标签更新源及 `latest.yml` 校验通过。安装器 `opencode-desktop-win-x64.exe` 为 281,105,297 字节，SHA256 为 `b9db3afbf5498c28430635ff5ed82d81e2bb27edbff0461da63d22c6ec709b5c`。四个 GitHub 资产的服务端摘要及公开下载均与本地一致。
- 安装包未签名，Windows 安装后人工验收待完成。

## v2.2.5-my.4 Windows x64 测试预发行

- 2026-11-05 23:54:42（Asia/Shanghai）公开，`draft=false`、`prerelease=true`，发布时设置 `--latest=false`。提供 Windows x64 完整安装包。[GitHub Release](https://github.com/joe-ieta/opencode/releases/tag/v2.2.5-my.4)
- 构建源码 `0eb91d7ea1b2d40326673d231c1bfb673d6713df` 合入官方 `dev@6bd47192ac97527e9fdc5e64c36fd4730aec2acd` 及 Side bar 贡献稿 `ad6923e0c30de156d951a240b511646d865d8ea2`。应用标识为 `ai.opencode.desktop.dev-my`，更新源固定在本发行标签。
- 底部 Running 随模型执行和后台 Shell 活动刷新。活动会话在项目内置顶，结束后将重新计算的顺序保存到已有手动排序的列表。Inbox 首屏等待活动状态同步后显示提示。
- 自动验证通过根检查 35 项、应用单元测试 2,406 项和生产 Chromium 回归 180 项。Bun 1.4.4 构建，比较 7,658 个内置模型，通过服务发现、V1 升级确认和历史迁移冒烟。独立 E2E 类型检查仍有 12 条上游基线已有的 fixture 诊断。
- 已核对 NSIS 完整性、内置 ASAR 与 CLI 版本、更新源及 `latest.yml` 的 SHA512 和大小。安装器 `opencode-desktop-win-x64.exe` 为 281,014,299 字节，SHA256 为 `c460b738fe7d26a0aa5789e8873f7559b84051509af200446bc30028e30e9d58`。四个 GitHub 资产的服务端摘要及公开下载均与本地一致。
- 安装包未签名，Windows 安装后人工验收待完成。

## v2.2.5-my.3 Windows x64 测试预发行

- [GitHub Release](https://github.com/joe-ieta/opencode/releases/tag/v2.2.5-my.3) 于 2026/11/3 15:28:47（Asia/Shanghai）公开，`draft=false`、`prerelease=true`；仅发布 Windows x64，本轮未重建 Linux。
- 不可变构建源码为 `97c429b635882143714d13702defda324b3d818f`，版本号改为 `2.2.5-my.3`，应用标识仍为 `ai.opencode.desktop.dev-my`。后续文档合并提交不作为二进制构建来源。
- 修复模型执行结束后后台 Shell 未纳入会话活动汇总的问题。兼容旧后端活动接口 404，侧栏、Running 与根会话标题跟随 Shell 活动显示和清除；模型执行、排队和中断状态保持独立。只读现场核验确认模型空闲、Shell 运行时汇总仍忙碌，服务注册未改变。
- 包含项目名称排序、独立固定区域及 40% 上限、滚动条、折叠未读提示、底部最多五行 Running 区域、无占位的悬浮操作、草稿标识，以及右键菜单 Close。
- 自动验证：根检查 35/35；Home/tabs 73/73、零重试；客户端相关测试 40/40；桌面打包相关测试 24/24。应用及客户端官方 TypeScript 检查通过，E2E 仍有原有 13 处类型诊断。
- Bun 1.4.4 构建；模型目录比较覆盖 7,657 个模型，CLI 服务发现、V1 升级确认与历史迁移冒烟通过。实际 ASAR/CLI 版本、既有 31 个中文词条、更新源、NSIS 完整性及 latest.yml 的 SHA512/大小均已核验。
- 安装器 `opencode-desktop-win-x64.exe` 为 279,878,027 字节，SHA256 `a8b78309bdd88521d6831cedc081c3dd36c1fe193a4b26596aa093259f77fe96`。四个远端资产大小及 SHA256 与本地一致；四个公开下载文件再次核对一致。
- 安装包未签名；用户于 2026-11-03 确认 Windows x64 安装后人工验收通过。验收后按用户要求将对应界面改动整理同步至 PR #60867，来源提交 `703db47378ab63960fc53899b0ae389b9dc3994d`，保留 Draft 等待上游设计评审。未重启用户应用或后台，也未发送测试邀请。
- 合并了 GitHub 上并行的文档更新；Gitee 不再作为远端或发行目标，未上传本版任何数据，也未清理历史远端资产。

### 2026-11-03 验收后的 PR 更新

- 既有 [PR #60867](https://github.com/anomalyco/opencode/pull/60867) 从 `b88b94a75d` 更新为 `703db47378`，先同步官方 `dev@3ba597f776`，再迁入已验收的 Side bar 改动；维护仍统一在 `dev-my`，贡献工作区保持 detached。
- 差异共 41 个文件：38 个应用文件及客户端 Shell 缓存读取、图标类型和目录；不包含 fork 服务端/协议、goal state、品牌或发行代码。复用已有 Shell 列表和事件，没有新增 HTTP 接口。
- 独立贡献验证：根检查 35/35，应用/客户端官方 TypeScript 检查通过，客户端数据测试 35/35，生产 Home/tabs 77/77，关键场景五并发重复 50/50、零重试。E2E 原有 13 处类型诊断保持不变；Windows 声明链接仅在检查时按导入解析，已恢复且不进入 PR。
- 导航基准前后各串行三次：内容首次显示中位数 551.5→511.4 ms，全部里程碑稳定 635.9→566.8 ms。此对照包含上游同步，小样本不用于推断性能提升；原始记录位于贡献工作区 `.cache/pr60867-{before,after}-benchmark.log`。
- PR 描述已更新为当前布局，并替换过时截图为 240×72 动画 SVG。GitHub check-standards/check-compliance 通过，PR 可合并但保留 Draft；人工验收不等于上游设计批准。

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
