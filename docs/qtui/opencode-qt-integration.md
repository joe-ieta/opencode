# opencode × Qt 集成文档

> 目标：将 opencode 裁剪为 headless 内核（HTTP + SSE），由现有 Qt/C++ 原生客户端接管全部 UI。
>
> 基准版本：opencode `v1.18.31`（仓库 dev 分支，HEAD `e03db9bc6`）。
> 协议以 `packages/sdk/openapi.json` 与 `packages/sdk/js/src/v2/gen/types.gen.ts` 为准；本文引用的路径、字段均来自当前源码。

---

## 1. 总体架构

```
┌────────────────────────── Qt / C++ 客户端 ──────────────────────────┐
│  聊天窗口 / Markdown 渲染 / 流式输出 / 工具卡片 / 权限弹窗 / 设置     │
│  ApiClient(QNetworkAccessManager)   SseClient(/event)               │
│  EventRouter(Qt signals)  SessionModel  ServerProcess(QProcess)     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTP/1.1 + Basic Auth + SSE
┌──────────────────────────────┴──────────────────────────────────────┐
│  opencode serve（headless 内核，独立进程）                            │
│  REST API（/session /message /permission /config ...）              │
│  SSE 事件流（/event）                                                │
│  packages/core + packages/server + packages/opencode(CLI)           │
│  SQLite 持久化、工具执行（read/write/edit/bash/grep/glob...）、       │
│  Agent/Provider/MCP/Plugin、LSP、文件监听                             │
└─────────────────────────────────────────────────────────────────────┘
```

设计原则：

1. **不改内核业务逻辑**：Qt 只做协议对接，模型、会话、工具、权限全部由内核负责。
2. **先跑通、后裁剪**：阶段 0 用官方发布版验证协议闭环，阶段 1 再裁剪仓库。
3. **UI 全部在 Qt**：不复用任何 Web UI 包（app/ui/session-ui/desktop）。
4. **协议优先稳定面**：使用 `/session`、`/event` 等稳定 REST 路径，不依赖实验性 `/api/*` 新面。

---

## 2. 对接契约（协议规范）

### 2.1 启动与认证

启动命令（`packages/opencode/src/cli/cmd/serve.ts`）：

```powershell
# 源码方式（开发期）
bun run ./src/index.ts serve --hostname 127.0.0.1 --port 4096

# 发布二进制
opencode serve --hostname 127.0.0.1 --port 4096
```

支持的启动参数：`--port`（默认 0，随机端口）、`--hostname`（默认 127.0.0.1）、`--mdns`、`--mdns-domain`、`--cors`（原生 Qt 不需要）。
启动成功后 stdout 输出一行：

```
opencode server listening on http://127.0.0.1:4096
```

**认证**（`packages/server/src/auth.ts`）：

- HTTP Basic Auth，用户名固定 `opencode`（可用 `OPENCODE_SERVER_USERNAME` 覆盖），密码来自环境变量 `OPENCODE_SERVER_PASSWORD`。
- 未设置密码时服务不设防（仅建议本机开发）。
- 请求头：`Authorization: Basic base64("opencode:<password>")`。
- Qt 侧每个请求（含 SSE）都必须携带该头。

**其他有用环境变量**：

| 变量 | 用途 |
|---|---|
| `OPENCODE_SERVER_PASSWORD` | 服务密码（必设） |
| `OPENCODE_CONFIG_CONTENT` | 内联 JSON 配置（agents/permission/model/mcp/plugin 等） |
| `OPENCODE_PURE=1` | 禁用外部插件（`--pure` 等价） |
| `OPENCODE_PRINT_LOGS=1` / `OPENCODE_LOG_LEVEL=DEBUG` | 调试日志 |

### 2.2 目录作用域（多项目）

内核是"单进程多目录"模型，每个请求通过目录标识定位项目实例：

- 请求头 `x-opencode-directory: <URL 编码的绝对路径>`（SDK 对所有请求都带，见 `packages/sdk/js/src/v2/client.ts:20-75`）。
- GET 请求也可用查询参数 `?directory=<路径>`。
- 可选 `x-opencode-workspace` / `?workspace=` 用于 worktree 场景。
- **建议**：Qt 为每个项目保存绝对路径，所有请求统一带 header。

### 2.3 REST 端点速查（已验证）

