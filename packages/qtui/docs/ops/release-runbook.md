# qtoc_core 统一发布规范（Release Runbook）

> 定位：`qt-headless` 分支上 `qtoc_core`（headless opencode 内核）发布的**唯一操作规范**：发布目的、标准步骤、脚本命令、产物存放与推送、CI 矩阵、多平台注意事项、使用模式与验收清单。
> 适用范围：本仓库（fork `joe-ieta/opencode`）qt-headless 分支的所有发布；人工或按技能 `qtoc-release` 由 AI 代理执行均可。
> 版本基线：opencode `1.18.34`（channel `qt-headless`）；流程自 1.18.31 起持续验证（2026-10-06 更新）。
> 关联文档：`qtoc-build.md`（构建脚本/裁剪/冲突热点细节）、`qt-headless.md`（发行内容/冒烟清单）、`bun-install.md`（Bun 安装）、`../KG/upstream.md`（同步与发布记录）、`../KG/architecture.md`（维护策略）、`../KG/data-agent-faq.md`（单二进制多配置使用模式）。

---

## 1. 发布目的与产物

**目的**

1. 把上游 OpenCode 最新能力以**最小 delta** 的 headless 发行版（`qtoc_core`）交付给 Qt/Native 客户端（HTTP + SSE 接入）。
2. 保持**单一二进制、领域中立**：领域能力（数据治理等）通过运行期配置（agent/MCP/插件）叠加，不产生多版本内核。
3. 每轮发布 = 同步上游 → 裁剪 → 构建 → 冒烟 → 打标签 → CI 矩阵构建 → 记录，全程可回退、可复现。

**产物与命名**

| 位置 | 名称 |
|---|---|
| 构建目录 | `packages/opencode/dist/opencode-<os>-<arch>/bin/qtoc_core[.exe]`（os：`windows`/`linux`/`darwin`；arch：`x64`/`arm64`） |
| 本地归档（稳定名） | `artifacts/qtoc/qtoc_core[.exe]` |
| 本地归档（版本化） | `artifacts/qtoc/qtoc_core-<version>-<os>-<arch>[.exe]` |
| CI 产物 | GitHub Actions Artifacts：`qtoc_core-Linux` / `qtoc_core-Windows` / `qtoc_core-macOS`（保留 14 天） |

- `artifacts/` 已被 `.gitignore` 忽略（上游 `/artifacts/`），**不提交**；分发以 CI 产物或本地归档为准。
- 当前工作流**不创建 GitHub Release**；长期留存需自行保存 CI 产物或另行扩展（见第 8 节）。

**版本语义**

- 二进制版本 = 上游版本（构建时注入 `OPENCODE_VERSION=<仓库版本>`，如 `1.18.34`）+ `OPENCODE_CHANNEL=qt-headless`；`qtoc_core --version` 可查。
- 标签：发行线标签 `qt-headless-v<版本>`（移动，始终指向最新验证提交）+ 迭代标签 `qt-headless-v<版本>.<N>`（不可变）。

---

## 2. 环境与前置条件

| 项 | 要求 |
|---|---|
| 分支 | `qt-headless`，工作区干净 |
| 远端 | `origin` = `joe-ieta/opencode`（推送目标）；`upstream` = `anomalyco/opencode`（同步来源） |
| Bun | ≥ 1.3.14（仓库 `packageManager` 声明；CI 用 latest，本机验证 1.4.2）；安装见 `bun-install.md` |
| Git 身份 | 本机未配置全局身份：合并提交与附注标签前必须设置 `GIT_AUTHOR_*` / `GIT_COMMITTER_*` 环境变量（见第 4 节 Step 1），否则报 `Committer identity unknown` |
| gh CLI | 已登录（`gh auth status`）；监控/重跑 CI 时使用 `-R joe-ieta/opencode` |
| Windows | 建议安装 Git（shell 工具依赖 Git Bash）；磁盘不足时设置 `BUN_INSTALL_CACHE_DIR`/`TMP` |
| macOS | 产物未签名/未公证；对外分发需另行 `codesign` + `notarytool` |

---

## 3. 脚本与命令总览

| 命令（仓库根执行） | 作用 |
|---|---|
| `bun run qtoc:sync` | 同步上游：fetch `upstream/dev` → merge → 自动解决 modify/delete（保持删除）→ trim → install → typecheck |
| `bun run qtoc:trim` | 幂等重新应用 headless 裁剪（删除 UI/无关包、精简配置/命令/CI）；模式漂移时 fail-fast |
| `bun run qtoc:build` | 构建编排：`bun install` → `bun run typecheck` → `script/build.ts --single --skip-install` → 归档 |
| `bun run --cwd packages/opencode script/build.ts --single --skip-install` | 底层构建命令（多平台发布不单独使用，见第 5 节） |

