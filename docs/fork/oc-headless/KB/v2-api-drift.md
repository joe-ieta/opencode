> **分支资料归档（2026-10-30）**：来自 `oc-headless` 提交 [`bd848794de`](https://github.com/joe-ieta/opencode/blob/bd848794de13cc596c4e73768f7fbb8fee889e43/packages/qtui/docs/KB/v2-api-drift.md)，原路径 `packages/qtui/docs/KB/v2-api-drift.md`。正文保留原记录及当时状态，仅调整文档链接；当前分支进度以上级 [项目总览](../../../../FORK.md)、[维护与发布方法](../../maintenance.md)及 [PR 跟踪](../../upstream-prs.md)为准。本文命令须在对应分支运行，不能直接套用到另一代内核。

# V2 API 漂移分析（KB）：oc_core 对齐评估（首轮）

> 阶段：2026-10-11，oc-headless phase 1（分支结构 + 首次 `oc_core` 构建与冒烟）。
> 结论：**存在重大漂移**——V2 收敛为纯 `/api/*` 面；V1 稳定路径与事件词汇表不再存在；Qt 客户端需按 V2 适配（详见第 3 节）。
> 关联：[branch-strategy.md](branch-strategy.md)（双分支决策）、[../ops/release-runbook.md](../ops/release-runbook.md)（发布规范）。

## 1. 端点面（openapi 对比）

| 项              | V1（qt-headless，1.19.0）                                                                                    | V2（upstream/dev，2.0.26）                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| openapi 位置    | `packages/sdk/openapi.json`                                                                                  | `packages/protocol/openapi.json`                                                                            |
| 端点数          | 162                                                                                                          | 118                                                                                                         |
| 顶层分组        | 稳定面（`session`/`event`/`permission`/`question`/`config`/`pty`/`global`…）+ `/api/*`（51）+ `/tui/*`（13） | `/api/*`（117）+ `/auth/connect/{code}`                                                                     |
| V1 稳定路径     | `GET /global/health`、`GET /event`、`/session`…                                                              | **全部不存在**                                                                                              |
| `/api/*` 延续性 | `/api/*` 为预览面                                                                                            | 40/51 条与 V1 预览面精确同名延续（session/model/provider/integration/credential/permission/event/pty/fs/…） |

**关键能力映射（V1 → V2）**

| 能力                  | V1                                                | V2                                                                                                                |
| --------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 健康/信息             | `GET /global/health`                              | `GET /api/info`（`ServerInfo`：version/pid/urls/paths/capabilities）                                              |
| 事件流                | `GET /event`（`{id,type,properties}`）            | `GET /api/event`（`{id,type,data,created?,location?}`；volatile：慢消费者溢出即断、无重放；含 `rpc.*` 插件事件）  |
| 会话                  | `/session…`                                       | `/api/session`、`/api/session/{id}`、`…/prompt`、`…/message`、`…/inbox`、`…/interrupt`、`…/fork`、`…/revert/stage | commit`、`…/context`、`…/diff`、`…/shell` |
| 权限                  | `GET /permission` + `POST /permission/{id}/reply` | `GET /api/permission/request` + `POST /api/session/{sid}/permission/{rid}/reply`                                  |
| 问答（question 工具） | `POST /question/{id}/reply`                       | **无 question 面**；由表单替代：`/api/form`、`POST /api/session/{sid}/form/{formID}/reply`                        |
| provider/model        | `/provider`、`/config/providers`                  | `/api/provider`、`/api/model`、`/api/model/default`                                                               |
| 配置                  | `/config`                                         | `/api/config`、`/api/experimental/config`                                                                         |
| 文件                  | `/find/file`、`/file/content`（目录头作用域）     | `/api/fs/find`、`/api/fs/list`、`/api/fs/read/*`（location 模型）                                                 |
| PTY                   | `/pty…`                                           | `/api/pty…`、`/api/experimental/persistent-pty…`                                                                  |

**认证与启动差异**

- 密码：V1 `OPENCODE_SERVER_PASSWORD`；V2 `OPENCODE_PASSWORD`（legacy 兼容 `OPENCODE_SERVER_PASSWORD`）；Basic 用户名均为 `opencode`；V2 另有 session cookie（HMAC）与 pairing（`/auth/connect/{code}`）机制。
- 前台 `serve` 未设置密码时：**随机生成 32B 密码并打印 `server password <pwd>`**（`packages/cli/src/server-process.ts:196`），请求需 Basic 认证；不设防仅限显式配置。
- 监听行：V1 `opencode server listening on …` → V2 `server listening on …`（进程管理解析需调整）。

## 2. 事件词汇表

- V1：`session.*`、`message.part.updated/delta/removed`、`permission.asked/replied`、`question.asked…`、`todo.updated` 等联合类型。
- V2：事件由 `@opencode/schema/event-manifest`（`ServerDefinitions`）声明；信封 `{id, type, data, created?, metadata?, location?}`；内建 `server.connected` 与 `rpc.*` 插件事件。
- grep 验证：V1 事件名（`session.idle`、`message.part.updated`、`permission.asked`、`question.*`）在 V2 `packages/protocol`/`server`/`cli` 中**不存在**——事件面同理发生重大漂移，需在移植轮做 manifest→Qt 映射。

## 3. Qt 客户端影响（`packages/qtui/client`）

现客户端基于 V1 稳定面 + V1 事件，对 V2 **不可直接工作**。适配要点（建议，移植轮实施）：

1. 请求面改 `/api/*`（session/prompt/message/permission/pty/fs）；
2. 事件解析改 V2 信封（`data` 字段）并按 V2 manifest 重建 EventRouter/SessionModel；
3. 鉴权改 `OPENCODE_PASSWORD`（或读取启动输出的随机密码）；
4. `question` 流程改表单（form）交互；
5. 监听行解析由 `opencode server listening on` 改为 `server listening on`。

## 4. 本轮构建与冒烟（oc_core 2.0.26，Windows）

| 项          | 结果                                                                                                                                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 依赖安装    | `bun install` 1843 包 / 172s（bun 1.4.2）                                                                                                                                                                                       |
| 构建        | `oc:build` → `packages/cli/script/build.ts --single --skip-install --skip-web-ui` → `artifacts/oc/oc_core.exe` **180.0 MB**（对比 V1 `qtoc_core` 119.6 MB）+ 版本化副本 `oc_core-2.0.26-windows-x64.exe`；channel=`oc-headless` |
| `--version` | `opencode v2.0.26`                                                                                                                                                                                                              |
| 启动        | `serve --hostname 127.0.0.1 --port 4096` → `server listening on http://127.0.0.1:4096`                                                                                                                                          |
| 信息面      | `GET /api/info`（Basic `opencode:<pwd>`）→ `{"version":"2.0.26","pid":…,"urls":[…],"paths":{…},"capabilities":{…}}`                                                                                                             |
| 事件流      | `GET /api/event` → `data: {"id":…,"type":"server.connected","data":{}}` + `: heartbeat`                                                                                                                                         |
| 鉴权        | 无认证请求 → `401 {"_tag":"UnauthorizedError",…}`                                                                                                                                                                               |
| 稳定性      | stderr 空                                                                                                                                                                                                                       |

## 5. 结论与后续

- **结论：重大漂移**（端点面、事件面、认证、交互模型均变化）；oc-headless 的套壳模式可行，`oc_core` 构建与冒烟已跑通。
- 后续（qtui 移植轮）：① V2 事件 manifest → Qt 映射表；② 客户端改走 `/api/*`；③ form 交互替代 question；④ oc-headless CI/发布流程（`oc-headless-v*`）；⑤ 真实模型端到端冒烟。

## 变更记录

| 日期       | 内容                                                                     |
| ---------- | ------------------------------------------------------------------------ |
| 2026-10-11 | 首版：V2 API 漂移评估 + oc_core 首轮构建/冒烟记录（oc-headless phase 1） |
