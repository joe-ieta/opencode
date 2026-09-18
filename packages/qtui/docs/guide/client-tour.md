# Qt 客户端工程导读（快速上手）

> 对象：Qt / C++ / Native 桌面开发者。
> 目标：30 分钟内跑通"启动内核 → 建会话 → 发消息 → 流式渲染 → 权限/问答闭环"，并理解每个模块的扩展点。
> 接口规范见 `qt-shell-guide.md`；协议清单见 `../api/qtoc-http-api.md`。

---

## 1. 工程概览

`packages/qtui/client/` 是一个 Qt Creator + CMake 工程（C++20 / Qt 6.5+），演示并验证 `qtoc_core` 的全部关键接入能力：

```
client/
├─ CMakeLists.txt          Qt6::Core/Widgets/Network/Test，构建 qtoc-client 与测试
├─ fixtures/               放置 qtoc_core[.exe]（不提交；默认查找位置）
├─ src/
│  ├─ main.cpp             入口
│  ├─ core/                与 UI 无关的协议层（可整体复制到你的工程）
│  │  ├─ ServerProcess     QProcess 生命周期 + 端口解析
│  │  ├─ ApiClient         QNAM 封装（Basic Auth + 目录头 + JSON）
│  │  ├─ SseParser         SSE 分帧解析（纯函数式，可单测）
│  │  ├─ SseClient         /event 长连接
│  │  ├─ EventRouter       事件 JSON → Qt 信号
│  │  ├─ SessionModel      part 投影与增量合并
│  │  └─ Settings          QSettings + 环境变量 + 配置 JSON 生成
│  └─ ui/
│     ├─ MainWindow        工具栏/聊天页/日志页/输入框/状态栏 + 弹窗闭环
│     └─ SettingsDialog    provider/baseURL/apiKey/model/port
└─ tests/
   ├─ tst_sse_parser.cpp   SSE 分帧单测（跨包/CRLF/心跳/非法 JSON）
   └─ tst_process.cpp      真实启动 qtoc_core 并校验 /global/health（缺内核时跳过）
```

数据流：

```
ServerProcess.ready ──► ApiClient.configure + SseClient.open
SseClient.eventReceived ──► EventRouter.handle ──► Qt signals
                                              ├─► SessionModel（part 投影）
                                              ├─► MainWindow（弹窗/状态）
                                              └─► 节流刷新聊天页
MainWindow.sendPrompt ──► ApiClient.post(prompt_async)
```

---

## 2. 构建与运行

### 2.1 准备内核

```bash
# 仓库根目录
bun run qtoc:build            # 产出 artifacts/qtoc/qtoc_core[.exe]
```

内核路径解析顺序（`MainWindow::corePath()`）：

1. 环境变量 `QTOC_CORE_PATH`；
2. CMake 编译期变量 `-DQTOC_CORE_PATH=<绝对路径>`（同时会复制到构建输出目录）；
3. 默认 `client/fixtures/qtoc_core[.exe]`。

### 2.2 Qt Creator

1. 打开 `client/CMakeLists.txt`，选择 Qt 6.5+ Kit（MSVC/MinGW 均可）；
2. 配置 Kit 后直接构建运行 `qtoc-client`。

### 2.3 命令行

```powershell
cmake -S packages/qtui/client -B build -DQTOC_CORE_PATH=<绝对路径>
cmake --build build --config Release
```

### 2.4 测试

```bash
# 在构建目录
ctest --output-on-failure
```

- `tst_sse_parser`：SSE 分帧单元测试；
- `tst_process`：真实启动 `qtoc_core` 校验 `/global/health`（找不到内核自动跳过）。

---

## 3. 运行配置

### 3.1 设置窗口（推荐）

工具栏 **Settings...**：

| 字段 | 说明 |
|---|---|
| LLM 类型 | provider id（如 `anthropic`、`openai`）。内置 id 直接用；其它 id 自动注册为 OpenAI 兼容 provider（`@ai-sdk/openai-compatible`） |
| 基础 URL | 可选，覆盖 provider `baseURL`（自建网关/代理） |
| API Key | 可选，写入内核 `provider.<id>.options.apiKey`（仅存本机 QSettings 并注入内核进程） |
| 模型名称 | 模型 id（如 `claude-sonnet-4-5`），最终以 `provider/model` 写入配置 |
| 服务端口 | `随机` 表示 0 |

