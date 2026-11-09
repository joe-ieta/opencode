# 跟踪、同步、验证与发布

本页是三个维护分支的当前通用操作方法。历史 Qt 手册保留追溯价值；旧 Bun 版本、Actions 状态和可移动发行线标签等约定，以本页及实际脚本为准。

自 2026-10-31 起，按用户要求，本次及后续维护不再向 Issue、PR 或其他讨论发送测试邀请。历史邀请仅作记录，不继续跟进或重复发送。本轮国际化检查与 Linux 发行不修改、新建 PR。

## 1. 环境、分支与检查

- `origin`：`git@gitee.com:ieta/opencode-my.git`，本仓库唯一发布远端；`upstream`：<https://github.com/joe-ieta/opencode>，代码同步来源，V2 从 `upstream/dev` 获取。本机虽有写权限，但只允许通过 PR 与之交互。本项目与 <https://github.com/anomalyco/opencode> 没有关系，不配置也不访问该仓库。顶层 [AGENTS.md](../../AGENTS.md) 的仓库约束覆盖旧配置。
- 源码、标签及全部平台发布物只发布到 `origin` 的 Releases；Windows 使用完整安装包，按现有分卷流程处理 origin 的单附件限制。
- 默认分支为 `dev-my`；`dev` 仅镜像 `upstream/dev`，不放 fork 改动或额外同步合并提交。三条维护线仍为 `dev-my`、`oc-headless`、`qt-headless`。对齐镜像前核对独有提交归属并保留归档，更新时使用明确旧 SHA 的 `--force-with-lease`，不改写三条维护线。
- 使用当前分支根 `package.json` 的 `packageManager` 指定 Bun；本次三个分支均为 **bun@1.4.4**。切换 V1/V2 后重新安装对应 lockfile，不共享一份假定兼容的依赖目录。
- 多条线同时工作时用独立 worktree，避免在有运行任务的目录里切分支；文档更新和检查不要求重启正在使用的桌面或后台服务。

以下命令只更新远端跟踪引用，不直接合并工作区：

```powershell
git status --short --branch
git fetch origin --prune --no-tags
git fetch upstream --prune --no-tags
git branch -vv
git log -1 --oneline origin/dev-my
git log -1 --oneline origin/oc-headless
git log -1 --oneline origin/qt-headless
```

查询标签与发行资产时分别核对；有 tag 不代表已有可下载 Release：

```powershell
git ls-remote --tags origin 'v*-dev-my.*' 'oc-headless-v*' 'qt-headless-v*'
# 发行资产在 origin 的 Releases 页面或 API 核对；本项目不查询 anomalyco/opencode
```

不要因上游“Latest Release”当前展示 V1 而误判 V2 代码版本；同步目标由分支定位确定。

## 2. 历史上游贡献记录

`docs/fork/upstream-prs.md` 中的 Issue/PR 链接属于历史记录，仅作来源追溯，不构成本项目的上游或协作关系。本项目不再查询、更新或推进 anomalyco/opencode 的 Issue/PR；不要为这些历史链接配置远端或运行跟踪命令。

本项目与 `upstream` 的变更只通过 PR（或等价评审流程）进行：从对应上游基线创建范围单一的主题分支，仅推送该主题分支并开 PR；禁止直接推送维护分支、发布标签或 fork 元数据。`AGENTS.md`、`FORK.md` 和 `docs/fork/` 的 fork 专属内容必须从上游 PR 分支中排除，推送前用 `git diff --name-only <upstream-base>...HEAD` 核对。临时分支与关联 worktree 的清理须先列出并经用户确认。

## 3. 同步三条发行线

### dev-my

桌面应用的唯一维护与发行主线是 `dev-my`；本地 Side bar 需求直接在 `dev-my` 维护。2026-11-02 按用户要求整合贡献分支历史，并将项目收起、后代活动与 RTL 修复同步到既有 #60867；此后远端 `sidebar-mode` 仅冻结保留为 PR 来源引用，不再接收开发提交，本地同名分支已删除。旧 `sidetab-overview` 的 #60446 已关闭，仅保留历史参考；旧 `sidebar-projects` 已从 GitHub/Gitee 删除，历史提交在本地 `refs/archive/sidebar-projects` 保留。其原始补丁 `966e97bf71` 与已进入 `dev-my` 的 `0a3c0c4e4a` 补丁指纹一致，不要再次整支合入。独立模式设计和验证见 [Side bar 记录](dev-my/sidebar-mode.md)。

