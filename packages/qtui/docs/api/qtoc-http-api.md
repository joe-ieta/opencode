# qtoc_core HTTP / SSE 接口全量清单

> 适用产物：`qtoc_core`（headless opencode 内核，`qt-headless` 分支）。
> 基准版本：opencode `1.18.32`（channel `qt-headless`）。
> 来源：`packages/sdk/openapi.json`（`opencode generate` 生成，共 **188** 个端点）与 `packages/server/src/**`。
> 配套阅读：`guide/qt-shell-guide.md`（按功能分类的开发指南）、`integration/methodology.md`（协议面选择与决策）。

---

## 1. 接入约定

### 1.1 基地址与启动

```
qtoc_core serve --hostname 127.0.0.1 --port 0
```

- 默认 `--port 0`（随机端口），启动成功后 stdout 输出一行：
  `opencode server listening on http://127.0.0.1:<port>`（Qt 解析此行获得实际端口）。
- 客户端所有请求的基地址：`http://127.0.0.1:<port>`。
- 另有 `--mdns`、`--mdns-domain`、`--cors` 参数；原生 Qt 客户端不需要。

### 1.2 认证

- HTTP Basic Auth，用户名固定 `opencode`（可用 `OPENCODE_SERVER_USERNAME` 覆盖），密码来自 `OPENCODE_SERVER_PASSWORD`。
- 未设置密码时服务不设防（仅限本机开发）。
- 每个请求（**包括 `/event` SSE**）都必须携带：
  `Authorization: Basic base64("opencode:<password>")`。

### 1.3 目录作用域（多项目）

内核是"单进程多目录"模型，请求通过目录标识定位项目实例：

| 方式 | 形式 | 说明 |
|---|---|---|
| 请求头（推荐） | `x-opencode-directory: <URL 编码的绝对路径>` | 所有方法均可用；SDK 默认行为 |
| 查询参数 | `?directory=<路径>` | GET 可用；与请求头等价 |
| 工作区（可选） | `x-opencode-workspace` / `?workspace=` | worktree 场景 |

**Qt 约定**：每个项目保存绝对路径，所有请求统一带 `x-opencode-directory`；路径必须 URL 编码（如 `E%3A%5Cprojects%5Cdemo`）。

### 1.4 通用请求/响应

- `Content-Type: application/json`（有 body 的请求）。
- 时间戳为 Unix 毫秒（`number`）。
- ID 前缀：`ses_`（会话）、`msg_`（消息）、`prt_`（part）、`per_`（权限请求）、`que_`（问答请求）、`pty_`（终端）、`wrk_`（工作区）、`evt_`（事件）。
- 错误响应体为具名错误对象（`Error` 联合类型），典型形状：

```json
{ "name": "NotFoundError", "data": { "message": "..." } }
```

常见错误名：`InvalidRequestError`、`NotFoundError`、`ProviderAuthError`、`ContextOverflowError`、`MessageAbortedError`、`APIError`、`UnknownError`。
Qt 侧解析建议：取 `data.message`，回退 `message`，再回退原始 JSON（参考 `packages/qtui/client/src/core/EventRouter.cpp` 的 `errorText`）。

### 1.5 SSE 事件流

`GET /event`（目录级）与 `GET /global/event`（全局），响应头 `content-type: text/event-stream`。

- 事件编码：`data: <JSON>\n\n`，JSON 为 `{ "id": "...", "type": "...", "properties": { ... } }`。
- **心跳与终止（两个流不同）**：
  - `/event`（legacy，Qt 主用）：每 **10 秒**一个 `server.heartbeat` **事件**（`{ id, type: "server.heartbeat", properties: {} }`，按未知事件忽略）；实例释放时发送 `server.instance.disposed` 并**结束流**（客户端需重连）；
  - `/api/event`（V2）：每 **15 秒**一行 `: heartbeat` 注释行（客户端忽略）。