**参数与环境变量**

| 参数/变量 | 作用 |
|---|---|
| `qtoc:sync --no-trim --skip-install --skip-typecheck` | 仅同步 |
| `qtoc:sync --no-commit` | 解决冲突后停下人工检查 |
| `qtoc:build --skip-install --skip-typecheck` | 复用刚完成的安装/类型检查（标准发布用此形式） |
| `qtoc:build --baseline` | 构建无 AVX2 的 baseline 变体 |
| `QTOC_MINIFY=0` | 关闭压缩（调试用，产物更大、堆栈可读） |
| `OPENCODE_CHANNEL` / `OPENCODE_VERSION` | `build.ts` 默认注入 `qt-headless` / 仓库版本；一般无需手动设置 |

**CI 工作流** `.github/workflows/qtoc.yml`：手动 `workflow_dispatch` 或推送 `qt-headless-v*` 标签触发；矩阵 ubuntu/windows/macos 原生构建 + Linux `serve`/`/global/health` 冒烟 + 上传产物。

---

## 4. 标准发布流程

> 以下为一次完整发布（同步 + 构建 + 发布）的标准顺序；每一步通过后再进入下一步。

### Step 0 拉取与检查

```powershell
git status --short                 # 必须干净
git fetch --all --prune
git pull --ff-only
git log --oneline HEAD..upstream/dev   # 查看待同步的上游提交
```

### Step 1 同步上游

```powershell
$env:GIT_AUTHOR_NAME="frank"; $env:GIT_AUTHOR_EMAIL="48937772+joe-ieta@users.noreply.github.com"
$env:GIT_COMMITTER_NAME="frank"; $env:GIT_COMMITTER_EMAIL="48937772+joe-ieta@users.noreply.github.com"
$env:GIT_MERGE_AUTOEDIT="no"
bun run qtoc:sync
```

- 脚本自动保持 modify/delete 删除；**非删除类冲突会中止并列出文件**。
- 高频手动冲突与处理：

| 文件 | 处理 |
|---|---|
| `bun.lock` | 取上游版本后重建：`git checkout --theirs bun.lock; git add bun.lock; git commit --no-edit`；随后 `bun install` 保存裁剪版 lockfile 并提交 |
| `.gitignore` | 取上游 `/artifacts/`（覆盖本地窄条目，收敛 delta） |
| `package.json` / `src/index.ts` / `build.ts` / `turbo.json` / `test.yml` | 人工合并（改动小）；合并后必须 `bun run qtoc:trim` |

- 冲突解决并提交合并后，补齐同步收尾：

```powershell
bun run qtoc:trim      # 期望 0 变更；有清理则提交
bun install            # lockfile 重建
bun run typecheck      # 期望 18/18
git status --short     # 有变更则提交：chore(qtui): reapply trim and lockfile after upstream sync <upstream短号>
```

- 协议检查（通常无变化）：

```powershell
git diff <上一发布点>..HEAD -- packages/sdk/openapi.json packages/sdk/js/src/v2/gen/types.gen.ts
```

### Step 2 本地构建与冒烟

```powershell
bun run qtoc:build --skip-install --skip-typecheck
```

产物：`artifacts/qtoc/qtoc_core[.exe]` 与 `qtoc_core-<version>-<os>-<arch>[.exe]`（构建脚本内含 `--version` 冒烟）。

二进制冒烟（Windows PowerShell；Linux/macOS 用等价命令）：

```powershell
$env:OPENCODE_SERVER_PASSWORD="smoke-secret"; $env:OPENCODE_CLIENT="desktop"
Start-Process artifacts\qtoc\qtoc_core.exe -ArgumentList "serve","--hostname","127.0.0.1","--port","4096"
curl.exe -s -u opencode:smoke-secret http://127.0.0.1:4096/global/health
curl.exe -s -u opencode:smoke-secret http://127.0.0.1:4096/experimental/tool/ids
curl.exe -N --max-time 3 -u opencode:smoke-secret http://127.0.0.1:4096/event
```

验收点：`--version` 正确；`/global/health` 返回 `{"healthy":true,...}`；tool ids 含 `question`；SSE 收到 `server.connected`；stderr 空；随后 `Stop-Process` 结束进程。

### Step 3 推送分支与打标签

