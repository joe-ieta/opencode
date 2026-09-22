# qtoc_core 双引擎底座架构设计（v1）

> 定位：在 `qtoc_core`（headless opencode）之上，定义一套可供 QtCreator 及同类 Native 开发环境使用的**双核智能体引擎底座**：编码引擎专注代码编写，业务引擎专注领域处理，两引擎相互独立、共享同一底层 LLM 与同一 `qtoc_core` 基础资源；业务引擎可按需把任务委派给编码引擎。
> 本文是架构设计第一版（宏观），落地细节（SDK API、manifest 完整 Schema、taskSpec 字段全集）在后续设计文档中展开。
> 版本基线：opencode `1.18.32`（channel `qt-headless`）。
> 关联文档：`../guide/qt-shell-guide.md`（客户端接入）、`data-agent-design.md`（数据治理领域设计）、`methodology.md`（集成方法）、`../KG/data-agent-faq.md`（扩展边界决策）、`../api/qtoc-http-api.md`（协议清单）。

---

## 1. 背景、目标与范围

### 1.1 背景

- `qtoc_core` 已验证：单一二进制 + 运行期配置即可承载不同领域 agent（见 `../KG/data-agent-faq.md`），内核零改动、可同步上游。
- 但当前 `packages/qtui` 的能力集中在"内核打包 + 演示客户端 + 文档"，缺少**多引擎编排、委派通道、能力宿主、可复用 SDK**，无法直接支撑 QtCreator 级别的 Native 应用。
- 领域能力（如 Text-to-SQL）已形成设计（`data-agent-design.md`），但缺少统一的能力打包/注册标准与"能力缺口 → 委派实现"的闭环。

### 1.2 目标

1. 定义双引擎底座：**编码引擎 A** + **业务引擎 B**，独立进程/状态/工具面，共享 LLM 与内核版本。
2. 定义**委派机制**：业务引擎通过工具把任务交给编码引擎，异步句柄 + 沙箱自动放行 + 测试门禁。
3. 定义**能力包规范与文件/包注册**：领域能力可独立开发、发布、挂载，对外可发布。
4. 定义**多仓工程组织与代码隔离**：内核/底座/网关/能力包/应用分离，依赖单向。
5. 以 Text-to-SQL 能力包作为**双引擎架构的验证 Demo**（demo 工程，见 `../capabilities/text2sql.md`），验证通过后再按生产化路径转正。

### 1.3 非目标（v1 不做）

- 不实现能力注册中心的服务端（先文件/包注册，后期演进）。
- 不做多内核版本共存（**双引擎共用同一 `qtoc_core` 版本**，见 9.5）。
- 不实现领域业务逻辑本身（属领域团队）。
- 不修改内核（`packages/{core,server,opencode}` 零改动）。

---

## 2. 术语与角色

| 术语 | 含义 |
|---|---|
| 底座（Base） | 内核打包 + Qt SDK + 引擎编排 + 委派 + 能力宿主 + 注册规范 |
| 编码引擎 A | 承载代码编写 agent 的 `qtoc_core` 实例（fs/bash/edit/lsp/task） |
| 业务引擎 B | 承载领域 agent 的 `qtoc_core` 实例（仅领域 MCP + question + 结构化输出） |
| 能力包（Capability Pack） | 可发布单元：MCP Server + manifest + 契约 + 规则 + 测试（+ 可选 UI） |
| 委派（Delegation） | 业务引擎把任务提交给编码引擎并取回结果的机制 |
| LLM Gateway | 自建统一模型入口：凭据、路由、配额、缓存、审计 |
| 注册中心（Registry） | 能力包索引与安装来源（v1 为文件/包注册） |

角色：**平台团队**（底座、内核、网关、注册规范）、**领域团队**（能力包、契约、规则、领域 UI）、**业务方**（规则审批、验收）。

---

## 3. qtui 定位与能力边界

### 3.1 现状