- 首帧：连接后立即收到 `server.connected`。
- **两个流的帧结构不同**：
  - `/event`：`data: { id, type, properties }`（目录级，Qt 主用）；
  - `/global/event`：`data: { directory, project?, workspace?, payload: { id, type, properties } }`（跨目录，多项目场景按 `directory` 分发）。
- **V1/V2 事件变体并存**：同一 `/event` 流会同时出现两代变体（如 `permission.asked` 与 `permission.v2.asked`、`question.asked` 与 `question.v2.asked`、V2 的 `session.next.*`）；客户端必须同时兼容，并按变体路由应答（V1 与 V2 的 pending 服务与应答端点相互独立，见 `../integration/dual-engine-architecture.md` 4.7）。
- **legacy `/event` 无事件 ID、无重放**：断线后必须用 REST 拉取历史重建（见 `guide/qt-shell-guide.md` 第 8 节）；V2 `/api/session/{id}/event?after=` 提供游标重放。
- 订阅者队列容量 256（`Queue.dropping`）：消费过慢会触发 `SubscriberOverflowError` 并终止该事件流（Qt 侧必须保证事件处理非阻塞，收到流结束需按第 8 节恢复）。

分帧解析要点（参考实现 `packages/qtui/client/src/core/SseParser.cpp`）：

1. 字节缓冲按 `\n\n` 切块，兼容 `\r\n` / `\r`，注意跨 chunk 的尾部 `\r`；
2. 拼接所有 `data:` 行后 `JSON.parse`；
3. 单块缓冲上限 1 MB，超出视为协议错误；
4. 忽略 `:` 开头的注释行（心跳）；
5. **未知事件类型必须安全忽略**（事件联合类型随版本增长）。

### 1.6 环境变量（Qt 进程管理相关）

| 变量 | 用途 |
|---|---|
| `OPENCODE_SERVER_PASSWORD` / `OPENCODE_SERVER_USERNAME` | Basic Auth |
| `OPENCODE_CLIENT=desktop` | 启用 question 工具（否则问答能力缺失） |
| `OPENCODE_CONFIG_CONTENT` | 内联 JSON 配置（最高优先级） |
| `OPENCODE_AUTH_CONTENT` | 内联凭据 JSON |
| `OPENCODE_CONFIG_DIR` | 隔离配置目录 |
| `OPENCODE_DB` | 隔离数据库（多 daemon 必用） |
| `XDG_STATE_HOME` / `XDG_DATA_HOME` / `XDG_CONFIG_HOME` | 隔离锁、数据、配置 |
| `OPENCODE_PURE=1` | 禁用外部插件 |

---

## 2. 端点全量清单（188）

标记说明：

- **稳定面**：`/session`、`/event`、`/permission`、`/question`、`/config`、`/provider`、`/file`、`/find`、`/vcs`、`/pty`、`/project`、`/mcp`、`/global` 等——Qt 主链路。
- **实验面**：`/experimental/*`（演进中，按需灰度）、`/api/*`（V2 HttpApi，独立命名空间，不依赖）。
- **忽略**：`/tui/*`（TUI 专用控制，Qt 壳不消费）。
- Qt 建议：必用 / 推荐 / 可选 / 忽略 / 观望。

### 2.1 健康、事件与可观测性（12）

| 方法 | 路径 | 用途 | 面 | Qt 建议 |
|---|---|---|---|---|
| GET | `/global/health` | `{ healthy: true, version }`，启动校验与心跳 | 稳定 | 必用 |
| GET | `/event` | 目录级 SSE 事件流 | 稳定 | 必用 |
| GET | `/global/event` | 全局 SSE 事件流（跨目录，帧带 `directory` 包装） | 稳定 | 可选（多项目） |
| GET | `/session/status` | 所有会话状态映射 `{ [sessionID]: SessionStatus }` | 稳定 | 推荐（断线对齐） |
| GET | `/path` | 当前目录/worktree/config 路径 | 稳定 | 推荐 |
| GET | `/lsp` | LSP 子系统状态 | 稳定 | 可选 |
| GET | `/formatter` | Formatter 子系统状态 | 稳定 | 可选 |
| GET | `/experimental/capabilities` | 能力探测 | 实验 | 观望 |
| POST | `/log` | 客户端日志上报 | 稳定 | 可选 |
| POST | `/instance/dispose` | 释放当前目录实例（不退出进程） | 稳定 | 可选 |
| POST | `/global/dispose` | 释放全局实例 | 稳定 | 可选 |
| POST | `/global/upgrade` | 触发升级 | 稳定 | 忽略 |