| 用途 | 方法与路径 | 请求体 / 参数 | 响应 |
|---|---|---|---|
| 健康检查 | `GET /global/health` | - | `{ healthy: true, version: string }` |
| 事件订阅 | `GET /event` | SSE | `text/event-stream` |
| 建会话 | `POST /session` | `{ parentID?, title?, agent?, model?{id,providerID,variant?}, metadata?, permission?, workspaceID? }` | `Session` |
| 会话列表 | `GET /session` | - | `Session[]` |
| 会话详情 | `GET /session/{sessionID}` | - | `Session` |
| 删除会话 | `DELETE /session/{sessionID}` | - | - |
| 发消息（同步） | `POST /session/{sessionID}/message` | `{ messageID?, model?{providerID,modelID}, agent?, noReply?, tools?, format?, system?, variant?, parts: PartInput[] }` | `{ info: AssistantMessage, parts: Part[] }`（阻塞到完成） |
| 发消息（异步） | `POST /session/{sessionID}/prompt_async` | 同上 | `204`，结果走事件流 |
| 历史消息 | `GET /session/{sessionID}/message` | - | `{ data: SessionMessage[], cursor: { previous?, next? } }` |
| 中止 | `POST /session/{sessionID}/abort` | - | `boolean` |
| 待决权限 | `GET /permission` | - | 权限请求列表 |
| 权限应答 | `POST /permission/{requestID}/reply` | `{ reply: "once" \| "always" \| "reject", message? }` | `boolean` |
| 问答应答 | `POST /question/{requestID}/reply` / `/reject` | `{ answers: string[][] }`（按问题顺序，每个答案为所选标签数组） | - |
| 模型列表 | `GET /config/providers` 或 `GET /provider` | - | Provider/Model 列表 |
| Agent 列表 | `GET /agent` | - | Agent[] |
| 配置读取 | `GET /config` | - | Config |
| 文件搜索 | `GET /find/file` | `?query=...&type=file\|directory&limit=` | 路径列表 |
| 文件内容 | `GET /file/content` | `?path=<绝对路径>` | 内容 |
| 文件状态 | `GET /file/status` | - | 变更文件 |
| 会话 diff | `GET /session/{sessionID}/diff` | - | diff |
| 会话 todo | `GET /session/{sessionID}/todo` | - | Todo[] |
| 会话 shell | `POST /session/{sessionID}/shell` | `{ agent, command, model?, messageID? }` | 命令结果 |
| revert | `POST /session/{sessionID}/revert` / `unrevert` | `{ messageID }` 等 | Session |
| PTY 终端 | `GET /pty`、`POST /pty`、`GET /pty/{ptyID}/connect-token` + WebSocket `/pty/{ptyID}` | - | 见 2.7 |

> 完整清单（162+ 路径）以 `packages/sdk/openapi.json` 为准；Qt 侧建议只生成/实现所需子集。

### 2.4 请求示例

创建会话并发消息（异步模式，推荐）：

```http
POST /session?directory=E%3A%5Cprojects%5Cdemo HTTP/1.1
Host: 127.0.0.1:4096
Authorization: Basic b3BlbmNvZGU6c2VjcmV0
Content-Type: application/json
x-opencode-directory: E%3A%5Cprojects%5Cdemo

{ "title": "Qt session" }
```

```http
POST /session/<sessionID>/prompt_async?directory=... HTTP/1.1
Authorization: Basic ...
Content-Type: application/json

{
  "agent": "build",
  "model": { "providerID": "anthropic", "modelID": "claude-sonnet-4-5" },
  "parts": [
    { "type": "text", "text": "帮我修复这个编译错误" },
    { "type": "file", "mime": "text/plain", "url": "file:///E:/projects/demo/src/main.cpp" }
  ]
}
```

`parts` 支持类型：`text`、`file`（url 可为 `file://` 或 `data:` base64）、`agent`、`subtask`。

### 2.5 SSE 事件流

连接 `GET /event`，响应头 `content-type: text/event-stream`。服务端行为（`packages/server/src/handlers/event.ts`）：

- 事件编码：`data: <JSON>\n\n`，JSON 形如 `{ "id": "...", "type": "...", "properties": { ... } }`。
- 心跳：每 15 秒一行 `: heartbeat`（注释行，客户端忽略）。
- **全局流无重放**：断线重连后需要重新拉取历史（见 2.6）。

解析要点（TS 参考实现 `packages/client/src/generated/client.ts:192-247`）：

1. 累积字节缓冲，按 `\n\n` 切分事件块，兼容 `\r\n` 与 `\r`。
2. 取所有 `data:` 前缀行，拼接后 `JSON.parse`。
3. 单块缓冲上限 1 MB，超出视为协议错误。
4. 忽略 `:` 开头的注释行（心跳）。