```powershell
git push origin qt-headless

# 情况 A：上游版本未变（迭代发布，如 1.18.34.2 → 1.18.34.3）
git tag -a qt-headless-v1.18.34.3 -m "<本次迭代说明>"
git tag -f -a qt-headless-v1.18.34 -m "opencode headless distribution profile for Qt integration (1.18.34)"
git push origin qt-headless-v1.18.34.3
git push -f origin qt-headless-v1.18.34

# 情况 B：上游版本变化（新发行线，如 1.18.34 → 1.18.36）
git tag -a qt-headless-v1.18.36 -m "opencode headless distribution profile for Qt integration (1.18.36)"
git tag -a qt-headless-v1.18.36.1 -m "<本轮说明>"
git push origin qt-headless-v1.18.36
git push origin qt-headless-v1.18.36.1
```

- 推送标签即触发 CI 矩阵（每次标签一个运行；`workflow_dispatch` 亦可手动触发）。
- GitHub 偶发 `Internal Server Error` 时直接重试推送。
- **迭代标签不可变**；修复发布创建下一个 `.N`，失败迭代在记录中标注"未采用"。

### Step 4 监控 CI 并处理失败

```powershell
gh run list -R joe-ieta/opencode --workflow=qtoc.yml --limit 5
gh run watch <run-id> -R joe-ieta/opencode --exit-status --interval 30
gh run rerun <run-id> -R joe-ieta/opencode --failed      # 失败任务重跑
gh run view <run-id> -R joe-ieta/opencode --log-failed   # 失败日志
gh run download <run-id> -R joe-ieta/opencode -n qtoc_core-Linux   # 下载产物
```

- 通过标准：三平台（Linux/Windows/macOS）构建成功且产物已上传；Linux 冒烟通过。
- 已知偶发：Linux 冒烟挂起（服务已监听但首个请求无响应）→ 重跑；若同提交其他运行通过即可判定为 runner 环境偶发（见第 8 节）。

### Step 5 记录与收尾

更新并提交（记录是发布的一部分）：

1. `../KG/upstream.md`
   - 「上游合并记录」追加一行：日期、范围 `<起点>..<终点>`（提交数）、冲突/trim/typecheck/协议结论；
   - 「发布记录」追加迭代行：标签、内容（同步范围 + 构建/修复）、标签指向提交、冒烟与 CI 结果（失败迭代注明"未采用"）。
2. `ops/qtoc-build.md`「版本与标签」表追加标签；新问题补「已知问题与修复」表。

```powershell
git add packages/qtui/docs/KG/upstream.md packages/qtui/docs/ops/qtoc-build.md
git commit -m "docs(qtui): record <version> sync and release results"
git push origin qt-headless
git status -sb    # 最终必须干净
```

---

## 5. 多平台发布

| 方式 | 平台 | 说明 |
|---|---|---|
| **CI 矩阵原生构建（发布标准）** | Linux/Windows/macOS | 每个平台在自身 runner 原生 `bun run qtoc:build --skip-install --skip-typecheck` 并冒烟；避免交叉编译原生依赖问题 |
| 本机构建 | 当前平台 | `bun run qtoc:build` 只产出当前平台（`--single`），用于本机验证/应急 |
| baseline 变体 | 当前平台 | `bun run qtoc:build --baseline` 产出无 AVX2 变体（老 CPU） |

平台注意：

- **Windows**：产物 `qtoc_core.exe`；shell 工具运行依赖 Git Bash；杀软可能短暂占用归档目标（脚本已有 `copyRetry`）。
- **Linux**：glibc x64（默认矩阵）；musl/arm64 需追加 runner（`ubuntu-24.04-arm` 等）并验证。
- **macOS**：矩阵为 arm64（`macos-latest`）；产物未签名/未公证，对外分发需另行签名；构建脚本对 darwin 产物做 ad-hoc 签名，签名路径必须指向 `bin/qtoc_core`（trim 已加守卫）。
- CI 默认只上传产物、不创建 Release；跨版本长期留存需自行下载保存。

---

## 6. 发布物存放与推送

| 环节 | 存放 |
|---|---|
| 构建临时 | `packages/opencode/dist/opencode-<os>-<arch>/`（本地，gitignore 覆盖 `dist`） |
| 本地归档 | `artifacts/qtoc/qtoc_core[.exe]` + `qtoc_core-<version>-<os>-<arch>[.exe]`（gitignore `/artifacts/`） |
| 代码与标签 | 推送 `origin/qt-headless` 分支 + `qt-headless-v*` 标签（触发 CI） |
| CI 产物 | GitHub Actions Artifacts（`qtoc_core-<OS>`，14 天） |
| 记录 | `KG/upstream.md`、`ops/qtoc-build.md` 随分支提交 |

---

## 7. 使用模式（部署与运行）

**启动（Qt 侧进程管理同样适用）**

