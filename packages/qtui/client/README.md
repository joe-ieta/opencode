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

## 运行配置（环境变量）

客户端启动内核时会读取以下环境变量（也可在 Qt Creator 的 Run 配置里设置）：

| 变量 | 作用 | 示例 |
|---|---|---|
| `QTOC_CORE_PATH` | qtoc_core 可执行文件路径 | `E:\...\artifacts\qtoc\qtoc_core.exe` |
| `QTOC_MODEL` | 默认模型（写入内核配置 `model`） | `anthropic/claude-sonnet-4-5` |
| `QTOC_CONFIG_JSON` | 完整覆盖内核配置（优先级最高） | `{"model":"...","permission":{...}}` |
| `QTOC_AUTH_JSON` | 内联凭据（映射为 `OPENCODE_AUTH_CONTENT`） | `{"anthropic":{"type":"api","key":"sk-..."}}` |
| `QTOC_DEBUG=1` | 打印每个事件的类型到 Server log | - |

未设置 `QTOC_MODEL` 时客户端默认配置只有权限项；此时 `prompt_async` 会被接受但内核无法调用模型，聊天窗口不会有内容（错误只以 `session.error` 事件返回）。

## 验证步骤

1. **Start server**：Server log 出现 `opencode server listening on http://127.0.0.1:<port>` 与 `server ready on port <port>`；
2. **事件流**：Server log 出现 `event stream connected`；
3. **模型检查**：Server log 出现 `providers: N [...], models: M, defaults: {...}`；若 `models: 0` 或提示 `no model configured`，先配置 `QTOC_MODEL` 与凭据；
4. **会话**：Server log 出现 `session: ses_...`；
5. **发送消息**：Server log 出现 `prompt accepted: ...`；聊天页出现用户文本与流式回复；
6. **权限/问答**：让模型执行一次编辑类操作，确认弹窗与应答闭环。

无反馈排查顺序：Server log 是否有 `session error: ...` → `providers/models` 是否为 0 → `QTOC_MODEL` 是否设置 → 凭据环境变量是否存在（如 `ANTHROPIC_API_KEY` 或 `QTOC_AUTH_JSON`）→ 用 `curl -u opencode:<password> http://127.0.0.1:<port>/config` 查看内核实际生效配置。

## 说明

- 客户端不负责 prompt 组装、模型解析与工具执行，全部由内核完成；
- 事件与端点清单见 `docs/qtui/opencode-qt-integration-methodology.md` 第 7 节。
