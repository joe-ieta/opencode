# qtui 文档阅读引导（Index）

> 本目录是 `qtoc_core`（headless opencode 内核）与 Qt/Native 客户端集成的唯一文档入口。
> 基准版本：opencode `1.18.31`（channel `qt-headless`）；协议以 `packages/sdk/openapi.json`（188 端点）为准。

---

## 1. 按角色选阅读路径

### A. Qt / Native 客户端开发者（第一次接触）

```
docs/README.md（本文）
  → guide/client-tour.md          30 分钟跑通 client 演示工程
  → guide/qt-shell-guide.md       按功能实现自己的壳（进程/协议/渲染/交互）
  → api/qtoc-http-api.md          查端点与事件细节
```

### B. 集成负责人 / 架构师（选型与边界）

```
docs/README.md（本文）
  → integration/methodology.md    集成模式选型、职责边界、协议面策略、风险
  → integration/implementation.md 分阶段实施步骤与验收
  → integration/data-agent-design.md  数据治理领域智能体：需求与设计（宏观）
  → guide/qt-shell-guide.md       关键方面的落地约定
```

### B2. 领域应用设计（数据治理 / Text-to-SQL）

```
docs/README.md（本文）
  → integration/data-agent-design.md  领域智能体总体架构、能力需求、样例链路、上游兼容策略
  → integration/methodology.md        5.4 业务上下文注入（插件 + 业务服务）
  → guide/qt-shell-guide.md           客户端落地约定
```

### C. 构建 / 发行 / 维护人员

```
docs/README.md（本文）
  → ops/qtoc-build.md             本地与 CI 构建、与上游同步、冲突处理
  → ops/qt-headless.md            发行内容、运行、验证清单
  → ops/bun-install.md            Bun 安装与疑难
  → KG/architecture.md            代码组织、维护策略与长期路线
  → KG/upstream.md                上游 PR/Issue 与同步记录
  → KG/history.md                 已修复问题（回归参考）
```

### D. 排查线上问题

```
KG/history.md → ops/qt-headless.md 第 4 节冒烟清单 → guide/client-tour.md 第 6 节调试清单
```

---

## 2. 文档分类总览

| 分类 | 目录 | 文档 | 内容 | 受众 |
|---|---|---|---|---|
| 阅读引导 | `docs/` | `README.md` | 分类导航、角色路径、维护约定 | 所有人 |
| 接口参考 | `api/` | `qtoc-http-api.md` | 188 个 HTTP/SSE 端点全量清单、事件清单、关键 Schema、接入约定 | 客户端开发者 |
| 开发指南 | `guide/` | `qt-shell-guide.md` | 按功能分类的壳开发指南（进程/协议/会话/渲染/交互/配置/恢复/多实例） | 客户端开发者 |
| 开发指南 | `guide/` | `client-tour.md` | 参考实现逐模块导读、构建运行、扩展任务、调试清单 | 客户端开发者 |
| 集成设计 | `integration/` | `methodology.md` | 集成模式选型、职责边界、协议面策略、配置注入、RAG、权限/问答、多 daemon、风险、验收 | 架构师/集成负责人 |
| 集成设计 | `integration/` | `implementation.md` | 阶段 0/1/2 实施步骤、裁剪清单、Qt 模块划分、源码索引 | 架构师/实施者 |
| 领域设计 | `integration/` | `data-agent-design.md` | 数据治理/Text-to-SQL 领域智能体：目标范围、架构分层、能力需求、样例链路、扩展点映射、上游兼容策略、路线图 | 架构师/领域负责人 |
| 运维发行 | `ops/` | `qtoc-build.md` | 构建编排、CI 矩阵、上游同步标准流程、冲突热点、标签流程 | 构建/维护 |
| 运维发行 | `ops/` | `qt-headless.md` | 发行内容（保留/移除）、运行方式、验证清单、与上游同步注意 | 构建/维护 |
| 运维发行 | `ops/` | `bun-install.md` | Bun 安装（Windows/Linux）、镜像、疑难（node-gyp/ENOSPC） | 构建/维护 |
| 知识库 | `KG/` | `architecture.md` | 代码组织、上游差异、同步成本、长期路线、Roadmap | 维护者 |
| 知识库 | `KG/` | `upstream.md` | 上游政策、我方 Issue/PR、合并与发布记录、delta 状态 | 维护者 |
| 知识库 | `KG/` | `history.md` | 问题处理历史（KG-001…）、验证基线、关键提交 | 维护者/排查 |

相关入口（不在本目录）：

| 位置 | 内容 |
|---|---|
| `packages/qtui/README.md` | qtui 包总览与命令（`qtoc:trim` / `qtoc:build` / `qtoc:sync`） |
| `packages/qtui/client/README.md` | Qt 演示/测试工程的使用说明与运行配置 |
| `packages/qtui/src/{trim,build,sync}.ts` | 裁剪、构建编排、上游同步脚本 |
| `packages/sdk/openapi.json` | 协议权威来源（`opencode generate` 生成） |
| `packages/sdk/js/src/v2/gen/types.gen.ts` | 事件/请求类型权威来源 |

---

## 3. 快速事实

| 项 | 值 |
|---|---|
| 内核产物 | `qtoc_core[.exe]`（归档于 `artifacts/qtoc/`） |
| 启动 | `qtoc_core serve --hostname 127.0.0.1 --port 0` |
| 认证 | HTTP Basic，用户名 `opencode`，密码 `OPENCODE_SERVER_PASSWORD` |
| 目录作用域 | `x-opencode-directory: <urlencoded 绝对路径>`（SSE 也必须带） |
| 主链路 | `POST /session/{id}/prompt_async` + `GET /event`（SSE） |
| 端点规模 | 188（稳定面 + `/experimental/*` + `/api/*` V2 + `/tui/*`） |
| 事件 | `data: {id,type,properties}`；15s 心跳；无重放 |
| 客户端 | `packages/qtui/client`（Qt6 + CMake，含单测与进程测试） |

---

## 4. 维护约定

1. **协议变更**：先更新 `api/qtoc-http-api.md`（以 `packages/sdk/openapi.json` 与 `types.gen.ts` 为准），再同步 `guide/qt-shell-guide.md` 的相关章节。
2. **构建/发行变更**：更新 `ops/` 下对应文档；标签与发布记录同时更新 `KG/upstream.md`。
3. **问题修复**：在 `KG/history.md` 追加 KG-XXX 条目（现象/排查/修复/验证/经验）。
4. **新增文档**：按分类放入 `api/`、`guide/`、`integration/`、`ops/`、`KG/`，并在本文第 2 节登记。
5. **版本基线**：文档头部注明适用的 opencode 版本与分支；跨版本不兼容时显式标注。
6. **引用路径**：文档内引用使用 `packages/qtui/docs/...` 全路径，保证从仓库根目录可直接定位。