| 能力 | 位置 | 说明 |
|---|---|---|
| 内核裁剪/同步 | `packages/qtui/src/{trim,sync}.ts` | 幂等裁剪、上游合并、删除类冲突自动化 |
| 打包发行 | `packages/qtui/src/build.ts` + `packages/opencode/script/build.ts` + CI 矩阵 | `qtoc_core` 单一二进制、版本注入、归档 |
| 演示客户端 | `packages/qtui/client/**` | ServerProcess/ApiClient/SseClient/EventRouter/SessionModel + 演示 UI + 单测 |
| 文档 | `packages/qtui/docs/**` | 接口/指南/集成/运维/KG |

### 3.2 做与不做（目标边界）

**做**：

1. `qtoc_core` 构建、同步、发行（单一版本、单一二进制）；
2. Qt/C++ SDK（客户端、引擎编排、委派、能力宿主）；
3. 双引擎生命周期与隔离管理；
4. 能力包规范、注册（文件/包）、安装与挂载工具；
5. 示例应用（QtCreator 插件 / 桌面）与文档。

**不做**：

1. 领域业务逻辑（属领域能力包）；
2. 领域 UI 细节（底座提供控件与挂载点）；
3. LLM Gateway 之外的上游模型治理（底座提供客户端约定，网关独立仓库）；
4. 修改内核或产生多版本内核；
5. 在底座内硬编码任何领域工具。

### 3.3 目标形态

`qtui` 从"内核打包 + 演示"升级为"**Qt 原生智能体底座**"：Kernel Packaging + Qt SDK + Engine Orchestration + Delegation + Capability Host；演示客户端降级为 SDK 的示例（Example），模块抽库并版本化。

---

## 4. 双引擎底座总体架构

### 4.1 分层图

```
┌──────────────────────── Qt App / QtCreator Plugin ────────────────────────┐
│  编码工作台 UI        │        业务工作台 UI（Text-to-SQL / 质量报告…）    │
│  EngineManager（生命周期/端口/密码/隔离/健康/重启）                         │
│  QtocClient SDK（HTTP+SSE / 事件路由 / 会话投影 / 结构化输出）              │
│  DelegationClient（任务提交/状态/结果）   CapabilityHost（MCP 进程托管）    │
└──────┬──────────────────────────────┬────────────────────────────────────┘
       │ HTTP+SSE（稳定面）            │ HTTP+SSE（稳定面）
┌──────┴──────────┐          ┌────────┴──────────┐
│ 编码引擎 A       │          │ 业务引擎 B         │
│ qtoc_core #1    │          │ qtoc_core #2      │
│ agent: coding   │          │ agent: domain     │
│ fs/bash/edit/   │          │ 仅领域 MCP +       │
│ lsp/task        │          │ question/format   │
│ DB/XDG/端口独立  │          │ DB/XDG/端口独立    │
└──────┬──────────┘          └────────┬──────────┘
       │           共享 LLM 通道        │
       └────────────┬──────────────────┘
              ┌─────┴──────┐
              │ LLM Gateway │  凭据/路由(大小模型)/配额/缓存/审计（自建）
              └─────┬──────┘
                    ▼  Provider(s)
       ┌──────────────────────────────┐
       │ 领域能力平面（MCP Servers）    │
       │ 数据网关 / 语义层(OpenMetadata)│
       │ 质量引擎 / 契约库 / 审计        │
       └──────────────────────────────┘
                    ▲
       ┌────────────┴─────────────┐
       │ Delegation Service        │
       │ 任务队列 / worktree 隔离 / │
       │ 沙箱策略 / 结果收集        │
       └──────────────────────────┘
```

### 4.2 引擎定义与隔离矩阵

