# oc-headless 项目路线图与架构（基线 v0.1.0）

> 定位：oc-headless 发行线（V2，同步源 `upstream/dev`）的唯一路线图与架构文档；基线版本、优化清单、阶段验收与发布策略以本文为准。
> 关联：双分支决策（D1–D7）见 `branch-strategy.md`（已移植本分支）；API 漂移评估见 `v2-api-drift.md`。
> 基线：`oc-headless-v0.1.0`（2026-10-11），内核 `opencode 2.0.26`。

## 0. 摘要

- **基线 v0.1.0 已冻结并独立复测通过**（构建元数据、鉴权、信息面、事件流，见 2.2）。
- 策略内核：最小 delta（不删上游包）、headless 由构建参数体现（`--skip-web-ui`）、协议只锁 `/api/*` 稳定子集。
- 长线五阶段：客户端移植 → CI 与发行 → 协议契约 → 业务能力平台 → 上游化终局。

## 1. 背景与双线定位

- 2026-10-10 上游 `chore: promote v2 to dev`（`5caf1f9f6f`）：`dev`/`production` 转 V2（2.0.26），`v1` 分支独立维护 1.19.x。
- 本仓库双线发行：

| 线 | 同步源 | 产物 | 定位 | 状态 |
|---|---|---|---|---|
| qt-headless | `upstream/v1` | `qtoc_core` | V1 维护线（安全/修复跟随，降频） | 稳定，已发 1.19.0.1 |
| oc-headless | `upstream/dev` | `oc_core` | V2 主线（重点投入） | 基线 v0.1.0 |

- 旧 `dev` 分支（个人合并分支）不在策略内，废弃。

## 2. 基线版本 v0.1.0

### 2.1 定义

| 项 | 值 |
|---|---|
| 标签 | `oc-headless-v0.1.0`（annotated `4973d67bde` → commit `d42ac37bf4`），已推送 origin |
| 上游基点 | `upstream/dev` @ `e31136bdbd`（V2.0.26） |
| 本线提交 | `432e8c2415` 工具链 bootstrap → `27af791b17` lockfile 工作区 → `d42ac37bf4` 漂移分析 + 构建/冒烟记录 |
| 构建命令 | `oc:build` → `packages/cli/script/build.ts --single --skip-install --skip-web-ui`；`OPENCODE_CHANNEL=oc-headless` |
| 产物 | `artifacts/oc/oc_core.exe`、`oc_core-2.0.26-windows-x64.exe`（188,766,208 B ≈ 180.0 MiB，bun 1.4.2） |
| SHA256 | `8D380B7553A52D3276A72D0D4FAC924DBC83F8EEF5D268335D83756C849D9883` |
| 覆盖平台 | Windows x64（本轮）；linux/darwin 待 CI 矩阵 |

### 2.2 独立复测（2026-10-11 本轮审查，端口 4097）

| 项 | 结果 |
|---|---|
| 启动 | `server listening on http://127.0.0.1:4097`，stderr 空 |
| `--version` | `opencode v2.0.26` |
| 鉴权 | 无凭据 → `401`；Basic `opencode:<pwd>` → `200` |
| 信息面 | `GET /api/info` → `{version:"2.0.26", pid, urls:["http://127.0.0.1:4097"], paths, capabilities:{persistentPty:false}}` |
| 事件流 | `GET /api/event` → `data: {"id":…,"type":"server.connected","data":{}}` + `: heartbeat` |
| openapi 面 | `packages/protocol/openapi.json` 路径数 118（与漂移文档一致） |

结论：复核与 `v2-api-drift.md` 记录一致，基线可用。

### 2.3 基线冻结规则

1. 基线 tag 不回写；后续任何同步/修复以新 tag 递增。
2. 基线准入清单（全部通过才可打 tag）：`oc:sync` 干净合并 → `oc:trim` ok → typecheck → `oc:build` → 冒烟（启动 / 信息面 / 401 / 事件流）→ 记录哈希与结果。
3. 本文档晚于 v0.1.0 tag 补入，不改变基线判定；下次发布（`oc-headless-v2.0.26`）时随发布收录。
4. 基线差距（不阻塞，纳入路线图）：Qt 客户端未适配、无 CI、ops 文档未移植、二进制体积、form 交互待实现。

## 3. 架构与原则

### 3.1 原则