保存后若内核在运行，会询问是否立即重启生效。

### 3.2 环境变量（设置窗口的回退/覆盖）

| 变量 | 作用 |
|---|---|
| `QTOC_CORE_PATH` | 内核可执行文件路径 |
| `QTOC_PROVIDER` / `QTOC_BASE_URL` / `QTOC_API_KEY` / `QTOC_MODEL` / `QTOC_PORT` | 设置字段回退值 |
| `QTOC_CONFIG_JSON` | 完整覆盖内核配置（优先级最高） |
| `QTOC_AUTH_JSON` | 内联凭据（映射为 `OPENCODE_AUTH_CONTENT`） |
| `QTOC_DEBUG=1` | 打印每个事件类型到 Server log |

### 3.3 运行验证顺序

1. **Start server** → Server log 出现 `opencode server listening on http://127.0.0.1:<port>` 与 `server ready on port <port>`；
2. **事件流** → `event stream connected`；
3. **模型检查** → `providers: N [...], models: M, defaults: {...}`；`models: 0` 或 `no model configured` 时先配置模型与凭据；
4. **会话** → `session: ses_...`；
5. **发送消息** → `prompt accepted: ...`，聊天页流式出现回复；
6. **权限/问答** → 触发编辑类操作验证弹窗闭环。

无反馈排查顺序：Server log 是否有 `session error` → `providers/models` 是否为 0 → `QTOC_MODEL` → 凭据（`ANTHROPIC_API_KEY` 或 `QTOC_AUTH_JSON`）→ `curl -u opencode:<password> http://127.0.0.1:<port>/config` 查看实际生效配置。

---

## 4. 模块逐层导读

### 4.1 ServerProcess（`core/ServerProcess.{h,cpp}`）

职责：启动/停止 `qtoc_core serve`，注入环境，解析实际端口。

- `Options{ corePath, workDir, stateDir, configJson, password, port }`；
- `start()`：创建目录、注入 `OPENCODE_SERVER_PASSWORD`、`OPENCODE_CLIENT=desktop`、`OPENCODE_CONFIG_CONTENT`、`XDG_*` 隔离目录，然后 `serve --hostname 127.0.0.1 --port <port>`；
- `handleStdout()`：按行匹配 `listening on http://[^:]+:(\d+)`，成功后发 `ready(port)`；
- 信号：`ready(quint16)`、`logLine(QString)`、`failed(QString)`、`stopped()`；
- 退出：Windows 直接 `kill()`，其它平台先 `terminate()` 超时再 `kill()`。

### 4.2 ApiClient（`core/ApiClient.{h,cpp}`）

职责：统一 REST 请求。`configure(baseUrl, password, directory)` 后：

- `get/post/del(path, callback)`；`callback(ok, QJsonDocument, errorText)`；
- 自动加 `Authorization`、`Content-Type`、`x-opencode-directory`（URL 编码）；
- 错误文本包含 HTTP 状态与响应体前 300 字节。

**扩展新端点**：直接 `m_api->post("/session/...", body, cb)` 即可，无需生成代码；类型安全可用 `packages/sdk/openapi.json` 生成 C++ 模型。

### 4.3 SseParser + SseClient（`core/SseParser.*`、`core/SseClient.*`）

- `SseParser::feed(QByteArray)` 返回完整事件 `QList<QJsonObject>`；纯逻辑、无 Qt 网络依赖，已单测覆盖；
- `SseClient::open(url, authHeader, directory)`：设置 `Accept: text/event-stream`、目录头、`setTransferTimeout(0)`（Qt 6.7+ 必须）；
- 信号：`opened()`、`eventReceived(QJsonObject)`、`failed(QString)`。

### 4.4 EventRouter（`core/EventRouter.{h,cpp}`）

职责：把事件 JSON 转为强类型 Qt 信号，UI 不直接解析 JSON。

