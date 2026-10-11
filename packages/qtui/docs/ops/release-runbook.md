# oc_core 统一发布规范（V2 线 / oc-headless）

> 定位：`oc-headless` 分支（同步源 `upstream/dev` V2）上 `oc_core` 发布的**唯一操作规范**：前置环境、标准步骤、脚本命令、产物与哈希、CI、标签与记录。
> 关联：路线图与版本策略见 `../KB/v2-upgrade-roadmap.md`；API 漂移见 `../KB/v2-api-drift.md`；发布记录见 `../KB/releases.md`；双线发布对照见 `dual-line-release.md`；V1 线规范（qt-headless）为另一分支的 `release-runbook.md`。
> 基线：`oc-headless-v2.0.26`（内核 opencode 2.0.26）。

## 1. 产物与版本

| 项 | 规则 |
|---|---|
| 产物（本地） | `artifacts/oc/oc_core[.exe]`（稳定名）+ `oc_core-<version>-<os>-<arch>[-baseline][.exe]`（版本化）+ 各自 `.sha256` sidecar |
| 产物（CI） | Actions Artifacts `oc_core-Linux` / `oc_core-Windows` / `oc_core-macOS`（保留 14 天） |
| 版本 | 内核版本 = 上游 V2 版本（构建注入 `OPENCODE_VERSION`）；channel 固定 `oc-headless` |
| git tag | 发行线 `oc-headless-v<内核版本>`（移动），迭代 `oc-headless-v<内核版本>.<N>`（不可变）；bootstrap 别名 `oc-headless-v0.1.0` 冻结不回写 |
| 构建实现 | `packages/cli/script/build.ts --single --skip-install --skip-web-ui`（V2 单二进制；无 web UI 归档） |

## 2. 环境与前置

| 项 | 要求/说明 |
|---|---|
| Bun | ≥ 1.4.2（V2 根 `packageManager` 声明；CI 用 latest） |
| 分支 | `oc-headless`，工作区干净；`origin`=joe-ieta/opencode，`upstream`=anomalyco/opencode |
| 预推送钩子 | 钩子执行 `bun run check`（lint + typecheck）。本机 Node < 23.6 时需 `NODE_OPTIONS=--experimental-strip-types`（oxlint 加载 TS 插件）；CI 自带合适环境 |
| Windows 符号链接 | 上游 `packages/app|enterprise/src/custom-elements.d.ts` 与多处 `public/*` 为 symlink；无 symlink 权限的检出会得到占位内容，导致 `app`/`enterprise` typecheck 误报 `TS1128`。临时以目标内容替换（不提交）后跑检查，推送后 `git checkout --` 还原 |
| git 身份 | 与 V1 线一致：合并/附注标签前注入 `GIT_AUTHOR_*`/`GIT_COMMITTER_*`（frank <48937772+joe-ieta@users.noreply.github.com>）；`GIT_MERGE_AUTOEDIT=no` |

## 3. 命令总览

| 命令（仓库根执行） | 作用 |
|---|---|
| `bun run oc:sync` | fetch `upstream/dev` → merge（DU 冲突自动保留删除）→ trim → install → typecheck |
| `bun run oc:trim` | 最小 delta 守卫：校验构建脚本仍支持 `--single/--skip-install/--skip-web-ui/--baseline` 与产物路径构造 |
| `bun run oc:build` | install → typecheck → 单二进制构建 → 归档 `artifacts/oc/`（稳定 + 版本化 + `.sha256`） |
| `bun run oc:smoke` | 自动冒烟：启动 → `/api/info`（认证 200 + 版本一致）→ 无凭据 401 → `/api/event` `server.connected` → 校验 stderr 空 |
| `bun run oc:contract` | P3 契约门禁：openapi 基线快照 + 稳定面白名单校验（缺失即失败，`--update` 刷新基线） |
| `bun run oc:release` | 一键候选流水线：sync → contract → build → smoke（标签/推送/记录仍按本文手动执行） |

参数：`oc:build --skip-install --skip-typecheck | --baseline`；`oc:smoke --binary <path> | --port <n>`；`oc:sync --no-trim --skip-install --skip-typecheck | --no-commit`。

