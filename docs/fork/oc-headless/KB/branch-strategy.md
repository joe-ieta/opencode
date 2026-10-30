> **分支资料归档（2026-10-30）**：来自 `oc-headless` 提交 [`bd848794de`](https://github.com/joe-ieta/opencode/blob/bd848794de13cc596c4e73768f7fbb8fee889e43/packages/qtui/docs/KB/branch-strategy.md)，原路径 `packages/qtui/docs/KB/branch-strategy.md`。正文保留原记录及当时状态，仅调整文档链接；当前分支进度以上级 [项目总览](../../../../FORK.md)、[维护与发布方法](../../maintenance.md)及 [PR 跟踪](../../upstream-prs.md)为准。本文命令须在对应分支运行，不能直接套用到另一代内核。

# 双分支策略（KB）：qt-headless / oc-headless 与上游 V2 对齐决策

> 定位：记录 2026-10-11 关于「上游 V2 晋升 dev 后，本仓库如何维护发行线」的设计决策与实施状态。
> 结论：`qt-headless` 固定对齐 `upstream/v1`（V1 维护线）；新建 `oc-headless` 对齐 `upstream/dev`（V2 主线），后续**重点跟踪 oc-headless**。
> 关联：[../ops/release-runbook.md](../ops/release-runbook.md)（发布规范）、`architecture.md`（维护策略）、`upstream.md`（同步与发布记录）、`release-issues.md`（发布问题复盘）。

## 背景

- 2026-10-10 上游执行 `chore: promote v2 to dev`（`5caf1f9f6f`）：**`dev`/`production` 转为 V2**（2.0.26），包结构重构，`packages/opencode`、`packages/sdk/openapi.json` 等 V1 结构不复存在。
- 上游另设 **`v1` 分支**继续维护 V1 线（1.19.x，2026-10-11 仍在更新）。
- 若不调整，`qtoc:sync`（默认 `upstream/dev`）将面对 V2 结构性变更，V1 裁剪与构建管线无法直接合并。

## 调研结论（V2 可套壳性）

| 项目              | V1（qt-headless）                            | V2（oc-headless）                                                                                          | 结论                |
| ----------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------- |
| 单二进制构建      | `packages/opencode/script/build.ts --single` | `packages/cli/script/build.ts --single`（编译为 `dist/<cli-os-arch>/bin/opencode`）                        | ✅ 同样支持         |
| headless 构建开关 | 默认不内嵌 Web UI（裁剪后）                  | `--skip-web-ui`（默认内嵌 app 归档）                                                                       | ✅ 显式跳过         |
| 服务命令          | `serve --hostname --port`                    | `serve --hostname --port --cors --stdio`（"Start the v2 API and web server"）                              | ✅ 具备             |
| 事件流            | `/event` SSE                                 | `packages/server/src/handlers/event.ts`（`text/event-stream`）                                             | ✅ 具备             |
| 协议描述          | `packages/sdk/openapi.json`                  | `packages/protocol/openapi.json`                                                                           | ✅ 具备（位置变化） |
| 上游 V2 真实分支  | -                                            | **`upstream/dev`**（`upstream/v2` 为陈旧指针：其 tip 是 dev 祖先、落后 1300+ 提交；`production` 为晋升线） | 跟踪 dev            |

## 决策记录

| 编号 | 决策                                                                                                                                                                                                         | 状态                                                    |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| D1   | `qt-headless` 同步源固定为 **`upstream/v1`**（`qtoc:sync` 默认分支改 `v1`，文档/技能同步更新）                                                                                                               | ✅ 已落地（`4816da8244`，发布 `qt-headless-v1.19.0.1`） |
| D2   | 上游 V2 真实开发分支为 **`upstream/dev`**；不再使用 `upstream/v2` 作为跟踪目标                                                                                                                               | ✅ 已确认                                               |
| D3   | V2 支持 qtoc_core 同款套壳（单二进制 + `serve` + HTTP/SSE + openapi），**可以建立 V2 发行线**                                                                                                                | ✅ 已确认                                               |
| D4   | 新建 **`oc-headless`** 分支跟踪 `upstream/dev`（V2）；`qt-headless`（V1）保留维护，后续重点为 `oc-headless`                                                                                                  | ✅ 已建立                                               |
| D5   | oc-headless 采用**最小 delta**：不删除上游包（无 V1 式 trim 包集合），"headless" 由构建参数（`--skip-web-ui`）与运行方式体现；仅新增 `packages/qtui`（工具/客户端/文档）。理由：最大化上游对齐、降低同步冲突 | ✅ 已落地（phase 1）                                    |
| D6   | 在 oc-headless 中移植 qtui 模式（phase 1）：`sync`/`build`/`trim` 脚本适配 V2、产物命名 `oc_core`、文档与 Qt 客户端随包移植                                                                                  | ✅ 已落地（phase 1）                                    |
| D7   | 版本与标签：qt-headless 继续 `qt-headless-v*`；oc-headless 使用 `oc-headless-v*`（bootstrap `oc-headless-v0.1.0`；首个验证构建后启用 `oc-headless-v<上游V2版本>` 发行线）                                    | ✅ 已打标签                                             |

## 分支模型

```
upstream/v1  ──merge──▶  qt-headless   （V1 线，稳定维护；qtoc_core；同步源 upstream/v1）
upstream/dev ──merge──▶  oc-headless   （V2 线，重点跟踪；oc_core；同步源 upstream/dev）
                              └─ packages/qtui（工具/文档/Qt 客户端模板，模式同 V1）
```

- 两条线共用 `packages/qtui` 模式（脚本 + 文档 + Qt 客户端），但**内核结构、协议面与产物独立**。
- 上游重大变更（V2 演进）只影响 oc-headless；V1 线仅承接 `v1` 安全/修复更新。

## oc-headless 实施要点（phase 1）

| 文件/项                              | 说明                                                                                                                                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/qtui/src/sync.ts`          | 同步源默认 `upstream/dev`（V2）                                                                                                                                                                              |
| `packages/qtui/src/build.ts`         | 编排：install → typecheck → `packages/cli/script/build.ts --single --skip-install --skip-web-ui` → 归档 `artifacts/oc/oc_core[.exe]` + `oc_core-<version>-<os>-<arch>[.exe]`；`OPENCODE_CHANNEL=oc-headless` |
| `packages/qtui/src/trim.ts`          | V2 最小 delta 守卫：校验构建脚本支持 `--skip-web-ui`，不做包删除                                                                                                                                             |
| 根 `package.json`                    | 新增 `oc:trim` / `oc:build` / `oc:sync` 脚本                                                                                                                                                                 |
| `packages/qtui/docs/**`、`client/**` | 自 qt-headless 移植（模式基线；V2 协议适配见待办）                                                                                                                                                           |

## 待办（roadmap）

- [ ] **本地构建验证**：在 oc-headless 完成 `bun install` + `oc:build` + 冒烟（`oc_core serve` + `/global/health`），确认 V2 单二进制可用；
- [ ] Qt 客户端 V2 协议适配（V2 API/事件面与 V1 差异评估；稳定面映射）；
- [ ] oc-headless CI 工作流（原生矩阵构建 + 产物上传；参考 `.github/workflows/qtoc.yml` 模式）；
- [ ] `layer-node` 校验补丁：V1（`packages/core`，#49684）与 V2（`packages/util`，分支 `validate-layer-node`）双线跟踪；
- [ ] 评估 oc-headless 是否需要阶段 2 裁剪（如移除 web/console/stats 包集合），或长期保持最小 delta；
- [ ] V1 线维护策略确认（安全跟随 `upstream/v1`；发布节奏降低）。

## 变更记录

| 日期       | 内容                                                                                      |
| ---------- | ----------------------------------------------------------------------------------------- |
| 2026-10-11 | 首版：V2 晋升后的双分支对齐决策（D1–D7）、V2 套壳调研结论、oc-headless phase 1 落地与待办 |
