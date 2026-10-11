# 双线发布对照（qt-headless / oc-headless）

> 定位：本项目当前维护两条并行发行线的**发布命令与流程对照**。两线**并重**（互不阻塞，独立 tag/CI/产物/记录）；V1 线以安全与修复跟随为主，V2 线为重点投入。
> 关联：`../KB/v2-upgrade-roadmap.md`（V2 线路线图）、`release-runbook.md`（V2 线发布规范）、qt-headless 分支 `packages/qtui/docs/ops/release-runbook.md`（V1 线发布规范）、`../KB/branch-strategy.md`（双分支决策 D1–D7）。

## 1. 两线对照

| 项 | qt-headless（V1 线） | oc-headless（V2 线） |
|---|---|---|
| 分支 | `qt-headless` | `oc-headless` |
| 同步源 | `upstream/v1`（1.19.x 维护线） | `upstream/dev`（V2 主线） |
| 运行态产物 | `qtoc_core[.exe]` | `oc_core[.exe]`（与 qtoc_core 隔离） |
| 版本/channel | 上游 1.19.x；channel `qt-headless` | 上游 2.x；channel `oc-headless` |
| 标签规范 | `qt-headless-v<版本>[.<N>]` | `oc-headless-v<版本>[.<N>]` |
| CI 工作流 | `.github/workflows/qtoc.yml` | `.github/workflows/oc-headless.yml` |
| 产物归档 | `artifacts/qtoc/` | `artifacts/oc/`（含 `.sha256`） |
| 发布记录 | `packages/qtui/docs/KB/upstream.md`（发布记录表） | `packages/qtui/docs/KB/releases.md` |
| 发布手册 | qt-headless 分支 `docs/ops/release-runbook.md` | 本分支 `docs/ops/release-runbook.md` |

## 2. 发布命令（标准序列）

**oc-headless（V2，本分支）**

```bash
# 一键候选流水线（同步 → 契约门禁 → 构建 → 冒烟）
bun run oc:release

# 分步（等价，便于干预）
bun run oc:sync                                # upstream/dev 同步（merge+trim+install+typecheck）
bun run oc:contract                            # P3 稳定面契约门禁（openapi 基线）
bun run oc:build --skip-install --skip-typecheck
bun run oc:smoke
# → 记录 KB/releases.md → 打 tag → 推送分支 + tag → CI（oc-headless.yml）
```

**qt-headless（V1，切换到 qt-headless 分支执行）**

```bash
git checkout qt-headless
bun run qtoc:sync                              # upstream/v1 同步（merge+trim+install+typecheck）
bun run qtoc:build --skip-install --skip-typecheck
# → 手动冒烟清单（同分支 docs/ops/release-runbook.md 第 4 节）→ 更新 KB/upstream.md → 打 tag → 推送
```

说明：V1 线的便捷别名 `qtoc:release` 将在下一次 V1 发布提交时随分支一并加入（本次为避免打断 V2 工作区未改动 qt-headless 分支）；在此之前 V1 线使用上表的分步命令。

## 3. 发布边界与约定

1. **互不阻塞**：两线使用不同 tag 前缀、CI 工作流、产物目录与记录文件；任一线的发布失败不影响另一线。
2. **工作区切换**：两条线在同一仓库的不同分支；切换分支后需按对应线重新 `bun install`（依赖集不同）。建议发布窗口内不跨线混跑。
3. **记录同步**：每次发布刷新对应线的记录文件（V1：`upstream.md`；V2：`releases.md`），并标注源提交、内核版本、产物哈希与冒烟结论。
4. **升级路径**：V1 线仅接收 `upstream/v1` 的安全/修复提交；V2 线接收 `upstream/dev`（V2）进展；V1→V2 的迁移策略见 `../KB/branch-strategy.md`。
