# qt-headless：V1 qtoc_core 维护线

跟随官方 `upstream/v1`，发行 V1 `qtoc_core[.exe]`，保留原生 Qt 客户端、集成设计及已验证的本地补丁。V1 维护与 V2 开发分开。

## 进度快照（2026-10-30）

- 分支：`81c50bd59a`；上游同步点 `006d837c50`，内核 1.19.5。
- 发行线标签 `qt-headless-v1.19.5` 与迭代标签 `qt-headless-v1.19.5.1` 均指向该分支提交。
- 最近 Windows 本地构建约 155.5 MB；类型检查 18/18、构建内置冒烟、`/global/health`、question 工具与 SSE 验证通过。
- 发布记录当时的三平台 CI 因 Actions 禁用而待补；当前 Actions 已启用，需核对具体运行和产物后才能标为完成。
- 后续以官方 V1 安全/可靠性修复和 Qt 客户端兼容维护为主，不合入官方 V2 dev 的结构重构。

## 构建与协议

本分支根目录提供 `qtoc:sync`、`qtoc:trim`、`qtoc:build`，当前未提供 `qtoc:release` 别名。同步后必须重新应用裁剪并检查 lockfile。产物位于 `artifacts/qtoc/`，渠道为 `qt-headless`，标签前缀 `qt-headless-v`。

V1 以本分支的 OpenAPI、SDK 与 HTTP/SSE 实现为准。Qt 负责 UI 和交互投影，模型、会话、权限、工具与持久化由内核负责。V2 应读取 [oc-headless 文档](../oc-headless/README.md)。

## 历史设计

[早期集成方案](legacy/opencode-qt-integration.md)与 [方法论](legacy/opencode-qt-integration-methodology.md)基于 1.18.31，保留作设计过程参考；当前 V1 对接优先看本目录 API、guide 与 ops 文档。历史记录里旧 PR 的状态可能已变化，统一以 [当前 PR 跟踪](../upstream-prs.md)为准。

## 本分支资料索引

以下为来源提交的完整 Qt 文档集合；保留内容与历史状态，统一调整导航。

- [tooling.md](tooling.md)
- [client/README.md](client/README.md)
- [KB/architecture.md](KB/architecture.md)
- [KB/branch-strategy.md](KB/branch-strategy.md)
- [KB/data-agent-faq.md](KB/data-agent-faq.md)
- [KB/history.md](KB/history.md)
- [KB/release-issues.md](KB/release-issues.md)
- [KB/upstream.md](KB/upstream.md)
- [archive-index.md](archive-index.md)
- [api/qtoc-http-api.md](api/qtoc-http-api.md)
- [capabilities/text2sql.md](capabilities/text2sql.md)
- [guide/client-tour.md](guide/client-tour.md)
- [guide/qt-shell-guide.md](guide/qt-shell-guide.md)
- [integration/data-agent-design.md](integration/data-agent-design.md)
- [integration/dual-engine-architecture.md](integration/dual-engine-architecture.md)
- [integration/implementation.md](integration/implementation.md)
- [integration/methodology.md](integration/methodology.md)
- [ops/bun-install.md](ops/bun-install.md)
- [ops/qt-headless.md](ops/qt-headless.md)
- [ops/qtoc-build.md](ops/qtoc-build.md)
- [ops/release-runbook.md](ops/release-runbook.md)