| 事件 | 信号 |
|---|---|
| `message.part.updated` | `partUpdated(part)` |
| `message.part.delta` | `partDelta(partID, field, delta)` |
| `session.idle` | `sessionIdle(sessionID)` |
| `session.status` | `sessionStatus(sessionID, statusType)` |
| `session.error` | `sessionError(sessionID, message)` |
| `permission.asked` / `replied` | `permissionAsked(request)` / `permissionReplied(requestID)` |
| `question.asked` / `replied` | `questionAsked(request)` / `questionReplied(requestID)` |
| 其它 | `unhandled(type)`（安全忽略） |

**扩展方式**：在 `handle()` 中加分支，在头文件加信号；`unhandled` 用于调试。

### 4.5 SessionModel（`core/SessionModel.{h,cpp}`）

职责：part 投影（id → 文本/类型），增量与快照合并。

- `upsert(part)`：新 part 追加顺序；已流式 part 不覆盖文本（防双写重复）；
- `appendDelta(partID, field, delta)`：仅 `field == "text"` 时累加；
- `transcript()`：按顺序拼接文本（演示用；生产建议按消息/part 结构化渲染）。

### 4.6 Settings / SettingsDialog（`core/Settings.*`、`ui/SettingsDialog.*`）

- `QtocSettings::load()/save()`：QSettings（Windows `HKCU\Software\qtoc\qtoc-client`）+ 环境变量回退；
- `configJson()`：生成 `OPENCODE_CONFIG_CONTENT`（`QTOC_CONFIG_JSON` 覆盖；自定义 provider 自动补 `npm: @ai-sdk/openai-compatible` 与 `models`）。

### 4.7 MainWindow（`ui/MainWindow.{h,cpp}`）

演示 UI 与闭环：

- 工具栏 Start/Stop/Settings/New session/Abort；
- Chat 页 + Server log 页；
- `sendPrompt()` → `prompt_async`；`abortSession()` → `/abort`；
- `onPartUpdated` / `onPartDelta` → SessionModel + 50ms 节流刷新；
- `onPermissionAsked`：QMessageBox（Once/Always/Reject）→ `/permission/{id}/reply`；
- `onQuestionAsked`：QInputDialog（选项/自定义输入）→ `/question/{id}/reply` 或 `/reject`；
- `checkProviders()`：启动后查询 `/config/providers`，按"无凭据/无模型/缺 provider"提示。

---

## 5. 常见扩展任务

| 任务 | 做法 |
|---|---|
| 渲染工具卡片 | `EventRouter` 已透传 tool part；在 UI 按 `part.type == "tool"`、`state.status` 渲染 |
| 历史恢复 | 调 `GET /session/{id}/message?limit=&before=`，按消息顺序 `upsert` part |
| 权限重连恢复 | 重连后 `GET /permission`、`GET /question`，把结果送入弹窗队列 |
| 新增端点调用 | 用 `ApiClient` 直接调用；复杂 body 参考 `../api/qtoc-http-api.md` 第 3 节 |
| 多项目 | `ApiClient.configure` 的 directory 参数切换；或每项目一个 `ApiClient` |
| 多 daemon | 每个 daemon 一个 `ServerProcess` + 独立 `XDG_*` 目录与密码 |

---

## 6. 调试清单

| 现象 | 排查 |
|---|---|
| 401 | 密码/认证头；确认 `OPENCODE_SERVER_PASSWORD` 注入子进程 |
| 连接被拒 | stdout 是否出现 listening 行；stderr 日志 |
| SSE 无会话事件 | `/event` 是否带 `x-opencode-directory`（缺目录头只收到 connected/heartbeat） |
| 文本重复 | 增量与全量双写；检查 SessionModel 的 `m_streamed` 逻辑 |
| 请求目录不对 | `x-opencode-directory` 是否 URL 编码、路径是否存在 |
| 聊天无内容 | `QTOC_DEBUG=1` 看事件；查 `session.error`、providers/models、凭据 |
| 流式卡顿 | 是否每个事件都全量重排 Markdown；加节流 |
| shell 工具失败（Windows） | 安装 Git（Git Bash） |
| Qt 6.7+ SSE 断开 | `setTransferTimeout(0)` 是否生效 |
