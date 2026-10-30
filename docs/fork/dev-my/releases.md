# dev-my 发行与源码同步记录

二进制发行以 [GitHub Releases](https://github.com/joe-ieta/opencode/releases) 的实际资产为准。源码标签只证明提交已标记，不代表为该版本构建或上传了安装包。

## v2.2.3 同步与 Windows 测试候选

- 2026-10-30，在独立 `dev-my` 工作区合并官方 `dev@e7acf85bb75fb121c4c53561333938ab91bf1ba1`；相对上次维护分支新增 28 个上游提交，保留已发行历史。本次自动合并没有文本冲突。
- 保留 Side tabs 后续优化：常驻运行区、分支/工作树和运行时长、共享项目与会话历史、每项目默认 5 条和展开、项目新建会话入口、显式隐藏和重新打开恢复。两条 headless 维护线没有改动。
- 桌面维护与发行统一以 `dev-my` 为准；`sidetab-overview` 保持纯上游贡献范围，旧 `sidebar-projects` 仅作原始实现的历史参考。
- 从合并后的协议运行 `packages/client` 的 `bun run generate`，生成结果没有额外差异。根检查 35/35、应用单元测试 945 项、browser 条件测试 303 项、迁移/SQLite/Layer 重点测试 45 项、桌面打包配置 14 项，以及应用/桌面正式 TypeScript 检查通过。
- 验证过程中修正两个已有 E2E 的时序：远端先轮换密码再输入新凭据，避免健康预检查缓存旧服务的拒绝；终端首次连接完成后再刷新，避免误算重连次数。两个场景各重复 10 次（5 workers、无重试），20/20 通过；产品逻辑与断言范围保持原样。
- 正式构建的首页、标签/Side tabs 与持久终端完整浏览器回归 83/83 通过（3 workers、无重试）。计划测试版本为 `2.2.3-dev-my.1`；实际源码提交、安装包哈希和发布状态在构建验收后补录。

| 日期       | 标签                                                                                   | 类型                           | 说明                                                                                                                     |
| ---------- | -------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
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

## 本次验证

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