| 维度 | 编码引擎 A | 业务引擎 B |
|---|---|---|
| 进程 | `qtoc_core` #1 | `qtoc_core` #2（同一二进制、同一版本） |
| Agent | `coding`（可用内置 prompt 或定制） | `domain`（`prompt` 整段替换，`packages/opencode/src/session/llm/request.ts:60`） |
| 工具面 | fs/bash/edit/lsp/task | 仅领域 MCP + `question` + `format: json_schema` |
| 工作目录 | 代码仓库 / 任务 worktree | 领域工作区（不持有数据凭据） |
| 隔离 | `OPENCODE_DB`、`XDG_*`、随机端口、独立密码 | 同左 |
| 失败域 | 独立；B 崩溃不影响 A | 独立 |
| 上下文 | 仅代码上下文 | 仅业务上下文（两引擎上下文不互通） |
| 版本 | **同一 `qtoc_core` 版本**（基础资源，见 9.5） | 同左 |

### 4.3 共享 LLM

- **长期（自建）**：`LLM Gateway` 作为统一入口，两个引擎均配置为 OpenAI 兼容自定义 provider（`provider.<id>.options.baseURL` 指向网关），网关负责凭据托管、按引擎配额、大小模型路由、语义缓存与审计。
- **P0（已确认）**：先**共享凭据**——两引擎注入同一份 `OPENCODE_AUTH_CONTENT`，不引入网关；上线网关后无缝切换（只改 `baseURL`）。
- 原则：共享的是**模型与配额**，不是**会话上下文**；业务数据不得进入编码会话。

### 4.4 委派机制

委派是"工具 + 服务"，不是提示词技巧：

```
业务 agent → 工具 coding_delegate(taskSpec) → Delegation Service
  taskSpec（结构化）：
  {
    goal, repo, baseRef?, acceptance[], contextRefs[],
    interfaceSpec?, constraints[], testCommand?, approvalMode: "sandbox"
  }
  → 分配独立 worktree + 创建编码会话（POST /session + prompt_async）
  → 事件流跟踪（GET /event）→ 测试门禁 → 收集 diff/tests/summary
  → 返回 { taskId, status: "running", handle }
业务 agent 轮询 coding_status(handle) 或订阅委派事件
```

关键设计：

1. **异步句柄**：MCP 默认超时 5000ms（`packages/core/src/v1/config/mcp.ts:20`），委派禁止阻塞调用；统一"提交 → 句柄 → 状态/事件 → 结果"。
2. **沙箱自动放行（已确认）**：编码任务默认在隔离 worktree 中执行，`edit`/`bash` 自动放行；**网络访问、推送、部署保持 `ask`/`deny`**；结果必须通过测试门禁，合并前人工评审。
3. **隔离**：每任务一个 worktree + 独立编码会话；业务数据脱敏后才进入 `taskSpec`（只传接口/契约，不传原始数据）。
4. **结果契约**：返回 patch/diff + 测试结果 + 摘要；由业务侧决定合并/注册。
5. **幂等与审计**：`taskId` + `messageID` 幂等；跨引擎 `correlationId` 贯穿审计。

### 4.5 能力缺口闭环

```
业务 agent 发现缺少工具/连接器（如 Hive 连接器）
 → 生成 CapabilityRequest（名称、IO Schema、策略、测试要求）
 → coding_delegate 委派编码引擎实现能力包
 → 编码引擎产出 MCP Server + 契约 + 测试 → 发布到注册中心
 → 业务引擎挂载新能力（POST /mcp 动态添加或重启）
 → 重试原任务
```

底座必须提供：能力包规范 + 注册/安装工具 + 动态挂载 + 契约测试，否则"委派实现"会退化为一次性人肉劳动。

### 4.6 Qt SDK 分层

| 库 | 职责 | 现状 |
|---|---|---|
| `qtoc-client` | ApiClient / SSE 解析 / 事件路由 / 会话投影 / 结构化输出 | 从 `client/src/core` 抽库并版本化 |
| `qtoc-engine` | ServerProcess、EngineManager/EnginePool、隔离与健康、重启 | 新增 |
| `qtoc-delegation` | 任务提交/轮询/结果/事件 | 新增 |
| `qtoc-capabilities` | MCP 进程托管、manifest 解析、注册客户端、挂载 | 新增 |
| `qtoc-ui`（可选） | 聊天视图、工具卡片、权限/问答弹窗、质量报告控件 | 从 `client/src/ui` 抽取 |
| `qtoc-example` | 现 `packages/qtui/client` 演示工程 | 保留为示例 |

