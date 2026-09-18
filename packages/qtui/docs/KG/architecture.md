# qtui 模块架构与维护策略（KG）

> 本文记录 qtui 支撑模块的代码组织方式、与上游 OpenCode 的关系、同步成本评估，以及已确定的长期演进路线。
> 基线：`qt-headless` 分支，opencode `1.18.31`（channel `qt-headless`），上游参照 `upstream/dev`。

## 摘要

qtui 不是"一个打包脚本"，而是 **独立 Qt 客户端 + 幂等裁剪 + 少量内核修复 + 打包发行 + 文档** 的组合。内核本体 = 上游代码 + 2 处真实修复 + 1 处打包选项；与上游的其余差异是"删除 UI/无关包"与"新增叶子包"。

## 1. 代码组织与上游关系

**依赖方向（单向，客户端与内核零代码链接）**

```
上游内核 packages/{core,server,opencode,protocol,schema,client,llm,plugin}
        │  裁剪 + 2 处修复 + 打包选项
        ▼
    qtoc_core[.exe] ──HTTP/SSE──▶ packages/qtui/client（C++/Qt，独立工程）
        ▲
        └── packages/qtui/src/{trim,build,sync}.ts（仓库工具，内核不依赖）
```

**相对 `upstream/dev` 的实际差异**

| 类型 | 数量 | 说明 |
|---|---|---|
| 删除 D | 2619 | app/desktop/web/session-ui/storybook/console/stats/enterprise/slack/function/cli、github/、sdks/、nix/、flake、相关 workflows/patches |
| 新增 A | 36 | `packages/qtui`（脚本/客户端/文档）+ `.github/workflows/qtoc.yml` |
| 修改 M | 9 | 内核源码仅 3 个：`core/filesystem/search.ts`、`core/effect/layer-node.ts`、`opencode/script/build.ts`；配置 6 个：`package.json`、`bun.lock`、`turbo.json`、`test.yml`、`.gitignore`、`opencode/src/index.ts` |

内核改动清单（全部有 KG 记录）：

| 文件 | 改动 | 性质 |
|---|---|---|
| `packages/core/src/filesystem/search.ts` | 循环导入修复（`import type` + schema 直接引入 `Entry/Match`） | **可上游化**（真实 bug） |
| `packages/core/src/effect/layer-node.ts` | `validateNodes` 依赖校验（报节点名+索引） | **可上游化**（防御） |
| `packages/opencode/script/build.ts` | `QTOC_MINIFY` 开关 + `qtoc_core` 产物名 + headless 默认 | 必须保留（发行定制） |

## 2. 能力构成（不只是裁剪打包）

| 层 | 位置 | 职责 |
|---|---|---|
| 裁剪 | `qtui/src/trim.ts` | 幂等删除 UI/无关包、精简 workspaces/命令/CI/patches；模式漂移时**报错不静默** |
| 同步 | `qtui/src/sync.ts` | fetch → merge → 自动解决 modify/delete 冲突（保持删除）→ trim → install → typecheck |
| 打包发行 | `qtui/src/build.ts`、`opencode/script/build.ts`、`.github/workflows/qtoc.yml` | 版本/通道注入、`QTOC_MINIFY`、产物命名、归档重试、CI 矩阵原生构建 |
| 内核补丁 | `core/filesystem/search.ts`、`core/effect/layer-node.ts` | 修复打包崩溃；图层依赖校验 |
| 独立客户端 | `qtui/client/**` | 进程管理、HTTP/SSE、事件路由、会话投影、权限/问答、设置窗口、Qt Test |
| 文档 | `qtui/docs/**` | 集成方法、构建/同步、Bun 安装、KG 历史 |

## 3. 同步成本分析

一次真实同步（7 个上游提交）产生 **66 个冲突，全部为 modify/delete**（我们删除、上游仍修改的 UI 包）。

| 成本项 | 来源 | 频率 | 处理方式 |
|---|---|---|---|
| 删除类冲突 | 上游持续改 app/desktop/console/stats 等 | 每次同步，随上游活跃度增长 | `qtoc:sync` 自动保持删除（已落地） |
| 热点文件冲突 | `package.json` / `index.ts` / `build.ts` / `turbo.json` / `test.yml` | 上游改到才发生 | 人工合并（改动小） |
| trim 模式漂移 | 上游重构 build/index/命令注册 | 低频 | trim fail-fast → 更新模式 |
| 内核补丁冲突 | `search.ts` 被上游改动 | 低频 | 上游已修则丢弃本地补丁 |
| 协议漂移 | openapi / 事件联合类型变化 | 中频 | 客户端只依赖稳定面 + 未知事件忽略 |

