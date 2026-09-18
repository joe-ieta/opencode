# opencode × Qt 集成方法文档（方法论与决策要点）

> 本文是集成设计的方法与决策记录，配套实施步骤见 `packages/qtui/docs/integration/implementation.md`。
>
> 面向客户端的接口分类指南见 `packages/qtui/docs/guide/qt-shell-guide.md`，全量端点清单见 `packages/qtui/docs/api/qtoc-http-api.md`。
>
> 基准版本：opencode `v1.18.31`（dev 分支，HEAD `e03db9bc6`）。所有协议、字段、端点均来自当前源码与 `packages/sdk/openapi.json`（由 `opencode generate` 生成，共 188 个端点）。
>
> 已确定决策：进程外 `opencode serve` + 全原生 Qt UI；业务上下文干预采用**插件 + 业务服务**（见 5.4）；权限/问答等全部交互由 Qt 承载（见 6）；Qt 端消费的端点与事件清单见 7。

---

## 1. 集成模式选型

| 模式 | 做法 | 适用 | 结论 |
|---|---|---|---|
| A. 进程内嵌入 | `@opencode-ai/sdk-next` 组合 Client+Core+Server | 单进程、低开销、需要直接访问 Effect 服务 | 实验性、private 包，暂不选 |
| B. 进程外 serve | Qt 通过 HTTP/SSE 连接独立 `opencode serve` 进程 | 全原生 UI、跨语言、稳定隔离 | **选定** |
| C. 源码裁剪 + 嵌入 | fork 后裁剪、以库方式集成 | 深度定制内核 | 成本高、迁移期风险大 |

选定 **B**，理由：协议面完整（188 端点）、UI 可完全用 Qt 原生实现、崩溃隔离、升级路径独立、无需跟随内核重构。

```
Qt/C++ 壳（全部交互 UI）
  ├─ ServerProcess (QProcess)      进程生命周期
  ├─ ApiClient (QNAM)              REST + Basic Auth + 目录头
  ├─ SseClient                     /event 长连接
  ├─ EventRouter / SessionModel    事件 → 状态机 → UI
  └─ PermissionBridge / QuestionBridge  人机交互闭环
        │ HTTP/1.1 + SSE
opencode serve（headless 内核，独立进程）
  session / provider / tools / permission / compaction / storage
```

---

## 2. 职责边界（必须遵守）

**服务端负责（Qt 不要重复实现）**：

| 领域 | 说明 |
|---|---|
| 会话生命周期 | 创建/删除/fork/revert/abort/summarize，SQLite 持久化 |
| 模型解析 | 优先级：prompt.model > session.model > agent.model > 全局默认；provider 凭据与 SDK 实例化 |
| Prompt 组装 | 系统提示词、instructions、历史投影、压缩裁剪、工具 schema 注入 |
| 工具调用 | LLM 流解析、工具执行、权限判定、结果截断、诊断回灌 |
| 上下文压缩 | 溢出检测、自动/手动压缩、旧工具输出裁剪 |
| 事件广播 | `/event`、`/global/event` |

**Qt 负责**：

| 领域 | 说明 |
|---|---|
| 进程管理 | 启动/健康/停止/重启 daemon，资源与日志采集 |
| 输入 | prompt parts（text/file/agent/subtask）、模型/agent 选择 |
| 渲染 | part 投影（文本增量、推理、工具卡片、diff、todo） |
| 交互 | 权限弹窗、问答弹窗、应答、超时策略 |
| 设置 | 配置读写 UI、凭据登录、项目切换 |
| 恢复 | 断线重放、待决请求重建 |

**反模式（明确禁止）**：
- 在 Qt 侧拼接系统提示词或历史（会与内核裁剪/注入冲突）；
- 在 Qt 侧解析模型原始 tool_call（服务端已结构化为 part）；
- 把 part/消息当作权威状态（权威在 server，Qt 只做投影）；
- 用同步 `/message` 做主链路（会长时间阻塞，应用 `prompt_async` + 事件）。

---

## 3. 协议接入面

### 3.1 两个面