SDK 需 UI 无关、可嵌入（QtCreator 插件/桌面/无头批处理三种宿主）。

### 4.7 接口面选型：V1/V2 成熟度与混用边界

**成熟度对比**（基线 `1.18.32`）：

| 维度 | V1（legacy，Demo 现用） | V2（`/api/*`） |
|---|---|---|
| 定位 | 稳定主链路（Qt/CLI/TUI 现用） | 新会话内核方向；协议自述 "Experimental HttpApi surface" |
| 能力面 | 完整：config/MCP/project/VCS/global/auth/会话管理 | 不完整：缺 config/MCP/project/VCS/global/auth/sync/会话重命名删除 |
| 消息输入 | `parts`（text/file/agent/subtask）、`system`、`tools`、`noReply`、per-message `model`/`agent`、`format: json_schema` | 仅 `{ text, files, agents }` + `delivery: steer\|queue` + `resume`；**无 parts/subtask、无结构化输出、无 per-message 覆盖** |
| 会话控制 | abort/revert/unrevert/summarize/fork/share | `wait`/`interrupt`/`compact`/agent·model switch/revert stage·commit·clear/context |
| 事件 | `message.part.*`、`permission.asked`、`question.asked`；无重放 | `session.next.*` 分段事件、`permission.v2.asked`、`question.v2.asked`；**durable + 游标重放** |
| 权限持久化 | `always` 仅实例内存 | `save` patterns → `/api/permission/saved` |
| 实现/验证 | 大量生产验证 | core session V2 已实质落地（`packages/core/src/session/**`、36 个相关测试）；仓库内无客户端消费 |
| 稳定性 | 稳定面 | 实验，可能变更 |

**混用边界**（哪些能混、哪些不能）：

| 层 | 能否混用 | 说明 |
|---|---|---|
| 存储/数据 | ✅ | 共享同一 schema/表（`SessionTable`/`MessageTable`(V1MessageData)/`PartTable`/`SessionInputTable`）；V1 读取同一 `SessionTable`（`packages/opencode/src/session/session.ts:540-543`） |
| 事件流 | ✅ | 单一事件总线（`EventV2Bridge`），V1/V2 变体同时出现在 `/event` |
| 历史读取 | ✅ | V2 消息以 V1 兼容形状持久化，V1 可读；V1 历史在 V2 续跑时懒合成 inbox 记录（`packages/core/src/session/input.ts:118-168` `projectPrompted`） |
| 应答（权限/问答） | ❌ 必须按变体路由 | V1 与 V2 的 pending 服务与应答端点相互独立：收到 `permission.asked` → `/permission/{requestID}/reply`；收到 `permission.v2.asked` → `/api/session/{sessionID}/permission/{requestID}/reply`；问答同理 |
| 执行器 | ⚠️ 禁止同会话并发 | V1 走 `SessionPrompt` 循环，V2 走 `SessionExecution`/runner；同一会话按"一个模式"顺序操作，不并发混用 |
| 目录作用域 | ⚠️ 需适配 | V1 用 `x-opencode-directory` 头；V2 用 body `location.directory` / query |

**选型策略**：

1. **V1 主链路**：交互式会话、结构化输出（`format`）、多模态 parts、管理面（config/MCP/project）；
2. **V2 选择性增强**（优先编排侧）：委派/批处理的 `wait`/`interrupt`、游标重放（`event?after=`/`history?after=`）、会话级 `agent`/`model` 切换、`delivery: steer|queue`、`/api/permission/saved` 持久化；
3. **适配层**：SDK 暴露统一模型并按能力路由 V1/V2；事件层双变体兼容；V2 调用集中在单一适配模块，随内核版本锁定并纳入回归；
4. **迁移触发条件**：V2 补齐 `format`/parts/管理面、移除 experimental 标注、本仓库客户端验证通过后，再评估切换主链路。

