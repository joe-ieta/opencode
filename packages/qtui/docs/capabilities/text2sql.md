# Text-to-SQL 能力包设计（双引擎验证 Demo）

> 定位：双引擎底座架构的**第一个验证能力包（demo 工程）**，用于端到端验证能力包规范、文件注册、动态挂载、引擎隔离、共享 LLM 与委派闭环；**不作为生产首发能力**，生产化路径见第 12 节。
> 版本基线：opencode `1.18.32`（channel `qt-headless`）；能力包规范 `qtoc.cap/v1`、注册索引 `qtoc.registry/v1`。
> 关联文档：`../integration/dual-engine-architecture.md`（底座架构 v1）、`../integration/data-agent-design.md`（数据治理领域需求与宏观设计）、`../KG/data-agent-faq.md`（内核扩展边界决策）。

---

## 1. 定位与验证目标

- 本能力包是**验证工具**：用一条真实链路（业务描述 → SQL → 校验/执行 → 固定格式 → 质检 → 修复重查）证明双引擎底座可用。
- 领域需求与宏观设计以 `../integration/data-agent-design.md` 为准；本文只定义**能力包级设计**（打包、契约、链路、发布、验证）。
- Demo 阶段的取舍：单库样例数据、文件化最小语义层、单会话修复回路；生产化增强（OpenMetadata、批量编排、缓存、网关）列入第 12 节。

**要验证的双引擎能力**（完整矩阵见第 10 节）：能力包规范可发布可安装、文件注册可校验、动态挂载可生效、业务/编码引擎隔离、共享凭据（P0）、能力缺口委派闭环、跨引擎审计关联。

---

## 2. 能力包清单（manifest）

包名采用 demo 命名空间，避免与生产能力冲突：`io.qtoc.demo.text2sql`。

```jsonc
{
  "apiVersion": "qtoc.cap/v1",
  "name": "io.qtoc.demo.text2sql",
  "version": "0.1.0",
  "kind": "mcp",
  "description": "Text-to-SQL 双引擎验证 Demo：查询、固定格式输出与质量检查",
  "owner": "qtoc-demo@example.com",
  "license": "proprietary",
  "compat": { "qtocCore": ">=1.18.32 <1.19.0" },
  "runtime": {
    "type": "local",
    "serverName": "text2sql",
    "command": ["bun", "run", "dist/server.js"],
    "env": { "DEMO_DB_DSN": { "secretRef": "env:DEMO_DB_DSN" } },
    "timeoutMs": 120000
  },
  "tools": [
    { "name": "schema_search",   "permission": "allow", "sideEffect": "read", "dataClassification": "internal", "timeoutMs": 15000 },
    { "name": "examples_retrieve","permission": "allow", "sideEffect": "read", "dataClassification": "internal", "timeoutMs": 15000 },
    { "name": "sql_validate",    "permission": "allow", "sideEffect": "read", "dataClassification": "internal", "timeoutMs": 30000 },
    { "name": "sql_execute",     "permission": "allow", "sideEffect": "read", "dataClassification": "internal", "timeoutMs": 120000 },
    { "name": "result_format",   "permission": "allow", "sideEffect": "read", "dataClassification": "internal", "timeoutMs": 30000 },
    { "name": "quality_check",   "permission": "allow", "sideEffect": "read", "dataClassification": "internal", "timeoutMs": 30000 }
  ],
  "credentials": [
    { "key": "DEMO_DB_DSN", "required": true, "source": "env", "description": "Demo 只读样例库连接串" }
  ],
  "contracts": [
    { "id": "query-result", "version": "1.0.0", "schema": "contracts/query-result.schema.json" }
  ],
  "rules": [
    { "id": "dq-basic", "version": "1.0.0", "path": "rules/dq-basic.json" }
  ],
  "ui": [
    { "slot": "business.workspace", "title": "数据查询（Demo）", "entry": "ui/panel.json", "optional": true }
  ],
  "tests": { "goldenSet": "tests/golden.jsonl", "contractTests": true },
  "integrity": { "checksum": "sha256:<build 产出>" }
}
```