| 面 | 路径 | 状态 | 策略 |
|---|---|---|---|
| 稳定面 | `/session`、`/event`、`/permission`… | 生产使用 | **主链路** |
| 实验面 | `/api/*`（V2 HttpApi）、`/experimental/*` | 演进中 | 按需灰度，不依赖 |

### 3.2 连接与作用域

- 认证：HTTP Basic，`opencode:<OPENCODE_SERVER_PASSWORD>`；Qt 每个请求（含 SSE）都带 `Authorization`。
- 目录：`x-opencode-directory: <urlencoded 绝对路径>`（GET 也可 `?directory=`）；多项目共用一个 daemon。
- SSE 格式：`data: {id,type,properties}`，15s 心跳 `: heartbeat`，无事件 ID、**无重放**；断线后拉历史重建。

### 3.3 端点清单（按功能分组，共 188）

**健康/生命周期/可观察性**：`GET /global/health`、`GET /event`、`GET /global/event`、`GET /session/status`、`GET /lsp`、`GET /formatter`、`GET /mcp`、`GET /path`、`GET /experimental/capabilities`、`POST /log`、`POST /instance/dispose`、`POST /global/dispose`、`POST /global/upgrade`、`GET/POST /sync/*`。

**配置/凭据/目录**：`GET|PATCH /config`、`GET|PATCH /global/config`、`GET /config/providers`、`GET /provider`、`GET /provider/auth`、`POST /provider/{id}/oauth/authorize|callback`、`PUT|DELETE /auth/{providerID}`、`GET /agent`、`GET /skill`、`GET /command`、`GET /experimental/tool`、`GET /experimental/tool/ids`。

**MCP 管理**：`GET|POST /mcp`、`POST /mcp/{name}/connect|disconnect`、`POST /mcp/{name}/auth`、`/auth/authenticate`、`/auth/callback`、`DELETE /mcp/{name}/auth`。

**会话生命周期**：`GET|POST /session`、`GET|PATCH|DELETE /session/{id}`、`GET /session/{id}/children`、`POST /session/{id}/init|abort|fork|revert|unrevert|summarize|share|command|shell`、`DELETE /session/{id}/share`、`GET /session/{id}/todo|diff`、`GET /experimental/session`、`POST /experimental/session/{id}/background`。

**消息与流**：`POST /session/{id}/message`（同步）、`POST /session/{id}/prompt_async`（异步，主用）、`GET /session/{id}/message`（分页 `limit/before`）、`GET /session/{id}/message/{messageID}`、`DELETE /session/{id}/message/{messageID}`、`PATCH|DELETE /session/{id}/message/{messageID}/part/{partID}`。

**权限与问答**：`GET /permission`、`POST /permission/{requestID}/reply`、`POST /session/{id}/permissions/{permissionID}`、`GET /question`、`POST /question/{requestID}/reply|reject`。

**文件与搜索**：`GET /file`、`GET /file/content`、`GET /file/status`、`GET /find`、`GET /find/file`、`GET /find/symbol`。

**VCS**：`GET /vcs`、`GET /vcs/status`、`GET /vcs/diff`、`GET /vcs/diff/raw`、`POST /vcs/apply`。

**PTY**：`GET /pty/shells`、`GET|POST /pty`、`GET|PUT|DELETE /pty/{ptyID}`、`GET /pty/{ptyID}/connect`（WS）、`POST /pty/{ptyID}/connect-token`。

**项目/工作区**：`GET /project`、`GET /project/current`、`PATCH /project/{id}`、`GET /project/{id}/directories`、`POST /project/git/init`、`/experimental/worktree*`、`/experimental/workspace*`、`/experimental/project/{id}/copy*`。

**TUI 控制（Qt 忽略）**：`POST /tui/*`、`GET /tui/control/next`、`POST /tui/control/response`。

**V2 实验面（值得关注）**：`/api/session/{id}/wait|context|compact|interrupt|agent|model|revert/{stage|commit|clear}|event?after=|history`、`/api/session/{id}/permission|question`、`/api/permission/saved`、`/api/model|provider|agent|command|skill|reference`、`/api/integration/*`、`/api/credential/*`。