---

## 5. 能力包规范与注册（v1：文件/包注册）

### 5.1 能力包结构

```
<capability>/
├─ capability.json        # manifest（见 5.2）
├─ dist/                  # MCP Server 产物（或 remote 地址）
├─ contracts/             # 输出契约（JSON Schema + 映射）
├─ rules/                 # 质量规则包（版本化）
├─ tests/                 # 契约测试 + 金标集
├─ ui/                    # 可选：领域 UI 资源
└─ README.md
```

### 5.2 manifest 规范（`capability.json`）

```jsonc
{
  "apiVersion": "qtoc.cap/v1",
  "name": "io.qtoc.cap.data.sql",          // 全局唯一，反向 DNS
  "version": "0.1.0",                       // SemVer
  "kind": "mcp",                            // v1 仅支持 mcp
  "description": "Text-to-SQL 查询与质检能力",
  "owner": "data-platform@example.com",
  "license": "proprietary",
  "compat": { "qtocCore": ">=1.18.32 <1.19.0" },  // 声明兼容区间；运行期强制精确匹配（见 9.5）
  "runtime": {
    "type": "local",                        // local | remote
    "serverName": "data-sql",               // MCP server 名，决定工具 ID 前缀
    "command": ["node", "dist/server.js"],
    "env": { "WAREHOUSE_DSN": { "secretRef": "vault:kv/data-sql#dsn" } },
    "timeoutMs": 120000                     // 必须显式设置（内核默认 5000ms）
  },
  "tools": [
    {
      "name": "sql_execute",
      "description": "只读执行 SQL，返回结果句柄",
      "inputSchema": { "$ref": "schemas/sql_execute.input.json" },
      "outputSchema": { "$ref": "schemas/sql_execute.output.json" },
      "permission": "allow",                // allow | ask | deny
      "sideEffect": "read",                 // read | write | external
      "dataClassification": "internal",     // public | internal | confidential | restricted
      "timeoutMs": 120000
    }
  ],
  "credentials": [
    { "key": "WAREHOUSE_DSN", "required": true, "source": "vault", "description": "只读账号" }
  ],
  "contracts": [
    { "id": "query-result", "version": "1.0.0", "schema": "contracts/query-result.schema.json" }
  ],
  "rules": [
    { "id": "dq-basic", "version": "1.0.0", "path": "rules/dq-basic.json" }
  ],
  "ui": [
    { "slot": "business.workspace", "title": "数据查询", "entry": "ui/panel.json", "optional": true }
  ],
  "tests": { "goldenSet": "tests/golden.jsonl", "contractTests": true },
  "integrity": { "checksum": "sha256:...", "signature": "..." }
}
```

### 5.3 命名规范

| 对象 | 规范 | 示例 |
|---|---|---|
| 能力包 | 反向 DNS：`<tld>.<org>.cap.<domain>.<name>` | `io.qtoc.cap.data.sql` |
| MCP server 名 | 短横线小写，能力包内的 `runtime.serverName` | `data-sql` |
| 工具 ID（内核侧） | `sanitize(serverName) + "_" + sanitize(tool.name)`（`packages/opencode/src/mcp/catalog.ts:119`） | `data-sql_sql_execute` |
| 契约 | `<capability>/<name>@<version>` | `io.qtoc.cap.data.sql/query-result@1.0.0` |
| 规则包 | `<capability>/<name>@<version>` | `io.qtoc.cap.data.sql/dq-basic@1.0.0` |
| 委派任务 | `task_<ULID>` | `task_01J...` |

### 5.4 注册中心（文件/包，v1）

索引文件（Git 仓库或对象存储，可对外发布）：

