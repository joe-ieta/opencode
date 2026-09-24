# qtoc_core 构建说明（稳定构建模式）

> 分支：`qt-headless`；产物：`qtoc_core`（由 headless opencode 构建）。
> 目标：与官方库同步后，可重复地重新裁剪并产出同名可执行文件。

## 0. 包与目录

| 位置 | 内容 |
|---|---|
| `packages/qtui/src/trim.ts` | 幂等裁剪脚本（同步上游后重新应用 headless 配置） |
| `packages/qtui/src/build.ts` | 构建编排（install → typecheck → qtoc_core → 归档） |
| `packages/qtui/client/` | Qt Creator + CMake 演示/测试工程（见 `packages/qtui/client/README.md`） |
| `packages/qtui/docs/` | 文档根目录（分类与阅读路径见 `docs/README.md`） |
| `artifacts/qtoc/` | 构建产物归档（已 gitignore） |

## 1. 产物与命名

| 位置 | 名称 |
|---|---|
| 构建目录 | `packages/opencode/dist/opencode-<os>-<arch>/bin/qtoc_core[.exe]` |
| 归档（稳定名） | `artifacts/qtoc/qtoc_core.exe`（Windows）/ `artifacts/qtoc/qtoc_core`（Linux/macOS） |
| 归档（版本化） | `artifacts/qtoc/qtoc_core-<version>-<os>-<arch>[.exe]` |

`artifacts/qtoc/` 已加入 `.gitignore`，不随仓库提交。
内部 CLI 标识（`opencode`、`OPENCODE_*` 环境变量、权限键、插件 API）保持不变，仅产物文件名与发行目录为 `qtoc_core`。

## 2. 环境准备

- Bun ≥ 1.3.14：见 `packages/qtui/docs/ops/bun-install.md`。
- Windows 建议安装 Git（shell 工具运行需要 Git Bash）。
- 磁盘空间：安装缓存默认在用户目录，空间不足时设置 `BUN_INSTALL_CACHE_DIR`（见 `packages/qtui/docs/ops/bun-install.md` 第 5 节）。

## 3. 日常构建（本地）

```bash
bun run qtoc:build
# 可选参数：
#   --skip-install     复用现有 node_modules
#   --skip-typecheck   跳过类型检查（不建议）
#   --baseline         构建无 AVX2 的 baseline 变体
```

流程：`bun install` → `bun run typecheck` → `bun run --cwd packages/opencode script/build.ts --single --skip-install` → 归档到 `artifacts/qtoc/`。

本地构建只产出**当前平台**的 `qtoc_core`（`--single`），冒烟测试也只针对当前平台。

## 3.1 发布构建：CI 矩阵原生构建（推荐）

**结论：发布产物一律使用 CI 矩阵原生构建，不在 Windows 上交叉编译 Linux/macOS 产物。**

- 工作流：`.github/workflows/qtoc.yml`
- 触发：手动 `workflow_dispatch`，或推送 `qt-headless-v*` 标签
- 矩阵：`ubuntu-latest`、`windows-latest`、`macos-latest`（各自原生 `bun run qtoc:build`，原生冒烟）
- 步骤：checkout → setup-bun → `bun install` → `bun run typecheck` → `bun run qtoc:build --skip-install --skip-typecheck` → Linux 上额外做 `serve` + `/global/health` 冒烟 → 上传 `artifacts/qtoc/*` 为 Actions Artifacts（`qtoc_core-Linux` / `qtoc_core-Windows` / `qtoc_core-macOS`，保留 14 天）

约定与注意：

| 事项 | 说明 |
|---|---|
| 原生优先 | 每个平台在自身 runner 上构建与冒烟，避免交叉编译的原生依赖（fff-bun / parcel-watcher / node-pty）与目标 libc 问题 |
| macOS | 产物未签名/未公证；对外分发需在 macOS 上另行 `codesign` + `notarytool` |
| 架构覆盖 | 默认矩阵为各平台 x64/默认架构（`macos-latest` 当前为 arm64）；如需 Linux arm64 或 macOS x64，追加 `ubuntu-24.04-arm`、`macos-13` |
| 版本 | 构建版本来自 `Script.version`（形如 `0.0.0-qt-headless-<timestamp>`），与标签名独立 |
| 交叉编译 | 仅作为实验手段（需去掉 `--single` 与 `--skip-install` 并自行验证），不作为发布路径 |

## 4. 与上游同步后的重建（标准流程）

推荐使用同步脚本（自动 fetch/merge、自动保持删除、trim、install、typecheck）：

```bash
git checkout qt-headless
bun run qtoc:sync               # = fetch upstream/dev → merge → 自动解决 modify/delete → trim → install → typecheck
bun run qtoc:build              # 构建 + 归档（CI 矩阵亦可）
```

出现非删除类冲突时，脚本会中止并列出冲突文件；手动解决后执行 `bun run qtoc:trim` 再提交。

等价的底层命令（脚本内部步骤）：

```bash
git fetch upstream
git merge upstream/dev          # 解决冲突，见第 5 节
bun run qtoc:trim               # 重新应用 headless 裁剪（幂等；模式不匹配会报错）
bun run qtoc:build              # 安装 + 类型检查 + 构建 + 归档
```

然后按 `packages/qtui/docs/ops/qt-headless.md` 第 4 节做冒烟验证（健康检查、question 工具、SSE、二进制启动）。

架构与长期维护策略见 `packages/qtui/docs/KG/architecture.md`。

## 5. 冲突热点清单