### 2.2 配置、Provider、凭据与模型（11）

| 方法 | 路径 | 用途 | 面 | Qt 建议 |
|---|---|---|---|---|
| GET | `/config` | 读取当前生效配置 | 稳定 | 必用（设置界面） |
| PATCH | `/config` | 更新项目级配置 | 稳定 | 可选 |
| GET | `/global/config` | 读取全局配置 | 稳定 | 必用 |
| PATCH | `/global/config` | 写回全局配置文件并触发失效 | 稳定 | 推荐（设置持久化） |
| GET | `/config/providers` | Provider + 模型列表 + 默认模型 | 稳定 | 必用（模型下拉框） |
| GET | `/provider` | Provider 列表 | 稳定 | 可选 |
| GET | `/provider/auth` | 各 Provider 的认证方式 | 稳定 | 推荐（登录界面） |
| POST | `/provider/{providerID}/oauth/authorize` | 发起 OAuth | 稳定 | 可选 |
| POST | `/provider/{providerID}/oauth/callback` | OAuth 回调 | 稳定 | 可选 |
| PUT | `/auth/{providerID}` | 写入 API Key 凭据 | 稳定 | 推荐 |
| DELETE | `/auth/{providerID}` | 删除凭据 | 稳定 | 推荐 |

### 2.3 Agent / 命令 / 技能 / 工具元数据（5）

| 方法 | 路径 | 用途 | 面 | Qt 建议 |
|---|---|---|---|---|
| GET | `/agent` | Agent 列表（含模式、模型、工具白名单） | 稳定 | 必用（Agent 下拉框） |
| GET | `/command` | slash 命令列表 | 稳定 | 推荐（命令面板） |
| GET | `/skill` | 技能列表 | 稳定 | 可选 |
| GET | `/experimental/tool` | 工具清单（含 JSON Schema） | 实验 | 可选 |
| GET | `/experimental/tool/ids` | 工具 ID 列表（可探测 `question` 是否启用） | 实验 | 推荐（能力自检） |

### 2.4 MCP 管理（8）

| 方法 | 路径 | 用途 | 面 | Qt 建议 |
|---|---|---|---|---|
| GET | `/mcp` | MCP 服务状态 | 稳定 | 可选 |
| POST | `/mcp` | 动态添加 MCP 服务 | 稳定 | 可选 |
| POST | `/mcp/{name}/connect` | 连接 | 稳定 | 可选 |
| POST | `/mcp/{name}/disconnect` | 断开 | 稳定 | 可选 |
| POST | `/mcp/{name}/auth` | 发起认证 | 稳定 | 可选 |
| POST | `/mcp/{name}/auth/authenticate` | 认证 | 稳定 | 可选 |
| POST | `/mcp/{name}/auth/callback` | 认证回调 | 稳定 | 可选 |
| DELETE | `/mcp/{name}/auth` | 删除认证 | 稳定 | 可选 |

### 2.5 会话生命周期（20）