```jsonc
{
  "apiVersion": "qtoc.registry/v1",
  "updatedAt": "2026-09-22T00:00:00Z",
  "capabilities": [
    {
      "name": "io.qtoc.cap.data.sql",
      "version": "0.1.0",
      "channel": "stable",                  // stable | beta | dev
      "compat": { "qtocCore": ">=1.18.32 <1.19.0" },
      "url": "https://registry.example.com/caps/io.qtoc.cap.data.sql-0.1.0.tgz",
      "checksum": "sha256:...",
      "publisher": "data-platform"
    }
  ]
}
```

### 5.5 发布与安装流程

```
领域团队：qtoc-cap build → qtoc-cap test（契约 + 金标集）→ qtoc-cap publish --channel stable
注册中心：校验 manifest/checksum/兼容区间 → 追加 index.json（不可变版本）
消费方：qtoc-cap install <name>@<version> → 校验 → 解包到能力目录 → 生成 MCP 配置 → 挂载引擎
```

### 5.6 权限与凭据

- manifest 的 `tools[].permission` 生成 agent 权限键（`data-sql_sql_execute: "allow"`）；实施时用 `GET /experimental/tool/ids` 核对。
- 凭据只通过 `secretRef` 引用，由 CapabilityHost 从密钥管理注入子进程；**绝不写入 prompt/会话/配置明文**。
- `dataClassification` 用于审计与展示策略；`restricted` 能力的工具默认 `ask`。

---

## 6. 领域团队与底座的关系

### 6.1 RACI

| 事项 | 平台团队 | 领域团队 |
|---|---|---|
| qtoc_core 打包/同步/发行 | **负责** | 使用 |
| Qt SDK / 引擎编排 / 委派 / 能力宿主 | **负责** | 使用 |
| 能力规范 / 注册工具 / 权限模型 / 审计 | **负责** | 遵循 |
| MCP Server / 工具实现 | 评审 | **负责** |
| 契约 / 规则 / 语义层口径 | 框架与校验 | **负责**（审批后发布） |
| 领域 UI 页面 | 提供控件与挂载点 | **负责** |
| 金标集与回归 | 提供框架 | **负责** |
| LLM Gateway / 配额 | **负责** | 申请配额 |
| 委派任务验收 | 提供沙箱与门禁 | **负责**（定义 acceptance） |

### 6.2 领域团队标准动作

1. `qtoc-cap init` 生成能力包骨架；
2. 本地挂载到业务引擎调试（`mcp.<serverName>` 配置）；
3. 契约测试 + 金标集回归；
4. `qtoc-cap publish` 到注册中心（stable/beta）；
5. 灰度发布 → 观测（一次通过率、修复率、成本、委派次数）。

---

## 7. 验证能力：Text-to-SQL Demo 能力包

Text-to-SQL 能力包是双引擎架构的**验证 Demo（demo 工程）**，用于端到端验证底座能力；它不作为生产首发能力，验证通过后再按生产化路径转正。能力包级设计（manifest、工具契约、链路、评测、发布与挂载、验证矩阵）见 `../capabilities/text2sql.md`；领域需求与宏观设计见 `data-agent-design.md`。Demo 使用 **V1 接口面**（依赖 `format: json_schema` 结构化输出与 parts，见 4.7），V2 增强项按 4.7 的选型策略灰度接入。

**验证项一览**：

| 验证项 | 说明 |
|---|---|
| 能力包规范 | manifest/契约/规则/测试齐备，可构建可发布 |
| 文件注册 | 索引、校验、安装、版本兼容检查 |
| 动态挂载 | `POST /mcp` 挂载后工具可用（权限键 `text2sql_sql_execute`） |
| 引擎隔离 | 业务引擎无 fs/bash；编码引擎无数据凭据 |
| 共享 LLM | P0 共享凭据；网关上线后平滑切换 |
| 委派闭环 | 能力缺口（如新增连接器）委派编码引擎实现并回归 |
| 审计关联 | 跨引擎 `correlationId` 可完整还原 |

> Demo 只在 `demo` 渠道发布；生产化步骤与转正条件见 `../capabilities/text2sql.md` 第 12 节。

---