2026-11-02 按用户确认核对并清理旧 Side tabs 分支：本地 `sidetab-overview@bb2f2669e9`、`sidetab-update@1f20601184` 及 GitHub `origin/sidetab-overview@1f20601184` 已删除；远端原本没有 `sidetab-update`。旧提交不是 `dev-my` 的直接祖先，但项目分组、共享历史、运行会话、新建入口、分支/工作树提示及子会话过滤已通过原维护提交和 `8a63200923` 吸收，随后 `0b82c40bff` 将其迁入独立 Side bar。旧提交保存在本地 `refs/archive/2026-11-02/heads/sidetab-overview` 和 `refs/archive/2026-11-02/heads/sidetab-update`；关联 `.cache/sidetab-pr` 工作树已转为 detached，文件保留。开放 PR 来源 `home-project-list`（#60570）、`sidebar-mode`（#60867）、`upstream-migration`（#56929）继续保留，其余候选分支本次未处理。

在该分支的干净工作区中：

```powershell
git switch dev-my
git merge --ff-only origin/dev-my
git merge upstream/dev
bun install --frozen-lockfile
bun run check
```

锁文件因真实依赖冲突需要重建时，先解决 package.json，再执行 `bun install` 并检查差异；不要用跳过安装或类型检查掩盖依赖缺失。发布分支采用 merge 保留已发行历史，不用 reset 或整体覆盖丢弃本地补丁。

合并时重点核对 Side bar 数据和隐藏语义、V1 升级确认、迁移清理与恢复、SQLite 分类、Layer 诊断、桌面服务/历史路径、同源码 CLI 打包，以及已上游合并的模型日期修复。

本地项目分组、历史列表和 Running sessions 仅在第四种 Side bar（`sidebar`）模式中维护；官方 Top tabs、Side tabs（`vertical`）和 Inbox 跟随上游。不要把本地列表逻辑重新写回官方 `tab-strip.tsx`，也不要通过重定义后台 Project 模型解决本地导航需求。升级保留已有模式选择，不将 `vertical` 自动迁移成 `sidebar`。

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

V2 跟踪 `upstream/dev`。`oc:sync` 已执行同步、守卫、依赖安装和类型检查；仅在这些门禁本轮已成功后，构建才可使用 skip 参数。一键候选流程为 `bun run oc:release`，不自动完成记录、打标签和 origin 发布。

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

跟踪源固定为 `origin/v1`（本项目 V1 基线；`upstream` 当前没有 V1 分支）。sync 已完成依赖和类型检查时才使用 skip 参数；发生冲突后，手工收尾还需 trim、安装、类型检查和协议检查。当前没有 `qtoc:release` 别名，不照抄 V2 命令。

V1 同步需要保留已裁剪包的删除。脚本可以处理特定 modify/delete 冲突，其余冲突须检查后解决，尤其 package.json、构建入口和 lockfile；不要普遍使用 `--ours`/`--theirs`。

### Headless 本地发布与固定交付目录

两条 headless 线分别归档，不建立日期或时间戳汇总目录：

| 分支          | 最终交付目录      | 稳定名            | 版本化名                                         |
| ------------- | ----------------- | ----------------- | ------------------------------------------------ |
| `qt-headless` | `artifacts/qtoc/` | `qtoc_core[.exe]` | `qtoc_core-<version>-<os>-<arch>[.exe]`          |
| `oc-headless` | `artifacts/oc/`   | `oc_core[.exe]`   | `oc_core-<version>-<os>-<arch>[-baseline][.exe]` |

每份二进制附同名 `.sha256`；两个目录分别保存自己的 `build.json`，记录实际构建源提交、官方上游提交、版本、平台、文件大小、SHA256 及验收结果。不要用后续文档提交冒充构建来源。