**业务引擎 Agent Profile（运行期配置，不属于能力包本体）**

```jsonc
{
  "agent": {
    "text2sql-demo": {
      "prompt": "你是数据查询助手（Demo）……（整段替换内置提示）",
      "mode": "primary",
      "temperature": 0,
      "steps": 12,
      "permission": {
        "bash": "deny", "edit": "deny", "write": "deny", "webfetch": "deny",
        "text2sql_schema_search": "allow",
        "text2sql_examples_retrieve": "allow",
        "text2sql_sql_validate": "allow",
        "text2sql_sql_execute": "allow",
        "text2sql_result_format": "allow",
        "text2sql_quality_check": "allow",
        "question": "allow"
      }
    }
  },
  "mcp": {
    "text2sql": {
      "type": "local",
      "command": ["bun", "run", "<cap-dir>/dist/server.js"],
      "environment": { "DEMO_DB_DSN": "{env:DEMO_DB_DSN}" },
      "timeout": 120000
    }
  }
}
```

> 工具 ID = `sanitize(serverName) + "_" + sanitize(tool)`（`packages/opencode/src/mcp/catalog.ts:119`）；实施时用 `GET /experimental/tool/ids` 核对权限键。

---

## 3. 工具契约（分层）

工具按评审结论分两层：L1 通用数据网关（平台团队，跨领域复用）、L2 领域服务（本能力包）。

### 3.1 L1 通用数据网关（跨领域复用）

| 工具 | 输入 | 输出 | Demo 实现 |
|---|---|---|---|
| `schema_search` | `{ terms[], topK }` | `{ tables[], metrics[], confidence }` | 文件化元数据 + 关键词/向量检索 |
| `schema_joinPath` | `{ from, to }` | `{ paths[] }` | 静态 join 图（样例库） |
| `values_resolve` | `{ term, column? }` | `{ candidates[{value, score}] }` | 样例值字典 |
| `time_resolve` | `{ phrase, timezone }` | `{ start, end }` | 规则解析（上月/本季等） |
| `sql_validate` | `{ sql, dialect }` | `{ ok, errors[], explainCost, normalizedSql }` | AST 策略 + LIMIT 注入（只读/白名单） |
| `sql_execute` | `{ sql, maxRows, timeout }` | `{ handle, columns[], rowCount, stats, sample[] }` | 只读账号 + 行数上限 + 结果句柄 |

### 3.2 L2 领域服务（本能力包）

| 工具 | 输入 | 输出 |
|---|---|---|
| `examples_retrieve` | `{ question, topK }` | `{ pairs[{ question, sql, notes }] }` |
| `result_format` | `{ handle, contractId }` | `{ artifact, schemaReport }` |
| `quality_check` | `{ handle, rulePackId }` | `{ passed, violations[{ rule, severity, rootCause, detail }] }` |

原则：确定性逻辑全部在工具；模型只负责理解、生成 SQL 与按修复简报修正。

---

## 4. 语义层（Demo 最小实现）

- 生产选型与定制策略见 `data-agent-design.md` 11.1（OpenMetadata 优先 + L1–L4 定制）。
- Demo 阶段最小语义层（文件化，随能力包发布）：
  - `metadata/tables.json`：表/列/类型/主外键/枚举/样例值；
  - `metadata/metrics.json`：指标口径与同义词；
  - `metadata/joins.json`：join 图；
  - `examples/*.jsonl`：Q→SQL 示例。
- 同步频率、OpenMetadata 接入与缓存失效策略沿用 `data-agent-design.md` 11.1.4，Demo 不实现。

---

## 5. 链路与修复回路

### 5.1 状态机

