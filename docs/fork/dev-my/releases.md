# dev-my 发行与源码同步记录

二进制发行以 [GitHub Releases](https://github.com/joe-ieta/opencode/releases) 的实际资产为准。源码标签只证明提交已标记，不代表为该版本构建或上传了安装包。环境准备、构建和排障见 [发布环境与多架构构建](../KB/release-environment.md)。

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
- Gitee 镜像发行页：[v2.2.3-dev-my.3](https://gitee.com/ieta/opencode-my/releases/tag/v2.2.3-dev-my.3)。Gitee 社区版限制单附件 100 MB、单仓库附件总容量 1 GB，因此该页仅上传 `SHA256SUMS`、`build.json` 和三个 `latest*.yml`，大安装包在发行说明中链接 GitHub；实际二进制仍以 GitHub 为准。

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