| 方法 | 路径 | 用途 | 面 | Qt 建议 |
|---|---|---|---|---|
| GET | `/session` | 会话列表（按目录过滤） | 稳定 | 必用 |
| POST | `/session` | 创建会话 | 稳定 | 必用 |
| GET | `/session/{sessionID}` | 会话详情 | 稳定 | 推荐 |
| PATCH | `/session/{sessionID}` | 重命名/元数据/权限/归档 | 稳定 | 推荐 |
| DELETE | `/session/{sessionID}` | 删除会话 | 稳定 | 推荐 |
| GET | `/session/{sessionID}/children` | 子会话列表 | 稳定 | 可选 |
| POST | `/session/{sessionID}/init` | 初始化（生成 AGENTS.md 等） | 稳定 | 可选 |
| POST | `/session/{sessionID}/abort` | 中止当前轮 | 稳定 | 必用 |
| POST | `/session/{sessionID}/fork` | 从消息分叉新会话 | 稳定 | 推荐 |
| POST | `/session/{sessionID}/revert` | 回滚到指定消息/part | 稳定 | 推荐 |
| POST | `/session/{sessionID}/unrevert` | 撤销回滚 | 稳定 | 推荐 |
| POST | `/session/{sessionID}/summarize` | 手动压缩上下文 | 稳定 | 推荐 |
| POST | `/session/{sessionID}/share` | 分享会话 | 稳定 | 可选 |
| DELETE | `/session/{sessionID}/share` | 取消分享 | 稳定 | 可选 |
| GET | `/session/{sessionID}/todo` | 任务清单 | 稳定 | 推荐 |
| GET | `/session/{sessionID}/diff` | 会话文件变更汇总 | 稳定 | 推荐 |
| POST | `/session/{sessionID}/command` | 执行 slash 命令 | 稳定 | 推荐 |
| POST | `/session/{sessionID}/shell` | 会话内 shell 命令 | 稳定 | 可选 |
| GET | `/experimental/session` | 会话列表（实验版） | 实验 | 忽略 |
| POST | `/experimental/session/{sessionID}/background` | 后台执行 | 实验 | 忽略 |

### 2.6 消息、Prompt 与 Part（7）

| 方法 | 路径 | 用途 | 面 | Qt 建议 |
|---|---|---|---|---|
| POST | `/session/{sessionID}/prompt_async` | **异步发消息（主链路）**，返回 204，结果走事件 | 稳定 | 必用 |
| POST | `/session/{sessionID}/message` | 同步发消息（阻塞到完成） | 稳定 | 仅脚本化 |
| GET | `/session/{sessionID}/message` | 历史消息（分页 `limit` / `before`） | 稳定 | 必用 |
| GET | `/session/{sessionID}/message/{messageID}` | 单条消息 | 稳定 | 可选 |
| DELETE | `/session/{sessionID}/message/{messageID}` | 删除消息 | 稳定 | 可选 |
| PATCH | `/session/{sessionID}/message/{messageID}/part/{partID}` | 编辑 part | 稳定 | 可选 |
| DELETE | `/session/{sessionID}/message/{messageID}/part/{partID}` | 删除 part | 稳定 | 可选 |

### 2.7 权限（3）

| 方法 | 路径 | 用途 | 面 | Qt 建议 |
|---|---|---|---|---|
| GET | `/permission` | 待决权限请求列表（重连恢复） | 稳定 | 必用 |
| POST | `/permission/{requestID}/reply` | 应答 `{ reply: "once"\|"always"\|"reject", message? }` | 稳定 | 必用 |
| POST | `/session/{sessionID}/permissions/{permissionID}` | 旧式应答 `{ response: ... }` | 稳定 | 兼容 |

### 2.8 问答（question 工具）（3）

| 方法 | 路径 | 用途 | 面 | Qt 建议 |
|---|---|---|---|---|
| GET | `/question` | 待决问答列表（重连恢复） | 稳定 | 必用 |
| POST | `/question/{requestID}/reply` | 应答 `{ answers: string[][] }` | 稳定 | 必用 |
| POST | `/question/{requestID}/reject` | 取消问答 | 稳定 | 必用 |

### 2.9 文件与搜索（6）

