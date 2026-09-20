# 数据治理扩展问答（KG）：边界、交付形态与单一二进制配置

> 定位：记录 2026-09-20 关于「数据治理领域智能体如何落地」的问答与结论，作为 `../integration/data-agent-design.md` 的配套决策记录（不改设计，只固化理解）。
> 基线：opencode `1.18.31`（channel `qt-headless`），分支 `qt-headless`；协议以 `packages/sdk/openapi.json`（188 端点）为准。
> 关联文档：`../integration/data-agent-design.md`（需求与宏观设计）、`../integration/methodology.md`（集成方法）、`architecture.md`（维护策略）、`../guide/qt-shell-guide.md`（客户端接入）、`../ops/qtoc-build.md`（构建与发行）。

## 摘要

1. 数据治理能力**不改造内核、不产生新二进制、不做新 Qt 程序**：同一 `qtoc_core` 产物 + 运行期 agent 配置 + 独立领域能力网关（推荐 MCP Server）+ 现有 Qt 壳扩展领域 UI。
2. 网关**独立于 qtoc_core 与 Qt 壳实现**（独立代码库/进程/部署/版本，语言不限）；交付给内核的形态是 **MCP 工具**（首选）或插件工具，纯 REST 需加 MCP/插件适配层。
3. 区分「编码实例」与「数据治理实例」靠**运行期配置**（实例级 / 隔离级 / 会话级三层），不靠编译期特性；`qtoc_core` 始终是单一二进制、单一发布线。

---

## Q1 领域扩展属于哪种形态？（扩展 vs 改造 vs 新程序 vs 多版本）

| 问题 | 结论 | 依据 |
|---|---|---|
| 扩展本项目能力，还是改造本项目？ | **扩展**，内核零改动：`packages/{core,server,opencode}` 不因领域需求修改 | 设计原则 5「内核零改动优先」；FR-1…FR-12 全部落在网关与配置 |
| 新实现一个 Qt 程序？ | **否**，复用现有 Qt 客户端工程（`packages/qtui/client`），只增加领域页面（工作台/澄清/质量报告/审计追溯） | 第 3 节分层职责：Qt 壳只负责交互、澄清、展示、审批、追溯 |
| 与 qtoc_core 的关系？ | qtoc_core 是**领域中立的 agent 运行时**；领域身份由 agent profile（prompt 整段替换 + 工具白名单 + 模型/温度/steps）定义 | 2.1 结论一、第 6 节扩展点映射、附录 C 配置草案 |
| 编译多个功能侧重的 qtoc_core？ | **否**。功能侧重是运行期配置，不是编译期特性；一个 daemon 可同时挂多个 agent（如 `build` + `data-analyst`） | 附录 C；Q5 配置区分 |

**为什么不做多版本/内核分叉**：与「最小 delta、可持续同步上游」冲突（多版本 = 多份构建/CI/同步成本，修复与协议分叉）；领域差异本质是数据与策略差异，确定性逻辑（校验/执行/格式化/质检）下沉网关；隔离诉求用「每租户一 daemon + 独立网关」解决。

---

## Q2 与 qtoc_core、Qt 壳的边界关系

```
Qt 壳 ──HTTP/SSE（稳定面）──► qtoc_core ──MCP（stdio/HTTP）或插件──► 领域能力网关（独立服务）
  （交互/澄清/展示/审批/追溯）   （会话/循环/事件/权限/压缩/插件宿主）      └──► 数据与规则平面（只读）
外部编排器 ──HTTP/SSE──► qtoc_core（批处理链路，无 Qt 壳）
```

| 层 | 职责 | 明确不做 |
|---|---|---|
| Qt 壳 | 交互、澄清、展示、审批、追溯；扩展领域 UI | 不拼 prompt、不做数据授权、不直连网关 |
| qtoc_core | 会话/循环/事件/权限/压缩/插件宿主；承载 agent profile | 不直连数据库、不实现领域规则、不持有凭据 |
| 领域能力网关 | 领域工具、策略执行、计算下推、结果句柄、脱敏、审计；**唯一持有数据平面凭据** | 不持有会话状态、不生成自然语言 |
| 数据与规则平面 | 数据、语义、规则、契约、审计的真实来源 | 不感知模型 |

---

## Q3 网关的交付形态（独立 REST？Qt 壳实现？MCP？）

**结论：网关独立实现，推荐 MCP Server；纯 REST 不能直接交给内核。**

| 形态 | 内核侧配置 | 说明 |
|---|---|---|
| 网关即 MCP Server（stdio） | `mcp.<name>.type = "local"` + `command`/`environment`/`timeout` | 最贴近设计文档附录 C 草案 |
| 网关即 MCP Server（HTTP） | `mcp.<name>.type = "remote"` + `url`/`headers`/`oauth`/`timeout` | REST 风格服务加 MCP over HTTP 协议层 |
| 纯 REST + 薄插件适配 | `plugin` 注册 tool，插件内部 `fetch` REST | 插件 in-process，重活必须放外部进程/线程，禁止阻塞事件循环 |

**为什么不在 Qt 壳上实现**：

1. 分层职责排除：Qt 壳「不做数据授权、不拼 prompt」；
2. 凭据安全：网关持有数据平面凭据与策略（RBAC/ABAC、行级、PII），放进桌面进程违背「数据不出域、凭据不出网关」；
3. 批处理链路（FR-11）由外部编排器直接驱动 daemon，**没有 Qt 壳**，网关必须在无 GUI 时可用；
4. 生命周期与审计：内核启动即需网关可用；审计经网关直写外部存储，不能依赖客户端在线。

（例外：本地演示/单机开发可用 mock，如 client `fixtures/` 的用法，不属于生产设计。）

