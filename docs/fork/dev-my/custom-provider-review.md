# 自定义模型设计评审记录

> 2026-11-04；评审对象 `origin/dev-my-models@168ee33882`。
> 本记录描述设计缺口，不表示这些新接口已存在或线上存在对应漏洞。
> 修订建议已合入 [设计 v0.2](custom-provider.md)。2026-11-14，实现分支 `models-design-review` 已合并入 `dev-my-models` 并基于 V2 2.3.0 重验；本文保留当时的评审证据与范围，不再表示“待实施”。

## 结论

保留 V2 配置与凭据分离、运行时选择器入口和全局写入范围。原稿暂不适合直接编码：来源判定、鉴权绑定、patch 权限、凭据删除语义和发现数据含义需要先落清楚。

需求不是再造模型目录，而是让用户管理自己已声明的 endpoint 与模型，并看到哪些设置真正生效。将保存闭环作为 P0、手动发现作为 P1，有利于先交付最常见的本地/私有网关场景；原生引擎元数据可后续扩展。

## 分支与隔离

- 主工作区 `E:/ChatGPT/opencode` 开始时位于 `dev-my-models`，无未提交改动；用户所称 my-dev 对应的维护分支实际为 `dev-my`。
- `origin/dev-my` = `ce6f5362fdafd5dc9e16530375a6ef9ed5e21ad6`。
- `origin/dev-my-models` = `168ee33882d4ba597c5f1658a27e544d4db2eaa3`，仅在上述基线上增加设计和 README 链接。
- 从匹配的 `origin/dev-my-models` 新建临时分支 `models-design-review`，工作树为 `E:/ChatGPT/opencode/.cache/models-design-review`。
- 只 fetch origin 的 dev-my/dev-my-models 和 upstream/dev；未 merge、push、切换主工作区、删除分支/工作树或更改默认分支。origin/upstream 均保持指向约定的 GitHub 仓库。
- 核对时 upstream/dev = `55276f2108c8853f94cf16dc530e7754a6ce8318`。下表涉及的主要配置/凭据/选择器代码与评审分支一致，未把旧 V1 文档当作 V2 实现依据。

## 关键发现

优先级 P1 表示实现前应修正；P2 表示范围或体验优化，并非线上缺陷评级。

