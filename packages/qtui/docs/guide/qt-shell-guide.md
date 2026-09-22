# Qt 壳接口开发指南（功能分类）

> 面向 Qt / C++ / 其它 Native 桌面开发者：从零实现一个连接 `qtoc_core` 的原生客户端需要掌握的全部关键方面。
> 协议全量清单见 `../api/qtoc-http-api.md`；设计决策与理由见 `../integration/methodology.md`；参考实现逐模块导读见 `client-tour.md`。
> 基准版本：opencode `1.18.32`（channel `qt-headless`）。

---

## 1. 总体模型与职责边界

```
Qt/C++ 壳（全部交互 UI）
  ├─ ServerProcess (QProcess)        进程生命周期
  ├─ ApiClient (QNAM)                REST + Basic Auth + 目录头
  ├─ SseClient                       /event 长连接 + 分帧解析
  ├─ EventRouter                     事件 JSON → Qt 信号
  ├─ SessionModel                    part 投影与增量合并
  └─ Permission/QuestionBridge       人机交互闭环
        │ HTTP/1.1 + SSE
qtoc_core serve（headless 内核，独立进程）
  session / provider / tools / permission / compaction / storage
```

**服务端负责**（Qt 不要重复实现）：

| 领域 | 说明 |
|---|---|
| 会话生命周期 | 创建/删除/fork/revert/abort/summarize，SQLite 持久化 |
| 模型解析 | prompt.model > session.model > agent.model > 全局默认；凭据与 provider 实例化 |
| Prompt 组装 | 系统提示词、instructions、历史投影、压缩裁剪、工具 schema 注入 |
| 工具调用 | LLM 流解析、工具执行、权限判定、结果截断 |
| 上下文压缩 | 溢出检测、自动/手动压缩 |
| 事件广播 | `/event`、`/global/event` |

**Qt 负责**：

| 领域 | 说明 |
|---|---|
| 进程管理 | 启动/健康/停止/重启 daemon，日志与资源采集 |
| 输入 | prompt parts（text/file/agent/subtask）、模型/agent 选择 |
| 渲染 | part 投影（文本增量、推理、工具卡片、diff、todo） |
| 交互 | 权限弹窗、问答弹窗、应答、超时策略 |
| 设置 | 配置读写 UI、凭据登录、项目切换 |
| 恢复 | 断线重放、待决请求重建 |

**反模式（明确禁止）**：

- 在 Qt 侧拼接系统提示词或历史（会与内核裁剪/注入冲突）；
- 在 Qt 侧解析模型原始 tool_call（服务端已结构化为 part）；
- 把 part/消息当作权威状态（权威在 server，Qt 只做投影）；
- 用同步 `/session/{id}/message` 做主链路（会长时间阻塞，应用 `prompt_async` + 事件）。

---

## 2. 进程与生命周期

### 2.1 启动

```cpp
QProcess *p = new QProcess(this);
QProcessEnvironment env = QProcessEnvironment::systemEnvironment();
env.insert("OPENCODE_SERVER_PASSWORD", m_password);   // 每次启动随机密码
env.insert("OPENCODE_CLIENT", "desktop");             // 启用 question 工具
env.insert("OPENCODE_CONFIG_CONTENT", configJson);    // 内联配置
env.insert("XDG_DATA_HOME",  stateDir + "/data");     // 隔离数据
env.insert("XDG_STATE_HOME", stateDir + "/state");    // 隔离锁
env.insert("XDG_CONFIG_HOME", stateDir + "/config");  // 隔离配置
p->setProcessEnvironment(env);
p->setProgram(corePath);
p->setArguments({"serve", "--hostname", "127.0.0.1", "--port", "0"}); // 0 = 随机端口
p->start();
```

要点：

1. **随机端口 + 随机密码**：`--port 0` 避免端口冲突；密码用 UUID，只存内存。
2. **从 stdout 解析端口**：匹配 `listening on http://[^:]+:(\d+)`，得到端口后再做健康检查。
3. **隔离目录**：`XDG_*` 指向应用私有目录，避免污染用户环境、支持多实例。
4. **Windows**：`terminate()` 对控制台进程通常无效，直接 `kill()`；数据落 SQLite，强杀可接受。
5. **崩溃自愈**：监听 `finished`，指数退避重启（1s/2s/4s…，上限 30s），超过阈值提示用户。
6. **Windows 依赖**：shell 工具依赖 Git Bash（内核自动探测 `git` 推导 bash），目标机需安装 Git，否则仅 shell 工具不可用。