1. **最小 delta**：不删除上游包；唯一新增 `packages/qtui`。可上游化的修复优先推上游。
2. **headless 是构建参数**：`--skip-web-ui` 使 app archive 编码为空（`AppArchive.encode([])`），不做包裁剪。
3. **上游对齐优先**：本地改动保持小、可审计；同步冲突热点显式记录。
4. **协议锁定**：客户端只用 `/api/*` 稳定子集；未知事件忽略；`/api/experimental/*`、`rpc.*`、gui 扩展不进契约。
5. **版本一元化**：`oc_core` 版本 = 上游版本；channel 固定 `oc-headless`（与 `qt-headless` 隔离）。

### 3.2 逻辑架构

```
upstream/dev ──oc:sync(merge + trim + install + typecheck)──▶ oc-headless
                                                                │ oc:build（--single --skip-web-ui）
                                                                ▼
                              oc_core 单二进制（channel=oc-headless，HTTP/SSE /api/*，Basic/cookie 鉴权）
                                                                │
                 ┌──────────────────────────┬───────────────────┴────────────────────┐
                 ▼                          ▼                                        ▼
        Qt 客户端（P1 移植）        SDK / 契约测试（P3）                  业务能力包（P4）
```

### 3.3 组件职责

| 组件 | 职责 |
|---|---|
| `packages/qtui/src/sync.ts` | 上游同步：fetch/merge；modify/delete 冲突自动保留删除；其余冲突即停 |
| `packages/qtui/src/trim.ts` | 最小 delta 守卫：校验上游构建脚本仍支持所需 flags，防静默错构建 |
| `packages/qtui/src/build.ts` | 构建编排：install → typecheck → 单二进制 → 归档 `artifacts/oc/`（含重试） |
| `packages/qtui/docs/**` | 本线唯一文档入口（KB 决策与漂移；ops 文档待移植/重建） |
| `packages/qtui/client/**` | Qt6 客户端（V1 版在 qt-headless；V2 适配在 P1） |
| 根 `package.json` | `oc:sync` / `oc:trim` / `oc:build` 入口 |

## 4. 详细优化清单（本轮审查发现）

### P0（下一次提交前）

1. **文档悬挂引用**：`v2-api-drift.md` 关联的 `branch-strategy.md`、`ops/release-runbook.md`、`ops/qt-headless.md` 在 oc-headless 均不存在；`README.md`、`sync.ts`（第 8、97 行）同样引用。处置：将 `branch-strategy.md` 移植进本分支（保持决策单一来源），ops 文档在 P2 重建，清除跨分支引用。
2. **`sync.ts` 文案**：usage 示例仍是 `qtoc:sync`（V1 名称）→ 改 `oc:sync`。
3. **版本单一来源**：`build.ts` 用 `cliPkg.version` 设置 `OPENCODE_VERSION`、却用 `distPkg.version` 命名产物；统一以产物 `distPkg.version` 为准并校验一致。
4. **`--baseline` 命名冲突**：baseline 变体覆盖同名 `oc_core-<version>-<os>-<arch>`；建议产物名追加 `-baseline`，并纳入 `trim.ts` 守卫清单。
5. **`trim.ts` 守卫强化**：`includes("bin")` 过弱（任意含 "bin" 字样即通过）→ 校验产物路径构造；`required` 增加 `--baseline`。

### P1（P2 阶段前）

6. **哈希与冒烟自动化**：`oc:build` 产出 `.sha256` sidecar；新增 `oc:smoke`（启动 → `/api/info` → 401 → `/api/event` → 退出），本地与 CI 复用。
7. **CI 工作流 `oc-headless.yml`**：linux/darwin/win32 矩阵（x64 + arm64）、bun cache、trim → typecheck → build → smoke、上传产物与哈希；tag 触发 release job（参考 qt-headless 的 `qtoc.yml` 模式）。
8. **体积调查**：180 MiB 对比 V1 `qtoc_core` 120 MiB。已排除 web UI（skip 后 archive 为空）；测量 pty/ripgrep/tree-sitter/opentui 等编译资产占比，评估 strip 或上游 flags，结论记录后再决定动作。✅ 结论（2026-10-11）：`bytecode: true` ≈ 49 MB（关闭后 133 MiB），其余为 V2 功能集；暂保持上游默认（详见 `../ops/release-runbook.md` §6）。
9. **发行手册（`ops/release-runbook.md`，V2 版）**：版本矩阵、tag 规范、产物存放与推送、发布记录模板、冒烟清单。