| 优先级 | 原稿位置与问题 | 源码/证据 | 修订 |
| --- | --- | --- | --- |
| P1 | §4.1/4.5 以“全局 + V2”决定可编辑，无法处理同 ID 多层覆盖；仅在不在配置时拒绝内置 ID | [Config 的来源顺序](../../../packages/core/src/config.ts)、[provider 顺序覆盖与 canonical](../../../packages/core/src/config/plugin/provider.ts) | 返回来源和只读原因；一期仅单一标准全局、非内置、无继承的兼容 provider 可编辑 |
| P1 | §4.2 接受任意 Schema.Json，可改 package、写入配置 Key；脱敏快照若整体提交也会破坏未回显字段 | [ConfigProvider.Info](../../../packages/schema/src/config/provider.ts)允许丰富 settings/models；完整验证不等于限制允许修改字段 | typed patch 白名单；原文上做叶子编辑，不回写脱敏对象；保留高级/未知字段 |
| P1 | §4.3 同时接受任意 baseURL 和 providerID，并自动复用该 ID 的凭据 | 原稿调用契约允许把旧 Key 发往新目标，是直接可构造的错误路径 | saved/draft 互斥；saved 由服务端解析地址；draft 必须显式提供临时 Key；不自动跟随重定向 |
| P1 | §4.3 将 max_input_tokens 当 context；§5.2 把未发现 Tools 写成 false | [Model schema 默认值](../../../packages/schema/src/model.ts)、[vLLM plugin 注释](../../../packages/core/src/plugin/provider/vllm.ts)明确工具解析依赖服务启动参数 | context/input/output 分开；能力 unknown 与 false 分开；显示实际 fallback 来源 |
| P1 | §4.4 等 integration 注册后才 Credential.create | [Credential.create](../../../packages/core/src/credential.ts)无注册前置；[CredentialHandler](../../../packages/server/src/handlers/credential.ts)校验全局连接策略 | 去掉注册轮询，仍复用策略检查；配置保存、Key 保存、目录刷新各自报告 |
| P1 | §4.4 将删除 active 凭据叫 Clear key，同时保留 inactive 历史 | [Credential.remove](../../../packages/core/src/credential.ts)会选取剩余凭据并激活；[Integration](../../../packages/core/src/integration.ts)还有 env 回退 | 改“删除此凭据”，明确回退行为；不宣称删除一条就断开连接 |
| P1 | §5.1 只有 provider 分组 Edit；全部模型隐藏/disabled/失败时分组可能不存在 | [模型选择器](../../../packages/app/src/providers/models/select-dialog.tsx)与 [#57997 review](https://github.com/anomalyco/opencode/pull/57997#discussion_r4344025056) | 增加来源于配置的管理列表及空态入口；不依赖运行目录完成去重 |
| P2 | §1.4/7 将引擎 hint 放 settings.engine 并改 AI adapter 剥离，称官方会忽略 | [toConfig](../../../packages/ai/src/providers/settings.ts)将其余字段放 providerOptions | 引擎仅作表单预设；不修改通用推理层；已有用户字段保留 |
| P2 | §4.5 声称叶子编辑后其他内容逐字节不变，写入失败自动回滚 | [Config.update](../../../packages/core/src/config.ts)使用 writeWithDirs/requestReload；[#57997 patch](https://github.com/anomalyco/opencode/pull/57997/files)对连续 modify 使用更新后的文本 | 缩小保真承诺到未编辑区域；原文/revision 检查；替换写入须实际验证 |
| P2 | §5.3 事件或 5 秒轮询即关闭，重试可能重复 Key | [#57997 review](https://github.com/anomalyco/opencode/pull/57997#discussion_r4344025050)与相邻重复凭据评论 | 区分 saved/pending/failed，复用已有 credential ID 处理同一操作重试，不增加队列 |

另外修正：三个端点被写成“两个”、PUT 搭配局部 patch 的语义、无依据的 `?location=/path`、列表返回全量 Info 的泄密面、模型 key 与 modelID 混同，以及原生发现不会自动过滤 embedding 的缺口。

## 上游需求与 PR 核查

以下为本轮读取时快照，Issue 的用户叙述与 bot review 不当作维护者已批准的规范。

| 来源 | 本轮证据与状态 | 对本案的影响 |
| --- | --- | --- |
| [Issue #33704](https://github.com/anomalyco/opencode/issues/33704)及评论 | open；请求编辑 URL/Key、增删模型、限额/模态，避免反复断开重连 | 需求是持续编辑，不只是新建；手动输入应一直可用 |
| [joe-ieta 的 Proposal](https://github.com/anomalyco/opencode/issues/33704#issuecomment-6515528622) | 已读取原文；包含预览、范围、刷新、可选发现和连接测试 | 明确本 fork 在入口和推理测试上的范围差异，不能声称全部覆盖 |
| [Issue #49091](https://github.com/anomalyco/opencode/issues/49091) | 搜索读取正文；请求 endpoint→Key→发现→保存的 TUI 流程，本轮未单独核验状态 | 复用服务端能力，但不把其混有旧字段的 JSON 示例当作 V2 schema |
| [Issue #50650](https://github.com/anomalyco/opencode/issues/50650) | 搜索读取正文；旧表单 mutation 恒失败 | 表单可见不等于功能完成，必须端到端验收真实保存 |
| [Issue #51527](https://github.com/anomalyco/opencode/issues/51527) | open；历史报告 custom ID 无 integration key method | 当前 Credential API 和配置注册已变化；历史问题不能推导“必须等待注册” |
| [Issue #59603](https://github.com/anomalyco/opencode/issues/59603) | open；2.2.0 找不到自定义入口 | 入口缺失属真实产品需求 |
| [PR #56877](https://github.com/anomalyco/opencode/pull/56877) | merged；向 beta 回移 #56106，并移除 custom 入口 | 证明移除事实；不从中推断官方永不支持自定义模型 |
| [PR #57997](https://github.com/anomalyco/opencode/pull/57997) | open、未合并；读取元数据、patch 和评论 | 可借鉴 JSONC/凭据分离；整条 provider 替换不满足本案无损编辑，bot 指出的轮询/重复 Key 值得处理 |
| [PR #59520](https://github.com/anomalyco/opencode/pull/59520) | open、未合并；元数据/正文已读，完整 patch 请求失败 | 运行时补全限额与本案交互式导入不同；不得把其缓存/后台轮询当已合并能力 |
| [PR #60546](https://github.com/anomalyco/opencode/pull/60546) | closed、未合并 | 文档澄清提案不是生效规范；以当前官方文档/源码为准 |
| [PR #60496](https://github.com/anomalyco/opencode/pull/60496) | 本轮 API 请求失败；本地历史含 `986221af34 ... (#60496)`，维护文档记录已吸收 | 保持未知发布日期可见的既有修复，不重做或取消显式隐藏 |
| [Issue #58122](https://github.com/anomalyco/opencode/issues/58122) | 搜索读取正文；希望自定义 URL 查询自己的库存 | 不冒用 openai 等内置 ID 获得错误目录；新建 ID 必须查冲突 |
| [Issue #61368](https://github.com/anomalyco/opencode/issues/61368)、[#59840](https://github.com/anomalyco/opencode/issues/59840)、[#60597](https://github.com/anomalyco/opencode/issues/60597) | 搜索读取报告；分别涉及目录可见性/初始化和内置覆盖，未复现 | 仅作验收场景和范围提醒；不将报告中的推测当已确认根因 |

原稿还引用 #57161、#57325：本轮直接请求失败，不续写未经核验的 open/merged 状态，也不依据其实现制定契约。没有新建 Issue、评论或 PR。

## 官方文档核对

- [OpenCode V2 Providers](https://opencode.ai/v2/docs/providers/)：确认 providers/package/settings.baseURL、模型覆盖与包相关设置。
- [OpenCode V2 Models](https://opencode.ai/v2/docs/models/)及仓库 `services/www/src/docs/content/models.mdx`：确认项目可用性、fallback、手动配置及本地自动发现；配置正确并不证明实际模型能力。
- [Ollama `/api/tags`](https://docs.ollama.com/api/tags)：库存字段不能充分说明上下文与工具能力；不能把它当通用 `/models` 响应解析。
- [LM Studio `/api/v1/models`](https://lmstudio.ai/docs/developer/rest/list)：字段 key/type 与 loaded_instances/context 等需要单独 adapter；理论上限与加载配置不同。
- vLLM 官方旧链接返回重定向，本轮不据该页做细节断言；实际 vLLM 行为依据本地官方插件源码及仓库模型文档。llama.cpp/SGLang 未逐个原生接口验证，因此不声称已完成六引擎兼容性验收。

## 本轮验证范围

这是设计评审与文档优化，没有修改运行时代码、公共协议或生成客户端，也没有连接用户的推理端点/背景服务。测试方案是后续实现的验收要求，不是已经通过的测试结果。文档链接、diff 检查和根检查的实际结果在交付时记录。

实际检查结果：

- `git diff --check`：通过。
- 两份设计/评审文档的相对文件链接：全部存在。
- 独立工作树根目录 `bun run check`：退出码 0；lint 为 0 errors / 1551 warnings，SDK 文档检查 0 problems；类型检查 35/35 成功，全部为共享工作树缓存命中，不表述为重新执行 35 个检查。
- 检查另提示无本地 turbo、使用全局同版本 2.10.2，以及既有 ast-grep unused-suppression；本轮未为纯文档改动安装依赖或修理无关代码。
- 主工作区仍干净，HEAD=`168ee33882`，本地 `dev-my`=`ce6f5362fd`；独立工作树仅修改本设计、此评审记录及 README。
- 未运行实际模型服务/GUI/接口测试，因为本轮没有实现新功能；没有生成客户端。
- 上述为 2026-11-04 评审当时状态；文档随后提交到 `models-design-review`，该分支已于 2026-11-14 合并入 `dev-my-models` 并删除。