参考实现：`packages/qtui/client/src/core/ServerProcess.cpp`（启动参数、环境注入、stdout 解析、退出处理）。

### 2.2 健康检查与就绪

- `GET /global/health` → `{ healthy: true, version }`；启动后轮询（带 Basic Auth），成功后置就绪。
- 记录 `version` 并与客户端兼容版本比对，不一致时警告（协议漂移防护）。
- 失败时保留 stderr 供排查（内核日志同时写入 `<XDG_DATA_HOME>/opencode/log/opencode.log`）。

### 2.3 停止

1. 关闭 SSE → 2. `kill()` 进程 → 3. 等待退出 → 4. 清理临时目录（可选）。

---

## 3. 连接与请求约定

### 3.1 请求头（每个请求，含 SSE）

| 头 | 值 | 说明 |
|---|---|---|
| `Authorization` | `Basic base64("opencode:<password>")` | 用户名固定 `opencode` |
| `x-opencode-directory` | URL 编码的绝对路径 | 项目作用域；SSE 也必须带，否则收不到会话事件 |
| `Content-Type` | `application/json` | 有 body 的请求 |

GET 也可用 `?directory=<路径>` 替代目录头。

> 事件流：目录级用 `GET /event`（帧 `{id,type,properties}`）；需要跨项目统一事件源时用 `GET /global/event`（帧外层多一层 `{ directory, project?, workspace?, payload }`）。单 daemon 多目录场景建议每目录一个 `/event` 或全局流按 `directory` 分发，二选一，不要重复订阅。

### 3.2 超时与连接池

- 普通请求 30s 超时；同步 `/message` 不设超时或设长超时。
- HTTP/1.1 同主机默认 6 连接：**全局只保留一个 `/event` SSE**，不要按会话开流。
- Qt 6.7+ 默认 30s 传输超时**会杀死 SSE 长连接**，必须 `request.setTransferTimeout(0)`。

### 3.3 错误映射

| HTTP | 含义 | Qt 处理 |
|---|---|---|
| 401 | 密码/认证头错误 | 提示重新配置，检查子进程环境变量 |
| 400 | 请求体不符合 schema | 记录响应体（含 `data.message`） |
| 404 | 会话/权限 ID 失效 | 清理本地状态，重拉列表 |
| 5xx | 内核内部错误 | 展示错误 + 保留日志，可重试 |

错误体为具名对象 `{ name, data: { message } }`；解析优先取 `data.message`。

参考实现：`packages/qtui/client/src/core/ApiClient.cpp`（认证头、目录头、统一回调）、`EventRouter.cpp` 的 `errorText`。

---

## 4. 会话与消息主链路

### 4.1 打开/恢复会话

```
GET /session                          # 会话列表（按目录过滤）
GET /session/{id}/message?limit=&before=   # 历史分页（重建投影）
GET /event                            # 建立 SSE（带目录头）
GET /permission + GET /question       # 重建待决弹窗
```

### 4.2 发送消息（唯一主链路）

```http
POST /session/{sessionID}/prompt_async
{
  "agent": "build",
  "model": { "providerID": "anthropic", "modelID": "claude-sonnet-4-5" },
  "parts": [ { "type": "text", "text": "..." } ]
}
→ 204
```

- 结果全部通过事件流返回；禁止用同步 `/message` 做主链路。
- `parts` 类型：`text`、`file`（`file://` 或 `data:` base64）、`agent`、`subtask`。
- 发送成功后 UI 进入"生成中"，收到 `session.idle` 结束。

### 4.3 会话管理