独立 worktree 的构建脚本先产出其工作区内的 `artifacts/qtoc/` 或 `artifacts/oc/`。完成本轮同步、裁剪、安装、检查和隔离冒烟后，将稳定名、版本化文件、校验侧车及清单原名复制到主仓库对应目录；本机最终位置为 `E:\ChatGPT\opencode\artifacts\qtoc\` 和 `E:\ChatGPT\opencode\artifacts\oc\`。核对旧稳定版已有版本化归档，保留历史版本，再更新稳定名；复制后重新校验全部哈希。

冒烟使用仓库之外的系统临时目录、独立配置和数据库、随机端口及独立密码，避免加载父级 `.opencode` 开发工具或接触正在使用的服务。V1 检查版本、健康、401、`question` 与 SSE；V2 检查 info 200/版本、401 与 SSE，两者均要求 stderr 空。测试后关闭其进程。

默认只做本地发布：源码和发布记录可提交到本地分支，二进制由 Git 忽略；不推送分支、标签或发布物，不触发远端 CI。远端发布须另有用户明确授权。两条维护分支的 `packages/qtui/docs/ops/release-runbook.md` 已分别固化这一流程。

## 4. 按变更范围验证

- 根目录 `bun run check` 为规范的完整 lint/类型检查；受影响包可先运行 `bun typecheck`。CI/发布的正式编译器验证使用包内 `bun run typecheck:tsc`，不直接调用 tsc。
- 拉取涉及依赖升级的源码后先执行 `bun install --frozen-lockfile`，确认实际安装版本与锁文件一致，再运行检查。2026-11-02 的 util 五个类型错误源于本机残留 Effect 4.0.6，而源码与锁文件已要求 4.1.0；按锁文件安装即可消除，不删减 `duplex` 支持或修改类型断言。修复后根检查 35/35、util 正式 TypeScript 检查及现有子进程回归 25/25 均通过。
- 正常推送保留 `.husky/pre-push` 的 Bun 版本与完整检查，不设置 `HUSKY=0` 或覆盖 `core.hooksPath` 跳过检查。
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

完整的 Windows/Ubuntu、多架构与 QEMU 环境准备、验证清单和排障见 [发布环境与多架构构建](KB/release-environment.md)。在 Windows x64 或 Ubuntu/Linux x64 的 `dev-my` 干净工作区，使用锁定 Bun：

```powershell
bun install --frozen-lockfile
bun run check
# 示例：将版本改成尚未存在的下一次发行号
bun run release:desktop:my --version=2.2.3-dev-my.3
```

Linux 支持 x64 与 arm64。Ubuntu 24.04 x64 上交叉构建 arm64 时先安装 `qemu-user-static`、arm64 交叉 libc，并注册 binfmt，再安装双架构可选依赖：

```bash
sudo apt install -y build-essential fakeroot unzip qemu-user-static binfmt-support libc6-dev-arm64-cross
export QEMU_LD_PREFIX=/usr/aarch64-linux-gnu
# WSL 的 systemd-binfmt 被 ConditionVirtualization=!wsl 跳过；需单独注册，并在重启后重新生效
sudo sh -c 'test -e /proc/sys/fs/binfmt_misc/qemu-aarch64 || cat /usr/lib/binfmt.d/qemu-aarch64.conf > /proc/sys/fs/binfmt_misc/register'
bun install --frozen-lockfile --cpu=*
# 仅 arm64，或同一标签同时构建 x64 与 arm64
bun run release:desktop:my --version=2.2.3-dev-my.3 --arch=arm64
bun run release:desktop:my --version=2.2.3-dev-my.3 --arch=all
```

`--arch` 省略时使用当前主机架构；Windows 目前只允许 x64。Linux arm64 的 CLI 冒烟通过 binfmt 在 qemu 中执行，Electron 交叉打包由 electron-builder 完成；Linux 两架构的模型目录冒烟使用 `--via-server`，等待插件激活后重试同一请求，避免 WSL 原生或 QEMU 下的一次请求 5 秒超时。仍完整比较内置目录与快照。正式 ARM64 GUI 验收仍应在原生 arm64 机器或 runner 上做。脚本是 `packages/desktop/script/release-my.ts`，按官方阶段执行：

1. 更新内置模型目录；从同一个源码提交按目标架构构建 CLI。
2. 校验 CLI 版本、模型目录，执行隔离服务发现及 V1 迁移确认/历史冒烟。
3. 构建 Electron，Windows 先生成 app 再包 NSIS；Linux 默认 AppImage/deb，可在有 rpmbuild 的机器设置 `OPENCODE_DESKTOP_LINUX_TARGETS=AppImage,deb,rpm` 增加 rpm。
4. 生成 `dist/releases/v<version>/` 的安装包、按架构的 `latest-linux.yml` / `latest-linux-arm64.yml`、`SHA256SUMS` 和 `build.json`。`build.json` 的 `targets` 列出本次构建的架构。

发布前核对实际打包的 app.asar 中有修复、CLI 版本正确，`build.json.commit` 与待打标签提交一致，安装包哈希与大小匹配。当前脚本未配置官方签名服务，产物未签名；本流程不替用户执行安装或替换运行中的服务。

以下以已完成构建的 `v2.2.3-dev-my.3` 多架构发行号为例，实际执行前准备好对应目录和 release notes；不要复用已发布标签：

```powershell
git tag -a v2.2.3-dev-my.3 <build.json中的源码提交> -m 'OpenCode My 2.2.3-dev-my.3'
git push origin dev-my
git push origin refs/tags/v2.2.3-dev-my.3
gh release create v2.2.3-dev-my.3 dist/releases/v2.2.3-dev-my.3/opencode-desktop-win-x64.exe dist/releases/v2.2.3-dev-my.3/opencode-desktop-linux-x86_64.AppImage dist/releases/v2.2.3-dev-my.3/opencode-desktop-linux-amd64.deb dist/releases/v2.2.3-dev-my.3/opencode-desktop-linux-arm64.AppImage dist/releases/v2.2.3-dev-my.3/opencode-desktop-linux-arm64.deb dist/releases/v2.2.3-dev-my.3/latest.yml dist/releases/v2.2.3-dev-my.3/latest-linux.yml dist/releases/v2.2.3-dev-my.3/latest-linux-arm64.yml dist/releases/v2.2.3-dev-my.3/SHA256SUMS dist/releases/v2.2.3-dev-my.3/build.json --repo joe-ieta/opencode --verify-tag --draft --title 'OpenCode My 2.2.3-dev-my.3 (Windows amd64 + Ubuntu amd64/arm64)' --notes-file <release-notes.md>
# 上传完成，核对资产大小和服务端 SHA256 digest 后再公开
gh release edit v2.2.3-dev-my.3 --repo joe-ieta/opencode --draft=false --prerelease=false --latest