### 3.4 可观察性评估

已覆盖：健康/版本、事件流（目录级+全局）、会话状态（idle/busy/retry）、子系统状态（LSP/Formatter/MCP）、配置可读、路径、能力探测、日志上报。

缺口（Qt 自管）：
1. 无 metrics 查询端点 → QProcess 采集 CPU/内存；
2. 无日志读取端点（只有 `POST /log` 写入）→ 捕获 stdout/stderr 或读日志目录；
3. 无进程退出端点（`dispose` 只释放实例）→ 生命周期归 Qt；
4. `/event` 无断点续传 → 重连拉历史（V2 `/api/session/{id}/event?after=` 有游标）；
5. 无用量/成本聚合 → 从消息 info 自行汇总。

---

## 4. 配置与设置注入方法

### 4.1 通道与优先级（低 → 高）

1. 全局文件 `~/.config/opencode/opencode.jsonc|json|config.json`
2. 项目文件（目录向上到 worktree 的 `opencode.json[c]`）
3. `.opencode` 目录（全局/项目沿途/home）
4. `OPENCODE_CONFIG` 指定文件
5. **`OPENCODE_CONFIG_CONTENT` 内联 JSON（最高）**

合并规则：深合并；`instructions` 数组拼接去重；全局配置有进程缓存，`PATCH /global/config` 写回文件并触发失效。

### 4.2 推荐组合

| 场景 | 手段 |
|---|---|
| 启动基础配置 + 凭据 | `OPENCODE_CONFIG_CONTENT` + `OPENCODE_AUTH_CONTENT` 进程注入 |
| 用户设置持久化 | `PATCH /global/config`（Qt 设置界面） |
| 项目级差异 | 项目目录 `opencode.json` / `.opencode/` |
| 会话级覆盖 | prompt body 的 `model`/`agent`/`system`/`tools`；`POST /session` 的 `permission` |

### 4.3 凭据

`OPENCODE_AUTH_CONTENT`（内联 JSON，Qt 首选）→ `auth.json`（`opencode auth login`）→ config `provider.*.options.apiKey` → provider 环境变量 → OAuth API（`/provider/auth`、`/provider/{id}/oauth/*`）。

### 4.4 必须注意的环境变量

| 变量 | 用途 |
|---|---|
| `OPENCODE_SERVER_PASSWORD` / `OPENCODE_SERVER_USERNAME` | Basic Auth |
| `OPENCODE_CONFIG_CONTENT` / `OPENCODE_AUTH_CONTENT` | 配置/凭据注入 |
| `OPENCODE_CLIENT=desktop` | **启用 question 工具**（否则问答能力缺失） |
| `OPENCODE_CONFIG_DIR` | 隔离配置目录 |
| `OPENCODE_DB` | 隔离数据库（多 daemon 必用） |
| `XDG_STATE_HOME` / `XDG_DATA_HOME` | 隔离锁与数据 |
| `OPENCODE_PURE=1` | 禁用外部插件 |
| `OPENCODE_ENABLE_QUESTION_TOOL=1` | 显式开启 question（替代 CLIENT） |

---

## 5. 会话、上下文与 RAG

### 5.1 会话与恢复

- 权威状态在 server（SQLite）；Qt 维护 part 投影。
- 主链路：`prompt_async` → `/event`；兜底：`GET /session/status`。
- 断线恢复：`GET /session/{id}/message`（分页 `limit/before`）全量重放；待决权限/问答用 `GET /permission`、`GET /question` 恢复。
- 会话内切换模型/agent：下一条 prompt 带新值（V2 有显式 switch 端点）。

### 5.2 上下文压缩

