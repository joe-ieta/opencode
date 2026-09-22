# opencode Headless 发行版（Qt 集成专用）

> 分支：`qt-headless`（当前基线 `v1.18.32`，源自 `dev`）
> 用途：供 Qt/C++ 壳通过 HTTP + SSE 集成，无界面、无桌面/Web 应用。

## 1. 发行内容

**保留（内核与工具链）**

```
packages/opencode           CLI + serve + session + tools（无界面命令集）
packages/core               服务层（filesystem/session/permission/tool/provider...）
packages/schema / protocol  协议与类型
packages/server             HttpApi + OpenAPI
packages/client             Effect 客户端（代码生成源）
packages/llm                LLM 抽象
packages/plugin             插件 API（业务上下文注入用）
packages/sdk/js             @opencode-ai/sdk（插件客户端依赖）
packages/script             构建脚本库
packages/effect-*           SQLite/Drizzle Effect 适配
packages/httpapi-codegen    客户端生成（dev）
packages/http-recorder      契约测试（dev）
packages/codemode           code mode（实验，按需）
packages/tui / packages/ui  仅作为编译依赖保留（见说明）
```

**已移除**

```
packages/app            Web/Desktop UI
packages/desktop        Electron 壳
packages/web            官网/文档站
packages/session-ui     会话 UI 组件
packages/storybook
packages/console/*      计费控制台
packages/stats/*
packages/enterprise
packages/slack
packages/function
packages/cli            lildax daemon CLI（service start 单例，与多 daemon 冲突）
github/                 GitHub Action
sdks/vscode             VS Code 扩展
nix/ + flake.*          Nix 打包
相关 workflows 与 patches（publish/desktop/vscode/storybook/stats/docs/nix）
```

**CLI 命令集（保留）**：`serve`、`generate`、`models`、`agent`、`providers`、`mcp`、`session`、`export`、`import`、`db`、`plug`、`debug`、`upgrade`、`uninstall`。
**已注销命令**：`tui`、`run`、`attach`、`web`、`pr`、`github`、`stats`、`account`、`acp`。

**说明**：`packages/tui` 与 `packages/ui` 作为编译依赖保留（`packages/opencode` 的 config/util 与构建 worker 复用它们），但 CLI 不再暴露 TUI 命令，二进制默认不内嵌 Web UI。如需彻底移除，见 `packages/qtui/docs/integration/methodology.md` 4.3 的"彻底"方案。

## 2. 运行

```powershell
bun install

# headless server（Qt 对接入口）
$env:OPENCODE_SERVER_PASSWORD = "your-secret"
$env:OPENCODE_CLIENT = "desktop"          # 启用 question 工具
bun run --cwd packages/opencode src/index.ts serve --hostname 127.0.0.1 --port 4096
```

冒烟：

```powershell
curl.exe -s -u opencode:your-secret http://127.0.0.1:4096/global/health
curl.exe -N -u opencode:your-secret http://127.0.0.1:4096/event
```

## 3. 构建单文件二进制（qtoc_core）

标准方式（推荐，含安装、类型检查与归档）：

```bash
bun run qtoc:build
```

等价底层命令：

```powershell
# 默认跳过 Web UI 内嵌（本分支无 packages/app）
bun run --cwd packages/opencode script/build.ts --single --skip-install
```

产物：

- `packages/opencode/dist/opencode-<os>-<arch>/bin/qtoc_core[.exe]`
- 归档：`artifacts/qtoc/qtoc_core[.exe]` 与 `artifacts/qtoc/qtoc_core-<version>-<os>-<arch>[.exe]`

发布产物使用 **CI 矩阵原生构建**（`.github/workflows/qtoc.yml`，Linux/Windows/macOS 各自原生构建与冒烟），
与上游同步后的重建流程见 `packages/qtui/docs/ops/qtoc-build.md`（含 3.1 节 CI 矩阵说明）。

## 4. 验证清单

- [x] `bun install` 成功，无缺失 workspace 报错（1130 packages / 19.3s，Windows + Bun 1.4.2）
- [x] `bun turbo typecheck` 通过（17/17 tasks）
- [x] `serve` 启动并输出 `opencode server listening on ...`
- [x] `/global/health` 返回 `{ healthy: true, version }`
- [x] `/event` 建连、收到 `server.connected`
- [x] `OPENCODE_CLIENT=desktop` 时 `GET /experimental/tool/ids` 包含 `question`
- [ ] 业务上下文插件（方案 B）注入生效且不重复（待业务服务就绪后验证）
- [x] 构建产物可运行（`--single --skip-install` → `opencode.exe` 118.3 MB，serve 健康检查通过）

> 验证环境：Windows（E: 盘工作区，Bun 1.4.2），日期 2026-09-17。
> 安装注意事项（C 盘空间不足、node-gyp 处理）见 `packages/qtui/docs/ops/bun-install.md` 第 5 节。

## 5. 与上游同步

从 `dev` 合并上游时注意：

1. 恢复被删除的 `workspaces` 引用会重新引入 UI 应用，需要重新裁剪；
2. `packages/opencode/src/index.ts` 的命令注册与 `script/build.ts` 的 Web UI 内嵌逻辑是本地改动点；
3. 业务上下文插件相关钩子（`experimental.chat.*.transform`）若上游调整签名，需同步更新插件。

## 6. 相关文档

- 阅读引导（全部分类）：`packages/qtui/docs/README.md`
- 构建与同步：`packages/qtui/docs/ops/qtoc-build.md`（qtoc_core 稳定构建模式）
- 安装 Bun：`packages/qtui/docs/ops/bun-install.md`
- 实施步骤：`packages/qtui/docs/integration/implementation.md`
- 方法与决策：`packages/qtui/docs/integration/methodology.md`
  - 5.4 业务上下文注入（插件 + 业务服务）
  - 7 Qt 壳端点消费清单与流程映射
