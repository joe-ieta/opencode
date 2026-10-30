# dev-my 发行与源码同步记录

二进制发行以 [GitHub Releases](https://github.com/joe-ieta/opencode/releases) 的实际资产为准。源码标签只证明提交已标记，不代表为该版本构建或上传了安装包。

| 日期       | 标签                                                                                   | 类型                           | 说明                                                                                                                     |
| ---------- | -------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| 2026-10-30 | `v2.2.2-dev-my.1`                                                                      | 源码同步标签                   | 同步官方 V2 2.2.2 的 `92b2ca0dd7`，吸收 107 个新上游提交及已合并 PR #60496；包含 fork 文档整理。此轮不构建或发布新安装包 |
| 2026-10-30 | [`v2.2.1-dev-my.2`](https://github.com/joe-ieta/opencode/releases/tag/v2.2.1-dev-my.2) | Windows amd64 二进制发行       | 本地修复未知发布日期模型默认隐藏；源码 `d28cf55b08`，安装包、更新清单、SHA256SUMS、build.json 已发布                     |
| 2026-10-29 | [`v2.2.1-dev-my.1`](https://github.com/joe-ieta/opencode/releases/tag/v2.2.1-dev-my.1) | Windows / Linux x64 二进制发行 | 同步 V2 2.2.1，并补充 Ubuntu AppImage/deb 构建支持                                                                       |
| 2026-10-29 | [`v2.2.0-dev-my.4`](https://github.com/joe-ieta/opencode/releases/tag/v2.2.0-dev-my.4) | Windows amd64 二进制发行       | Side tabs 项目计数、最近活动与任务观察窗完善；旧发行作为历史参考                                                         |

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
