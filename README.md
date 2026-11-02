# OpenCode My

[简体中文](#简体中文) | [English](#english)

面向日常开发的桌面 AI 编程工作台。基于 OpenCode，保留完整的编程与智能体能力，重点优化使用界面、个性化流程和本地模型体验。

A desktop AI coding workspace for everyday development. Built on OpenCode, it retains the full coding and agent capabilities while improving the interface, personal workflows, and local model experience.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/fork/dev-my/sidetab-overview-dark.png">
    <img src="docs/fork/dev-my/sidetab-overview-light.png" alt="OpenCode My Side bar 任务概览 / session overview" width="300">
  </picture>
</p>
<p align="center"><sub>Side bar（本地模式）：运行中的任务、按项目分组的最近会话、分支与运行时长一屏可见。截图为合成数据。<br>Side bar (local mode): running tasks, recent sessions grouped by project, branches, and elapsed time in one view. The screenshot uses synthetic data.</sub></p>

## 简体中文

自 Windows 测试版 `v2.2.3-dev-my.4` 起，任务概览独立为第四种 Side bar；官方 Side tabs 保持原行为。[设计与验证记录](docs/fork/dev-my/sidebar-mode.md)。稳定 Latest 仍为 `v2.2.3-dev-my.3`，Windows 完整安装包在 [GitHub Release](https://github.com/joe-ieta/opencode/releases/tag/v2.2.3-dev-my.3)。

最新测试版 [v2.2.5-dev-my.2](https://github.com/joe-ieta/opencode/releases/tag/v2.2.5-dev-my.2) 提供 Windows x64 完整安装包与 Linux amd64/arm64 AppImage/deb。三个目标安装包提测试核验；安装文件未签名。详情见 [发行记录](docs/fork/dev-my/releases.md)。

`dev-my` 已吸收上游 V2 2.2.5 `dev@ff90ed9160`，保留项目整组收起、分组排序、深层子智能体状态与标题方向修复。Side bar 开发统一在 `dev-my`。

### 项目定位

OpenCode My 把改动集中在每天都会用到的三件事上：

- **使用界面优化**：新增本地 Side bar（`sidebar`）模式，将首页、运行任务、最近会话和项目历史收进同一个侧栏；官方 Top tabs、Side tabs 和 Inbox 继续跟随上游。正在运行的任务即使没有打开标签也能看到，分支、工作树和运行时长随任务更新。
- **个性化流程定制**：最近会话默认按项目分组，每个项目默认显示 5 条并可展开；项目旁可直接新建会话。关闭标签或隐藏历史条目会保留会话，Home/搜索可重新打开。
- **本地使用偏好**：沿用系统语言与主题，记住标签布局、分组和排序偏好；项目、会话历史与配置保存在本机，使用本地模型不依赖额外的云端账户。

欢迎在 [Issues](https://github.com/joe-ieta/opencode/issues) 提出功能建议或反馈问题，帮助我们改善界面、消息查看等使用体验，尤其是长任务跟踪和多项目并发开发监控。我们会尽力改进完善。

### 项目来源

OpenCode My 在 [joe-ieta/opencode](https://github.com/joe-ieta/opencode) 维护，官方上游为 [anomalyco/opencode](https://github.com/anomalyco/opencode)，发行桌面应用 **OpenCode My**。

### 本地模型支持

本地模型沿用 OpenCode provider 体系，不另造一套接口，配置和切换更直接：

- 统一走 OpenAI 兼容配置与本地模型发现，Ollama、LM Studio、vLLM、llama.cpp 等本地服务可按同一方式接入。
- 本地模型与云端模型共用模型选择、会话和工具流程，不为本地运行单独维护客户端。
- 修复自定义/本地模型因发布日期未知而被误判为旧模型并隐藏的问题；手动隐藏仍然优先。
- 不强制登录云端服务，模型地址、凭据和自定义模型配置留在本机，适合离线或内网开发，后续会针对主流开源模型提供更简洁的本地接入模式。
- 本地模型仍受上下文长度、工具调用能力等自身限制；配置方法见[OpenCode Providers 文档](https://opencode.ai/v2/docs/providers)。

### 文档与发行

- [FORK.md](FORK.md)：fork 定位、三个维护分支和上游贡献状态
- [docs/fork](docs/fork/README.md)：维护、同步、验证、发布与 Qt/headless 资料
- [dev-my 桌面发行](docs/fork/dev-my/README.md)：Side bar、桌面身份、配置和运行时约定
- [Releases](https://github.com/joe-ieta/opencode/releases)：所有平台的完整安装包与更新清单统一在本仓库 GitHub 发布。

## English

---

## 官方 OpenCode 首页

> 以下为上游 OpenCode 首页原文，随官方 `dev` 同步保留。

<p align="center">
  <a href="https://opencode.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="OpenCode logo">
    </picture>
  </a>
</p>
<p align="center">The open source AI coding agent.</p>
<p align="center">
  <a href="https://opencode.ai/discord"><img alt="Discord" src="https://img.shields.io/discord/1391832426048651334?style=flat-square&label=discord" /></a>
  <a href="https://www.npmjs.com/package/@opencode/cli"><img alt="npm" src="https://img.shields.io/npm/v/@opencode/cli?style=flat-square" /></a>
  <a href="https://github.com/anomalyco/opencode/actions/workflows/release.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/anomalyco/opencode/release.yml?style=flat-square&branch=dev" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a> |
  <a href="README.zht.md">繁體中文</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.it.md">Italiano</a> |
  <a href="README.da.md">Dansk</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.pl.md">Polski</a> |
  <a href="README.ru.md">Русский</a> |
  <a href="README.bs.md">Bosanski</a> |
  <a href="README.ar.md">العربية</a> |
  <a href="README.no.md">Norsk</a> |
  <a href="README.br.md">Português (Brasil)</a> |
  <a href="README.th.md">ไทย</a> |
  <a href="README.tr.md">Türkçe</a> |
  <a href="README.uk.md">Українська</a> |
  <a href="README.bn.md">বাংলা</a> |
  <a href="README.gr.md">Ελληνικά</a> |
  <a href="README.vi.md">Tiếng Việt</a>
</p>

[![OpenCode Terminal UI](packages/web/src/assets/lander/screenshot.png)](https://opencode.ai)

---

### Installation

```bash
# YOLO
curl -fsSL https://opencode.ai/v2/install | bash

# Package managers
npm i -g @opencode/cli@latest      # or bun/pnpm/yarn
brew install anomalyco/tap/opencode-v2 # macOS and Linux (recommended, always up to date)
brew install opencode              # macOS and Linux (official brew formula, updated less)
sudo pacman -S opencode            # Arch Linux (Stable)
paru -S opencode-beta              # Arch Linux (Latest from AUR)
mise use -g opencode               # Any OS
nix run github:anomalyco/opencode  # Nix
```

> [!TIP]
> Remove versions older than 0.1.x before installing.

### Desktop App (BETA)

OpenCode is also available as a desktop application. Download it from [opencode.ai/download](https://opencode.ai/download).

| Platform              | Download                         |
| --------------------- | -------------------------------- |
| macOS (Apple Silicon) | `opencode-desktop-mac-arm64.dmg` |
| macOS (Intel)         | `opencode-desktop-mac-x64.dmg`   |
| Windows               | `opencode-desktop-win-x64.exe`   |
| Linux                 | `.deb`, `.rpm`, or `.AppImage`   |

```bash
# macOS (Homebrew)
brew install --cask opencode-desktop
```

#### Installation Directory

The install script installs OpenCode to `$HOME/.opencode/bin`.

### Agents

OpenCode includes two built-in agents you can switch between with the `Tab` key.

- **build** - Default, full-access agent for development work
- **plan** - Read-only agent for analysis and code exploration
  - Denies file edits by default
  - Asks permission before running bash commands
  - Ideal for exploring unfamiliar codebases or planning changes

Also included is a **general** subagent for complex searches and multistep tasks.
This is used internally and can be invoked using `@general` in messages.

Learn more about [agents](https://opencode.ai/v2/docs/agents).

### Documentation

For more info on how to configure OpenCode, [**head over to our docs**](https://opencode.ai/v2/docs).

### Contributing

If you're interested in contributing to OpenCode, please read our [contributing docs](./CONTRIBUTING.md) before submitting a pull request.

### Building on OpenCode

If you are working on a project that's related to OpenCode and is using "opencode" as part of its name, for example "opencode-dashboard" or "opencode-mobile", please add a note to your README to clarify that it is not built by the OpenCode team and is not affiliated with us in any way.

---

**Join our community** [Discord](https://discord.gg/opencode) | [X.com](https://x.com/opencode)
