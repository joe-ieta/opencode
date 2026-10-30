# oc-headless：V2 oc_core 发行线

跟随官方 `upstream/dev`，为 Qt/C++ 等原生客户端提供 V2 HTTP/SSE 内核，运行产物为 `oc_core[.exe]`。与 V1 `qtoc_core` 分开维护。

## 进度快照（2026-10-30）

- 分支：`bd848794de`；内核 V2 2.2.0；标签 `oc-headless-v2.2.0`。
- 采用最小差异策略，保留上游包结构，构建时显式 `--skip-web-ui`，不照搬 V1 删除包集合的裁剪方式。
- 最近本地 Windows 构建 227,193,344 字节；类型检查 36/36、API 契约门禁和认证/事件流冒烟通过。
- Qt V2 传输与会话适配已完成；历史记录包含 ctest 3/3 与真实模型端到端验证。GUI 权限、表单交互仍需人工验收，不能称全部 Qt GUI 已验收。
- 2.2.0 发布记录当时注明 GitHub Actions 被禁用、三平台 CI 待补。截至本次核对仓库 Actions 已启用；这不等于该标签已补跑成功，需按 [维护方法](../maintenance.md)查运行结果。
- 桌面已升级到 2.2.1，不代表本分支已同步到 2.2.1。

## 使用入口

在本分支根目录使用 `oc:sync`、`oc:contract`、`oc:build`、`oc:smoke`，一键候选流程为 `oc:release`。产物归档到 `artifacts/oc/`，渠道为 `oc-headless`，标签前缀 `oc-headless-v`。

V2 API 以对应提交的 `packages/protocol` 为准。不要直接沿用 V1 的 `/session`、`/event`、目录头和 question 假设；先读 API 漂移记录及契约门禁。

后续优先同步 V2 修复、验证 Qt GUI 交互和补齐对应标签的原生矩阵验收。完整归档索引见下方；当前方法优先于历史手册中的旧 Bun 版本、CI 状态和移动标签约定。

## 本分支资料索引

以下为来源提交的完整 Qt 文档集合；保留内容与历史状态，统一调整导航。

- [tooling.md](tooling.md)
- [client/README.md](client/README.md)
- [KB/branch-strategy.md](KB/branch-strategy.md)
- [KB/releases.md](KB/releases.md)
- [KB/v2-api-drift.md](KB/v2-api-drift.md)
- [KB/v2-upgrade-roadmap.md](KB/v2-upgrade-roadmap.md)
- [ops/contract-gate.md](ops/contract-gate.md)
- [ops/dual-line-release.md](ops/dual-line-release.md)
- [ops/release-runbook.md](ops/release-runbook.md)