Qt/C++ 参考伪代码：

```cpp
void SseClient::onReadyRead() {
    m_buffer.append(m_reply->readAll());
    if (m_buffer.size() > 1024 * 1024) { abort("malformed"); return; }
    m_buffer.replace("\r\n", "\n");
    int idx;
    while ((idx = m_buffer.indexOf("\n\n")) >= 0) {
        QByteArray block = m_buffer.left(idx);
        m_buffer.remove(0, idx + 2);
        QByteArray data;
        for (const QByteArray &line : block.split('\n')) {
            if (line.startsWith("data:")) {
                if (!data.isEmpty()) data += "\n";
                data += line.mid(5).trimmed();
            }
        }
        if (data.isEmpty()) continue;
        const QJsonDocument doc = QJsonDocument::fromJson(data);
        if (doc.isObject()) emit eventReceived(doc.object());
    }
}
```

**主要事件类型**（完整联合类型见 `types.gen.ts` 的 `Event`）：

| 事件 | properties | 用途 |
|---|---|---|
| `session.created` / `session.updated` / `session.deleted` | `sessionID, info` | 会话列表/标题同步 |
| `message.updated` | `sessionID, info, time` | 消息元数据（role、状态、token） |
| `message.part.updated` | `sessionID, part, time` | part 快照（文本、推理、工具调用） |
| `message.part.delta` | `sessionID, messageID, partID, field, delta` | 增量（优先用于流式） |
| `message.part.removed` | `sessionID, messageID, partID` | 移除 part |
| `session.status` | `sessionID, status` | busy/idle/retry 状态 |
| `session.idle` | `sessionID` | 一轮完成 |
| `session.error` | `sessionID?, error` | 错误（ProviderAuth/Aborted/Overflow 等） |
| `session.diff` | `sessionID, diff` | 文件变更汇总 |
| `todo.updated` | `sessionID, todos` | 任务清单 |
| `permission.asked` / `permission.replied` | 权限请求信息 | 权限弹窗 |
| `question.asked` / `question.replied` / `question.rejected` | `id, sessionID, questions` | 问答弹窗 |
| `file.edited`、`lsp.updated`、`installation.*` | - | 可选 UI 联动 |

流式渲染策略（兼容两种模式）：

- 收到 `message.part.delta`：按 `(messageID, partID, field)` 追加增量；
- 收到 `message.part.updated`：以完整 part 覆盖本地状态（兜底，防止丢增量）；
- `part.type == "text"` 渲染 Markdown；`part.type == "tool"` 渲染工具卡片（状态、输入、输出）；`part.type == "reasoning"` 可折叠展示。

### 2.6 断线恢复

- `/event` 不提供重放；重连成功后对当前打开的会话执行 `GET /session/{sessionID}/message` 全量重放并重建 UI 状态。
- 新协议面提供按游标续传（`/api/session/{sessionID}/event?after=` 与 `/api/session/{sessionID}/history?after=&limit=`），当前版本可作为增强项接入，不作为主链路依赖。
- 建议重连采用指数退避（1s、2s、4s…，上限 30s），并在此期间保持 UI 可用（禁用发送）。

### 2.7 终端（PTY，可选）

- 创建：`POST /pty`，列表：`GET /pty`。
- 连接：先 `GET /pty/{ptyID}/connect-token` 取 ticket，再以 WebSocket 连接 `/pty/{ptyID}?ticket=...`（浏览器无法设置 header，故用 ticket；原生客户端也可走该流程）。
- 帧协议为自定义分帧（`PtyProtocol`），带 `cursor` 参数支持回放；Qt 用 `QWebSocket` 接入，按协议解析文本/控制帧。
- 若首期不需要内置终端，可完全跳过。

---

## 3. 阶段 0：基线跑通（不改源码）

### 3.1 启动

```powershell
cd packages\opencode
$env:OPENCODE_SERVER_PASSWORD = "dev-secret"
bun run ./src/index.ts serve --hostname 127.0.0.1 --port 4096
```

### 3.2 冒烟测试（PowerShell）