量化估计：

| 场景 | 预计耗时 |
|---|---|
| 无热点变动（自动化后） | 20–40 分钟（sync → build → 冒烟） |
| 上游重构热点 | 半天到一天（更新 trim 模式/补丁 + 客户端回归） |

## 4. 长期路线

| 路线 | 做法 | 优点 | 代价 |
|---|---|---|---|
| A. fork + merge（原状态） | 长期维护分支，周期合并 | 控制力最强 | 删除冲突累积 |
| B. 补丁集模式（**当前演进方向**） | delta 收敛为 patch 系列；同步 = 干净上游 → 应用补丁 → prune → 构建 | 删除冲突消失、delta 可审计 | 补丁需随上游 rebase（范围小） |
| C. 上游化 + 最小 delta（终局） | 内核修复上游化；改用发布版二进制 + 纯 Qt 客户端 | 维护成本趋近零 | 依赖上游合并意愿，裁剪/品牌化减弱 |

决策：**先走 B（已落地 `qtoc:sync`），同时推进 C 的前提条件（上游化内核修复）**；若上游接受修复且业务不需要内核定制，再切换到 C。

## 5. 已确定推进项（Roadmap）

### 阶段 1（已落地）
- [x] `bun run qtoc:sync`：自动 fetch/merge/解决删除冲突/trim/install/typecheck
- [x] 同步流程文档化（本文 + `qtoc-build.md` 第 4 节）

### 阶段 2（内核修复上游化）
- [ ] 向上游提交 PR 1：`fix(core): break filesystem search import cycle`（附 KG-001 复现与验证）
- [ ] 向上游提交 PR 2：`fix(core): validate layer node dependencies`（报节点名+索引）
- [ ] 上游合并后，从本地 delta 中移除对应补丁，并在 KG 记录

### 阶段 3（协议契约与版本策略）
- [ ] 客户端只使用稳定面（`/session`、`/event`、`/permission`、`/question`、`/config`、`/config/providers`）
- [ ] 保持 `x-opencode-directory`、SSE 分帧、未知事件忽略、`/global/health` 版本校验等约定
- [ ] `qtoc_core` 版本 = 上游版本 + channel `qt-headless`；每次同步跑 CI 矩阵 + ctest + 冒烟清单
- [ ] 业务插件钩子（`experimental.chat.*.transform`）视为实验 API，按内核版本锁定并纳入回归

### 阶段 4（终局评估）
- [ ] 评估直接使用 npm `opencode-ai` 发布二进制 + Qt 客户端的可行性（无内核定制时）
- [ ] 若保留 fork：仅维护"打包/品牌化 + 必要补丁"，禁止 qtui 反向依赖内核内部模块

## 6. 同步操作手册

```bash
# 标准同步（自动处理删除冲突）
bun run qtoc:sync

# 仅同步、不构建
bun run qtoc:sync --no-trim --skip-install --skip-typecheck

# 出现非删除类冲突时：手动解决后
bun run qtoc:trim
bun run qtoc:build

# 发布构建（CI 矩阵原生构建）
# 推送 qt-headless-v* 标签，或在 GitHub Actions 手动运行 qtoc 工作流
```

同步后验证：`packages/qtui/docs/qt-headless.md` 第 4 节冒烟清单 + `ctest`（`packages/qtui/client`）。

## 7. 风险与监控点

| 风险 | 监控方式 | 触发动作 |
|---|---|---|
| trim 模式失配 | `qtoc:trim` 抛错 | 更新 `trim.ts` 模式，更新 KG |
| 上游内核修复与本地补丁冲突 | `qtoc:sync` 报非删除冲突 | 合并时保留上游版本，删除本地补丁 |
| 协议/事件变更 | 冒烟清单 + 客户端回归 | 更新客户端适配层与 KG |
| 删除冲突数量增长 | `qtoc:sync` 输出统计 | 评估切换路线 B/C |
| 插件实验钩子变更 | 业务注入冒烟 | 锁定内核版本或适配 |
