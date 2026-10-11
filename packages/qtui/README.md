# @opencode-ai/qtui

> 分支：**`oc-headless`**（对齐上游 V2 `upstream/dev`），运行态产物 **`oc_core`**（与 `qtoc_core` 隔离）。
> 本轮为结构阶段：仅保留 `oc_core` 构建工具；qtui 文档、Qt 客户端与 V2 API 适配在后续轮次移植（决策见 `packages/qtui/docs/KB/branch-strategy.md`，随文档移植带入）。

## 命令（仓库根目录执行）

```bash
bun run oc:sync     # 同步上游（upstream/dev V2：merge + trim + install + typecheck）
bun run oc:trim     # V2 最小 delta 守卫（幂等，失败即停）
bun run oc:build    # 构建 oc_core 并归档到 artifacts/oc/
```

可选参数：`--skip-install`、`--skip-typecheck`、`--baseline`。

## 结构

```
packages/qtui/
├─ src/
│  ├─ trim.ts      # V2 最小 delta 守卫（校验构建脚本开关，不做包删除）
│  ├─ build.ts     # 构建编排：install → typecheck → packages/cli 单二进制 → 归档 oc_core
│  └─ sync.ts      # 上游同步（默认 upstream/dev）
├─ package.json
└─ tsconfig.json
```

产物：`artifacts/oc/oc_core[.exe]` 与 `oc_core-<version>-<os>-<arch>[.exe]`（`artifacts/` 已 gitignore）。