| 方法 | 路径 | 用途 | 面 | Qt 建议 |
|---|---|---|---|---|
| GET | `/file` | 文件/目录列表 | 稳定 | 可选 |
| GET | `/file/content` | 文件内容（`?path=<绝对路径>`） | 稳定 | 推荐 |
| GET | `/file/status` | 变更文件状态 | 稳定 | 推荐 |
| GET | `/find` | 文本搜索 | 稳定 | 可选 |
| GET | `/find/file` | 文件名搜索（`?query=&type=&limit=`） | 稳定 | 推荐 |
| GET | `/find/symbol` | 符号搜索 | 稳定 | 可选 |

### 2.10 VCS（5）

| 方法 | 路径 | 用途 | 面 | Qt 建议 |
|---|---|---|---|---|
| GET | `/vcs` | VCS 信息 | 稳定 | 可选 |
| GET | `/vcs/status` | 变更状态 | 稳定 | 推荐 |
| GET | `/vcs/diff` | diff | 稳定 | 推荐 |
| GET | `/vcs/diff/raw` | 原始 diff | 稳定 | 可选 |
| POST | `/vcs/apply` | 应用补丁 | 稳定 | 可选 |

### 2.11 PTY 终端（8）

| 方法 | 路径 | 用途 | 面 | Qt 建议 |
|---|---|---|---|---|
| GET | `/pty/shells` | 可用 shell 列表 | 稳定 | 可选 |
| GET | `/pty` | 终端列表 | 稳定 | 可选 |
| POST | `/pty` | 创建终端 | 稳定 | 可选 |
| GET | `/pty/{ptyID}` | 终端详情 | 稳定 | 可选 |
| PUT | `/pty/{ptyID}` | 更新终端 | 稳定 | 可选 |
| DELETE | `/pty/{ptyID}` | 删除终端 | 稳定 | 可选 |
| GET | `/pty/{ptyID}/connect` | WebSocket 连接（`?ticket=`） | 稳定 | 可选 |
| POST | `/pty/{ptyID}/connect-token` | 换取连接 ticket | 稳定 | 可选 |

> PTY 连接为 WebSocket + 自定义分帧（`PtyProtocol`，带 `cursor` 回放）；Qt 用 `QWebSocket` 接入。首期可整体跳过。

### 2.12 项目、工作区与 Worktree（20）

| 方法 | 路径 | 用途 | 面 | Qt 建议 |
|---|---|---|---|---|
| GET | `/project` | 项目列表 | 稳定 | 推荐（项目切换） |
| GET | `/project/current` | 当前项目 | 稳定 | 推荐 |
| PATCH | `/project/{projectID}` | 更新项目 | 稳定 | 可选 |
| GET | `/project/{projectID}/directories` | 项目目录列表 | 稳定 | 可选 |
| POST | `/project/git/init` | 初始化 Git 仓库 | 稳定 | 可选 |
| GET | `/experimental/worktree` | worktree 列表 | 实验 | 观望 |
| POST | `/experimental/worktree` | 创建 worktree | 实验 | 观望 |
| DELETE | `/experimental/worktree` | 删除 worktree | 实验 | 观望 |
| POST | `/experimental/worktree/reset` | 重置 worktree | 实验 | 观望 |
| GET | `/experimental/workspace` | 工作区列表 | 实验 | 观望 |
| POST | `/experimental/workspace` | 创建工作区 | 实验 | 观望 |
| DELETE | `/experimental/workspace/{id}` | 删除工作区 | 实验 | 观望 |
| GET | `/experimental/workspace/adapter` | 工作区适配器 | 实验 | 忽略 |
| GET | `/experimental/workspace/status` | 工作区状态 | 实验 | 忽略 |
| POST | `/experimental/workspace/sync-list` | 同步列表 | 实验 | 忽略 |
| POST | `/experimental/workspace/warp` | 工作区迁移 | 实验 | 忽略 |
| POST | `/experimental/project/{projectID}/copy` | 项目复制 | 实验 | 忽略 |
| DELETE | `/experimental/project/{projectID}/copy` | 取消复制 | 实验 | 忽略 |
| POST | `/experimental/project/{projectID}/copy/generate-name` | 生成名称 | 实验 | 忽略 |
| POST | `/experimental/project/{projectID}/copy/refresh` | 刷新复制 | 实验 | 忽略 |