### P2（长线铺垫）

10. **版本/标签规范**：`oc-headless-v<上游版本>`（如 `v2.0.26`），同一上游版本重发递增为 `v2.0.26.1`；`v0.1.0` 保留为 bootstrap 别名。
11. **发布记录 `KB/releases.md`**：每次发布一行（tag / 源提交 / 内核 / 产物哈希 / 冒烟结论）。
12. **同步演练**：用最近 `upstream/dev` 变更跑一次含冲突路径的 `oc:sync`，验证自动处理并沉淀冲突热点清单。

## 5. 路线图

| 阶段 | 交付 | 验收 | 状态 |
|---|---|---|---|
| P0 基线固化 | v0.1.0：工具链 + 漂移评估 + 构建/冒烟 | 本文 2.2 复测全过 | ✅ |
| P1 客户端移植 | EventRouter/SessionModel 按 V2 manifest 重建；请求改 `/api/*`；form 替代 question；`OPENCODE_PASSWORD`/随机密码；监听行解析；`client-tour` 重写 | Qt 客户端对 `oc_core` 真实模型端到端会话（含权限/表单） | ▢ |
| P2 CI 与发行 | `oc-headless.yml`；sha256；ops 手册；首个 `oc-headless-v2.0.26` 双平台产物 | tag 触发流水线全绿，产物可复核 | ▢ |
| P3 协议契约 | 稳定面白名单与兼容矩阵；未知事件容忍；实验钩子锁定单适配层；契约测试（http-recorder 基线） | 内核升级仅通过契约测试 + 冒烟即可判定兼容 | ▢ |
| P4 业务能力平台 | SDK 库化 + 双 daemon；委派服务；能力包规范/注册；Text-to-SQL；LLM Gateway（对齐 dual-engine P0–P4，重定基 V2） | 双引擎同内核版本共跑；能力包脚手架 → 发布 → 挂载全流程复现 | ▢ |
| P5 上游化终局 | delta 清零评估；直接消费上游发布二进制 + 纯 Qt 客户端 | 无内核定制仍可交付；fork 仅余品牌/打包 | ▢ |

## 6. 版本与发布策略

### 6.1 版本矩阵

| 项 | 规则 | 示例 |
|---|---|---|
| 内核 `oc_core` | = 上游版本 | 2.0.26 |
| channel | 固定 | `oc-headless` |
| git tag | `oc-headless-v<内核版本>[.<重发序号>]` | `v2.0.26`、`v2.0.26.1` |
| 产物 | `oc_core-<版本>-<os>-<arch>[.exe]`（+`.sha256`） | `oc_core-2.0.26-windows-x64.exe` |
| qtui 包版本 | 跟随内核 | 2.0.26 |

### 6.2 发布流程（草案，P2 完善）

`oc:sync` → `oc:trim` → typecheck → `oc:build` → `oc:smoke` → 记录哈希/结果（`KB/releases.md`）→ 打 tag → 推送分支 + tag → 上传产物。

### 6.3 V1/V2 文档边界

- V1 文档冻结在 qt-headless；oc-headless 从零建立自己的 KB/ops，不批量搬运。
- 跨线引用（如 branch-strategy）仅作为历史决策来源，长期以本线文档为准。

## 7. 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| 上游构建脚本/产物路径漂移 | 构建失败或错产物 | `oc:trim` 守卫 + build 产物存在性检查 + CI 矩阵 |
| `/api/*` 预览面频繁变更 | 客户端随版本破坏 | 稳定子集白名单 + 契约测试 + 未知事件容忍 + 适配层单点 |
| 体积增长 / 杀软误报 | 分发与体验 | P1 体积测量；发布前多引擎扫描；保留 baseline 变体 |
| 文档双线漂移 | 决策失真 | 本线文档单一来源；跨线引用显式标注 |
| 维护资源有限 | 双线节奏失衡 | V1 仅安全跟随；oc-headless 集中投入 |
| Qt 适配量低估（form/事件面全换） | P1 超期 | 先契约测试后 UI；按 manifest 生成映射表 |

## 8. 变更记录

| 日期 | 内容 |
|---|---|
| 2026-10-11 | 首版：基线 v0.1.0 定义与独立复测、P0–P2 优化清单、P0–P5 路线图、版本与发布策略、风险清单 |