```powershell
$auth = "opencode:dev-secret"
# 健康检查
curl.exe -s -u $auth http://127.0.0.1:4096/global/health
# 建会话（指定目录）
curl.exe -s -u $auth -H "x-opencode-directory: E%3A%5Cprojects%5Cdemo" `
  -H "Content-Type: application/json" -X POST `
  -d '{\"title\":\"smoke\"}' http://127.0.0.1:4096/session
# 事件流（另开一个终端，观察事件）
curl.exe -N -u $auth http://127.0.0.1:4096/event
# 异步发消息
curl.exe -s -u $auth -H "Content-Type: application/json" -X POST `
  -d '{\"parts\":[{\"type\":\"text\",\"text\":\"你好\"}]}' `
  http://127.0.0.1:4096/session/<sessionID>/prompt_async
```

### 3.3 验收清单

- [ ] `/global/health` 返回 `{healthy:true,version}`。
- [ ] Qt 能建立并保持 `/event` SSE 连接，收到心跳不报错。
- [ ] 发送 prompt 后，事件流出现 `message.part.updated` / `message.part.delta`，文本逐步增长。
- [ ] 收到 `session.idle` 视为一轮结束。
- [ ] 触发工具调用（例如让模型读文件）时能收到 `tool` part 并渲染。
- [ ] 权限弹窗链路可用：事件 `permission.asked` → `POST /permission/{id}/reply`。

---

## 4. 阶段 1：裁剪为 headless 内核

> 原则：先改 workspaces 与入口，再物理删除；每步保持可启动、可回退。

### 4.1 建分支

```powershell
git checkout -b qt-headless
```

### 4.2 调整根 `package.json` 的 workspaces

删除以下包（UI 客户端与无关服务）：

```
packages/app           # Web/Desktop 共享 UI
packages/desktop       # Electron 壳
packages/web           # 官网/文档站
packages/session-ui    # 会话 UI 组件
packages/ui            # 设计系统
packages/storybook
packages/console/*     # 计费/控制台
packages/stats/*
packages/enterprise
packages/slack
packages/function
```

保留：

```
packages/opencode          # CLI + serve + session + tools
packages/core              # 服务层（filesystem/session/permission/tool...）
packages/schema
packages/protocol
packages/server
packages/client
packages/llm
packages/plugin
packages/sdk/js            # opencode 插件客户端依赖
packages/script
packages/effect-sqlite-node
packages/effect-drizzle-sqlite
packages/httpapi-codegen   # client 生成用（dev）
packages/http-recorder     # 契约测试（dev，可留）
```

`packages/codemode` 仅在启用实验 code mode 时需要；否则删除，并同时移除 `packages/opencode/src/tool/code-mode.ts` 与 `src/tool/registry.ts` 中的动态导入分支。

### 4.3 TUI 处理

`packages/opencode` 有约 20 处引用 `@opencode-ai/tui`，涉及：

```
src/config/tui.ts
src/config/tui-migrate.ts
src/config/tui-host-attention.ts
src/cli/tui/layer.ts
src/cli/cmd/tui.ts
src/cli/cmd/attach.ts
src/cli/cmd/prompt-display.ts
src/cli/cmd/run/*            （多个文件）
src/cli/logo.ts
src/util/record.ts
src/util/locale.ts
src/util/error.ts
src/plugin/tui/runtime.ts
src/plugin/tui/internal.ts
```

两种方案：

- **保守（推荐首期）**：保留 `packages/tui` 依赖，仅不构建/不使用；其余裁剪照常。风险最低。
- **彻底**：删除 `packages/tui`，逐一处理上述文件：`util/record.ts`、`util/locale.ts`、`util/error.ts`、`cli/logo.ts` 改为本地实现或删除；删除 `config/tui*.ts` 并清理 `config/config.ts` 中的引用；删除 `cli/cmd/tui.ts`、`cli/cmd/run/`、`plugin/tui/` 及 `index.ts` 中对应命令注册。

### 4.4 精简 CLI 命令（`packages/opencode/src/index.ts`）

保留：`serve`、`generate`、`models`、`agent`、`providers`、`mcp`、`session`、`export`、`import`、`db`、`upgrade`。
移除：`tui`、`run`、`web`、`attach`、`acp`、`pr`、`github`、`stats`、`account`、`plug`（按需）。

### 4.5 构建与分发

```powershell
# 关键：必须跳过 Web UI 内嵌（默认会构建 packages/app）
bun run --cwd packages/opencode script/build.ts --skip-embed-web-ui
```

分发方式三选一：

1. **源码 + Bun 运行时**（内网/开发期最快）；
2. **单文件二进制**（`script/build.ts` 产物，按平台编译，随 Qt 安装包分发）；
3. **npm 全局安装**（要求用户机器有 Node/Bun 环境，不推荐产品化）。

