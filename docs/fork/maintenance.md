# 跟踪、同步、验证与发布

本页是三个维护分支的当前通用操作方法。历史 Qt 手册保留追溯价值；旧 Bun 版本、Actions 状态和可移动发行线标签等约定，以本页及实际脚本为准。

## 1. 环境、分支与检查

- `origin`：`git@github.com:joe-ieta/opencode.git`；`upstream`：`git@github.com:anomalyco/opencode.git`。
- 使用当前分支根 `package.json` 的 `packageManager` 指定 Bun；本次三个分支均为 **bun@1.4.4**。切换 V1/V2 后重新安装对应 lockfile，不共享一份假定兼容的依赖目录。
- 多条线同时工作时用独立 worktree，避免在有运行任务的目录里切分支；文档更新和检查不要求重启正在使用的桌面或后台服务。

以下命令只更新远端跟踪引用，不直接合并工作区：

```powershell
git status --short --branch
git fetch origin --prune --no-tags
git fetch upstream dev v1 --no-tags
git branch -vv
git log -1 --oneline origin/dev-my
git log -1 --oneline origin/oc-headless
git log -1 --oneline origin/qt-headless
```

查询标签与发行资产时分别核对；有 tag 不代表已有可下载 Release：

```powershell
git ls-remote --tags origin 'v*-dev-my.*' 'oc-headless-v*' 'qt-headless-v*'
gh release list --repo joe-ieta/opencode --limit 20
gh release view v2.2.1-dev-my.2 --repo joe-ieta/opencode --json tagName,isDraft,assets
```

不要因官方“Latest Release”当前展示 V1 而误判 V2 代码版本；同步目标由分支定位确定。

## 2. 跟踪上游贡献

```powershell
gh pr list --repo anomalyco/opencode --author joe-ieta --state all --limit 30
gh pr view 60496 --repo anomalyco/opencode --json state,mergedAt,mergeCommit,headRefOid
gh pr view 60446 --repo anomalyco/opencode --json state,isDraft,mergeable,reviewDecision,statusCheckRollup
gh issue view 60241 --repo anomalyco/opencode --comments
```

每次交互后更新 [PR 跟踪](upstream-prs.md)，必要时更新 [FORK.md](../../FORK.md)的状态快照。官方设计批准、机器人回复、测试成功、实际合并要分别记录；不要把一个状态推断成另一个。

新 V2 上游贡献从 `upstream/dev` 起分支，使用短名称和 conventional commit；按当前 CONTRIBUTING、AGENTS 和 PR 模板提交。保持 fork 文档、品牌和发行脚本不混入无关 PR。

## 3. 同步三条发行线

### dev-my

桌面应用的唯一维护与发行主线是 `dev-my`；Side tabs 的上游贡献单独维护在 `sidetab-overview`。旧 `sidebar-projects` 仅保留最初实现的历史参考，不再接收功能更新或用于发行。其原始补丁 `966e97bf71` 与已进入 `dev-my` 的 `0a3c0c4e4a` 补丁指纹一致，后续优化以 `dev-my` 为准；不要将旧分支再次整支合入。

在该分支的干净工作区中：

```powershell
git switch dev-my
git merge --ff-only origin/dev-my
git merge upstream/dev
bun install --frozen-lockfile
bun run check
```

锁文件因真实依赖冲突需要重建时，先解决 package.json，再执行 `bun install` 并检查差异；不要用跳过安装或类型检查掩盖依赖缺失。发布分支采用 merge 保留已发行历史，不用 reset 或整体覆盖丢弃本地补丁。

合并时重点核对 Side tabs 数据和隐藏语义、V1 升级确认、迁移清理与恢复、SQLite 分类、Layer 诊断、桌面服务/历史路径、同源码 CLI 打包，以及已上游合并的模型日期修复。

### oc-headless

只在 `oc-headless` 工作区执行：

```powershell
git switch oc-headless
git merge --ff-only origin/oc-headless
bun run oc:sync
bun run oc:contract
bun run oc:build --skip-install --skip-typecheck
bun run oc:smoke
```