```

`gh release create` 只对本仓库 `joe-ieta/opencode` 执行，全部平台安装包及更新清单统一使用本仓库 GitHub Release。不要向官方 `upstream` 推送 fork 发行提交、标签或发布物。

只列入实际完成构建与验收的架构和清单；不把未构建的平台记成通过。Linux 按架构提供 `latest-linux.yml` / `latest-linux-arm64.yml`。GUI appId 独立，后台渠道仍为 `dev`；配置、服务/历史和 tag 固定更新源约定见 [dev-my](dev-my/README.md)。

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

桌面安装包采用保留策略：保留当前稳定 Latest，以及各平台最新测试发行；被替代的历史 GitHub Release 与其资产可以清理，源码标签保留。删除前核对每个平台的保留版本，删除后独立核验 Release 清单、Latest 和源码标签；不把该策略套用于 headless 分支或其 Actions artifacts。2026-10-31 首次清理结果见 [发行记录](dev-my/releases.md#历史发行清理2026-10-31)。

新发行优先使用新的、不可变的迭代标签，不默认强推覆盖已发布标签。历史 Qt 冲突曾在明确授权下按“备份旧 annotated tag → 对齐远端”处理：

- `qt-headless-v1.18.31` 与 `qt-headless-v1.18.32` 已在本机对齐远端。
- 旧 tag 对象留在本机 `refs/archive/2026-10-30/tags/<标签名>`；这些是本地备份引用，不是已推送到 origin 的发行标签。

本目录是文档汇集工作区，Qt 资料带来源提交快照；两条 headless 的原始操作文档仍在其分支。后续若在对应分支统一迁移实际文档路径，应只移植文档变更、同步脚本/技能中的引用并验证，不能 merge 整个 dev-my 来搬文档。原始技能入口保留原位以保证发现机制。

每次发行或上游交互后，更新顶层快照、对应分支概览、PR 表和发行记录；本地 `.cache/`、`dist/`、`artifacts/` 不作为 Markdown 正文或上游 PR 的附件代码提交。