### 4.6 裁剪后验证

- [ ] `bun install` 成功，lockfile 已刷新。
- [ ] `bun run --cwd packages/opencode typecheck` 通过。
- [ ] `serve` 启动，阶段 0 冒烟测试全部通过。
- [ ] 构建产物不包含 Web UI 资源。
- [ ] 回归：`opencode generate > openapi.json` 正常输出（用于 Qt 侧类型生成）。

---

## 5. 阶段 2：Qt 客户端实现

### 5.1 模块划分

| 模块 | 职责 |
|---|---|
| `ServerProcess` | QProcess 管理 opencode 生命周期、端口/密码、健康检查、重启 |
| `ApiClient` | QNetworkAccessManager 封装：Basic Auth、目录头、JSON 编解码、错误映射 |
| `SseClient` | `/event` 长连接、分帧解析、心跳过滤、断线重连 |
| `EventRouter` | 事件 JSON → Qt 信号（session/message/part/permission/question） |
| `SessionModel` | 消息与 part 状态机（含增量合并）、会话列表 |
| `PermissionBridge` | 权限/问答弹窗与应答 |
| `ChatView` | 现有聊天窗口接入 SessionModel（流式 Markdown） |

### 5.2 进程管理（QProcess）

```cpp
QProcess *p = new QProcess(this);
QProcessEnvironment env = QProcessEnvironment::systemEnvironment();
env.insert("OPENCODE_SERVER_PASSWORD", m_password);
env.insert("OPENCODE_CONFIG_CONTENT", configJson);
p->setProcessEnvironment(env);
p->setProgram(binaryPath);          // opencode 或 bun
p->setArguments({ "serve", "--hostname", "127.0.0.1", "--port", "0" });
p->start();
// 读取 stdout，匹配 "opencode server listening on (http://...)"
```

要点：

- 使用随机端口（`--port 0`）并从 stdout 解析实际端口，避免端口冲突。
- 启动后轮询 `/global/health`（带 Basic Auth）确认可用；失败重试并记录 stderr。
- 退出策略：先 `terminate()`，超时（如 5s）后 `kill()`；内核数据落 SQLite，强杀可接受。
- 崩溃自愈：监听 `finished`，指数退避重启，超过阈值提示用户。
- Windows 注意：shell 工具依赖 Git Bash（内核自动探测 `git` 推导 bash 路径），目标机器需安装 Git；否则仅 shell 工具不可用。

### 5.3 HTTP 客户端要点

- 所有请求携带：`Authorization: Basic ...`、`x-opencode-directory: <urlencoded>`、`Content-Type: application/json`。
- 超时：普通请求 30s；同步 prompt（`/message`）不设超时或设长超时（模型可能长时间运行）；推荐主链路用 `prompt_async` + SSE，避免长连接阻塞。
- HTTP/1.1 同主机连接数默认 6：**只保留一个全局 `/event` SSE**，不要为每个会话开 SSE；普通请求与 SSE 共享连接池时注意并发上限。
- 大响应（图片/附件 base64）在独立线程解析，避免阻塞 UI。
- 401 → 密码错误；400 → 请求体不符合 schema（按 openapi 校验）；404 → 会话/权限 ID 失效。

### 5.4 流式渲染状态机

```
message.part.updated(part)  → upsert(partID, part)  → 渲染
message.part.delta(field,delta) → append(partID.field, delta) → 渲染
message.part.removed(partID)    → remove(partID)
message.updated(info)           → 更新消息头（状态/用量）
session.idle                    → 结束"生成中"指示
session.error                   → 错误提示
```

渲染节流：事件可能高频到达，建议合并到 30–60 FPS 的 UI 刷新（例如 QTimer 批量应用增量），避免频繁重排 Markdown。

### 5.5 权限与问答

1. 收到 `permission.asked`（含 `id`、`sessionID`、动作/资源/元数据）→ 弹原生对话框。
2. 用户选择 → `POST /permission/{requestID}/reply`，`reply` 取 `once` / `always` / `reject`。
3. 收到 `permission.replied` 关闭弹窗（多端一致性）。
4. 问答工具：`question.asked` → `POST /question/{requestID}/reply`（`answers: string[][]`）或 `/reject`。

### 5.6 配置注入