### 2.13 同步与多实例（4）

| 方法 | 路径 | 用途 | 面 | Qt 建议 |
|---|---|---|---|---|
| POST | `/sync/start` | 启动同步 | 稳定 | 忽略 |
| POST | `/sync/history` | 同步历史 | 稳定 | 忽略 |
| POST | `/sync/replay` | 回放 | 稳定 | 忽略 |
| POST | `/sync/steal` | 抢占实例 | 稳定 | 忽略 |

### 2.14 TUI 控制（13，Qt 壳忽略）

`GET /tui/control/next`、`POST /tui/control/response`、`POST /tui/{append-prompt,clear-prompt,execute-command,open-help,open-models,open-sessions,open-themes,publish,select-session,show-toast,submit-prompt}`。
这些端点面向内置 TUI 的远程控制，Qt 壳全部忽略（误用会导致行为冲突）。

### 2.15 V2 实验面 `/api/*`（58，独立命名空间）

> 演进中，不纳入主链路。**唯一值得 Qt 关注**：`GET /api/session/{sessionID}/event?after=` 与 `GET /api/session/{sessionID}/history?after=&limit=` 提供**游标续传**，可作为断线恢复增强；`GET /api/session/{sessionID}/context` 可读取上下文占用。

<details>
<summary>展开 58 个 V2 端点</summary>

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/health` | 健康检查 |
| GET | `/api/event` | 全局事件流（V2） |
| GET | `/api/location` | 位置信息 |
| GET | `/api/session` | 会话列表 |
| POST | `/api/session` | 创建会话 |
| GET | `/api/session/active` | 活跃会话 |
| GET | `/api/session/{sessionID}` | 会话详情 |
| GET | `/api/session/{sessionID}/history` | 历史（游标） |
| GET | `/api/session/{sessionID}/event` | 事件（游标） |
| GET | `/api/session/{sessionID}/context` | 上下文占用 |
| POST | `/api/session/{sessionID}/prompt` | 发消息 |
| POST | `/api/session/{sessionID}/wait` | 等待完成 |
| POST | `/api/session/{sessionID}/interrupt` | 中断 |
| POST | `/api/session/{sessionID}/compact` | 压缩 |
| POST | `/api/session/{sessionID}/agent` | 切换 Agent |
| POST | `/api/session/{sessionID}/model` | 切换模型 |
| POST | `/api/session/{sessionID}/revert/stage` | 回滚暂存 |
| POST | `/api/session/{sessionID}/revert/commit` | 回滚提交 |
| POST | `/api/session/{sessionID}/revert/clear` | 清除回滚 |
| GET | `/api/session/{sessionID}/message` | 消息列表 |
| GET | `/api/session/{sessionID}/message/{messageID}` | 单条消息 |
| GET | `/api/session/{sessionID}/permission` | 待决权限 |
| POST | `/api/session/{sessionID}/permission` | 创建权限 |
| GET | `/api/session/{sessionID}/permission/{requestID}` | 权限详情 |
| POST | `/api/session/{sessionID}/permission/{requestID}/reply` | 权限应答 |
| GET | `/api/session/{sessionID}/question` | 待决问答 |
| GET | `/api/question/request` | 问答请求列表 |
| POST | `/api/session/{sessionID}/question/{requestID}/reply` | 问答应答 |
| POST | `/api/session/{sessionID}/question/{requestID}/reject` | 问答取消 |
| GET | `/api/permission/request` | 权限请求列表 |
| GET | `/api/permission/saved` | 已保存权限规则 |
| DELETE | `/api/permission/saved/{id}` | 删除规则 |
| GET | `/api/agent` | Agent 列表 |
| GET | `/api/command` | 命令列表 |
| GET | `/api/skill` | 技能列表 |
| GET | `/api/model` | 模型列表 |
| GET | `/api/provider` | Provider 列表 |
| GET | `/api/provider/{providerID}` | Provider 详情 |
| GET | `/api/reference` | 引用列表 |
| GET | `/api/fs/list` | 目录列表 |
| GET | `/api/fs/find` | 文件搜索 |
| GET | `/api/fs/read/*` | 文件读取 |
| GET | `/api/pty` / POST | 终端列表/创建 |
| GET | `/api/pty/{ptyID}` / PUT / DELETE | 终端详情/更新/删除 |
| GET | `/api/pty/{ptyID}/connect` | 终端连接 |
| POST | `/api/pty/{ptyID}/connect-token` | 终端 ticket |
| GET | `/api/integration` | 集成列表 |
| GET | `/api/integration/{integrationID}` | 集成详情 |
| POST | `/api/integration/{integrationID}/connect/key` | Key 连接 |
| POST | `/api/integration/{integrationID}/connect/oauth` | OAuth 连接 |
| GET | `/api/integration/attempt/{attemptID}` | 尝试状态 |
| DELETE | `/api/integration/attempt/{attemptID}` | 取消尝试 |
| POST | `/api/integration/attempt/{attemptID}/complete` | 完成尝试 |
| PATCH | `/api/credential/{credentialID}` | 更新凭据 |
| DELETE | `/api/credential/{credentialID}` | 删除凭据 |

</details>

### 2.16 控制台/资源/控制面实验（5）

| 方法 | 路径 | 用途 | 面 | Qt 建议 |
|---|---|---|---|---|
| GET | `/experimental/console` | 控制台信息 | 实验 | 忽略 |
| GET | `/experimental/console/orgs` | 组织列表 | 实验 | 忽略 |
| POST | `/experimental/console/switch` | 切换组织 | 实验 | 忽略 |
| POST | `/experimental/control-plane/move-session` | 迁移会话 | 实验 | 忽略 |
| GET | `/experimental/resource` | 资源列表 | 实验 | 忽略 |

---

## 3. 关键请求/响应 Schema

### 3.1 创建会话 `POST /session`

```json
{
  "parentID": "ses_...",
  "title": "string",
  "agent": "string",
  "model": { "id": "string", "providerID": "string", "variant": "string" },
  "metadata": {},
  "permission": { },
  "workspaceID": "wrk_..."
}
```

响应为 `Session` 对象（含 `id`、`title`、`time`、`model` 等）。

### 3.2 发消息 `POST /session/{sessionID}/prompt_async`

```json
{
  "messageID": "msg_...",
  "model": { "providerID": "anthropic", "modelID": "claude-sonnet-4-5" },
  "agent": "build",
  "noReply": false,
  "tools": { "bash": true },
  "format": { },
  "system": "string",
  "variant": "string",
  "parts": [
    { "type": "text", "text": "帮我修复这个编译错误" },
    { "type": "file", "mime": "text/plain", "url": "file:///E:/projects/demo/src/main.cpp" }
  ]
}
```

- `parts` 必填，支持 `text`、`file`（`file://` 或 `data:` base64）、`agent`、`subtask`。
- 返回 `204`；所有结果通过 `/event` 事件流返回。
- 同步版本 `POST /session/{sessionID}/message` 返回 `{ info, parts }`，会阻塞到整轮完成。

### 3.3 权限应答 `POST /permission/{requestID}/reply`

```json
{ "reply": "once" | "always" | "reject", "message": "可选，reject 时作为修正反馈给模型" }
```

语义：`always` 写入实例内存 approved（**不持久化**，重启失效）；`reject` 级联拒绝同会话所有待决权限。

### 3.4 问答应答 `POST /question/{requestID}/reply`

```json
{ "answers": [["选项标签 A"], ["自定义答案"]] }
```

`answers` 按问题顺序，每个答案为所选标签数组；`POST /question/{requestID}/reject` 取消。

### 3.5 Part 类型（`message.part.updated` / `message.part.delta`）

`text`、`subtask`、`reasoning`、`file`、`tool`、`step-start`、`step-finish`、`snapshot`、`patch`、`agent`、`retry`、`compaction`。

Qt 渲染建议：

| part.type | 渲染 |
|---|---|
| `text` | Markdown（增量：`message.part.delta` 的 `field == "text"`） |
| `reasoning` | 可折叠思考区 |
| `tool` | 工具卡片：`tool` 名称、`state.status`（pending/running/completed/error）、输入/输出 |
| `file` | 附件/文件引用 |
| `compaction` | "上下文已压缩"标记 |
| 其它 | 安全忽略或占位 |

### 3.6 会话状态 `SessionStatus`

```ts
{ type: "idle" } | { type: "busy" } | { type: "retry", attempt, message, next, action? }
```

---

## 4. SSE 事件清单

`Event` 为联合类型，公共外层：`{ id, type, properties }`。Qt 主用事件如下（完整列表见 `packages/sdk/js/src/v2/gen/types.gen.ts` 的 `Event`）：

| 事件 | properties 关键字段 | 用途 |
|---|---|---|
| `server.connected` | `{}` | 连接就绪 |
| `session.created` / `session.updated` / `session.deleted` | `sessionID, info` | 会话列表/标题同步 |
| `message.updated` | `sessionID, info` | 消息元数据（role、状态、token、时间） |
| `message.part.updated` | `sessionID, part, time` | part 快照（upsert） |
| `message.part.delta` | `sessionID, messageID, partID, field, delta` | 增量（优先流式渲染） |
| `message.part.removed` | `sessionID, messageID, partID` | 移除 part |
| `session.status` | `sessionID, status` | idle/busy/retry 指示 |
| `session.idle` | `sessionID` | 一轮完成 |
| `session.error` | `sessionID?, error` | 错误（含 `ContextOverflowError`） |
| `session.diff` | `sessionID, diff` | diff 面板刷新 |
| `session.compacted` | `sessionID` | 压缩完成 |
| `todo.updated` | `sessionID, todos` | 任务清单 |
| `permission.asked` | `id, sessionID, permission, patterns, metadata, always, tool?` | 权限弹窗 |
| `permission.replied` | `sessionID, requestID, reply` | 关闭弹窗（多端一致性） |
| `question.asked` | `id, sessionID, questions[], tool?` | 问答弹窗 |
| `question.replied` | `sessionID, requestID, answers` | 关闭弹窗 |
| `question.rejected` | `sessionID, requestID` | 关闭弹窗 |
| `file.edited` | `file` | 文件变更联动（可选） |
| `lsp.updated` | `{}` | LSP 状态（可选） |
| `installation.*` | - | 安装/升级提示（可选） |
| `permission.v2.asked` | `id, sessionID, action, resources[], save?, metadata?, source?` | V2 权限弹窗（应答必须走 `/api/session/{id}/permission/{requestID}/reply`） |
| `question.v2.asked` | `id, sessionID, questions[], tool?` | V2 问答弹窗（应答必须走 `/api/session/{id}/question/{requestID}/reply|reject`） |

> V2 事件（`session.next.*`、`permission.v2.*`、`question.v2.*` 等）属于实验面：**纯 V1 主链路的 Qt 客户端可忽略**；但只要通过 `/api/*` 驱动过会话（哪怕只用于编排或重放），就必须处理 V2 的权限/问答变体并按变体路由应答（见 1.5 与 `../integration/dual-engine-architecture.md` 4.7），否则该会话会永久挂起。

---

## 5. 版本与升级

- 启动时校验 `GET /global/health` 的 `version` 与客户端兼容版本。
- 升级流程：替换 `qtoc_core` → `opencode generate > openapi.json` → diff 端点/事件/字段 → 更新客户端适配层 → 跑冒烟清单（见 `ops/qt-headless.md` 第 4 节）。
- 事件是联合类型：**未知事件忽略**是强制约定，保证向前兼容。