## 8. 工程组织与代码隔离

### 8.1 多仓布局（已确认：不同 repo）

建议创建组织（如 `qtoc-ai`）；若保留个人账号则使用 `qtoc-` 前缀。仓库命名建议：

| 仓库 | 用途 | 建议名（组织下 / 个人账号下） |
|---|---|---|
| 内核 fork | opencode 裁剪 + `qtoc_core` 构建/同步/发行 | `core` / `qtoc-core` |
| Qt/C++ SDK | 客户端库 + 引擎编排 + 委派 + 能力宿主 + 示例 | `sdk-qt` / `qtoc-sdk-qt` |
| LLM 网关 | 自建网关（凭据/路由/配额/缓存/审计） | `gateway` / `qtoc-gateway` |
| 注册中心 | 能力索引 + 校验/发布 CLI + 规范文档 | `registry` / `qtoc-registry` |
| 领域能力包 | 数据治理/Text-to-SQL（通用模式 `<domain>`） | `cap-data` / `qtoc-cap-data` |
| 应用与 IDE 集成 | QtCreator 插件 + 桌面应用 | `app` / `qtoc-app` |
| 部署与运维 | 部署模板、审计、监控 | `infra` / `qtoc-infra` |
| 架构与规范（可选） | ADR、能力规范、Roadmap | `spec` / `qtoc-spec` |

> 内核 fork 保留 upstream remote（`anomalyco/opencode`）；仓库重命名不影响 `upstream` 跟踪。

### 8.2 依赖方向（单向）

```
core(qtoc_core 二进制) ◄── sdk-qt ◄── app
                              ▲
cap-* (能力包) ───────────────┘（只依赖协议与 manifest 规范，不 import 内核内部）
gateway / registry / infra 独立，经 HTTP/文件交互
```

- 内核不感知任何领域概念；
- 能力包不 import 内核内部模块（只走 MCP 协议与 manifest）；
- SDK 只依赖 HTTP/SSE 与协议类型（`packages/sdk/openapi.json`）。

### 8.3 CI 分层

| 流水线 | 内容 |
|---|---|
| 内核 CI | 上游同步、`qtoc:trim`、矩阵构建、二进制冒烟 |
| SDK CI | 单测 + 对 `qtoc_core` 的契约测试（http-recorder 基线） |
| 能力包 CI | manifest 校验、契约测试、金标集 |
| 集成 CI | 双引擎 + 假 LLM 端到端（含委派闭环） |

### 8.4 版本与契约

- `qtoc_core` 版本 = 上游版本（当前 `1.18.32`）；
- SDK 版本独立，声明兼容内核区间；
- 能力包/契约/规则独立版本，注册中心记录兼容区间；
- 只用稳定协议面 + 锁定扩展点（实验钩子集中在单一适配插件）。

---

## 9. 关键决策记录

### 9.1 多仓（D1）

**决策**：采用多仓（见 8.1 命名建议）；内核 fork、SDK、网关、注册中心、能力包、应用、基础设施各自独立版本与 CI。

### 9.2 LLM Gateway（D2）

**决策**：**自建**（凭据托管、路由、配额、缓存、审计）；**P0 先共享凭据**（两引擎注入同一 `OPENCODE_AUTH_CONTENT`），网关就绪后切换 `baseURL` 即可，无需改引擎。

### 9.3 委派审批（D3）

**决策**：编码任务**沙箱自动放行**——独立 worktree、`edit`/`bash` 自动放行、网络/推送/部署保持 `ask`/`deny`、测试门禁 + 合并前人工评审。

### 9.4 能力注册（D4）

**决策**：v1 使用**文件/包注册**（Git/对象存储索引 + 校验/发布 CLI），规范对外发布（`qtoc.cap/v1` + `qtoc.registry/v1`）；后期演进为服务化注册中心（API + 鉴权 + 灰度）。

### 9.5 内核版本（D5）