| 机制 | 说明 |
|---|---|
| 溢出检测 | 模型 context 上限 + `compaction.reserved` |
| 自动压缩 | `compaction.auto`（默认开），prompt 循环内触发 |
| 手动压缩 | `POST /session/{id}/summarize`（body `providerID/modelID/auto?`） |
| 产物 | `compaction` part + 摘要消息，历史投影保留 tail |
| 裁剪 | `compaction.prune` 标记旧工具输出为 compacted |
| 可配置 | `compaction.{auto,prune,tail_turns,preserve_recent_tokens,reserved}` |
| 插件钩子 | `experimental.session.compacting`、`experimental.compaction.autocontinue` |

Qt 交互：渲染 `part.type == "compaction"` 为"上下文已压缩"标记；`session.status` 展示处理中；`session.error` 的 `ContextOverflowError` 提示用户或触发手动压缩。

### 5.3 外部 RAG 接入（推荐度排序）

1. **MCP 工具（首选）**：检索封装为 MCP server 的 `search/retrieve`，配置 `mcp` 字段；模型自主调用，结果以 tool part 呈现。
2. **服务端插件工具**：`@opencode-ai/plugin` 的 `tool()`，进程内直接访问向量库/HTTP。
3. **预注入**：`instructions` 文件、prompt 的 `system` 追加、`parts` 的 `file`（file:// 或 data:）、`references`（外部目录进入系统提示词，模型按需读取）、`skills`。
4. **自定义命令**：`config.command` / `POST /session/{id}/command`，把"检索+提问"封装为模板，Qt 做知识库选择器。

约束：工具结果受 `tool_output.max_lines/max_bytes` 截断；敏感检索工具用 `permission` 做 `ask` 管控。

### 5.4 Prompt 组装干预（已确定：插件 + 业务服务）

**决策**：业务侧不接管 prompt 组装。业务分析与资料加工保留在业务服务（Qt 侧或独立进程），opencode 通过插件钩子在服务端组装环节注入；插件仅做薄适配层，随 serve 进程运行，无需 fork 内核。

```
业务服务（Qt 侧或独立进程，提供 HTTP/IPC）
   ▲ analyze / retrieve（超时 300ms，失败降级 skip）
   │
opencode serve 进程内的插件（薄适配）
   ├─ chat.message                          改写本轮输入（持久化，可审计）
   ├─ experimental.chat.messages.transform  读取完整会话消息，注入补充内容
   ├─ experimental.chat.system.transform    追加/改写系统提示词
   ├─ chat.params / chat.headers            调参/模型路由
   └─ experimental.session.compacting       保护压缩语义
```

**钩子选择表**：

| 场景 | 钩子 | 触发频率 | 持久化 | 说明 |
|---|---|---|---|---|
| 每轮重型检索 | `chat.message` | 每轮 | 是（写入历史） | 结果作为 parts，可审计 |
| 每 step 轻量补充 | `experimental.chat.messages.transform` | 每 step + 压缩 | 否（内存态） | 必须幂等去重 |
| 业务规则/知识 | `experimental.chat.system.transform` | 每请求 | 否 | 最安全，不动消息序列 |
| 模型参数/路由 | `chat.params` / `chat.headers` | 每请求 | 否 | 按业务维度切模型 |
| 压缩保护 | `experimental.session.compacting` | 压缩时 | 否 | 避免摘要被注入污染 |

**业务服务契约（建议）**：

```
POST /internal/context/analyze
{ sessionID, agent, model, step, userInput, messages: [{ id, role, parts }] }
→ { systemAppend?, userTextAppend?, documents?: [{ mime, name, url|data }], skip? }
```

**插件骨架**：

```ts
import type { Plugin } from "@opencode-ai/plugin"

export const BusinessContext: Plugin = async () => ({
  "experimental.chat.system.transform": async (_input, output) => {
    const res = await analyze({ phase: "system" })
    if (res?.systemAppend) output.system.push(res.systemAppend)
  },
  "experimental.chat.messages.transform": async (_input, output) => {
    const res = await analyze({ phase: "messages", messages: output.messages })
    if (res?.documents?.length) {
      // 以末尾 system 消息追加，避免破坏 tool-call/tool-result 配对
    }
  },
  "chat.message": async (input, output) => {
    const res = await analyze({ phase: "message", parts: output.parts })
    if (res?.userTextAppend) output.parts.push({ type: "text", text: res.userTextAppend, synthetic: true })
  },
})
```