```
[0] 接入     业务描述 + contractId + 上下文（时间范围/过滤）
[1] 澄清     question：口径/时间/维度不明确
[2] 链接     schema_search + examples_retrieve
[3] 生成     结构化输出 { sql, assumptions[], tables[], confidence }
[4] 校验     sql_validate（只读/白名单/LIMIT/EXPLAIN）
[5] 执行     sql_execute → handle + stats + sample
[6] 格式化   result_format(handle, contractId)
[7] 质检     quality_check(handle, dq-basic)
[8] 交付     固定格式结果 + 质检报告 + SQL + 假设
      └─ 不合格 → 修复简报 → 回到 [3]（≤3 轮）
```

### 5.2 失败分类与修复策略

| 类 | 场景 | 可修复 | 策略 |
|---|---|---|---|
| A 静态校验 | 方言/越权/缺 LIMIT/成本超限 | 模型 | 带结构化错误重生成；越权直接失败并告警 |
| B 执行 | 列不存在/类型/超时 | 模型（超时除外） | 带错误码修复；超时降采样 |
| C 格式 | 缺列/类型不符/枚举未归一 | 模型/格式化器 | 先判"SQL 形状"还是"映射缺失" |
| D 质量 | 空结果/重复/越界/null 超阈 | 视根因 | `rootCause=query` 修 SQL；`rootCause=data` **不重试**，出报告 |
| E 不可修复 | 权限/口径矛盾/契约冲突 | 无 | 快速失败，返回证据 |

### 5.3 修复简报（模型输入）

```jsonc
{
  "attempt": 2,
  "originalQuestion": "……（钉住，压缩保护）",
  "previousSql": "SELECT ...",
  "failureClass": "D",
  "violations": [{ "rule": "uniqueness", "severity": "high", "rootCause": "query", "detail": "order_id 重复 12 行" }],
  "schemaHints": ["orders.order_id 为主键", "orders.status ∈ {paid, refunded}"],
  "constraints": ["只读", "LIMIT ≤ 10000", "时间范围 2026-01-01 起"],
  "instruction": "仅修复导致违规的查询逻辑，保持已确认口径不变"
}
```

### 5.4 收敛与升级

1. 重试上限 3；归一化 SQL 与上一轮相同 → 立即升级；
2. 同一失败类连续 2 次未消除 → 升级（附完整尝试历史）；
3. 升级出口：最佳结果 + 质检报告 + SQL + 失败原因，交人工修正；
4. Demo 采用**单会话**修复回路；批量走外部编排属生产化（第 12 节）。

---

## 6. 契约与质量规则

- **输出契约** `query-result@1.0.0`：字段名/类型/枚举归一/排序/精度；契约不可变版本化，查询携带 `contractId + version`（治理决策见 `data-agent-design.md` 11.2）。
- **质量规则包** `dq-basic@1.0.0`（Demo 版）：非空、唯一、值域、行数区间；每条规则带 `severity`、`rootCause` 判定条件（治理决策见 `data-agent-design.md` 11.4）。
- 规则变更必须重跑金标集；Demo 阶段规则由平台与领域共同评审。

---

## 7. 评测（Demo 验收）

- **金标集**：10–20 条业务问题，覆盖单表、聚合、多表 join、时间范围、枚举过滤、故意失败（空结果/重复键）。
- **指标**：

| 指标 | Demo 验收阈值（建议） |
|---|---|
| SQL 执行一致率 | ≥ 90% |
| 结果集一致率（金标） | ≥ 85% |
| 契约一次通过率 | ≥ 80% |
| 平均修复轮次 | ≤ 1.5 |
| 不可修复占比 | ≤ 10%（且均可解释） |
| 越权 SQL 拦截率 | 100% |

- 内核升级/提示词变更/工具变更后自动回归。

---

## 8. 安全与数据边界

- 只读账号 + 行级策略在 L1 网关执行；Demo 使用脱敏样例库。
- 列级掩码、样本行数上限（≤20 行）、查询成本上限、结果水印、样本审计：Demo 实现样本上限与审计，其余列入生产化。
- 结果只回传句柄 + 统计 + 样本；**原始数据不进入模型上下文**。
- 凭据只存在于能力包进程（`DEMO_DB_DSN`），不写入 prompt/会话/配置明文。

---