| 功能 | 端点 | 备注 |
|---|---|---|
| 中止 | `POST /session/{id}/abort` | 停止按钮；同时中断待决权限等待 |
| 重命名/归档 | `PATCH /session/{id}` | body `{ title, metadata, permission, time.archived }` |
| 删除 | `DELETE /session/{id}` | - |
| 分叉 | `POST /session/{id}/fork` | body `{ messageID }` |
| 回滚 | `POST /session/{id}/revert` / `unrevert` | body `{ messageID, partID? }` |
| 手动压缩 | `POST /session/{id}/summarize` | body `{ providerID, modelID, auto? }` |
| 子会话 | `GET /session/{id}/children` | - |
| 任务清单 | `GET /session/{id}/todo` | 或事件 `todo.updated` |
| 变更汇总 | `GET /session/{id}/diff` | 或事件 `session.diff` |
| slash 命令 | `GET /command` + `POST /session/{id}/command` | body `{ command, arguments, agent?, model?, parts? }` |
| 会话内 shell | `POST /session/{id}/shell` | body `{ agent, command, model? }` |

### 4.4 状态兜底

- `GET /session/status` 返回 `{ [sessionID]: { type: "idle"|"busy"|"retry", ... } }`；
- 断线重连或 UI 状态不确定时用它对齐；`retry` 状态含 `attempt`、`message`、`next`。

---

## 5. 流式渲染状态机

```
message.part.updated(part)      → upsert(partID, part)          → 渲染
message.part.delta(field,delta) → append(partID.field, delta)   → 渲染
message.part.removed(partID)    → remove(partID)
message.updated(info)           → 更新消息头（role/状态/用量）
session.status / session.idle   → 生成中指示
session.error                   → 错误提示
```

### 5.1 双写去重（必须处理）

同一 part 会同时收到增量（`message.part.delta`）与快照（`message.part.updated`）。若两者都追加会造成文本重复。参考实现策略（`packages/qtui/client/src/core/SessionModel.cpp`）：

- 记录已收到增量的 part（`m_streamed`）；
- 已流式的 part 收到全量 `updated` 时**忽略其文本覆盖**，保留增量累积结果。

### 5.2 渲染节流

事件可能高频到达（每 token 一次 delta）。用 `QTimer`（50ms 单次触发）合并刷新，目标 30–60 FPS，避免频繁 Markdown 全量重排。参考实现：`MainWindow::m_renderTimer`。

### 5.3 part 类型渲染建议

| part.type | 渲染 |
|---|---|
| `text` | Markdown，增量字段 `text` |
| `reasoning` | 可折叠思考区，增量字段 `text` |
| `tool` | 工具卡片：`tool` 名称 + `state.status`（pending/running/completed/error）+ `state.title` + 输入/输出 |
| `file` | 附件/文件引用 |
| `compaction` | "上下文已压缩"标记 |
| `snapshot` / `patch` / `step-*` / `retry` / `agent` / `subtask` | 可折叠或安全忽略 |

### 5.4 大 payload

图片/附件 base64 可能在独立线程解析，避免阻塞 UI；渲染层限制单条消息的 Markdown 重排范围。

---

## 6. 权限与问答闭环（人机交互）

### 6.1 通用模型

服务端 `ask` → 挂起请求（pending Map + Deferred）→ 发布事件 → Qt 弹窗 → REST reply → 工具继续。**无超时**；实例释放时 pending 全部失败；`abort` 中断等待。

### 6.2 权限

- 事件：`permission.asked`（`id, sessionID, permission, patterns, metadata, always, tool?`）/ `permission.replied`。
- 应答：`POST /permission/{requestID}/reply`，`reply ∈ once | always | reject`，可带 `message`。
- 语义：
  - `always` 将 `always` patterns 写入**实例内存** approved（重启失效），并自动放行被覆盖的其它待决请求；
  - `reject` 级联拒绝同会话所有待决权限；带 `message` 时作为修正反馈给模型。
- 弹窗按类型渲染：`edit` 显示 diff、`bash` 显示命令、`external_directory` 显示目录 glob。
- 持久化规则用 config `permission` 或 V2 `/api/permission/saved`（实验）。

### 6.3 问答（question 工具）

- 启用条件：`OPENCODE_CLIENT ∈ {app, cli, desktop}` 或 `OPENCODE_ENABLE_QUESTION_TOOL=1`。
- 事件：`question.asked`（`questions[].question/header/options/multiple/custom`）。
- 应答：`POST /question/{requestID}/reply` `{ answers: string[][] }`；`/reject` 取消。
- Plan 模式确认（`plan_exit`）复用该通道；回答存入 tool part `metadata.answers`，历史可回显。