配置注入：`OPENCODE_CONFIG_CONTENT` 中 `"plugin": ["./.opencode/plugin/business-context.ts"]`；业务服务地址与令牌通过 serve 进程环境变量传入。

**约束（必须遵守）**：

1. 不破坏 tool-call/tool-result 配对；优先 `system.transform` 或末尾 system 消息注入；
2. `messages.transform` 每 step 触发 → 幂等（按 messageID+step 去重）、超时（建议 300ms）、失败降级 skip；
3. `messages.transform` 修改不落库；需审计/持久化走 `chat.message` 的 parts；
4. 压缩场景同样触发 → 注入内容需可识别（带标记），避免污染摘要；
5. 插件运行在 serve 进程内，可访问文件/网络；业务凭据用环境变量注入，不写死在插件；
6. 插件内不做重活（阻塞会拖慢每个 step）；重型检索放业务服务异步完成。

若业务分析逻辑位于 Qt 进程内，则 Qt 需暴露本地接口供插件调用（建议 `127.0.0.1` + 随机端口 + 一次性 token，插件从环境变量读取地址与令牌），见 7.4。

---

## 6. 人机交互集成方法（权限与问答）

### 6.1 通用模型

服务端 `ask` → pending Map + Deferred 阻塞 → 发布事件 → Qt 弹窗 → REST reply → Deferred resolve → 工具继续。无超时；实例释放时 pending 全部失败；会话 abort 中断等待。

### 6.2 权限

- 事件：`permission.asked` / `permission.replied`。
- 应答：`POST /permission/{requestID}/reply` `{ reply: "once"|"always"|"reject", message? }`。
- 语义：
  - `always` 将 `always` patterns 写入**实例内存** approved 并自动放行被覆盖的其他待决请求；
  - `reject` **级联拒绝同会话所有待决权限**；带 `message` 时作为修正反馈给模型；
  - V1 `always` 不持久化（重启失效）→ 持久化用 config `permission` 或 `/api/permission/saved`。
- Qt 弹窗按类型渲染：`edit` 显示 diff、`bash` 显示命令、`external_directory` 显示目录 glob。

### 6.3 问答（question 工具）

- 启用条件：`OPENCODE_CLIENT ∈ {app, cli, desktop}` 或 `OPENCODE_ENABLE_QUESTION_TOOL=1`。
- 事件：`question.asked`（`questions[].options/multiple/custom`）、`question.replied/rejected`。
- 应答：`POST /question/{requestID}/reply` `{ answers: string[][] }`；`/reject` 表示取消。
- Plan 模式确认（`plan_exit`）复用 question 通道。
- 回答存入 tool part `metadata.answers`，历史渲染可回显。

### 6.4 Qt 闭环清单

1. 事件路由 → 模态弹窗队列（FIFO，带会话上下文）；
2. 应答接口调用（注意两种 body 结构）；
3. **重连恢复：`GET /permission` + `GET /question` 重建待决**（否则会话永久挂起）；
4. 超时策略（建议默认拒绝 + 提示）；
5. 多窗口一致性（`replied` 事件关闭其他窗口弹窗）；
6. 中止联动（`abort` 中断等待）。

---

## 7. Qt 壳端点消费清单与流程映射

### 7.1 服务端端点（按 Qt 功能分组）

