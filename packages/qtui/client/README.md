# qtoc_core Qt 客户端（演示 / 测试工程）

Qt Creator + CMake 工程，用于验证与演示 `qtoc_core`（headless opencode 内核）的接入：
启动内核、建会话、异步 prompt、SSE 流式渲染、工具卡片、权限与问答弹窗。

## 打开与配置

1. 构建内核（仓库根目录）：
   ```bash
   bun run qtoc:build
   ```
2. 用 Qt Creator 打开 `packages/qtui/client/CMakeLists.txt`，选择 Qt 6.5+ 的 Kit（MSVC/MinGW 均可）。
3. 指定内核路径（任选其一）：
   - 复制 `artifacts/qtoc/qtoc_core.exe` 到 `client/fixtures/`（默认路径）；
   - CMake 变量：`-DQTOC_CORE_PATH=<绝对路径>`；
   - 环境变量 `QTOC_CORE_PATH`（运行时也会读取）。
4. 构建并运行 `qtoc-client`。

## 演示流程

- 工具栏 **Start server**：以随机端口、随机密码、隔离的 XDG 目录启动 `qtoc_core serve`；
- 自动订阅 `/event` 并创建会话；
- 输入框发送 prompt（`prompt_async`），聊天页流式显示文本与工具卡片；
- 工具触发权限时弹窗（Once / Always / Reject）；`question` 工具触发时弹选项框；
- **Abort** 中止当前轮；**Server log** 标签页查看内核输出。

## 测试

```bash
# 在构建目录
ctest --output-on-failure
```

- `tst_sse_parser`：SSE 分帧单元测试（跨包、CRLF、心跳、非法 JSON）；
- `tst_process`：真实启动 `qtoc_core` 并校验 `/global/health`（找不到内核时自动跳过）。

## 说明

- 客户端不负责 prompt 组装、模型解析与工具执行，全部由内核完成；
- 需要真实模型响应时，请在 `OPENCODE_CONFIG_CONTENT`（见 `MainWindow::startServer`）中配置 provider 凭据，或使用本地 mock provider；
- 事件与端点清单见 `docs/qtui/opencode-qt-integration-methodology.md` 第 7 节。