**部署拓扑**：默认「内核与网关同机 + 回环通信」，凭据由密钥管理服务注入网关；多租户为「一租户一 daemon + 一独立网关」（设计文档第 9 节）。

---

## Q4 以什么方式交给内核？

1. **MCP 工具（首选）**——工具注册名为 `sanitize(server) + "_" + sanitize(tool)`（`packages/opencode/src/mcp/catalog.ts:119`），如 `data-plane_sql_execute`：
   - local：`{ type: "local", command: [...], environment: { GATEWAY_TOKEN: "{env:GATEWAY_TOKEN}" }, timeout: 120000 }`
   - remote：`{ type: "remote", url: "...", headers: {...}, oauth: false, timeout: 120000 }`
   - **必须显式调大 `timeout`**（默认仅 5000ms，`packages/core/src/v1/config/mcp.ts:20`、`:56`）；长查询用「执行返回句柄 + 轮询」异步模式。
2. **插件工具 + 策略钩子（补充）**——`tool.execute.before/after`、`tool.definition`、`permission.ask`（可接 OPA/Casbin）；实验钩子（`experimental.chat.*.transform`、`experimental.session.compacting`）隔离在单个适配插件内并锁定版本。
3. **配置注入（载体）**——Qt 启动内核时通过环境变量下发：
   - `OPENCODE_CONFIG_CONTENT`（内联 JSON，优先级最高，`packages/opencode/src/config/config.ts:482-489`）；
   - `OPENCODE_CONFIG`（配置文件路径，`packages/opencode/src/config/config.ts:415-417`）；
   - 或全局/项目配置（`~/.config/opencode/opencode.json`、项目 `opencode.json` / `.opencode/`）；
   - 凭据一律用环境变量引用（`{env:...}`），**绝不写入 prompt 或会话消息**。
4. **权限闸门**——agent 的 `permission` 按工具名放行（如 `data-plane_sql_execute: "allow"`）；实施时用 `GET /experimental/tool/ids` 核对实际键名。

---

## Q5 单一二进制如何区分用途？

**同一个二进制**：同一分支（`qt-headless`）、同一构建（`qtoc:build` / CI 矩阵）、同一版本号（1.18.31）、同一产物 `qtoc_core[.exe]`。区分完全在运行期：

| 层级 | 手段 | 用途 |
|---|---|---|
| 进程/实例级 | `OPENCODE_CONFIG_CONTENT`（内联 JSON）、`OPENCODE_CONFIG`（文件路径）、全局/项目配置 | 决定该 daemon 是「编码实例」还是「数据治理实例」 |
| 隔离级 | `OPENCODE_DB`（独立 SQLite，`packages/core/src/database/database.ts:44-46`）、`XDG_*` 目录、随机端口、独立 `OPENCODE_SERVER_PASSWORD` | 同机并存多实例，互不干扰 |
| 会话/请求级 | `POST /session` 的 `agent` 字段、消息体的 `agent`/`model` | 同一 daemon 内切换 agent profile（可并存） |

环境变量入口：`packages/core/src/flag/flag.ts:21-22`（`OPENCODE_CONFIG` / `OPENCODE_CONFIG_CONTENT`）、`:47`（`OPENCODE_DB`）、`:75-76`（`OPENCODE_CLIENT`，`desktop` 时启用 `question` 工具）。

示例（同一 exe，两份配置）：

```jsonc
// 编码实例（默认/现有）
{ "agent": { "build": { } } }

// 数据治理实例
{
  "agent": {
    "data-analyst": {
      "prompt": "……（整段替换内置提示）",
      "permission": { "bash": "deny", "data-plane_sql_execute": "allow" },
      "temperature": 0,
      "steps": 12
    }
  },
  "mcp": { "data-plane": { "type": "local", "command": ["bun", "run", "<gateway>/index.ts"], "timeout": 120000 } },
  "plugin": ["./.opencode/plugin/data-agent-adapter.ts"]
}
```

运行时自检：`GET /global/health`（版本）、`GET /config`（当前实例生效配置）、`GET /experimental/tool/ids`（工具与权限键）。

---

## 决策清单

| 编号 | 决策 | 状态 |
|---|---|---|
| D1 | 领域能力以「配置 + 外部网关 + 插件」实现，内核零改动 | 已定（设计文档原则 5） |
| D2 | Qt 壳复用现有客户端工程，只扩展领域 UI，不新起 Qt 程序 | 已定（本文 Q1/Q2） |
| D3 | 网关独立实现（语言不限、独立部署），**MCP Server 为首选交付形态**；纯 REST 必须经 MCP/插件适配 | 已定（本文 Q3） |
| D4 | 单一 `qtoc_core` 二进制；功能侧重由运行期配置决定，不编译多版本 | 已定（本文 Q5） |
| D5 | 凭据只存网关；配置注入用 `OPENCODE_CONFIG_CONTENT` + 环境变量引用 | 已定（Q4、设计文档 6 节约束） |
| D6 | 长查询显式调大 MCP `timeout`，统一「结果句柄」模式，结果集不进模型上下文 | 已定（设计文档 6 节约束） |

## 待决问题（沿用设计文档第 11 节）

1. 语义层选型（DataHub/OpenMetadata/自建）与同步频率；
2. 输出契约由业务方维护还是平台方统一注册；
3. 修复回路放单会话（交互）还是外部编排（批量）的切换阈值；
4. 质检规则的审批链与责任人模型；
5. 是否需要内核级「数据上下文源」（当前判断：不需要；若需要按 KG 流程评估上游化）。

## 变更记录

| 日期 | 内容 |
|---|---|
| 2026-09-20 | 首版：固化领域扩展边界、网关交付形态、单一二进制配置区分的问答结论 |
