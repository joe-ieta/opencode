> **分支资料归档（2026-10-30）**：来自 `oc-headless` 提交 [`bd848794de`](https://github.com/joe-ieta/opencode/blob/bd848794de13cc596c4e73768f7fbb8fee889e43/packages/qtui/docs/ops/contract-gate.md)，原路径 `packages/qtui/docs/ops/contract-gate.md`。正文保留原记录及当时状态，仅调整文档链接；当前分支进度以上级 [项目总览](../../../../FORK.md)、[维护与发布方法](../../maintenance.md)及 [PR 跟踪](../../upstream-prs.md)为准。本文命令须在对应分支运行，不能直接套用到另一代内核。

# oc_core API 契约门禁（P3）

> 定位：`oc-headless`（V2 线）稳定面契约检查的唯一入口；对应路线图 P3 验收「内核升级仅通过契约测试 + 冒烟即可判定兼容」。
> 关联：路线图 [../KB/v2-upgrade-roadmap.md](../KB/v2-upgrade-roadmap.md) §5 P3；API 漂移 [../KB/v2-api-drift.md](../KB/v2-api-drift.md)；发布流程 [release-runbook.md](release-runbook.md)。

## 1. 目的与组成

把 Qt 客户端用到的 `/api/*` 调用固化为可机器校验的白名单，并用全量路径快照盯住上游 `openapi.json` 的收缩，使内核升级的兼容判定不依赖人工比对。

| 文件                                   | 作用                                                              |
| -------------------------------------- | ----------------------------------------------------------------- |
| `src/contract.ts`                      | 门禁实现（无新依赖，Bun API）                                     |
| `contract/stable-surface.json`         | 客户端白名单：仅列 Qt 客户端允许调用的 `{method, path}`           |
| `contract/openapi-paths.baseline.json` | 生成快照：`packages/protocol/openapi.json` 的全量路径（排序数组） |

## 2. 用法

仓库根执行（等价）：

```powershell
bun run --cwd packages/qtui contract            # 校验；不写任何文件
bun run --cwd packages/qtui contract --update   # 重生成 baseline 并打印差异
# 根 package.json 若提供别名，可用 bun run oc:contract / oc:contract --update
```

- 退出码 0 仅当无 ERROR；WARN 不失败。
- 默认模式绝不写文件；`--update` 仅重写 `openapi-paths.baseline.json`（稳定面检查有 ERROR 时不写）。

## 3. 检查项

1. **稳定面存在性**：`stable-surface.json` 中每个 `{method, path}` 必须在 openapi 中存在（路径与动词分别校验），缺失 → ERROR `stable surface path missing` / `stable surface method missing`；重复条目 → ERROR。
2. **全量路径对比 baseline**：相对 `openapi-paths.baseline.json`——
   - 移除的路径在稳定面 → ERROR `removed path is in the stable surface`；
   - 移除的路径不在稳定面 → WARN；
   - 新增路径 → 信息列出（不阻塞）。

## 4. CI 集成

- 在 `oc-headless.yml` 的 Linux job 中、`oc:sync`/typecheck 之后、`oc:build` 之前增加一步：`bun run --cwd packages/qtui contract`（建议由环境负责人加根别名 `"oc:contract": "bun run --cwd packages/qtui contract"` 后统一用 `bun run oc:contract`）。
- 作用：上游同步引入 `/api/*` 漂移（尤其稳定路径被删）时，在构建前快速失败；与 `oc:smoke`（运行期信息面/鉴权/事件流）互补，两者共同构成 P3 的兼容判定。
- 本门禁不做网络请求、不需要 `oc_core` 二进制；纯静态校验，秒级完成。

## 5. 稳定面规则

- 客户端只允许调用 `stable-surface.json` 中的 `{method, path}`；新增调用必须先改白名单并通过门禁。
- 白名单只允许非实验路径，不得加入 `/api/experimental/*`、`/api/rpc/*`。
- 路径模板参数（如 `{sessionID}`、`{requestID}`）以 openapi 原文为准，不做重命名/映射。
- `--update` 只在上游同步后有意执行，并把 baseline diff 纳入同一提交审查；不得为绕过门禁而随手更新。
- 事件面不在本门禁机器校验范围内（见第 6 节），由适配层与冒烟覆盖。

## 6. 未知事件容忍与实验钩子隔离（策略）

- **未知事件容忍**：客户端按 V2 事件信封 `{id, type, data, created?, metadata?, location?}` 解析；未知 `type`（含上游新增事件与 `rpc.*`）一律忽略，不报错、不中断事件循环。本门禁对事件词汇表变化只提供路径级信号（`/api/event` 被删会 ERROR），语义变化需人工确认。
- **实验钩子隔离**：`/api/experimental/*`、`rpc.*`、gui 扩展不进契约、不进白名单；所有实验调用必须集中在单一适配层（hook 层），业务代码不得直接引用；内核升级时只需审计该适配层。
- 实验面路径仍在 baseline 快照中（信息性跟踪），删除或新增只产生信息/WARN，不阻塞发布。

## 变更记录

| 日期       | 内容                                                 |
| ---------- | ---------------------------------------------------- |
| 2026-10-11 | 首版：P3 契约门禁（脚本 + 白名单 + baseline + 文档） |