`oc:sync` 已执行同步、守卫、依赖安装和类型检查；仅在这些门禁本轮已成功后，构建才可使用 skip 参数。一键候选流程为 `bun run oc:release`，不自动完成记录、打标签和 GitHub 发布。

V2 使用最小差异守卫，保留包结构，通过 `--skip-web-ui` 生成 headless 单二进制；避免误套 V1 包删除清单。公开协议变化后先按仓库要求从 `packages/client` 运行 `bun run generate`，不得手改生成客户端。API 契约基线更新必须审阅差异，不能为了让检查通过盲目 `--update`。

### qt-headless

只在 `qt-headless` 工作区执行：

```powershell
git switch qt-headless
git merge --ff-only origin/qt-headless
bun run qtoc:sync
bun run qtoc:trim
bun run qtoc:build --skip-install --skip-typecheck
```

跟踪源固定为 `upstream/v1`。sync 已完成依赖和类型检查时才使用 skip 参数；发生冲突后，手工收尾还需 trim、安装、类型检查和协议检查。当前没有 `qtoc:release` 别名，不照抄 V2 命令。

V1 同步需要保留已裁剪包的删除。脚本可以处理特定 modify/delete 冲突，其余冲突须检查后解决，尤其 package.json、构建入口和 lockfile；不要普遍使用 `--ours`/`--theirs`。

## 4. 按变更范围验证

- 根目录 `bun run check` 为规范的完整 lint/类型检查；受影响包可先运行 `bun typecheck`。CI/发布的正式编译器验证使用包内 `bun run typecheck:tsc`，不直接调用 tsc。
- 测试从包目录执行；写测试前读相应 `.opencode/skills`。不要从仓库根跑测试。
- GUI 行为采用正式构建和隔离数据验证；不得为了测试重启用户正在运行的应用/后台。附着 live Electron 时遵守 `noDefaults: true` 等仓库诊断规范。
- 纯文档整理检查链接、来源与命令，不需要重新构建二进制；文档提交不能冒用此前二进制的源码 provenance。

V2 模型修复当次的可复用检查：

```powershell
# 在 packages/app 中执行
bun test --conditions=solid --isolate --preload ../ui/test/solid-jsx.ts --preload ./happydom.ts ./src/runtime/server/global-sync/utils.test.ts ./src/providers/models/models.test.ts
bun run typecheck:tsc
```

headless 冒烟必须使用新构建的产物和隔离的 home/config/state。V1 检查 `/global/health`、工具列表、SSE；V2 `oc:smoke` 检查 `/api/info`、版本、无凭据 401 和 `/api/event`。协议和 UI 不能只凭进程启动成功就验收。

## 5. dev-my 桌面构建与发布

在 Windows x64 或 Ubuntu/Linux x64 的 `dev-my` 干净工作区，使用锁定 Bun：

```powershell
bun install --frozen-lockfile
bun run check
# 示例：将版本改成尚未存在的下一次发行号
bun run release:desktop:my --version=2.2.2-dev-my.2
```

脚本是 `packages/desktop/script/release-my.ts`，按官方阶段执行：

1. 更新内置模型目录；从同一个源码提交构建 baseline CLI。
2. 校验 CLI 版本、模型目录，执行隔离服务发现及 V1 迁移确认/历史冒烟。
3. 构建 Electron，Windows 先生成 app 再包 NSIS；Linux 默认 AppImage/deb，可在有 rpmbuild 的机器设置 `OPENCODE_DESKTOP_LINUX_TARGETS=AppImage,deb,rpm` 增加 rpm。
4. 生成 `dist/releases/v<version>/` 的安装包、更新清单、`SHA256SUMS` 和 `build.json`。

发布前核对实际打包的 app.asar 中有修复、CLI 版本正确，`build.json.commit` 与待打标签提交一致，安装包哈希与大小匹配。当前脚本未配置官方签名服务，产物未签名；本流程不替用户执行安装或替换运行中的服务。