| Qt 功能 | 端点 | 备注 |
|---|---|---|
| 启动/心跳 | `GET /global/health` | 版本校验 + 周期心跳 |
| 项目上下文 | `GET /path` | 当前目录/worktree/config 路径 |
| 会话列表 | `GET /session` | 侧边栏，按目录过滤 |
| 新建会话 | `POST /session` | 可带 `title`/`agent`/`model`/`permission` |
| 会话管理 | `PATCH /session/{id}`、`DELETE /session/{id}`、`GET /session/{id}/children` | 重命名/删除/子会话 |
| 历史加载 | `GET /session/{id}/message?limit=&before=` | 分页 + cursor |
| 单条刷新 | `GET /session/{id}/message/{messageID}` | 按需 |
| 发送消息（主链路） | `POST /session/{id}/prompt_async` | 异步 204，结果走事件 |
| 发送消息（同步） | `POST /session/{id}/message` | 仅脚本化场景 |
| 中止 | `POST /session/{id}/abort` | 停止按钮 |
| 事件流 | `GET /event` | **唯一 SSE**，渲染/状态/交互 |
| 状态兜底 | `GET /session/status` | 断线后状态对齐 |
| 权限待决 | `GET /permission` | 重连恢复 |
| 权限应答 | `POST /permission/{requestID}/reply` | `once`/`always`/`reject` |
| 权限应答（兼容） | `POST /session/{id}/permissions/{permissionID}` | 旧式 |
| 问答待决 | `GET /question` | 重连恢复 |
| 问答应答 | `POST /question/{requestID}/reply`、`/reject` | `answers: string[][]` |
| 手动压缩 | `POST /session/{id}/summarize` | "压缩上下文"按钮 |
| 回滚 | `POST /session/{id}/revert`、`/unrevert` | 消息级回滚 |
| 分叉 | `POST /session/{id}/fork` | 从消息分支 |
| 命令面板 | `GET /command`、`POST /session/{id}/command` | slash 命令 |
| Agent 选择 | `GET /agent` | 下拉框 |
| 模型选择 | `GET /config/providers`、`GET /provider` | 下拉框 |
| 技能展示 | `GET /skill` | 可选 |
| 设置读取 | `GET /config`、`GET /global/config` | 设置界面 |
| 设置保存 | `PATCH /global/config` | 持久化 |
| 凭据登录 | `GET /provider/auth`、`POST /provider/{id}/oauth/authorize`、`/oauth/callback`、`PUT /auth/{providerID}` | 登录流程 |
| 会话内 shell | `POST /session/{id}/shell` | 可选 |
| 变更视图 | `GET /session/{id}/diff`、`GET /file/status`、`GET /vcs/diff` | diff 面板 |
| 文件浏览 | `GET /file`、`GET /file/content`、`GET /find/file` | 可选 |
| 终端 | `GET|POST /pty`、`GET /pty/{id}/connect` | 可选 |

### 7.2 事件 → UI 映射

| 事件 | Qt 行为 |
|---|---|
| `session.created` / `session.updated` / `session.deleted` | 会话列表刷新 |
| `message.updated` | 消息头（role/状态/用量） |
| `message.part.updated` | part upsert 渲染 |
| `message.part.delta` | 增量追加（优先） |
| `message.part.removed` | 移除 part |
| `session.status` | busy/retry 指示 |
| `session.idle` | 结束"生成中" |
| `session.error` | 错误提示（含 ContextOverflow） |
| `session.diff` | diff 面板刷新 |
| `todo.updated` | 任务清单 |
| `permission.asked` / `permission.replied` | 弹窗 / 关闭弹窗 |
| `question.asked` / `question.replied` / `question.rejected` | 弹窗 / 关闭弹窗 |
| `file.edited` / `lsp.updated` | 可选刷新 |

### 7.3 关键流程时序

**打开/恢复会话**：`GET /session` → `GET /session/{id}/message`（分页）→ 建立 `GET /event` → `GET /permission` + `GET /question` 重建待决弹窗。

**发送消息**：`POST /session/{id}/prompt_async`（带 model/agent/parts）→ 事件流渲染增量与工具 part → `session.idle` 结束生成态。

**交互应答**：事件 `permission.asked`/`question.asked` → 弹窗 → reply → `replied` 事件关闭所有窗口弹窗。

**断线恢复**：重连 → `GET /session/status` 对齐状态 → 对活跃会话 `GET /session/{id}/message` 重放 → 重新 `GET /permission` + `GET /question`。

### 7.4 Qt 侧需要暴露的本地接口（业务逻辑在 Qt 时）

若业务分析与资料加工在 Qt 进程内完成，Qt 需为 serve 插件提供本地调用入口：

