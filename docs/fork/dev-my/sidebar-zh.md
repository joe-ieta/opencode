# Side bar 简体中文翻译核对

核对日期：2026-10-31（Asia/Shanghai）。本次在 `dev-my` 单独补齐前次检查缺少的 29 个 `zh` 词条；加上原有 2 个词条，相关 31 个键均有简体中文值。英文源文案和键、繁体中文及其他语言未修改，不修改或新建 PR，不发送测试邀请。

## 用词与语义

| 概念 | 简体中文 | 核对要点 |
| --- | --- | --- |
| Side bar | 侧栏 | 对应新增第四种界面模式；与官方 Side tabs 的既有标签模式区分。 |
| Session / Project | 会话 / 项目 | 沿用应用既有中文词典，不把项目改称目录或工作区。 |
| Worktree / Branch | 工作树 / 分支 | 使用维护中的 VS Code 简体中文 Git 译名；与 Workspace（工作区）区分。 |
| Running sessions | 运行中的会话 | 忠实于英文标题；区域仍包含工作中及等待输入/批准的会话，不修改状态范围。 |
| More / Show less | 更多 / 收起 | 展开额外历史或恢复五行预览，不表示折叠整个项目。 |
| Hide from recent sessions | 从最近会话中隐藏 | 与关闭、删除区分，保留原有数据和操作语义。 |

完整说明使用中文句号、提示字段使用中文冒号、更多数量使用中文括号；保留全部 `{{...}}` 占位符和项目名、路径、分支名等动态值。按 CLDR 的中文 `other` 规则，0、1、多个数量采用相同句式；已有 `.one` / `.other` 键均补齐中文，组件仍通过共享 `language.plural` 选择，不增加语言分支。

时长以紧凑的“小时”“天”显示。计数说明区分“已显示”“最近”“项目历史共”，不把预览数当作全部历史数量。本次 29 个新增值没有保留英文；OpenCode 产品名、用户数据及其他既有共享界面词条仍遵循各自字典，不据此声称整个应用已完成中文翻译。

## 参考资料

- [VS Code 简体中文 Git 语言包](https://github.com/microsoft/vscode-loc/blob/main/i18n/vscode-language-pack-zh-hans/translations/extensions/vscode.git.i18n.json)：核对工作树、分支、工作区等开发术语及带动态值的提示。
- [Firefox 简体中文侧栏语言文件](https://github.com/mozilla-l10n/firefox-l10n/blob/main/zh-CN/browser/browser/sidebar.ftl)：核对侧栏、标签页、历史记录与侧栏操作的语境。Apple 等产品也有“侧边栏”的用法；本次采用 Firefox 的简短译名“侧栏”。
- [Unicode CLDR 中文复数规则](https://www.unicode.org/cldr/charts/49/supplemental/language_plural_rules.html#zh)：中文数量采用 `other`。
- [Microsoft 本地化风格指南入口](https://learn.microsoft.com/en-us/globalization/reference/microsoft-style-guides)及其维护中的 VS Code 实际中文文案，用于核对面向开发者的界面习惯。
- [GB/T 15834-2011 标点符号用法（政府网站转载）](https://www.zhangye.gov.cn/szb/dzdt/zsbx/201811/t20181129_138125_ghb.html)：核对说明句和提示字段的中文标点。

## 验证

- 精确增加 29 个中文键；相关 31/31 个键已覆盖，英文回退为 0，占位符与英文源一致；英文源及其他语言未改动。
- 根目录 `bun run check` 35/35；现有语言及桌面语言映射测试 21/21（467 项断言）；既有 Windows 安装器和打包配置测试 18/18。
- 隔离的生产界面夹具覆盖 0/1/2 个运行会话、小时/天、空项目计数、更多/收起、项目新建会话、简单列表/按项目、隐藏操作、分支/工作树/结束时间及设置卡片。相关截图已复核。

以上是自动检查和术语/语义核对，不等同于已完成 Windows 安装后的人工验收。发行来源、安装包和远端校验结果单独记录在 [发行记录](releases.md)。

本次 Windows 测试包已发布为 [v2.2.3-dev-my.6](https://github.com/joe-ieta/opencode/releases/tag/v2.2.3-dev-my.6)，实际包内中文值、版本、完整性与远端资产已核验，尚未安装后人工验收。Linux `.5` 包未包含本次翻译。
