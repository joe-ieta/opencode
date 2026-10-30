> **分支资料归档（2026-10-30）**：来自 `oc-headless` 提交 [`bd848794de`](https://github.com/joe-ieta/opencode/blob/bd848794de13cc596c4e73768f7fbb8fee889e43/packages/qtui/README.md)，原路径 `packages/qtui/README.md`。正文保留原记录及当时状态，仅调整文档链接；当前分支进度以上级 [项目总览](../../../FORK.md)、[维护与发布方法](../maintenance.md)及 [PR 跟踪](../upstream-prs.md)为准。本文命令须在对应分支运行，不能直接套用到另一代内核。

# @opencode-ai/qtui

> 分支：**`oc-headless`**（对齐上游 V2 `upstream/dev`），运行态产物 **`oc_core`**（与 `qtoc_core` 隔离）。
> V2 协议适配已完成（CMake 构建 24/24 + ctest 2/2，含真实 `oc_core` 进程测试；GUI 端到端待人工验收）。
> 路线图：[docs/KB/v2-upgrade-roadmap.md](KB/v2-upgrade-roadmap.md)；双分支决策：[docs/KB/branch-strategy.md](KB/branch-strategy.md)；API 漂移：[docs/KB/v2-api-drift.md](KB/v2-api-drift.md)；发布规范：[docs/ops/release-runbook.md](ops/release-runbook.md)；双线发布对照：[docs/ops/dual-line-release.md](ops/dual-line-release.md)；契约门禁：[docs/ops/contract-gate.md](ops/contract-gate.md)；发布记录：[docs/KB/releases.md](KB/releases.md)。

## 命令（仓库根目录执行）

```bash
bun run oc:release  # 一键候选流水线：sync → contract → build → smoke
bun run oc:sync     # 同步上游（upstream/dev V2：merge + trim + install + typecheck）
bun run oc:trim     # V2 最小 delta 守卫（校验构建脚本 flags/产物路径，幂等，失败即停）
bun run oc:build    # 构建 oc_core 并归档到 artifacts/oc/（含 .sha256）
bun run oc:smoke    # 自动冒烟：启动 → /api/info（含 401 校验）→ /api/event
bun run oc:contract # P3 契约门禁：openapi 基线快照 + 稳定面白名单校验
```

可选参数：`oc:build --skip-install --skip-typecheck | --baseline`；`oc:smoke --binary <path> | --port <n>`。

## 结构

```
packages/qtui/
├─ src/
│  ├─ trim.ts      # V2 最小 delta 守卫（不做包删除）
│  ├─ build.ts     # 构建编排：install → typecheck → packages/cli 单二进制 → 归档 oc_core（+sha256）
│  ├─ sync.ts      # 上游同步（默认 upstream/dev）
│  └─ smoke.ts     # 自动冒烟（认证 / 401 / 事件流）
├─ client/         # Qt6 + CMake 演示/测试工程（命名隔离 oc_core；V2 协议适配进行中）
├─ docs/           # 本线文档（KB 决策/漂移/发布记录 + ops 规范）
├─ package.json
└─ tsconfig.json
```

产物：`artifacts/oc/oc_core[.exe]` 与 `oc_core-<version>-<os>-<arch>[-baseline][.exe]` + 各自 `.sha256`（`artifacts/` 已 gitignore）。