- `POST /internal/context/analyze`（见 5.4 契约）；
- 仅监听 `127.0.0.1`，随机端口 + 一次性 token（插件从环境变量读取）；
- 超时保护与降级返回 `{ skip: true }`；
- 不要把业务凭据通过接口透传给插件。

### 7.5 Qt 内部模块清单（配套实现）

`ServerProcess`（QProcess 生命周期）、`ApiClient`（QNAM + Basic Auth + 目录头）、`SseClient`（/event 分帧解析）、`EventRouter`（事件→信号）、`SessionModel`（part 投影与增量合并）、`PermissionBridge` / `QuestionBridge`（弹窗闭环）、`SettingsStore`（config 读写）、`BusinessContextClient`（对接业务服务/插件）。

---

## 8. 多实例 / 多 daemon 方法

- `opencode serve` 无单例限制，可多开；**不要用 `packages/cli` 的 `service start`**（按 state 目录单例，会互踢）。
- 隔离资源：

| 资源 | 隔离方式 |
|---|---|
| SQLite | `OPENCODE_DB=<绝对路径>` 或 `XDG_DATA_HOME` |
| 锁目录 | `XDG_STATE_HOME` |
| 配置 | `OPENCODE_CONFIG_DIR` |
| 端口/密码 | `--port 0` + 每实例密码 |

- 拓扑建议：
  1. **单 daemon 多目录（首选）**：`x-opencode-directory` 区分项目，资源最省；
  2. 多 daemon：按配置/凭据/版本/租户隔离，Qt 维护 DaemonPool（端口映射、健康、LRU 回收）；
  3. 混合：公共 daemon + 敏感项目独立 daemon。
- 会话 ID 与 daemon 绑定，不可跨实例复用。

---

## 9. 风险清单与对策

| # | 风险 | 影响 | 对策 |
|---|---|---|---|
| 1 | 双轨 API（稳定面 vs `/api/*` 实验面）演进 | 客户端返工 | 主链路只用稳定面；实验面灰度；升级时 diff `openapi.json` |
| 2 | 协议版本漂移（`packages/app` 甚至 vendor 固定版本 client） | 类型/字段不兼容 | 启动校验 `/global/health` version；pin 二进制；维护适配层 |
| 3 | `/event` 无重放 | 断线丢事件 | 重连全量拉历史；V2 `?after=` 游标作为增强 |
| 4 | HTTP/1.1 同主机 6 连接限制 | SSE 挤占普通请求 | 仅一个全局 SSE；不按会话开流 |
| 5 | 权限/问答无超时 | 会话永久 busy | Qt 超时策略 + 重连恢复 `GET /permission|/question` |
| 6 | `always` 不持久化 | 重启后重复弹窗 | 持久规则写 config `permission` 或 V2 saved |
| 7 | question 工具默认未启用 | 问答/计划确认缺失 | 注入 `OPENCODE_CLIENT=desktop` |
| 8 | 压缩行为随版本变化 | 上下文语义差异 | 关注 `compaction` 配置与事件；UI 只做标记展示 |
| 9 | 同步 `/message` 长阻塞 | Qt 超时/卡死 | 主用 `prompt_async` |
| 10 | 多 daemon 共享 DB/锁 | 数据损坏/互踢 | 按第 8 节隔离；禁用 `service start` |
| 11 | Windows 依赖 Git Bash（shell 工具） | 部分工具不可用 | 安装 Git 或禁用 bash 工具 |
| 12 | 裁剪仓库遗漏（TUI 引用 20+ 处、build 默认内嵌 Web UI） | 构建失败/体积 | 保守保留 tui 依赖；`--skip-embed-web-ui` |
| 13 | 大 payload（base64 附件） | UI 卡顿 | 后台线程解析 + 渲染节流（30–60 FPS） |
| 14 | 权限弹窗类型渲染不足 | 用户误批危险操作 | 按 permission 类型渲染上下文（diff/命令/目录） |
| 15 | 插件注入破坏消息序列（tool-call/result 配对） | LLM 请求报错、会话失败 | 优先 `system.transform`；不在消息中间插入；末尾 system 注入 |
| 16 | 插件重复注入 / 阻塞每个 step | 内容重复、延迟升高 | 按 messageID+step 幂等；300ms 超时；失败降级 skip |
| 17 | 注入内容污染压缩摘要 | 摘要失真、上下文异常 | 注入带标记；`experimental.session.compacting` 中识别并剔除 |

