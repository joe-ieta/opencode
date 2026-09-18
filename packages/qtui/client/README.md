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

## 运行配置

### 设置窗口（推荐）

工具栏 **Settings...** 打开运行参数设置：

| 字段 | 说明 |
|---|---|
| LLM 类型 | provider id（如 `anthropic`、`openai`）。内置 id 直接使用；其它 id 自动注册为 OpenAI 兼容自定义 provider（`npm: @ai-sdk/openai-compatible`） |
| 基础 URL | 可选，覆盖 provider 的 `baseURL`（自建网关/代理时使用） |
| API Key | 可选，写入内核 `provider.<id>.options.apiKey`（仅保存在本机 QSettings，并注入内核进程） |
| 模型名称 | 模型 id（如 `claude-sonnet-4-5`），最终以 `provider/model` 写入内核配置 |
| 服务端口 | 内核 HTTP 端口，`随机` 表示 0（随机端口） |

保存后若内核正在运行，客户端会询问是否立即重启以应用设置。设置持久化在 QSettings（Windows 注册表 `HKCU\Software\qtoc\qtoc-client`）。

### 环境变量（作为设置窗口的回退/覆盖）

| 变量 | 作用 | 示例 |
|---|---|---|
| `QTOC_CORE_PATH` | qtoc_core 可执行文件路径 | `E:\...\artifacts\qtoc\qtoc_core.exe` |
| `QTOC_PROVIDER` / `QTOC_BASE_URL` / `QTOC_API_KEY` / `QTOC_MODEL` / `QTOC_PORT` | 设置窗口字段的回退值 | `QTOC_MODEL=anthropic/claude-sonnet-4-5` |
| `QTOC_CONFIG_JSON` | 完整覆盖内核配置（优先级最高） | `{"model":"...","permission":{...}}` |
| `QTOC_AUTH_JSON` | 内联凭据（映射为 `OPENCODE_AUTH_CONTENT`） | `{"anthropic":{"type":"api","key":"sk-..."}}` |
| `QTOC_DEBUG=1` | 打印每个事件的类型到 Server log | - |

未配置模型时客户端默认配置只有权限项；此时 `prompt_async` 会被接受但内核无法调用模型，聊天窗口不会有内容（错误只以 `session.error` 事件返回）。

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
- 工程逐模块导读与扩展方式见 `packages/qtui/docs/guide/client-tour.md`；
- 接口功能分类与关键约定见 `packages/qtui/docs/guide/qt-shell-guide.md`；
- 端点与事件清单见 `packages/qtui/docs/api/qtoc-http-api.md`。