- 首选 `OPENCODE_CONFIG_CONTENT`（JSON 字符串）随进程启动注入，便于 Qt 统一管理。
- 也可写全局配置（`~/.config/opencode/opencode.json`）或项目配置（项目根 `opencode.json` / `.opencode/`）。
- 可配置内容：`model`、`small_model`、`agent`（含 system prompt、工具白名单、权限）、`permission`、`provider`、`mcp`、`plugin`、`instructions`、`shell` 等。
- 领域定制全部走配置（agents + 权限 + MCP + 插件工具），不改内核。

### 5.7 版本策略与升级

- 启动时读取 `/global/health` 的 `version`，与客户端内置兼容版本比对，不一致时警告。
- 升级流程：更新二进制 → `opencode generate > openapi.json` → diff 与上一版的差异（路径、事件联合类型、字段）→ 更新 Qt 客户端 → 跑阶段 0 冒烟清单。
- 事件类型是联合类型，新增事件必须被 Qt 侧"未知事件忽略"策略安全兜底。

### 5.8 业务上下文注入（插件 + 业务服务，已确定）

架构与钩子细节见 `docs/qtui/opencode-qt-integration-methodology.md` 5.4；Qt 端点与流程清单见同文档第 7 节。实施步骤：

1. 业务侧提供分析接口（建议 `127.0.0.1` + 随机端口 + 一次性 token，契约见方法文档 5.4）；
2. 编写插件 `.opencode/plugin/business-context.ts`：
   - `experimental.chat.system.transform`：追加业务规则/知识（首选，最安全）；
   - `experimental.chat.messages.transform`：按需注入补充资料（幂等 + 超时 + 降级）；
   - `chat.message`：需要审计/持久化的输入增强走这里（写入历史 parts）；
3. 通过 `OPENCODE_CONFIG_CONTENT` 下发 `"plugin": ["./.opencode/plugin/business-context.ts"]`，业务服务地址与令牌作为 serve 进程环境变量注入；
4. 冒烟验证：注入可见、每 step 不重复、业务服务不可用时降级且会话不失败。

约束：不破坏 tool-call/tool-result 配对（优先 system 注入）；`messages.transform` 的修改不落库；压缩场景需识别并剔除注入标记。

---

## 6. 附录

### A. 关键源码索引

| 内容 | 路径 |
|---|---|
| serve 命令与参数 | `packages/opencode/src/cli/cmd/serve.ts`、`packages/opencode/src/cli/network.ts` |
| Basic Auth | `packages/server/src/auth.ts` |
| SSE 端点与心跳 | `packages/server/src/handlers/event.ts` |
| SSE 解析参考实现 | `packages/client/src/generated/client.ts:192-247` |
| 目录头处理 | `packages/sdk/js/src/v2/client.ts:20-75` |
| 事件/请求类型定义 | `packages/sdk/js/src/v2/gen/types.gen.ts` |
| OpenAPI 全量描述 | `packages/sdk/openapi.json`（162+ 路径） |
| 会话处理 | `packages/server/src/handlers/session.ts` |
| 权限处理 | `packages/server/src/handlers/permission.ts` |
| PTY/WebSocket | `packages/server/src/handlers/pty.ts` |
| 构建脚本（`--skip-embed-web-ui`） | `packages/opencode/script/build.ts` |
| 桌面端进程管理参考 | `packages/desktop/src/main/sidecar.ts`、`background-cli.ts` |

### B. 故障排查

| 现象 | 排查方向 |
|---|---|
| 401 | `Authorization` 头或密码错误；确认 `OPENCODE_SERVER_PASSWORD` 已注入子进程 |
| 连接被拒 | 端口解析失败或进程未起；检查 stdout 的 listening 行与 stderr 日志 |
| SSE 无事件 | 确认 `Content-Type: text/event-stream`、没有代理缓冲；先只订阅 `/event` 观察 |
| 请求目录不对 | 检查 `x-opencode-directory` 是否 URL 编码、路径是否存在 |
| shell 工具失败（Windows） | 安装 Git（Git Bash），或改用其他工具 |
| 流式卡顿 | 检查是否每个事件都触发 Markdown 全量重排；加节流/增量渲染 |
| 同步 prompt 超时 | 改用 `prompt_async` + SSE |

### C. 阶段验收总表

| 阶段 | 交付物 | 验收 |
|---|---|---|
| 0 | Qt 能连接官方 serve 并完成一轮对话 | 冒烟清单 3.3 全绿 |
| 1 | 裁剪后的 headless 仓库 + 构建产物 | 4.6 全绿，包体积/构建时间明显下降 |
| 2 | Qt 集成模块与聊天窗口接入 | 流式渲染、工具卡片、权限弹窗、断线恢复可用 |