同步时以下文件最可能冲突，处理原则：

| 文件 | 本地改动 |
|---|---|
| `package.json` | workspaces 精简、移除 UI 脚本、`trustedDependencies` 去掉 tree-sitter/electron、`patchedDependencies` 去掉 UI 专属项、新增 `qtoc:*` 脚本 |
| `packages/opencode/src/index.ts` | 注销 `tui/run/attach/web/pr/github/stats/account/acp` 命令 |
| `packages/opencode/script/build.ts` | Web UI 内嵌改为 opt-in；产物名 `qtoc_core` |
| `turbo.json` | 移除已删除包的 test 任务 |
| `.github/workflows/test.yml` | 移除 app e2e 任务 |
| 删除类冲突（modify/delete） | **保持删除**（app/desktop/web/session-ui/storybook/console/stats/enterprise/slack/function/cli、github/、sdks/、nix/、flake.*、相关 workflows 与 patches） |

合并完成后一律执行 `bun run qtoc:trim`：它会重新应用上述裁剪，并在上游改动了关键模式时抛错提示手动更新 `packages/qtui/src/trim.ts`。

## 6. trim 脚本行为（`packages/qtui/src/trim.ts`）

1. 删除 UI 应用与无关组件目录/文件/workflows/patches；
2. 精简根 `package.json`（workspaces、scripts、trustedDependencies、patchedDependencies），确保 `qtoc:trim` / `qtoc:build` 脚本存在；
3. 注销 headless 不需要的 CLI 命令；
4. 确保 `build.ts` 为 headless 默认且产物名为 `qtoc_core`（模式不匹配则报错）；
5. 清理 `turbo.json` 与 `test.yml` 中已删除包的引用。

脚本幂等，可重复执行。

## 7. 版本与标签

| 标签 | 内容 |
|---|---|
| `qt-headless-v1.18.32` | 当前发行线（1.18.32，始终指向最新裁剪 + 验证提交） |
| `qt-headless-v1.18.32.1` | 上游同步 `70a24697ea..fe3f3a41f7`（含 #50439 上游化 `search.ts`）+ 1.18.32 构建与冒烟 |
| `qt-headless-v1.18.32.2` | **双核架构设计结点**：双引擎底座架构 v1 + Text-to-SQL 能力包设计（验证 Demo），纯文档 |
| `qt-headless-v1.18.32.3` | 上游同步 `fe3f3a41f7..18ef3cc7c5` + 1.18.32 构建与冒烟 |
| `qt-headless-v1.18.32.4` | 上游同步 `18ef3cc7c5..0f549842ee` + 裁剪版 `bun.lock` 重建 + 1.18.32 构建与冒烟 |
| `qt-headless-v1.18.31` | 上一发行线（1.18.31） |
| `qt-headless-v1.18.31.6` | 上游同步 + 文档重组（docs 索引 / qtoc HTTP API 参考 / KG 上游跟踪） |

- 二进制内置版本来自构建时的 `Script.version`，`qtoc_core --version` 可查看（当前为 `1.18.32`）。
- 打标签流程：
  ```bash
  git tag -a qt-headless-v1.18.32 -m "opencode headless distribution profile for Qt integration"
  git push origin qt-headless-v1.18.32
  git tag -a qt-headless-v1.18.32.1 -m "<本次迭代说明>"
  git push origin qt-headless-v1.18.32.1
  ```

## 8. 已知问题与修复（1.18.31 基线）

| 问题 | 根因 | 修复 |
|---|---|---|
| 编译版发 prompt 崩溃：`TypeError ... 'node.name'`（源码运行正常） | `packages/core/src/filesystem.ts` 与 `filesystem/search.ts` 循环导入；打包后 `FileSystemSearch.node` 为 `undefined`，location 服务图层构建失败 | `search.ts` 改为 `import type { FileSystem }`，值引用 `Entry`/`Match` 直接从 `@opencode-ai/schema/filesystem` 引入 |
| 插件依赖安装失败：`@opencode-ai/plugin@0.0.0-qt-headless-...` 在 npm 不存在 | 构建版本号为本地预览版本 | `packages/qtui/src/build.ts` 默认设置 `OPENCODE_VERSION=<仓库版本>`（1.18.31）并保留 `OPENCODE_CHANNEL=qt-headless` |
| 图层构建报错信息晦涩（`a.name` / `node.name`） | LayerNode 图未校验 `undefined` 依赖 | `packages/core/src/effect/layer-node.ts` 增加 `validateNodes`，报出节点名与索引 |
| `qtoc:build` 归档 `EBUSY` | 目标文件被正在运行的内核进程占用 | 归档 `copyRetry`（10 次 × 1s 重试） |
| 需要调试构建 | - | 构建脚本新增 `QTOC_MINIFY=0`（默认压缩） |

## 9. 常见问题

| 现象 | 处理 |
|---|---|
| `bun install` 报 node-gyp / ENOSPC | 见 `packages/qtui/docs/ops/bun-install.md` 第 5 节 |
| `qtoc:trim` 抛 "no longer matches the expected outfile pattern" | 上游改了 `build.ts`，更新 `packages/qtui/src/trim.ts` 中的模式后重跑 |
| `qtoc:build` 找不到产物 | 确认 `build.ts` 未报错、`packages/opencode/dist/opencode-<os>-<arch>/bin/qtoc_core[.exe]` 存在 |
| `git push` 报 husky `bun: command not found` | 将 `%USERPROFILE%\.bun\bin` 加入当前会话 PATH 后再推送 |