以下以已完成构建的下一次 Windows 发行号为例，实际执行前准备好对应目录和 release notes；不要复用已发布标签：

```powershell
git tag -a v2.2.2-dev-my.2 <build.json中的源码提交> -m 'OpenCode My 2.2.2-dev-my.2'
git push origin dev-my
git push origin refs/tags/v2.2.2-dev-my.2
gh release create v2.2.2-dev-my.2 dist/releases/v2.2.2-dev-my.2/opencode-desktop-win-x64.exe dist/releases/v2.2.2-dev-my.2/latest.yml dist/releases/v2.2.2-dev-my.2/SHA256SUMS dist/releases/v2.2.2-dev-my.2/build.json --repo joe-ieta/opencode --verify-tag --draft --title 'OpenCode My 2.2.2-dev-my.2 (Windows amd64)' --notes-file <release-notes.md>
# 上传完成，核对资产大小和服务端 SHA256 digest 后再公开
gh release edit v2.2.2-dev-my.2 --repo joe-ieta/opencode --draft=false --prerelease=false --latest
```

Linux 换成该平台实际包和 `latest-linux.yml`；只有完成该平台构建与验收后才列入发行资产，不把本机 Windows 构建记成三平台通过。GUI appId 独立，后台渠道仍为 `dev`；配置、服务/历史和 tag 固定更新源约定见 [dev-my](dev-my/README.md)。

## 6. headless 标签、CI 与产物

| 分支        | 标签                            | 产物位置                                     | 工作流                                     |
| ----------- | ------------------------------- | -------------------------------------------- | ------------------------------------------ |
| oc-headless | `oc-headless-v<内核版本>[.<N>]` | `artifacts/oc/oc_core*` 及各自 `.sha256`     | 本分支 `.github/workflows/oc-headless.yml` |
| qt-headless | `qt-headless-v<内核版本>[.<N>]` | `artifacts/qtoc/qtoc_core*` 及各自 `.sha256` | 本分支 `.github/workflows/qtoc.yml`        |

先记录源提交、内核版本、平台、文件大小和哈希、协议变化及冒烟结果，再打标签、推分支/标签并核验 Actions。当前工作流发布的是有保留期限的 Actions artifacts；不要把它写成永久 GitHub Release 资产。

```powershell
gh api repos/joe-ieta/opencode/actions/permissions
gh run list --repo joe-ieta/opencode --workflow oc-headless.yml --limit 5
gh run list --repo joe-ieta/opencode --workflow qtoc.yml --limit 5
gh run view <run-id> --repo joe-ieta/opencode
```

工作流可能只存在于 headless 分支；调用时先确认该 ref 的文件与注册状态，必要时指定 workflow ID 和实际 ref。缺少记录或 CI 尚未运行，就明确记为待补。本次只查询状态，没有重新 dispatch 构建。

截至 2026-10-30，Actions 设置 `enabled=true`；两条 headless 最近发行的归档仍记录“当时被禁用，CI 待补”，不得仅凭开关恢复改写成通过。

## 7. 标签和文档维护约定

新发行优先使用新的、不可变的迭代标签，不默认强推覆盖已发布标签。历史 Qt 冲突曾在明确授权下按“备份旧 annotated tag → 对齐远端”处理：

- `qt-headless-v1.18.31` 与 `qt-headless-v1.18.32` 已在本机对齐远端。
- 旧 tag 对象留在本机 `refs/archive/2026-10-30/tags/<标签名>`；这些是本地备份引用，不是已推送到 origin 的发行标签。

本目录是文档汇集工作区，Qt 资料带来源提交快照；两条 headless 的原始操作文档仍在其分支。后续若在对应分支统一迁移实际文档路径，应只移植文档变更、同步脚本/技能中的引用并验证，不能 merge 整个 dev-my 来搬文档。原始技能入口保留原位以保证发现机制。

每次发行或上游交互后，更新顶层快照、对应分支概览、PR 表和发行记录；本地 `.cache/`、`dist/`、`artifacts/` 不作为 Markdown 正文或上游 PR 的附件代码提交。