### 6.4 Qt 闭环清单

1. 事件路由 → 模态弹窗队列（FIFO，带会话上下文）；
2. 应答接口调用（注意权限与问答 body 结构不同）；
3. **重连恢复：`GET /permission` + `GET /question` 重建待决**（否则会话永久挂起）；
4. 超时策略（建议默认拒绝 + 提示）；
5. 多窗口一致性（`replied` 事件关闭所有窗口弹窗）；
6. 中止联动（`abort` 中断等待）。

参考实现：`packages/qtui/client/src/ui/MainWindow.cpp` 的 `onPermissionAsked` / `onQuestionAsked`。

---

## 7. 配置、模型与凭据

### 7.1 注入通道与优先级（低 → 高）

1. 全局文件 `~/.config/opencode/opencode.json[c]`
2. 项目文件（目录向上到 worktree 的 `opencode.json[c]`）
3. `.opencode` 目录
4. `OPENCODE_CONFIG` 指定文件
5. **`OPENCODE_CONFIG_CONTENT` 内联 JSON（最高，Qt 首选）**

合并规则：深合并；`instructions` 数组拼接去重；`PATCH /global/config` 写回文件并触发失效。

### 7.2 推荐组合

| 场景 | 手段 |
|---|---|
| 启动基础配置 + 凭据 | `OPENCODE_CONFIG_CONTENT` + `OPENCODE_AUTH_CONTENT` 进程注入 |
| 用户设置持久化 | Qt QSettings + `PATCH /global/config` |
| 项目级差异 | 项目目录 `opencode.json` / `.opencode/` |
| 会话级覆盖 | prompt body 的 `model`/`agent`/`system`/`tools`；`POST /session` 的 `permission` |

### 7.3 凭据

优先级：`OPENCODE_AUTH_CONTENT`（内联 JSON，Qt 首选）→ `auth.json` → config `provider.*.options.apiKey` → provider 环境变量 → OAuth API。

### 7.4 模型/Agent 列表

- 模型：`GET /config/providers` 返回 `{ providers: [...], default: {...} }`，每个 provider 的 `models` 为对象映射；
- Agent：`GET /agent`；
- 启动自检：若 `models == 0` 或未配置模型，明确提示用户（错误只会以 `session.error` 事件返回，聊天窗口不会有内容）。

参考实现：`packages/qtui/client/src/core/Settings.cpp`（配置 JSON 生成、内置 provider 列表、自定义 OpenAI 兼容 provider）。

---

## 8. 断线恢复

1. 重连 `/event`（指数退避 1s/2s/4s…，上限 30s，期间禁用发送）；
2. `GET /session/status` 对齐 busy/idle；
3. 对当前会话 `GET /session/{id}/message`（分页）全量重放重建投影；
4. `GET /permission` + `GET /question` 重建待决弹窗；
5. 增强（可选）：V2 `/api/session/{id}/event?after=` 与 `/history?after=` 提供游标续传，但不作为主链路依赖。

---

## 9. 可选能力面

| 能力 | 端点 | 说明 |
|---|---|---|
| 文件浏览 | `GET /file`、`GET /file/content`、`GET /find/file` | `?path=` 绝对路径 |
| 变更视图 | `GET /file/status`、`GET /session/{id}/diff`、`GET /vcs/status`、`GET /vcs/diff` | diff 面板 |
| MCP 管理 | `GET|POST /mcp`、`POST /mcp/{name}/connect|disconnect` | 设置界面 |
| 登录 | `GET /provider/auth`、`PUT /auth/{providerID}`、`POST /provider/{id}/oauth/*` | 凭据流程 |
| 终端 | `GET|POST /pty`、`POST /pty/{id}/connect-token` + WS `/pty/{id}` | QWebSocket + 自定义分帧，可整体跳过 |
| 命令面板 | `GET /command`、`POST /session/{id}/command` | slash 命令 |

---

## 10. 多实例 / 多项目

- `qtoc_core serve` 无单例限制，可多开。
- 隔离资源：

