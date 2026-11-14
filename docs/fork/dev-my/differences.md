# dev-my 与官方 dev 的差异：Side bar、模型管理与桌面发行

> 对照基线：官方 `upstream/dev@f0089856c0`（V2 2.3.0）。`dev-my` 于 2026-11-14 合入 `dev-my-models` 的自定义 Provider 工作（合并提交 `4005a3aecd`，UI 收口提交 `abc5450959`），并从合入后的 `dev-my` 发布 Windows 测试版 [v2.3.0-my.4](https://github.com/joe-ieta/opencode/releases/tag/v2.3.0-my.4)（构建源码 `09fc39f73b`）。本文描述 V2 桌面应用的产品、设计与实现差异；`oc-headless`、`qt-headless` 不在范围内。
>
> 本文是差异总览。Side bar 的完整需求、评审和测试记录见 [Side bar 独立模式](sidebar-mode.md)，自定义 Provider 的字段、协议和实施记录见 [Custom Provider 设计](custom-provider.md)，发行与源码同步见 [发行记录](releases.md)。

## 1. 定位与兼容原则

- 官方 `dev` 是通用上游实现。`dev-my` 跟随官方 `dev`，在其上维护桌面发行、独立 Side bar、自定义 Provider 和尚未上游化的可靠性修复。
- 官方已有界面模式、项目/会话/权限模型和公开协议保持原语义。Side bar 是可选的第四种模式，不替换 Top tabs、Side tabs（`vertical`）或 Inbox。
- 新能力优先放在独立模块或 `experimental.*` 协议下，不复用官方稳定端点表达尚未上游化的界面需求。
- 桌面安装包使用独立身份和更新源，但后台渠道、数据库、服务和历史路径继续沿用官方约定，避免形成第二套运行时。
- 上游已合并的能力不再算作 fork 差异。例如模型未知发布日期修复（#60496）已随 2.3.0 进入官方实现，本 fork 只保留回归覆盖。

## 2. 差异总览

| 领域 | 官方 `dev@f0089856c0` | `dev-my` | 兼容与边界 |
| --- | --- | --- | --- |
| 界面模式 | Top tabs、Side tabs（`vertical`）、Inbox | 前三种保持官方行为，新增本地 Side bar（`sidebar`） | 不改变默认值，不把已有 `vertical` 自动迁移为 `sidebar` |
| 侧栏项目清单 | 展示当前客户端使用过的项目；Side tabs 只列已打开标签 | 仅 Side bar 展示服务器已知项目，增加置顶、整组收起、计数与 origin/upstream 提示 | 项目登记、路径和权限仍由官方 Project 模型决定 |
| 最近会话 | Home 的最近会话列表；Side tabs 不承载历史列表 | Side bar 增加按项目分组的 Recent sessions、每项目 5 条预览、整组收起与本地隐藏 | 隐藏只影响当前窗口列表，不删除会话 |
| 运行观察 | 打开标签/首页上的会话忙碌状态 | Side bar 增加独立 Running sessions，聚合模型执行、Shell、子智能体、图片和后台作业 | 新活动接口为 experimental；不改变模型执行所有权 |
| 自定义 Provider | 非内置 OpenAI Compatible 服务需手写 JSONC；内置 Ollama/LM Studio/vLLM 有官方发现 | 模型选择器内新增/编辑/删除全局自定义 Provider，保存 Key、主动发现、原生元数据、文本测试和类型化高级字段 | 只编辑当前服务端的全局 V2 定义；项目/托管/继承/V1 只读 |
| 模型管理 | 有模型可见性管理；模型目录来自 provider 与插件 | 保留可见性管理，并把 `Custom providers` 与 `Manage models` 并列为模型选择器底部入口 | 不再从模型选择器提供内置 Provider 连接入口，连接仍可从 Settings/命令面板进入 |
| 桌面发行 | 官方 `opencode` 身份与官方更新源 | `OpenCode My`、`ai.opencode.desktop.dev-my`、本仓库 Release 与固定 tag 更新源 | 后台渠道仍为 `dev`，服务和历史路径不变 |
| V1 升级 | 上游当前迁移入口 | 增加单向升级确认、清理批次提交与恢复、SQLite 错误分类、Layer 依赖诊断 | 相关上游 PR 未全部合并，本地发行保留有效实现 |
| 仓库信息 | 无 fork 专用界面 | VCS 返回 experimental remotes，Side bar 展示紧凑的 origin/upstream 提示 | 字段位于 `Vcs.Info.experimental`，不改变稳定分支信息 |

## 3. Side bar 独立模式

### 3.1 与官方 Side tabs 的产品差异

Side tabs 继续只显示已打开标签，是“标签的竖排布局”。Side bar 是“项目与任务导航”：

| 能力 | 官方 Side tabs | `dev-my` Side bar |
| --- | --- | --- |
| 导航内容 | 已打开标签 | Home、New session、Search sessions、Pinned projects、Recent sessions、Running sessions |
| 项目来源 | 不列项目历史 | 当前可见服务器的项目清单；仅此模式使用 `projects.visible()`，其他模式继续使用 `projects.used()` |
| 项目操作 | 无独立项目区 | 打开项目草稿、Pin/Unpin、整组收起、项目菜单、显示计数和远程提示 |
| 历史会话 | 不承载 | 按 Project/worktree 分组，默认每项目 5 条，可展开 More/Show less |
| 运行观察 | 只反映已打开标签自身状态 | 底部独立区域，跨可见服务器展示运行中的主会话、子会话和后台工作 |
| 默认值 | 官方设置决定 | 必须手动选择；升级不改变已有偏好 |

### 3.2 导航与项目清单

- 顺序固定为 Home → New session → Search sessions → Pinned projects → Recent sessions；Running sessions 始终位于底部。只有 Side bar 将 Search sessions 放在 New session 之后，并把最近关闭标签等官方入口保留在项目区上方。
- 普通项目按显示名称自然排序，不沿用服务端最近活跃顺序；置顶项目进入独立的 Pinned projects 区域，最多占项目/会话区域的 40%，该区域内部滚动，Recent sessions 使用剩余空间。
- 项目身份为“服务器 + 规范化项目路径”，同名跨服务器项目不会合并。置顶、收起、排序和隐藏分别持久化在窗口本地：
  - `sidebar.pinnedProjects`
  - `sidebar.collapsedProjects`
  - `sidebar.order`
  - `sidebar.hidden`
- 项目行提供新建草稿、Pin/Unpin 和现有官方项目菜单。计数区分“当前可见的最近会话数”和“项目历史总量”；后者来自轻量 ID/归属清单，不为计数加载完整会话。
- 只有 Side bar 为项目标题读取分支、工作树路径与 origin/upstream 提示；提示复用 VCS 缓存，不新增轮询或持久化。远程 URL 去掉协议、凭据、`.git` 和尾部斜杠后再展示。
- 整组收起后隐藏会话与 More，但保留标题、计数和新建入口；展开时保留原来的 5 条预览或 More 状态。新建项目草稿会先展开对应分组。

### 3.3 最近会话与 Running sessions

Recent sessions 与 Home 共享同一会话查询缓存和实时会话存储：

- 只列未归档的主会话，子智能体仍从父会话或 Running 进入。选择历史行时才按现有导航打开，不把全量历史复制进已打开标签集合。
- 默认按最近活动排序并稳定处理相同时间；显式排序继续生效。分组内拖拽不改变项目归属，键盘导航按实际展示顺序工作。
- 关闭标签或隐藏历史行都不删除会话；Home/搜索仍可找到，重新打开后恢复。真正删除仍走明确的删除操作。
- 查询按目录保留最近 64 条，再附加最近时间窗内的额外行；同时保留完整的轻量 inventory 以计算项目总数。分页读取每页 5,000 条，折页时只保留有界子集，避免把全部历史放进查询缓存。

Running sessions 的区域：

- 跨当前可见且已连接的服务器，显示模型执行、Shell、子智能体、图片和后台作业；包括尚未打开的主会话以及深层子会话。
- 展示工作/等待输入/等待批准状态、项目、目录分支和当前运行时长。行会按需同步会话、权限和表单状态；缺失的祖先元数据按需读取，不读取祖先 transcript。
- 区域独立滚动，高度上限为 `min(288px, 40dvh)`，空状态也保留。切换项目分组不改变其范围；根会话的标题/图标会聚合自身及已知 family 的活动。
- 客户端把官方 `session.active` 执行索引与新的 `experimental.session.activity` 观察快照合并；旧服务器没有新端点时仍保留执行索引，不把 404 当成会话失败。
- 服务端的 `SessionActivitySource` 只注册实时读取器，不存储工作、不控制执行；`SessionActivity.list()` 补充存在的祖先链。活动事件 `experimental.session.activity.changed` 只用于失效通知，消费者再从快照取事实。

### 3.4 设计取舍与实现

- 独立模式由 `packages/app/src/shell/sidebar/` 承载；官方 `tab-strip.tsx` 保持上游实现，避免把本地项目分组逻辑重新写回官方 Side tabs。
- Home 和 Side bar 的差异集中在项目来源选择与展示组件，不复制项目/会话缓存。`session-index.ts` 和 `session-queries.ts` 由 Home 与 Side bar 共用，删除、重命名、查看事件同时更新两边。
- 会话隐藏状态由 `shell/sidebar/visibility.ts` 维护；标签打开/选择会清除对应隐藏标记，关闭标签会写入隐藏标记，避免“关闭后又被历史列表自动打开”。
- 不新增数据库表或持久化会话列表；Side bar 的服务端数据仍是现有 Project、Session、VCS 和 Session Activity 读取结果。
- 主要实现文件：

| 路径 | 作用 |
| --- | --- |
| `packages/app/src/shell/sidebar/projects.tsx` | 项目分组、置顶、收起、排序、计数、项目菜单和远程提示 |
| `packages/app/src/shell/sidebar/session-row.tsx` | 历史会话行、分支/工作树/时长提示、隐藏与打开 |
| `packages/app/src/shell/sidebar/running.tsx` | Running 区域、状态、祖先和分支加载 |
| `packages/app/src/shell/sidebar/history.ts` | Home/Side bar 共用查询、inventory 和实时合并 |
| `packages/app/src/runtime/server/session-index.ts` | 有界索引、分页 inventory、稳定排序 |
| `packages/app/src/runtime/server/session-queries.ts` | 共享 Query 缓存及删除/重命名更新 |
| `packages/app/src/shell/titlebar/titlebar.tsx` | 第四种模式的挂载与导航顺序 |
| `packages/app/src/settings/general/interface-mode.tsx` | Side bar 设置入口和预览 |
| `packages/core/src/session/activity-source.ts`、`activity.ts` | 后台活动注册表、祖先补全 |
| `packages/schema/src/session-activity.ts`、`packages/protocol/src/groups/session.ts` | 活动数据结构与 experimental 端点 |

### 3.5 验证、限制与上游状态

- 已覆盖四模式切换、偏好恢复、项目分组/隐藏/排序、置顶与整组收起、深层子智能体忙碌、重载后的历史与 Running、RTL 标题和窄/宽布局。
- 2.3.0 同步轮次通过根检查 35/35、应用单元测试 2,723 项、核心作业/活动/执行/子会话测试 94 项，以及生产 Chromium 的 Home/标签/Side bar 回归 113 项；共享索引和排序用例另做重复回归。
- 非英语界面仍有部分 Side bar 词条使用英文回退；这是现有翻译评审流程的状态，不是缺失国际化机制。
- 不实现任意目录树、归档筛选、自定义标签/文件夹、Inbox 固定会话或项目过滤。性能记录是小样本，不作为通用性能保证。
- 上游贡献稿 [#60867](https://github.com/anomalyco/opencode/pull/60867) 保持 Draft，等待设计评审；远端 `sidebar-mode` 仅作 PR 来源引用，不再作为开发或发行分支。

## 4. 自定义 Provider 与模型管理

### 4.1 与官方行为的差异

官方 2.3.0 的模型选择器负责选择、连接内置 Provider 和管理模型可见性；非内置 OpenAI Compatible 服务仍要求用户编辑 `opencode.jsonc`。官方已有 Ollama/LM Studio/vLLM 的自动发现插件，但不是通用的自定义 Provider CRUD。

`dev-my` 在模型选择器底部提供两个等宽入口：

- `Custom providers`：新增、编辑、删除全局 OpenAI Compatible Provider，管理模型条目和凭据。
- `Manage models`：保留官方模型可见性管理。

两个对话框通过 `dialog.push` 压在模型选择器上方，关闭或点击 `Back to model selection` 只关闭上层，重新露出模型选择器而不是回到 composer。内置 Provider 的连接入口从模型选择器移除，改由 Settings → Providers 或命令面板进入，减少重复入口。

### 4.2 用户可见能力

- 新建/编辑 Provider：显示名、Provider ID、Base URL、可选 Key，以及至少一个聊天模型。Provider ID 创建后不可重命名。
- 模型字段：模型 key、请求 `modelID`、显示名、context/input/output 限额、tools/image 三态；支持类型化高级字段。
- 删除：Provider 需要二次确认，删除全局 JSONC 定义并清空该 integration 的已存凭据；V2 定义可编辑，V1 历史定义只读锁定但可删除；模型删除只删除全局定义，不删除底层服务模型文件。
- Key：写入现有 Credential 存储，不回显 secret；Key 的保存/替换是独立操作，配置模板或 env 提供的 Key 只显示来源。
- 发现：用户主动触发通用 `/models`、Ollama 原生或 LM Studio 原生读取；预览后勾选导入，默认不全选，不覆盖手填值。
- 测试：已保存模型可发起固定提示词的最小文本请求，验证地址、凭据和请求 modelID 能完成一次文本响应；不自动重试，不创建 Session，不改变当前选模。
- 高级字段：超时、编码、推理选项、兼容字段、价格和变体放在折叠区；headers/body 任意值仍通过源文件修改。

### 4.3 设计与安全边界

- 配置来源：服务端按真实优先级和原始 JSONC 枚举来源。只允许编辑当前服务端标准全局 `opencode.json`/`opencode.jsonc` 中唯一的 V2 定义；项目、托管、继承链、内置 Provider 和自动发现 Provider 只读。V1 `provider` 定义保持只读锁定，但允许从同一全局文件删除并以同一流程清理凭据。新建写入现有最高优先级全局文件，默认 `opencode.jsonc`。
- 写入：使用字段白名单 patch，从原始 JSONC 应用编辑，保留未编辑字段和注释；共享全局写入锁，服务端生成 revision，锁内重读并核对冲突；同目录临时文件成功落盘后 rename 替换。拒绝任意 `Schema.Json`、provider 根替换和模型/变体越权字段。
- 凭据：复用 `Credential` 和现有连接策略；稳定 credential ID 支持幂等重试；保存失败保留配置并返回部分成功，避免重复创建历史凭据。
- 发现：saved 与 draft 目标严格互斥。saved 复用已保存 URL/凭据/headers，draft 只用本次显式 Key，不把已保存 Key 发往草稿地址。只允许 http/https，拒绝内嵌凭据、link-local 和云元数据地址，保留 loopback/私网；默认不跟随重定向，5 秒超时、2 MiB 响应上限、最多 1,000 条。
- 原生元数据：Ollama 先 `/api/tags`，用户勾选后再读 `/api/ps` 和选中模型的 `/api/show`；只把唯一运行实例的 `context_length` 当当前 context，理论 `maxContext` 不写入配置。LM Studio 只保留 `type: "llm"`，按加载实例区分 context。未知能力保持未知，不伪造 `false`。
- 文本测试：固定短提示词、`max_tokens: 32`、`stream: false`，30 秒期限和 2 MiB 上限；只返回结果类别和 HTTP 状态，不回传生成文本或远端错误正文。成功不证明 tools、image、限额或高级参数可用。
- 目录刷新：2.3.0 的插件加载是异步的，保存返回 `catalog: "pending"` 是合法结果；客户端继续消费 `provider.updated`/`model.updated` 并有界回读，不等待插件激活。

### 4.4 API 与分层

| Method / Path | OpenAPI identifier | 作用 |
| --- | --- | --- |
| `GET /api/experimental/config/providers` | `experimental.config.providers.list` | 来源、只读理由、可编辑快照、Key 元数据 |
| `PATCH /api/experimental/config/providers/:providerID` | `experimental.config.providers.update` | `create` / `edit` / `delete` 与 typed patch |
| `POST /api/experimental/config/providers/discover` | `experimental.config.providers.discover` | saved/draft 模型发现 |
| `POST /api/experimental/config/providers/test` | `experimental.config.providers.test` | 已保存连接的最小文本测试 |

- Schema 位于 `packages/schema/src/custom-provider.ts` 和 `custom-provider-advanced.ts`；Core 负责来源读取、JSONC 编辑、发现、测试和编排；Server 负责协议映射与现有策略边界；App 使用生成 SDK。
- 公共协议变化后从 `packages/client` 运行 `bun run generate`，不手改生成客户端。
- 主要 UI 位于 `packages/app/src/providers/custom/`，模型选择器入口在 `select-dialog.tsx`，可见性管理在 `manage.tsx`。
- 服务端按 `ConfigWrite.lock` 与既有 shell writer 共用写入锁；配置读取、凭据和 provider 目录仍由官方 Core 服务提供。

### 4.5 验证、限制与上游状态

- 自定义 Provider 服务端测试 15/15、生产 Chromium 回归 10/10；覆盖配置/JSONC、凭据失败重试、发现、原生元数据、文本测试、高级字段、底部入口、返回导航、Provider 删除、V1 只读删除和模型删除。根检查 35/35，App/core/server 的 `typecheck:tsc` 通过。
- 尚未完成真实 llama.cpp、SGLang、LiteLLM、私有网关及真实 Ollama/LM Studio 的版本兼容、工具/图像推理人工验收。
- Provider ID 重命名、项目级写入、任意 headers/body 编辑不做；真实引擎兼容矩阵另立验证。
- 上游需求 [#33704](https://github.com/anomalyco/opencode/issues/33704) 仍 open，已在该 issue 记录实现范围评论；#57161、#57997、#59520 等仍未合并，不能把 Draft/机器人验证写成上游已交付。
- 2.3.0 已合并的 #60496（未知发布日期）、#63266（保存 Key 用于本地发现）、#63700（15 秒发现超时与端点隔离）、#63200/#56214/#63198（LM Studio 元数据）和 #62240（部分 limit 保留）属于官方行为，不再作为 fork 差异。

## 5. 其他维护差异

### 5.1 Home、项目缓存与 VCS 提示

- Home 与 Side bar 共用项目/会话缓存，避免两套 GUI 本地状态导致项目历史和计数不一致。
- 官方模式继续使用 `projects.used()`；只有 Side bar 使用 `projects.visible()`，不改变服务端项目发现和登记。
- VCS 新增 experimental remotes 读取，Side bar 用它显示 origin/upstream；地址压缩会移除凭据、协议和查询参数，保留端口与路径。该字段不进入稳定 VCS 契约。

### 5.2 桌面身份与发行

| 项目 | 官方桌面 | `dev-my` |
| --- | --- | --- |
| 产品名 | OpenCode | OpenCode My |
| appId | 官方身份 | `ai.opencode.desktop.dev-my` |
| 更新源 | 官方 feed | 本仓库对应 tag 的 GitHub Release |
| 后台渠道 | `dev` | `dev`（保持不变） |
| 服务/历史 | 官方 `service.json`、`opencode.db` | 相同路径与约定，避免形成第二套运行时 |
| 构建脚本 | 官方发布流水线 | `packages/desktop/script/release-my.ts` |
| 产物 | 官方签名/发布 | 未签名 NSIS、AppImage、deb，附 `latest*.yml`、`SHA256SUMS`、`build.json` |

- 自动更新 feed 固定在当前 tag；后续 fork 版本需要手动下载安装，不把官方更新源混入。
- Windows 只构建 x64；Linux 支持 x64/arm64，arm64 可在 Ubuntu 24.04 x64 上通过 QEMU/binfmt 交叉构建 CLI 并打包，原生 GUI 验收仍需 arm64 环境。
- 构建脚本会校验 Bun 版本、CLI 版本、模型目录、隔离服务发现、V1 升级确认和历史迁移冒烟，再生成安装包与校验清单。

### 5.3 V1 升级与可靠性补丁

- 单向 V1→V2 升级确认：升级前必须由用户明确确认；对应上游 #60084 已关闭且未合并。
- 迁移清理批次提交与恢复：按批次提交删除/清理，进程中断后可恢复；对应上游 #56929 仍 open。
- SQLite 错误分类：保留错误类别，避免把可恢复错误误判为数据库损坏。
- Layer 依赖诊断：校验节点依赖，尽早报告缺失服务，而不是在运行期出现难定位的失败。
- 这些补丁按分支需要保留；上游未合并、PR 关闭或机器人评论都不构成删除本地有效修复的理由。

### 5.4 本地化、RTL 与可访问性

- 模型选择器和自定义 Provider 弹框全部使用 `customProvider.*` 词条；简繁中文已补齐，其他语言沿用英文回退；只读原因也使用类型化词条，不直接显示内部 reason。
- Side bar 使用逻辑方向属性，标题对齐跟随布局方向，文字本身保留 `dir="auto"`；RTL 短标题不会落入关闭按钮渐隐区。
- 新词条按应用现有英文回退和独立翻译评审流程处理；非英语覆盖不完整时不伪造已完成翻译。
- 关闭标签、隐藏历史行和删除会话保持不同语义；键盘操作按实际展示顺序导航。

### 5.5 语言默认值

- 首次安装保存 `system: true`，启动时按 `navigator.languages` 解析系统语言并加载对应词典；系统语言变化时，跟随模式监听 `languagechange` 并切换到新语言。
- 在 Settings → General → Language 中手动选择具体语言后，保存 `system: false` 和所选 locale；后续系统语言变化不再覆盖该选择。
- 选择 `Follow system` 会重新打开系统跟随；旧版本已保存的 `{ locale }` 记录按手动选择处理，不会在升级时突然切换语言。

## 6. 兼容性与维护边界

- **官方模式不变**：Top tabs、Side tabs 和 Inbox 继续跟随上游；Side bar 是独立模式和独立组件。
- **稳定协议不变**：Side bar 本身不新增稳定端点；自定义 Provider、Session Activity 和 VCS remotes 均位于 `experimental.*`。公共协议变化按仓库要求重新生成客户端。
- **数据模型不变**：不重定义 Project、Session 或权限；不新增 Side bar 数据库表；本地偏好保存在窗口持久化中。
- **桌面运行时一致**：后台渠道仍为 `dev`，服务和历史路径沿用官方约定；fork 只改变桌面身份、更新源和打包产物。
- **维护分支**：`dev-my` 是桌面功能、文档和发行的唯一主线；`dev-my-models` 已完成合并，后续新功能直接进入 `dev-my`。`sidebar-mode` 只作为 #60867 的 PR 来源引用，不并行开发。
- **文档边界**：`docs/fork/` 和 `FORK.md` 不进入官方上游 PR；官方贡献从 `upstream/dev` 建短分支，保持品牌、发行脚本和无关补丁不混入。

## 7. 验证与待办

当前已验证：

- Windows x64 测试预发行 [v2.3.0-my.4](https://github.com/joe-ieta/opencode/releases/tag/v2.3.0-my.4) 已发布；安装包、`latest.yml`、`SHA256SUMS`、`build.json` 四个资产的服务端大小/SHA256 与本地一致，完整公开下载哈希一致，Latest 仍为 `v2.2.6-my.1`。
- 根目录 `bun run check` 35/35，lint 0 errors；App/core/server 的 `typecheck:tsc` 通过。
- 自定义 Provider 服务端 15/15、生产 Chromium 回归 10/10；覆盖入口、返回、V1 只读删除、Provider/模型删除、发现、文本测试和高级字段。
- 语言默认值：单元测试覆盖首次安装跟随系统、旧记录保持手动选择、系统跟随与手动替换；浏览器回归覆盖 `Follow system` 默认值、语言切换和词典加载失败。
- 2.3.0 同步轮次应用单元测试 2,723 项、核心相关测试 94 项、生产 Chromium Home/标签/Side bar 回归 113 项；Side bar 共享索引和排序用例有重复回归。
- 历史 Side bar 专项包含四模式、RTL、深层子智能体、重载恢复、Running 与项目整组收起；这些结果属于对应源码版本，不冒充新构建的二进制验收。

仍待完成：

- 真实 Ollama/LM Studio、llama.cpp、SGLang、LiteLLM、私有网关的版本兼容与工具/图像推理人工验收。
- Side bar 非英语翻译评审、原生 ARM64 GUI 验收，以及更多真实项目的排序/隐藏/大小规模回归。
- 上游 #60867 设计评审结果；在获得批准和明确授权前不转 Ready、不合并。
- 迁移补丁在上游的最终状态（#56929 open、#60084 closed）与本 fork 实现的持续对照。

## 8. 相关文档

- [Side bar 独立模式：设计、需求与上游贡献](sidebar-mode.md)
- [Custom Provider 设计与实施记录](custom-provider.md)
- [Custom Provider 源码评审记录](custom-provider-review.md)
- [dev-my 发行与源码同步记录](releases.md)
- [维护、同步、验证与发布](../maintenance.md)
- [上游 PR、Issue 与补丁跟踪](../upstream-prs.md)
- [发布环境与多架构构建](../KB/release-environment.md)