---

## 10. 验收与测试方法

**冒烟清单（每次升级必跑）**
- [ ] `/global/health` 正常且版本符合预期；
- [ ] `/event` 建连、心跳无报错；
- [ ] `prompt_async` 后收到 `message.part.delta/updated` 并流式渲染；
- [ ] 工具调用 part 正确渲染（含 diff/终端输出）；
- [ ] 权限闭环（`asked` → reply → `replied`）；
- [ ] 问答闭环（`question.asked` → reply/reject）；
- [ ] 断线重连后历史与待决恢复；
- [ ] 压缩触发后 UI 标记正确、会话可继续；
- [ ] 业务注入生效且不重复（`system.transform` 追加可见、消息序列合法）；
- [ ] 业务服务不可用时插件降级、会话不失败。

**契约测试**：用 `packages/http-recorder` 录制真实交互，作为 Qt 侧回归基线。

**升级 checklist**：更新二进制 → `opencode generate > openapi.json` → diff 端点/事件/字段 → 更新 Qt 适配层 → 跑冒烟清单。

---

## 11. 附录

### A. 关键文件索引

| 内容 | 路径 |
|---|---|
| serve 命令/参数 | `packages/opencode/src/cli/cmd/serve.ts`、`cli/network.ts` |
| Basic Auth | `packages/server/src/auth.ts` |
| SSE 端点/心跳 | `packages/server/src/handlers/event.ts` |
| SSE 解析参考 | `packages/client/src/generated/client.ts:192-247` |
| 目录头 | `packages/sdk/js/src/v2/client.ts:20-75` |
| 端点/事件类型 | `packages/sdk/js/src/v2/gen/types.gen.ts`、`packages/sdk/openapi.json` |
| 配置加载/合并 | `packages/opencode/src/config/config.ts`、`config/paths.ts` |
| 配置 schema | `packages/core/src/v1/config/*.ts` |
| 凭据 | `packages/opencode/src/auth/index.ts` |
| 会话/循环 | `packages/opencode/src/session/prompt.ts`、`processor.ts`、`llm.ts`、`system.ts`、`message-v2.ts` |
| 压缩 | `packages/opencode/src/session/compaction.ts`、`overflow.ts` |
| 权限 | `packages/opencode/src/permission/index.ts` |
| 问答 | `packages/opencode/src/question/index.ts`、`tool/question.ts`、`tool/plan.ts` |
| 运行时 flags | `packages/opencode/src/effect/runtime-flags.ts` |
| 全局路径/锁 | `packages/core/src/global.ts`、`util/flock.ts` |
| 数据库路径 | `packages/core/src/database/database.ts:43-57` |
| daemon 单例语义 | `packages/cli/src/services/daemon.ts` |
| 构建 | `packages/opencode/script/build.ts`（`--skip-embed-web-ui`） |

### B. 事件速查（Qt 主用）

`session.created/updated/deleted`、`message.updated`、`message.part.updated`、`message.part.delta`、`message.part.removed`、`session.status`、`session.idle`、`session.error`、`session.diff`、`todo.updated`、`permission.asked/replied`、`question.asked/replied/rejected`、`file.edited`、`lsp.updated`。

### C. 方法总则

1. **薄客户端**：状态、循环、工具、提示词全在服务端；Qt 只做投影与交互。
2. **稳定优先**：主链路用稳定面，实验面灰度。
3. **可恢复**：任何断线后都能用 REST 重建视图与待决请求。
4. **可观察**：业务态看事件与状态端点，进程态靠 Qt 自采。
5. **可演进**：pin 版本、契约测试、升级 checklist 固化为流程。