```powershell
$env:OPENCODE_SERVER_PASSWORD="<secret>"; $env:OPENCODE_CLIENT="desktop"   # desktop 启用 question 工具
qtoc_core serve --hostname 127.0.0.1 --port 0    # 0 = 随机端口，从 stdout 解析 listening 行
```

- 认证：HTTP Basic，用户名 `opencode`，密码 `OPENCODE_SERVER_PASSWORD`。
- 目录作用域：`x-opencode-directory: <urlencoded 绝对路径>`（SSE 也必须带）。
- 主链路：`POST /session/{id}/prompt_async` + `GET /event`（SSE）。

**分发方式**

1. 单文件二进制（推荐）：随 Qt 安装包分发 `qtoc_core[.exe]`；
2. 源码 + Bun 运行时（内网/开发期）；
3. npm 全局安装（不推荐产品化）。

**单二进制多配置（使用模式差异）**

- 同一二进制通过运行期配置区分用途：`OPENCODE_CONFIG_CONTENT`（内联 JSON，优先）/ `OPENCODE_CONFIG`（文件）/ 全局与项目配置；
- 实例隔离：`OPENCODE_DB`、`XDG_*` 目录、随机端口、独立密码；同机可并存多实例；
- 会话级切换：`POST /session` 的 `agent` 字段选择 agent profile（如 `build` 与 `data-analyst` 并存）。
- 详见 `../KG/data-agent-faq.md` 与 `../integration/dual-engine-architecture.md`。

**Qt 客户端验证**：`packages/qtui/client`（Qt6 + CMake），`qtoc_core` 路径通过 `-DQTOC_CORE_PATH` / 环境变量 `QTOC_CORE_PATH` / 复制到 `client/fixtures/` 指定。

---

## 8. 注意事项与已知问题

| 事项 | 处理 |
|---|---|
| 本机 git 身份缺失 | 合并提交/附注标签前设置 `GIT_AUTHOR_*`/`GIT_COMMITTER_*`；`GIT_MERGE_AUTOEDIT=no` 防编辑器阻塞 |
| Bun 版本不足 | `packages/script` 要求 `^1.3.14`；`bun upgrade` EPERM 时用官方脚本重装 |
| husky 预推送报 `bun: command not found` | 将 `%USERPROFILE%\.bun\bin` 加入当前会话 PATH |
| `bun.lock` 每次同步冲突 | 取上游后 `bun install` 重建裁剪版并提交（流程见 Step 1 冲突处理表） |
| trim fail-fast（模式漂移） | 上游改了 `build.ts`/`index.ts` 等模式 → 更新 `packages/qtui/src/trim.ts` 后重跑 |
| Linux CI 冒烟偶发挂起 | runner 环境偶发（同提交其他 runner 通过）；冒烟已加固（`curl --connect-timeout/--max-time`、失败输出内核日志）；失败重跑即可 |
| macOS codesign 路径漂移 | 上游新增签名步骤曾引用 `bin/opencode` 导致 macOS 构建失败；已修 `build.ts` 并由 `trim.ts` 守卫（残留 `bin/opencode` 即 fail-fast） |
| 上游合并本地补丁 | 见 `../KG/upstream.md`「本地 delta」表；上游合并后删除本地补丁 |
| 标签推送 500 | GitHub 偶发错误，重试推送 |
| 归档 `EBUSY`（Windows） | 目标 exe 被运行中内核占用；脚本 `copyRetry`（10×1s），或先停止进程 |
| 旧内核进程占用端口 | 冒烟后务必 `Stop-Process`/`kill`；发布构建与冒烟使用不同目录 |
| CI 产物过期 | Actions Artifacts 保留 14 天；需要长期留存请及时下载 |

---

## 9. 发布验收清单

- [ ] 工作区干净，`origin/qt-headless` 已同步，标签已推送；
- [ ] `qtoc:sync` 冲突处理完毕，trim 幂等（0 变更或已提交清理），typecheck 18/18；
- [ ] 协议检查完成（`openapi.json`/`types.gen.ts` 如有变化已评估影响）；
- [ ] `qtoc_core` 构建成功，本地归档存在（稳定名 + 版本化名）；
- [ ] 本地冒烟：`--version`、`/global/health`、`question`、SSE、stderr 空；
- [ ] CI 三平台构建通过且产物已上传（Linux 冒烟通过）；
- [ ] `KG/upstream.md`（同步记录 + 发布记录）与 `ops/qtoc-build.md`（标签表 + 已知问题）已更新并提交推送；
- [ ] 发行线标签指向最新验证提交；失败迭代已标注"未采用"。