## 9. 发布与挂载（Demo 流程）

```bash
# 领域团队
qtoc-cap init text2sql-demo            # 生成能力包骨架
qtoc-cap build                          # 产出 dist/ + capability.json + checksum
qtoc-cap test                           # 契约测试 + 金标集
qtoc-cap publish --channel demo         # 发布到文件注册中心

# 消费方（底座/CapabilityHost）
qtoc-cap install io.qtoc.demo.text2sql@0.1.0
# → 校验 checksum/兼容区间 → 解包 → 生成 mcp.text2sql 配置 → 挂载
```

注册索引（Demo 渠道）：

```jsonc
{
  "apiVersion": "qtoc.registry/v1",
  "capabilities": [
    {
      "name": "io.qtoc.demo.text2sql",
      "version": "0.1.0",
      "channel": "demo",
      "compat": { "qtocCore": ">=1.18.32 <1.19.0" },
      "url": "https://registry.example.com/caps/io.qtoc.demo.text2sql-0.1.0.tgz",
      "checksum": "sha256:...",
      "publisher": "qtoc-demo"
    }
  ]
}
```

动态挂载：业务引擎可通过 `POST /mcp` 添加 `text2sql` server（或重启加载配置），挂载后用 `GET /experimental/tool/ids` 核对工具与权限键。

---

## 10. 验证矩阵（Demo 通过标准）

| 验证项 | 方法 | 通过标准 |
|---|---|---|
| 能力包规范 | manifest/契约/规则/测试齐备并可构建 | `qtoc-cap build/test` 全绿 |
| 文件注册 | 发布/校验/安装/兼容检查 | 安装后可生成 MCP 配置 |
| 动态挂载 | `POST /mcp` 添加 `text2sql` | 工具 ID 出现且权限键生效 |
| 引擎隔离 | 业务引擎无 fs/bash；编码引擎无数据凭据 | 业务引擎调用 `bash` 被拒；编码引擎读不到 DSN |
| 共享凭据（P0） | 两引擎共用同一 `OPENCODE_AUTH_CONTENT` | 两引擎均可调用模型且配额可观测 |
| 委派闭环 | 能力缺口（如新增样例连接器）委派编码引擎 | 产出可安装的新能力包并回归通过 |
| 审计关联 | 跨引擎 `correlationId` 贯穿 | 一次查询可完整还原（业务会话 → 委派任务 → 编码会话） |

---

## 11. 工程位置

- 建议放入领域能力仓库 `qtoc-cap-data` 的 `demo/text2sql/`（后续生产能力 `prod/*` 复用同一脚手架）；也可独立为 `qtoc-demo-text2sql`。
- 目录结构：

```
demo/text2sql/
├─ capability.json
├─ src/                # MCP Server（L1 + L2）
├─ metadata/           # 最小语义层（tables/metrics/joins）
├─ examples/           # Q→SQL 示例
├─ contracts/          # query-result.schema.json
├─ rules/              # dq-basic.json
├─ tests/              # 契约测试 + golden.jsonl
├─ ui/                 # 可选面板描述
└─ README.md
```

- CI：manifest 校验、契约测试、金标集；纳入集成 CI（双引擎 + 假 LLM + 委派演练）。

---

## 12. 生产化路径（Demo 转正条件）

| 步骤 | 内容 | 条件 |
|---|---|---|
| 1 | 语义层切换 OpenMetadata（L1–L4 定制） | 定制护栏与升级测试就绪 |
| 2 | 补齐 L1 语义能力（joinPath/values/time）与缓存 | 金标集提升达标 |
| 3 | 批量编排（外部调度）与并发治理 | 单批 ≥ 50 稳定运行 |
| 4 | 安全增强（掩码/成本上限/水印） | 安全评审通过 |
| 5 | 切换 LLM Gateway | 网关上线并验收 |
| 6 | 契约/规则进入正式审批链 | 治理委员会批准 |

转正前，Demo 能力包仅在 `demo` 渠道发布，不得进入生产业务引擎的 stable 配置。
