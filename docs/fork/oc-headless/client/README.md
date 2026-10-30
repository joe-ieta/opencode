> **分支资料归档（2026-10-30）**：来自 `oc-headless` 提交 [`bd848794de`](https://github.com/joe-ieta/opencode/blob/bd848794de13cc596c4e73768f7fbb8fee889e43/packages/qtui/client/README.md)，原路径 `packages/qtui/client/README.md`。正文保留原记录及当时状态，仅调整文档链接；当前分支进度以上级 [项目总览](../../../../FORK.md)、[维护与发布方法](../../maintenance.md)及 [PR 跟踪](../../upstream-prs.md)为准。本文命令须在对应分支运行，不能直接套用到另一代内核。

# oc_core Qt 客户端（演示 / 测试工程）

Qt Creator + CMake 工程，用于验证与演示 `oc_core`（V2 headless opencode 内核）的接入：
启动内核、建会话、异步 prompt、SSE 流式渲染、工具卡片、权限与表单弹窗。

> 本工程面向 **V2 `/api/*` 协议面**（oc-headless 线）。V1 稳定面（`/global/health`、`/event`、`/session`、`question`）在该内核中不存在；协议差异见 [packages/qtui/docs/KB/v2-api-drift.md](../KB/v2-api-drift.md)，迁移阶段见 [packages/qtui/docs/KB/v2-upgrade-roadmap.md](../KB/v2-upgrade-roadmap.md)（P1）。

## 打开与配置

1. 构建内核（仓库根目录）：
   ```bash
   bun run oc:build
   ```
2. 用 Qt Creator 打开 `packages/qtui/client/CMakeLists.txt`，选择 Qt 6.5+ 的 Kit（MSVC/MinGW 均可）。
3. 指定内核路径（任选其一）：
   - 复制 `artifacts/oc/oc_core.exe` 到 `client/fixtures/`（默认路径）；
   - CMake 变量：`-DOC_CORE_PATH=<绝对路径>`；
   - 环境变量 `OC_CORE_PATH`（运行时也会读取）。
4. 构建并运行 `oc-client`。

## 演示流程

- 工具栏 **Start server**：以随机端口、随机密码启动 `oc_core serve --hostname 127.0.0.1 --port <p>`；密码经 `OPENCODE_PASSWORD` 注入内核（客户端用 Basic `opencode:<pwd>` 访问），XDG 目录隔离；
- 自动订阅 `GET /api/event`，读取 `GET /api/info`（版本/pid），检查 `GET /api/provider`、`GET /api/model`、`GET /api/config`，并 `POST /api/session` 创建会话；
- 输入框发送 prompt（`POST /api/session/{id}/prompt`，`{text}`），聊天页流式显示文本、推理与工具状态（`session.text.*` / `session.reasoning.*` / `session.tool.*`）；
- 每轮终态（`session.execution.succeeded/failed/interrupted`，兼容 `session.idle`）后按 `GET /api/session/{id}/message?order=desc&limit=200` 重建完整转录；
- 工具触发权限时弹窗（Once / Always / Reject → `POST /api/session/{sid}/permission/{rid}/reply`，`{decision}`）；
- `question` 工具以表单呈现（`form.created` → FormDialog → `POST /api/session/{sid}/form/{fid}/reply`，`{answer}`；取消走 `DELETE …/form/{fid}?message=…`）；
- **Abort** 触发 `POST /api/session/{id}/interrupt`；**Server log** 标签页查看内核输出。

## 协议面（V2）

### 端点

| 功能                      | 请求                                                                               | 说明                                                                                                |
| ------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------- | -------------------- | ----------- |
| 健康/信息                 | `GET /api/info`                                                                    | `ServerInfo`：`version/pid/urls/paths/capabilities`，无 data 包装                                   |
| 事件流                    | `GET /api/event`                                                                   | SSE；信封 `{id, type, data, created?, metadata?, location?}`                                        |
| 会话列表/创建/删除        | `GET                                                                               | POST /api/session`、`DELETE /api/session/{id}`                                                      | 创建成功 `{data: Session.Info}` |
| 发送消息                  | `POST /api/session/{id}/prompt`                                                    | `{text, files?, agents?, skills?, metadata?, delivery?, resume?}`；成功 `{data: SessionInbox.User}` |
| 消息（转录）              | `GET /api/session/{id}/message`                                                    | `{data: Session.Message.Info[], cursor}`；`order`/`limit`/`cursor` 分页                             |
| 中断                      | `POST /api/session/{id}/interrupt`                                                 | 无请求体；成功 `{interrupted: bool}`                                                                |
| 权限应答                  | `POST /api/session/{id}/permission/{requestID}/reply`                              | `{decision: "once"                                                                                  | "always"                        | "reject", message?}` |
| 表单应答                  | `POST /api/session/{id}/form/{formID}/reply`                                       | `{answer: {key: string                                                                              | number                          | boolean              | string[]}}` |
| 表单取消                  | `DELETE /api/session/{id}/form/{formID}?message=…`                                 | 无请求体                                                                                            |
| provider / model / config | `GET /api/provider`、`GET /api/model`、`GET /api/model/default`、`GET /api/config` | provider/model 响应为 `{location, data}`；config 为 `Config.Entry[]`                                |

目录作用域：请求头 `x-opencode-directory: <percent-encoded 绝对路径>`。

### 鉴权与启动

- HTTP Basic，用户名固定 `opencode`，密码来自环境变量 `OPENCODE_PASSWORD`（内核仍兼容旧名 `OPENCODE_SERVER_PASSWORD`）。
- 客户端启动内核时注入随机 `OPENCODE_PASSWORD`；未设置密码时内核自行生成并打印 `server password <pwd>`。
- 前台监听行为 `server listening on http://…`（V1 为 `opencode server listening on …`，客户端解析两者兼容）。

### 事件（客户端消费子集）

| 类型                                             | `data` 关键字段                                      | 用途                                                                     |
| ------------------------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------ |
| `session.text.started/delta/ended`               | `assistantMessageID, ordinal, delta/text`            | 文本流                                                                   |
| `session.reasoning.started/delta/ended`          | 同上                                                 | 推理流                                                                   |
| `session.tool.input.started/delta/ended`         | `assistantMessageID, id, name/delta/text`            | 工具入参流                                                               |
| `session.tool.called/progress/success/failed`    | `id, input/metadata/content/error`                   | 工具生命周期                                                             |
| `session.idle` / `session.status`                | `sessionID` / `status.type`（`idle`/`busy`/`retry`） | 运行状态（若内核发出）                                                   |
| `session.retry.scheduled`                        | `attempt, error`                                     | 重试提示                                                                 |
| `session.execution.succeeded/failed/interrupted` | `error`（failed）                                    | 终态：刷新转录、更新状态；`failed` 额外展示错误（V2 无 `session.error`） |
| `permission.asked/replied`                       | `Permission.Request` / `requestID, reply`            | 权限弹窗                                                                 |
| `form.created/replied/cancelled`                 | `form: Form.Info` / `id`                             | 表单弹窗                                                                 |

未知事件经 `EventRouter::unhandled` 忽略（设置 `OC_DEBUG=1` 时记录类型到 Server log）。

## 测试

```bash
# 在构建目录
ctest --output-on-failure
```

- `tst_sse_parser`：SSE 分帧单元测试（跨包、CRLF、心跳、非法 JSON）；
- `tst_process`：真实启动 `oc_core`，以 Basic `opencode:<password>` 校验 `GET /api/info`（找不到内核时自动跳过）；
- `tst_v2_session`：**真实模型端到端**（默认跳过）——启动 `oc_core`、订阅 `/api/event`、建会话、发 prompt、等待终端执行事件并断言流式文本。启用方式：

```powershell
# 需要网络访问内置 Zen 免费模型（或设置 OC_TEST_MODEL 指向其他 provider/model）
$env:OC_TEST_E2E="1"; ctest -R v2_session --output-on-failure
```

说明：Zen 默认模型 `exo-free` 已弃用（410）；e2e/演示请使用 `opencode/ling-3.1-flash-free`（默认）或自配模型。

## 运行配置

### 设置窗口（推荐）

工具栏 **Settings...** 打开运行参数设置：

| 字段     | 说明                                                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| LLM 类型 | provider id（如 `anthropic`、`openai`）。内置 id 直接使用；其它 id 自动注册为 OpenAI 兼容自定义 provider（`package: aisdk:@ai-sdk/openai-compatible`） |
| 基础 URL | 可选，写入 `providers.<id>.settings.baseURL`（自建网关/代理时使用）                                                                                    |
| API Key  | 可选，写入 `providers.<id>.settings.apiKey`（仅保存在本机 QSettings，并注入内核进程）                                                                  |
| 模型名称 | 模型 id（如 `claude-sonnet-4-5`），最终以 `provider/model` 写入内核 `model`                                                                            |
| 服务端口 | 内核 HTTP 端口，`随机` 表示 0（随机端口）                                                                                                              |

保存后若内核正在运行，客户端会询问是否立即重启以应用设置。设置持久化在 QSettings（Windows 注册表 `HKCU\Software\oc\oc-client`）。

### 环境变量（作为设置窗口的回退/覆盖）

| 变量                                                                  | 作用                                                     | 示例                                   |
| --------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------- |
| `OC_CORE_PATH`                                                        | oc_core 可执行文件路径                                   | `E:\...\artifacts\oc\oc_core.exe`      |
| `OC_PROVIDER` / `OC_BASE_URL` / `OC_API_KEY` / `OC_MODEL` / `OC_PORT` | 设置窗口字段的回退值                                     | `OC_MODEL=anthropic/claude-sonnet-4-5` |
| `OC_CONFIG_JSON`                                                      | 完整覆盖内核配置 `OPENCODE_CONFIG_CONTENT`（优先级最高） | `{"model":"...","permissions":[...]}`  |
| `OC_DEBUG=1`                                                          | 打印每个事件的类型到 Server log                          | -                                      |

未配置模型时客户端默认配置只有权限项；此时 prompt 会被接受但内核无法调用模型，聊天窗口不会有内容（错误以 `session.execution.failed` 事件返回）。

## 验证步骤

1. **Start server**：Server log 出现 `server listening on http://127.0.0.1:<port>` 与 `server ready on port <port>`；
2. **事件流**：Server log 出现 `event stream connected`、`oc_core 2.x.x (pid …)`；
3. **模型检查**：Server log 出现 `providers: N [...], models: M` 与 `config documents: K`；若 `models: 0` 或提示 `no model configured`，先配置 `OC_MODEL` 与凭据；
4. **会话**：Server log 出现 `session: ses_…`；
5. **发送消息**：Server log 出现 `prompt accepted: …`；聊天页出现用户文本与流式回复；
6. **权限/表单**：让模型执行一次编辑类操作（权限弹窗）或调用 `question` 工具（表单弹窗），确认应答闭环。

无反馈排查顺序：Server log 是否有 `error: …` → `providers/models` 是否为 0 → `OC_MODEL` 是否设置 → 凭据环境变量是否存在（如 `ANTHROPIC_API_KEY`，或在设置窗口填 API Key）→ 用 `curl -u opencode:<password> http://127.0.0.1:<port>/api/config` 查看内核实际生效配置。

## 假设 / 未验证

- 事件名与 `data` 字段按 `packages/schema/src/session-event.ts`、`session-status-event.ts`、`permission.ts`、`form.ts` 推导；上游为预览面，后续可能漂移。
- `session.execution.failed` 是唯一展示的错误来源（`error.message`，前缀 `error.type`）；`session.step.failed` 假定由终态 execution 事件覆盖，不单独展示（`OC_DEBUG` 下仍可见类型日志）。
- `session.status`/`session.idle` 仍在 manifest 中，但本内核快照未见发布者；转录刷新与状态收敛同时挂在 `session.execution.succeeded/failed/interrupted` 与 `session.idle` 上，重复刷新是幂等的。
- 转录重建只取 `order=desc&limit=200` 的第一页（最近 200 条），未实现 `cursor` 回溯；实时流式事件与重建结果在 idle 时对齐。
- 表单按 `Form.Info`/`Form.Fields` 实现 `string`（含 options/custom）、`number`、`integer`、`boolean`、`multiselect`、`when` 可见性；`hidden` 仅在提供 `default` 时回填，`external` 跳过；`format`/`pattern`/`minLength`/`minItems` 未做校验（仅必填）。
- 多选 `custom` 自由答案以单个字符串追加，不做分隔符拆分。
- 权限/表单为模态弹窗；弹窗期间到达的同类事件会叠加新弹窗。
- `OC_AUTH_JSON` 便捷变量在 V2 已移除（内核不再有 `OPENCODE_AUTH_CONTENT`），凭据请用设置窗口或 provider 环境变量。
- provider/model/config 检查为启动后一次性尽力而为（`/api/provider` 在 provider 就绪前可能返回 503），失败只记日志，不阻塞会话。
- 本工程未在无 Qt6 工具链的环境编译验证；`ctest` 与真实模型端到端待执行。

## 说明

- 客户端不负责 prompt 组装、模型解析与工具执行，全部由内核完成；
- 工程逐模块导读与扩展方式见 `packages/qtui/docs/guide/client-tour.md`（V1 文档，接口差异以本文为准）；
- 端点与事件清单以 `packages/protocol/openapi.json` 与 `packages/schema/src/` 为准。