**决策**：**双引擎不允许不同 `qtoc_core` 版本**。`qtoc_core` 作为基础资源被共用：底座统一分发与管理同一版本；能力包 manifest 声明兼容区间但运行期强制精确匹配，不兼容的能力包拒绝挂载。

### 9.6 接口面策略（D6）

**决策**：**V1 主链路 + V2 选择性增强**（见 4.7）。禁止同一会话并发混用 V1/V2 执行器；事件层必须同时兼容 V1/V2 变体并按变体路由应答；V2 调用集中在 SDK 的单一适配模块，随内核版本锁定并纳入契约回归。

---

## 10. 路线图与验收

| 阶段 | 交付 | 验收 |
|---|---|---|
| P0 | SDK 库化（`qtoc-client`/`qtoc-engine`）+ EngineManager 双 daemon + 共享凭据 | QtCreator/桌面可同时起两引擎并各自对话，互不影响 |
| P1 | Delegation Service + `coding_delegate` 工具（异步句柄）+ 沙箱策略 | 业务引擎委派真实代码任务并取回 diff/测试结果 |
| P2 | 能力包规范 + 文件注册 + `qtoc-cap` CLI + 动态挂载（`POST /mcp`） | "脚手架 → 测试 → 发布 → 安装 → 挂载"全流程可复现 |
| P3 | Text-to-SQL 能力包按第 7 节重构（分层网关 + 语义层补全 + 缓存 + 评测） | 一次通过率/修复轮次达标；缺口闭环演练成功 |
| P4 | LLM Gateway 上线（自建） | 双引擎共用网关，配额/路由/审计生效 |

---

## 11. 风险与开放问题

| 风险 | 影响 | 对策 |
|---|---|---|
| 委派任务失控（diff 过大/循环） | 资源与评审成本 | acceptance + 测试门禁 + diff 上限 + 任务超时 |
| 业务数据经委派泄漏 | 合规风险 | taskSpec 脱敏；只传接口/契约；审计 |
| 能力包质量参差 | 业务失败率上升 | 注册校验 + 契约测试 + 金标集 + 灰度 |
| 沙箱隔离不足 | 宿主机风险 | worktree + 进程/容器隔离 + 网络禁用 + 资源限额 |
| 注册中心演进 | 迁移成本 | manifest 与索引版本化，服务化时保持同构字段 |
| 双引擎资源竞争 | 相互影响 | 独立进程 + 配额 + 网关限流 |

**开放问题**

1. 组织与仓库创建顺序（先 SDK 还是先注册规范）？
2. 沙箱隔离强度（仅 worktree / 加容器）与目标平台支持矩阵？
3. 能力包签名与信任模型（自签 / 企业 CA / 双签）？
4. 委派结果的合并策略（人工 PR / 自动合并 + 测试）？
5. QtCreator 插件形态（进程内嵌 SDK vs 本地服务 + 插件薄客户端）？

---

## 12. 附录

### A. 示例 taskSpec

```jsonc
{
  "taskId": "task_01J...",
  "goal": "实现 Hive 只读连接器 MCP 工具",
  "repo": "git@github.com:org/qtoc-cap-data.git",
  "baseRef": "main",
  "acceptance": [
    "sql_execute 支持 Hive 方言并通过 sql.validate",
    "契约测试通过",
    "金标集 3 条样例通过"
  ],
  "interfaceSpec": "schemas/hive-tools.json",
  "contextRefs": ["docs/connector-guide.md"],
  "constraints": ["只读", "无网络", "超时 120s"],
  "testCommand": "bun test",
  "approvalMode": "sandbox"
}
```

### B. 示例委派结果

```jsonc
{
  "taskId": "task_01J...",
  "status": "succeeded",
  "sessionId": "ses_...",
  "diff": "patches/task_01J.patch",
  "tests": { "passed": true, "command": "bun test", "summary": "12 passed" },
  "summary": "新增 Hive 连接器与 2 个工具，契约测试通过"
}
```

### C. 术语速查

见第 2 节；协议细节见 `../api/qtoc-http-api.md`。
