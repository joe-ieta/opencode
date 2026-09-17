# @opencode-ai/qtui

Qt/C++ 集成包：封装 `qtoc_core`（headless opencode 内核）的裁剪、构建与 Qt 客户端演示/测试工程。

## 目录结构

```
packages/qtui/
├─ src/
│  ├─ trim.ts              # 幂等重新裁剪（同步上游后执行）
│  └─ build.ts             # 构建编排：install → typecheck → qtoc_core → 归档
├─ client/                 # Qt Creator + CMake 演示/测试工程（C++）
│  ├─ CMakeLists.txt
│  ├─ fixtures/            # 放置 qtoc_core[.exe]（不提交）
│  ├─ src/                 # ServerProcess / ApiClient / SseClient / UI
│  └─ tests/               # Qt Test：SSE 解析、进程与健康检查
└─ package.json
```

## 命令（仓库根目录执行）

```bash
bun run qtoc:trim        # 同步上游后重新应用 headless 裁剪（幂等，失败即停）
bun run qtoc:build       # 构建 qtoc_core 并归档到 artifacts/qtoc/
```

可选参数：`--skip-install`、`--skip-typecheck`、`--baseline`。

发布产物走 **CI 矩阵原生构建**（`.github/workflows/qtoc.yml`：Linux/Windows/macOS 各自原生构建 + 冒烟 + 上传产物），
本地 `qtoc:build` 只产出当前平台版本。详见 `docs/qtui/qtoc-build.md` 3.1 节。

## Qt 客户端工程

用 Qt Creator 打开 `client/CMakeLists.txt`，按 `client/README.md` 配置运行（指定 `qtoc_core` 路径或复制到 `client/fixtures/`）。

## 文档

- 集成方法与端点清单：`docs/qtui/opencode-qt-integration-methodology.md`
- 实施步骤：`docs/qtui/opencode-qt-integration.md`
- Headless 发行与验证：`docs/qtui/qt-headless.md`
- 构建与上游同步：`docs/qtui/qtoc-build.md`
- Bun 安装（Windows/Linux）：`docs/qtui/bun-install.md`
