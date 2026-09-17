# qtoc_core 构建说明（稳定构建模式）

> 分支：`qt-headless`；产物：`qtoc_core`（由 headless opencode 构建）。
> 目标：与官方库同步后，可重复地重新裁剪并产出同名可执行文件。

## 0. 包与目录

| 位置 | 内容 |
|---|---|
| `packages/qtui/src/trim.ts` | 幂等裁剪脚本（同步上游后重新应用 headless 配置） |
| `packages/qtui/src/build.ts` | 构建编排（install → typecheck → qtoc_core → 归档） |
| `packages/qtui/client/` | Qt Creator + CMake 演示/测试工程（见 `packages/qtui/client/README.md`） |
| `docs/qtui/` | 集成文档（本文、方法、实施、发行、Bun 安装） |
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

- Bun ≥ 1.3.14：见 `docs/qtui/bun-install.md`。
- Windows 建议安装 Git（shell 工具运行需要 Git Bash）。
- 磁盘空间：安装缓存默认在用户目录，空间不足时设置 `BUN_INSTALL_CACHE_DIR`（见 `docs/qtui/bun-install.md` 第 5 节）。

## 3. 日常构建

```bash
bun run qtoc:build
# 可选参数：
#   --skip-install     复用现有 node_modules
#   --skip-typecheck   跳过类型检查（不建议）
#   --baseline         构建无 AVX2 的 baseline 变体
```

流程：`bun install` → `bun run typecheck` → `bun run --cwd packages/opencode script/build.ts --single --skip-install` → 归档到 `artifacts/qtoc/`。

## 4. 与上游同步后的重建（标准流程）

```bash
git fetch upstream
git checkout qt-headless
git merge upstream/dev          # 解决冲突，见第 5 节
bun run qtoc:trim               # 重新应用 headless 裁剪（幂等；模式不匹配会报错）
bun run qtoc:build              # 安装 + 类型检查 + 构建 + 归档
```

然后按 `docs/qtui/qt-headless.md` 第 4 节做冒烟验证（健康检查、question 工具、SSE、二进制启动）。

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

- `qt-headless-v1.18.31`：当前发行线（指向最新裁剪+验证提交）。
- `qt-headless-v1.18.31.1`：本次 qtoc_core 构建模式的迭代标签。
- 二进制内置版本来自构建时的 `Script.version`（形如 `0.0.0-qt-headless-<timestamp>`），`qtoc_core --version` 可查看。

## 8. 常见问题

| 现象 | 处理 |
|---|---|
| `bun install` 报 node-gyp / ENOSPC | 见 `docs/qtui/bun-install.md` 第 5 节 |
| `qtoc:trim` 抛 "no longer matches the expected outfile pattern" | 上游改了 `build.ts`，更新 `packages/qtui/src/trim.ts` 中的模式后重跑 |
| `qtoc:build` 找不到产物 | 确认 `build.ts` 未报错、`packages/opencode/dist/opencode-<os>-<arch>/bin/qtoc_core[.exe]` 存在 |
| `git push` 报 husky `bun: command not found` | 将 `%USERPROFILE%\.bun\bin` 加入当前会话 PATH 后再推送 |