| 资源 | 隔离方式 |
|---|---|
| SQLite | `OPENCODE_DB=<绝对路径>` 或 `XDG_DATA_HOME` |
| 锁目录 | `XDG_STATE_HOME` |
| 配置 | `OPENCODE_CONFIG_DIR` / `XDG_CONFIG_HOME` |
| 端口/密码 | `--port 0` + 每实例随机密码 |

- 拓扑建议：
  1. **单 daemon 多目录（首选）**：`x-opencode-directory` 区分项目，资源最省；
  2. 多 daemon：按配置/凭据/版本/租户隔离，Qt 维护 DaemonPool（端口映射、健康、LRU 回收）；
  3. 混合：公共 daemon + 敏感项目独立 daemon。
- 会话 ID 与 daemon 绑定，不可跨实例复用。

---

## 11. 风险清单与对策

| # | 风险 | 对策 |
|---|---|---|
| 1 | 双轨 API（稳定面 vs `/api/*`）演进 | 主链路只用稳定面；实验面灰度 |
| 2 | 协议版本漂移 | 启动校验 `/global/health` version；pin 二进制 |
| 3 | `/event` 无重放 | 重连全量拉历史；V2 游标作为增强 |
| 4 | HTTP/1.1 6 连接限制 | 仅一个全局 SSE |
| 5 | 权限/问答无超时 | Qt 超时策略 + 重连恢复 |
| 6 | `always` 不持久化 | 持久规则写 config `permission` |
| 7 | question 工具默认未启用 | 注入 `OPENCODE_CLIENT=desktop` |
| 8 | 同步 `/message` 长阻塞 | 主用 `prompt_async` |
| 9 | 多 daemon 共享 DB/锁 | 按第 10 节隔离 |
| 10 | 大 payload | 后台线程解析 + 渲染节流 |
| 11 | 未知事件/字段 | 未知事件安全忽略 |
| 12 | Qt 6.7+ SSE 被传输超时杀死 | `setTransferTimeout(0)` |

---

## 12. 验收与冒烟

**每次升级必跑**

- [ ] `/global/health` 正常且版本符合预期；
- [ ] `/event` 建连、心跳无报错、首帧 `server.connected`；
- [ ] `prompt_async` 后收到 `message.part.delta/updated` 并流式渲染；
- [ ] 工具调用 part 正确渲染（含 diff/终端输出）；
- [ ] 权限闭环（`asked` → reply → `replied`）；
- [ ] 问答闭环（`question.asked` → reply/reject）；
- [ ] 断线重连后历史与待决恢复；
- [ ] 压缩触发后 UI 标记正确、会话可继续。

**升级 checklist**：替换二进制 → `opencode generate > openapi.json` → diff 端点/事件/字段 → 更新适配层 → 跑冒烟清单。

---

## 13. 与参考实现的模块对照

| 职责 | 参考文件（`packages/qtui/client/src/`） | 关键点 |
|---|---|---|
| 进程生命周期 | `core/ServerProcess.{h,cpp}` | 随机端口/密码、XDG 隔离、stdout 解析、Windows kill |
| HTTP 客户端 | `core/ApiClient.{h,cpp}` | Basic Auth、目录头、统一回调与错误文本 |
| SSE 连接 | `core/SseClient.{h,cpp}` | 传输超时置 0、目录头、断线回调 |
| SSE 分帧 | `core/SseParser.{h,cpp}` | 跨包、CRLF、心跳、1MB 上限、非法 JSON 忽略 |
| 事件路由 | `core/EventRouter.{h,cpp}` | JSON → Qt 信号、错误对象解析、未知事件透传 |
| 会话投影 | `core/SessionModel.{h,cpp}` | part upsert、增量合并、双写去重 |
| 设置与配置 | `core/Settings.{h,cpp}` | QSettings + 环境变量回退、`OPENCODE_CONFIG_CONTENT` 生成 |
| UI 与闭环 | `ui/MainWindow.{h,cpp}` | 流式渲染节流、权限/问答弹窗、abort、日志 |
| 设置界面 | `ui/SettingsDialog.{h,cpp}` | provider/baseURL/apiKey/model/port |