## 4. 标准发布流程

```powershell
# 0) 拉取与检查
git status --short
git fetch --all --prune
git pull --ff-only

# 1) 同步上游（冲突处理：DU 自动；其余手动；bun.lock 取上游后 bun install 重建）
$env:GIT_AUTHOR_NAME="frank"; $env:GIT_AUTHOR_EMAIL="48937772+joe-ieta@users.noreply.github.com"
$env:GIT_COMMITTER_NAME="frank"; $env:GIT_COMMITTER_EMAIL="48937772+joe-ieta@users.noreply.github.com"
$env:GIT_MERGE_AUTOEDIT="no"
$env:NODE_OPTIONS="--experimental-strip-types"   # 本机钩子需要
bun run oc:sync
bun run oc:trim
git status --short                                # 有变更（lockfile 等）提交：chore(qtui): ...

# 2) 契约门禁 + 构建与冒烟
bun run oc:contract
bun run oc:build --skip-install --skip-typecheck
bun run oc:smoke

# 3) 记录（KB/releases.md 追加：tag / 源提交 / 内核 / 产物哈希 / 冒烟结论）
# 4) 打标签并推送
git tag -a oc-headless-v2.0.26 -m "oc_core 2.0.26 (oc-headless): ..."
git push origin oc-headless
git push origin oc-headless-v2.0.26
# 同一内核重发：新 tag oc-headless-v2.0.26.1；发行线 tag 用 -f 移动（如适用）

# 5) CI 监控（tag 触发 oc-headless.yml 三平台矩阵）
gh run list -R joe-ieta/opencode --workflow=oc-headless.yml --limit 5
gh run watch <id> -R joe-ieta/opencode --exit-status
```

CI 通过标准：三平台构建成功并上传产物（含 `.sha256`）；Linux 冒烟通过；`bun run oc:trim`、`oc:contract` 与 Linux typecheck 通过。

## 5. 记录与验收

**发布记录**（`../KB/releases.md`）每次发布一行：tag、源提交（本线 merge 产生）、内核版本、平台、产物名与 SHA256、冒烟结论。

**验收清单**

- [ ] `oc:sync` 干净合并（冲突已处置并提交），`oc:trim` ok，typecheck 通过；
- [ ] `oc:build` 产出稳定名 + 版本化产物 + `.sha256`，OPENCODE_VERSION 与产物版本一致；
- [ ] `oc:smoke` PASS（含 401 与事件流）；
- [ ] 记录已提交；tag 已推送；CI 三平台全绿、产物可下载；
- [ ] 工作区干净，分支与 origin 一致。

## 6. 已知问题

| 事项 | 处理 |
|---|---|
| Windows symlink 占位导致 app/enterprise typecheck 误报 | 见第 2 节；不修改上游文件入库 |
| 预推送钩子 oxlint 插件加载失败（`ERR_UNKNOWN_FILE_EXTENSION`） | 设置 `NODE_OPTIONS=--experimental-strip-types` |
| 二进制体积（V2 2.0.26 Windows x64 ≈ 180 MiB，V1 120 MiB） | 实验结论（2026-10-11）：`bytecode: true` 约 49 MB（188,766,208 B → 关闭后 139,571,712 B ≈ 133 MiB），其余为 V2 功能集增长；当前保持上游默认，进一步瘦身需由 trim 管理开关（未采用）。另：构建**不可字节复现**（同尺寸不同哈希），发布以 `.sha256` 侧车为准 |
| macOS 产物未签名/未公证 | 对外分发需另行 codesign + notarytool |
| Zen 默认模型 `exo-free` 已弃用（410 `ModelDeprecated`） | 端到端/演示使用 `opencode/ling-3.1-flash-free`（免费）或自配模型；客户端 e2e 测试：`OC_TEST_E2E=1`（可选 `OC_TEST_MODEL`） |
| `/api/*` 预览面变更 | 客户端只用稳定子集 + 未知事件容忍（路线图 P3 契约测试） |

## 变更记录

| 日期 | 内容 |
|---|---|
| 2026-10-11 | 首版：V2 线发布规范（基于路线图 P1#9；含本机钩子/符号链接注意事项） |
