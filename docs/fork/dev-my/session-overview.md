# 会话全貌显示优化方案（Session Overview）

状态：设计草案，未实现。本文只定义方案与边界，运行时代码、插件和测试另行提交。

日期：2026-11-02（Asia/Shanghai）

范围：V2 桌面/Web 会话时间线；TUI 作为对照说明，不在本次实现范围。

## 1. 结论

当前会话界面是“按消息追加的线性时间线”，由前端把消息推导成轮次（turn）、助手步骤（step）、内容分组（group）和虚拟化行（row）。它能很好地展示“正在发生什么”，但缺少三个俯瞰视图：

1. 目录：这次会话经过了哪些轮次，每轮做了什么；
2. 工作状态：目标、已完成/进行中、改了哪些文件、有哪些错误；
3. 全历史检索：当前搜索和 Context 面板只看已加载的消息窗口，不是完整会话。

推荐的加法不是重写主时间线，而是：

- 新增一个低风险的 `overview` 时间线预设；
- 新增一个只读的 Session Map 侧栏插件；
- 增加一个通用的消息定位 SDK 能力；
- 把“整轮折叠、minimap、粘性当前轮次”留到后续核心增强。

主时间线的消息顺序、投影规则、虚拟化、搜索、滚动、锚点、pending/revert 逻辑保持不变。所有新能力默认不启用，保持现有默认体验。

## 2. 背景：消息与界面目前如何组织

### 2.1 消息是追加式记录，turn 是推导结果

协议中的 `SessionMessage.Info` 是一个联合类型，主要包括：

- `user`：用户输入，含文本、附件、agent、skill 引用；
- `assistant`：一次模型步骤，含 agent、model、`content[]`、token 用量、快照、finish/error/retry、时间；
- `shell`：独立 shell 命令；
- `idle`：执行结束标记，带 `succeeded / failed / interrupted`；
- `compaction`：压缩检查点，含 summary、native provider window、token/cost；
- `synthetic / system / skill`：后台任务结果、指令更新、技能加载等通知；
- `agent-switched / model-switched / location-switched`：选择变更通知。

没有一条“turn”记录。`assistant` 也不是一轮，而是轮次中的一步。一轮由前端推导：

```text
user A ─ assistant step 1 ─ assistant step 2 ─ idle ─ user B ...
   └──────────────── 同一个 turn ────────────────┘
```

会话忙碌时 steer 进来的用户消息仍可能属于当前 turn，直到 `idle` 结束。旧会话没有 `idle` 标记时，前端退化为“下一条用户输入就是上一轮边界”。

相关代码：

- `packages/schema/src/session-message.ts`：消息联合类型；
- `packages/session-ui/src/timeline/projection.ts:242`：`constructSessionMessageRows` 的 turn 推导；
- `packages/util/src/session-turn.ts`：轮次时长、tokens/s 的辅助计算。

### 2.2 模型上下文和 UI 历史不是同一份数据

UI 时间线保留全部消息，压缩只是中间的一条 `compaction` 通知。模型读取历史时，则从最近一次已完成的压缩边界开始：摘要压缩带 summary 和最近保留文本，provider 原生压缩重放 `native.messages` 窗口。

因此长会话里“屏幕上还能看到的早期内容”和“模型当前还记得的内容”可能完全不同。当前界面只有一个压缩分隔条，没有明确提示“从这一条开始，模型上下文已经重新开始”。

相关代码：

- `packages/core/src/session/history.ts:27-53`：压缩边界与 native window；
- `packages/core/src/session/history.ts:192-264`：summary + recent text 的重建；
- `packages/core/src/session/compaction.ts:166-237`：压缩摘要模板，已包含 Objective、Requirements、Decisions、Work State、Next Move、Relevant Files、Important Context。

这份摘要本身就是一个现成的“会话工作检查点”，但目前埋在线性时间线里，且 `quiet` / `text-only` 预设会把已完成的压缩摘要隐藏。

### 2.3 客户端只保留一个消息窗口

每个会话在客户端 store 中保存一个 `SessionMessageInfo[]`，并维护向更早历史翻页的 cursor：

- 首次同步默认取最新 20 条；`compact` 预设下取 40 条；
- 向上滚动接近顶部时，每次再加载 20 条；
- 打开会话时最多补 3 页，用来补全页面边界处被截断的开头轮次；
- 打开的 tab 和最近 3 个会话保留 transcript，其余会话可能被 evict，重新打开时再加载。

相关代码：

- `packages/client/src/solid/data.ts:92`、`:1811-1924`：消息分页、同步、loadMore；
- `packages/app/src/session/timeline/model.ts:84-130`：补全 leading turn；
- `packages/app/src/runtime/server/runtime.tsx:239-257`：会话 transcript 保留策略。

因此，搜索、Context 面板、字数统计这类功能默认只覆盖已经加载到 store 的消息，不是整个会话。

### 2.4 其他叠加状态

- pending input：尚未投递的用户输入在 inbox 中，UI 会叠加到时间线尾部；steer 可能暂时显示在当前 turn 里，queue 则等当前工作结束；
- revert：UI 隐藏 revert 边界之后的消息；
- compaction queue：已 admit 但未开始的压缩显示为排队行；
- turn diff：一轮结束后，根据 assistant 的 `snapshot.files` 和 `session.diff` 显示这一轮改了哪些文件。

这些状态都在前端投影时合并，不改变底层消息记录。

### 2.5 界面投影

`packages/session-ui/src/timeline/projection.ts` 的流程大致是：

1. 遍历消息，把 `user / shell` 当作新 turn 的开始；
2. 后续 `assistant` 追加到当前 turn；
3. `idle` 结束当前 turn，并可能追加错误行或 turn diff；
4. `compaction / synthetic / system` 等通知挂在当前 turn 或作为 leading notice；
5. 根据当前是否 active、是否 pending，决定是否插入 `Activity`、`CompactionQueued`；
6. 应用 `TimelineDetail` 设置，隐藏或分组内容；
7. 生成扁平的 `TimelineRow[]`。

行类型包括 `TurnGap`、`UserMessage`、`Shell`、`Notice`、`TurnDivider`、`AssistantPart`、`Thinking`、`Error / Retry`、`CompactionQueued`、`TurnDiff`、`Activity`。

助手内容会再分组：

- `context`：相邻的 reasoning、commentary 文本、被设为 grouped 的工具调用；
- `read`：连续的读取/搜索类工具；
- `file`：编辑/写入/补丁类工具，按文件聚合；
- `part`：不进入分组的单个内容。

commentary 与 final answer 的区分规则是：最后一次工具调用之前的文本通常为 commentary，之后的文本为最终回答；OpenAI Responses 的 `native.phase` 可以覆盖位置规则。

用户消息有独立的视觉 run：连续多条用户消息在 agent/model 相同、都有文本、没有附件、且中间没有 agent/model/location/compaction 边界时合并，只有最后一条显示 meta 行。run 只是视觉分组，不代表同一个 turn。

用户消息折叠是实验性设置：超过 12 行时显示前 8 行，通过 Read more 展开，默认关闭。助手文本始终完整渲染，没有按消息折叠。

### 2.6 虚拟化、搜索与导航

桌面端主时间线使用 TanStack Virtual，只挂载视口附近的行和少量 overscan；每行绝对定位，按实际高度布局；每个会话缓存测量结果；靠近顶部时加载更早历史；离开底部后停止跟随新内容。

现有导航能力：

- `mod+f` 搜索已加载的用户/助手文本，不搜索工具输出和 reasoning；
- 匹配后滚动到对应 part，并展开被折叠的用户消息；
- 上一条/下一条用户消息命令；
- URL hash 锚点 `#message-<userMessageID>`，支持深链和自动加载更早页面；
- 侧栏 Context 面板显示统计、系统提示、raw messages；
- Session 导出通过 API 分页拉取完整消息，生成 JSON。

缺口是搜索不加载更多历史、Context raw messages 也只用当前窗口、没有整轮目录、没有 minimap、没有粘性当前轮次。

### 2.7 时间线显示预设

`TimelineDetail` 把内容分成 7 类：`shell`、`edit`、`thinking`、`subagents`、`notices`、`tools`、`commentary`。每类有三种 placement：`separate / grouped / hidden`，部分还有 `collapsed / expanded`。

现有预设：

- `everything`：全部展开；
- `detailed`：shell/edit 展开，thinking/notices/tools 分组；
- `compact`：默认，shell/edit/thinking/notices/tools 都分组；
- `quiet`：隐藏 shell/thinking/notices/tools，保留 edit 分组；
- `text-only`：除文本和 commentary 外几乎全部隐藏。

`quiet` 和 `text-only` 会把已完成的压缩摘要也隐藏，只保留失败的压缩。因此这些模式虽然变短，但会话最重要的检查点摘要也看不到。

相关代码：

- `packages/session-ui/src/timeline/detail.ts`；
- `packages/app/src/settings/timeline-detail.tsx`；
- `packages/session-ui/src/timeline/projection.ts:384-402`。

### 2.8 TUI 对照

TUI 使用另一套投影：`reduceSessionRows` 把消息拆成 `message / part / group / assistant-footer / turn-usage`；reasoning、exploration、instructions 按 `config.session.verbosity`（low/medium/high）分组；`session.timeline` 对话框列出用户消息；上一条/下一条消息通过锚点和消息边界计算。

TUI 插件可以通过 `sidebar.content`、`session.panel` 等槽位增加面板，现有 `sidebar.context` 是先例。若本方案主要在桌面端落地，TUI 保持现有行为，不共享实现。

## 3. 问题定义

| 问题 | 现有机制 | 缺口 |
| --- | --- | --- |
| 助手输出很长 | commentary 可隐藏，工具/思考可折叠 | 最终回答没有按消息折叠；默认仍全量渲染 |
| 用户输入很长 | experimental 用户消息折叠 | 默认关闭；附件、评论不可折叠 |
| 工具调用太多 | TimelineDetail 预设 | 只能降噪，不能给出跨轮次概览 |
| 历史太长 | 分页加载 | 搜索、Context 面板、统计只覆盖已加载窗口 |
| 不知道每轮做了什么 | turn diff（默认关闭，最多先列 5 个文件） | 没有轮次目录、没有工作台账 |
| 不知道当前目标/决策 | 压缩摘要模板已包含 | 摘要埋在线性时间线里，quiet/text-only 下还会隐藏 |
| 不知道模型还记得什么 | compaction 边界 | 没有“模型上下文从何处开始”的提示 |
| 定位困难 | 搜索、上一条/下一条、hash | 没有 outline / minimap / 粘性当前轮次 |
| 轮次概念不直观 | turn 是投影推导的 | 用户看到的是消息，不是“第 N 轮 / 共 M 轮” |

核心矛盾是：主时间线优化的是“读当前正在发生的内容”，而不是“俯瞰整个开发过程”。

## 4. 设计目标与非目标

### 4.1 目标

- G1：用户可以在一个侧栏内看到最近轮次的目录、检查点、文件改动和错误；
- G2：可以搜索轮次/最终回答/文件路径，并在需要时扩展到完整历史；
- G3：可以从目录定位回主时间线的对应轮次；
- G4：默认不改变现有时间线、默认预设和快捷键；
- G5：插件只读，不修改消息、不自动调用模型、不改变 pending/revert 语义；
- G6：完整历史索引按需加载，不把全量消息灌进主时间线 store；
- G7：失败隔离，插件异常不拖垮会话界面。

### 4.2 非目标

- 不修改 `SessionMessage` 协议或数据库结构；
- 不改变 turn 的定义、steer 语义、compaction 语义；
- 不重写主时间线投影或虚拟化；
- 不用插件替换主时间线，或往每条消息里注入额外内容；
- 不默认生成 AI 摘要；
- 不让第三方插件依赖应用内部 DOM、hash 或路由约定；
- 不在本次实现 TUI 的对应界面。

## 5. 方案比较

| 方案 | 改动范围 | 全貌价值 | 风险 | 建议 |
| --- | --- | --- | --- | --- |
| A. 使用现有 compact/quiet + turn diffs + 搜索 | 无 | 低到中 | 无 | 立即可用 |
| B. 新增 `overview` 时间线预设 | 小，只加预设和 i18n | 中高 | 低 | 第一批实现 |
| C. Session Map 侧栏插件 | 新插件，不改核心 | 高 | 中低 | 主方案 |
| D. 整轮折叠进主时间线 | 核心投影与虚拟化 | 高 | 中高 | 后续评估 |
| E. minimap / 粘性当前轮次 | 核心滚动与布局 | 中高 | 中 | 后续评估 |
| F. AI 自动 recap | 插件或服务 | 中 | 成本/隐私/幻觉 | 仅显式触发 |

推荐组合：**B + C + 一个很小的消息定位 SDK 能力**。D、E 留到用户确认需要“在主时间线内折叠/导航”后再做。

## 6. `overview` 时间线预设

### 6.1 行为

新增一个预设，建议放在 `timelinePresets` 末尾，避免改变现有 `timelinePresets[2]` 默认 `compact` 的下标：

```ts
{
  id: "overview",
  value: {
    shell: { placement: "hidden", details: "collapsed" },
    edit: { placement: "grouped", details: "collapsed" },
    thinking: { placement: "hidden", details: "collapsed" },
    subagents: { placement: "separate" },
    notices: { placement: "grouped" },
    tools: { placement: "hidden" },
    commentary: { placement: "hidden" },
  },
}
```

效果：

- 保留用户消息；
- 保留助手的最终回答（最后一次工具调用之后的文本）；
- 保留文件改动分组；
- 保留子代理/后台结果；
- 保留分组后的通知和压缩检查点；
- 隐藏中间分析、工具调用、shell 和思考。

这比 `text-only` 更接近“开发对话概览”，因为 `text-only` 仍保留 commentary，且会隐藏文件改动。`notices: grouped` 保证压缩摘要仍在。

### 6.2 边界

- 新预设不设为默认；
- 用户仍可切回 `everything` / `detailed` / `compact`；
- 不改变投影代码，只增加一个 `TimelineDetail` 值；
- 需要补 `settings.timeline.preset.overview` 与描述文案；
- 需要更新搜索目录或设置测试中可能存在的预设数量断言。

## 7. Session Map 侧栏插件

### 7.1 放置位置

- 作为 side region 的普通 tab，默认不打开；
- 通过命令面板或快捷键打开；
- 在 `session.header` 槽位增加图标按钮（`compact` 时只显示图标）；
- 窄屏使用 `mobile.kind: "drawer"` 或 `menu`；
- 不设置 pinned / fallback，避免默认占用时间线宽度；
- 不注入主时间线行。

插件 SDK 当前支持 `Panel`、`Slot`、`Command`、`MenuItem`、`ComposerPill`，以及 `ctx.sessions`、`ctx.screen`、`ServerRef.data`、`ServerRef.client`。

`SlotMap` 没有时间线行插槽，并且仓库规则明确要求“Never add work to timeline rows. The session header slot is the only timeline surface.”因此本方案不尝试往消息行里塞内容。

### 7.2 信息架构

```text
Session Map
────────────────────────────────────
[Checkpoint]  最近一次压缩摘要
  Objective / Work State / Next Move / Files
  （直接复用压缩摘要，不额外调用模型）

[Turn Index]
  #18  10:42  修复登录页        2m14s · 3 files · 1 error
  #17  10:31  运行测试          45s   · 14 tools
  #16  10:12  分析消息结构      3m    · read ×8
  ...
  [All] [Changes] [Errors] [Checkpoints] [Subagents]

[Work Ledger]
  Files touched: 12
  Commands/tests: ...
  Open TODOs: ...
```

每轮卡片建议包含：

- 轮次序号、用户 prompt 摘要、时间；
- 持续时长（`SessionTurn.duration`）；
- agent/model；
- assistant step 数；
- 工具调用数、读取/编辑/搜索等分类计数；
- 本轮改动的文件（`assistant.snapshot.files`）；
- 是否有 error / retry / interrupted；
- 是否有 compaction 边界；
- 是否包含 steer 输入；
- 是否属于 pending（尚未投递）。

过滤条件：全部、只看有文件改动、只看错误/重试、只看压缩检查点、只看子代理/后台任务。

排序：最新在前（回看）或最早在前（从头理解开发过程）。

### 7.3 数据推导

建议的 turn index 条目：

```ts
type TurnIndexEntry = {
  id: string
  executionID: string
  kind: "user" | "shell"
  steer: boolean
  created: number
  completed?: number
  agent?: string
  model?: ModelRef
  stepCount: number
  toolCount: number
  toolNames: Record<string, number>
  files: string[]
  errors: number
  interrupted: boolean
  compactionBefore?: string
  pending?: "queued" | "steer"
}
```

推导规则：

1. `user` / `shell` 开始一个新轮次；
2. 后续 `assistant` 追加到当前轮次，累计 step、tool、snapshot.files；
3. `idle` 关闭当前轮次，记录 outcome；
4. `compaction` 作为检查点边界，记录在下一轮 `compactionBefore`；
5. 没有 `idle` 的旧会话，用下一条 `user` / `shell` 作为上一轮边界；
6. pending 输入按 `delivery` 合并，queued 与 steer 分别标记；
7. revert 边界之后的消息不进入索引；
8. 只保留工具名和计数，不保留工具输出。

摘要字段：

- prompt：用户文本第一行，截断到固定长度，附件只显示数量；
- final answer：最后一条工具调用之后的文本 part，截断；
- files：`snapshot.files` 去重；需要 diff 时再通过 `session.diff` 按需加载；
- checkpoint：最近一次 completed compaction 的 summary；
- errors：assistant error/retry、failed idle、失败的压缩；
- subagents：`task` / `subagent` 工具或 `synthetic.source === "subagent"` 的通知。

### 7.4 快照模式与完整模式

快照模式：

- 直接读取 `session.server.data.session.message.list(session.id)`；
- 立即显示最近若干轮，不阻塞首屏；
- 只索引结构字段，不深度遍历工具输出；
- 适合打开面板就能看到最近工作。

完整模式：

- 用 `session.server.client.message.list({ sessionID, limit: 200, cursor, order })` 分页拉取；
- 在插件自己的缓存中建立 turn index；
- **不要调用 `data.session.message.loadMore` 把完整历史灌进主时间线 store**，否则主投影会对几千条消息做一次 O(n) 重建；
- 缓存按 `session.key` 保存，tab 关闭或 session evict 时清理；
- 先显示最近轮次，再后台补齐更早轮次；
- 支持取消和进度状态。

刷新策略：

- 新轮次结束（idle）、压缩完成、面板重新打开时刷新；
- 当前活跃轮次可以就地 patch，不必重建整个索引；
- 不在每个流式 token 上重排列表。

### 7.5 搜索

- 默认搜索 prompt、最终回答、工具名、文件路径；
- 不默认搜索完整工具输出，避免体积和敏感内容；
- 完整模式下列表可跨全部历史；
- 结果必须标明来自哪一轮，并支持点击定位；
- 搜索输入需要防抖，索引构建和过滤分离。

### 7.6 定位回主时间线

当前公开 SDK 没有 `revealMessage` / `scrollToMessage`。建议新增一个通用能力：

```ts
ctx.sessions.reveal(session, { messageID, partID? }): Promise<boolean>
```

宿主负责：

- 必要时切换或打开会话；
- 继续 loadMore 直到找到目标；
- 调用虚拟化器的 `revealMessage` / `revealPart`；
- 解除“跟随底部”；
- 返回是否找到。

设计约束：

- 只滚动，不修改消息、不自动发送；
- 是否同步 URL hash 由宿主决定，默认不写路由，避免插件跳转污染历史；
- 找不到目标时返回 false，插件显示“该轮次尚未加载”；
- 该 API 是加法，不改变现有时间线行为。

如果没有这个 API，插件 MVP 可以退化为“展示 + 复制锚点”，或者仅对用户消息使用内部 `#message-<id>` hash。后者不应成为第三方插件的长期依赖。

### 7.7 失败与空状态

- 插件渲染异常由宿主隔离，侧栏显示错误状态，不影响主时间线；
- 没有消息时显示空状态；
- 没有压缩检查点时只显示轮次目录，不伪造摘要；
- 完整历史加载失败时保留已加载轮次，并提供重试；
- 子代理会话显示自己的轮次；需要父会话时给出手动入口，不自动合并父子 transcript。

## 8. 后续核心增强（不在第一批）

### 8.1 整轮折叠

可以增加 `TurnSummary` 行，只对已完成且非 active 的 turn 生效，显示 prompt、最终回答摘要、文件数和错误数，点击展开。

需要处理：

- 新行类型的 `TimelineRow.key` 和 `sameFields`；
- 展开状态在虚拟化回收后保留；
- 搜索命中折叠 turn 时自动展开；
- hash 跳到某个 part 时展开包含它的 turn；
- turn diff、错误、压缩通知不能被错误折叠；
- 虚拟化高度测量和行复用。

风险明显高于 `overview` 预设，建议先验证用户是否真的需要主时间线内折叠。

### 8.2 minimap

在滚动条旁标记用户 prompt、错误、文件改动、压缩边界和当前视口。现有 `ScrollView` 有自定义 thumb，可以在核心层加 marker；插件不能直接画到时间线滚动条上。

### 8.3 粘性当前 prompt

阅读很长的助手回答时，把当前 turn 的用户 prompt 固定在顶部。需要和现有 header、搜索栏、composer overlay 协调，属于中等复杂度核心改动。

### 8.4 AI recap

可以显式提供“生成会话摘要”按钮，调用 `session.generate`，结果存入插件 store，并标注为模型生成。默认不自动运行，优先复用压缩检查点。

## 9. 性能与正确性

- 主时间线投影是 O(n) 的，完整历史不能直接灌入共享 store；
- 插件索引只保留结构字段和截断文本；
- 用粗粒度签名（消息 ID、类型、idle 数、compaction 数、pending ID、revert ID）驱动重建；
- 长列表使用虚拟化或分页；
- 只对展开的轮次渲染 Markdown；
- 完整历史加载使用 `AbortSignal`，切换会话后丢弃旧结果；
- 缓存按 `session.key` 清理，避免会话移动/重开时读旧对象；
- 不改变主时间线的行 key、锚点、滚动位置和 pin 状态；
- 新预设和插件都不自动改变用户当前选择。

## 10. 测试与验证计划

### 10.1 纯逻辑

- turn 索引：idle、steer、queued、legacy（无 idle）、compaction、revert、pending；
- 时长、step 数、工具计数、文件去重；
- 最终回答提取与 commentary 规则一致；
- 空会话、失败轮次、中断轮次。

### 10.2 组件

- Session Map 的渲染、过滤、排序、空状态、错误隔离；
- 窄屏 drawer；
- 键盘可达性和 RTL 布局；
- 插件关闭后不残留定时器/请求。

### 10.3 端到端

- 命令打开面板；
- 最近轮次显示；
- 点击定位到主时间线并解除 pin；
- 搜索命中并定位；
- 完整历史加载可取消；
- 现有时间线默认行为不变；
- `overview` 预设显示 prompt、final answer、文件分组、压缩检查点。

### 10.4 性能

- 记录当前生产基线；
- 对比打开面板、构建索引、完整历史加载、主时间线滚动；
- 大 session 下不能出现长时间主线程阻塞；
- 新预设不能造成投影或滚动明显退化。

## 11. 分阶段落地

1. 设计评审：确认 `overview` 预设、插件范围和定位 API；
2. Phase 1：新增 `overview` 预设与 i18n，不改默认；
3. Phase 2：Session Map 插件 MVP（当前窗口 + 检查点 + 过滤 + 命令/header 入口）；
4. Phase 3：完整历史索引与搜索；
5. Phase 4：`reveal` SDK 能力与精确跳转；
6. Phase 5：根据反馈评估整轮折叠、minimap、粘性 prompt。

每一阶段都可以独立回滚：预设不选即无效，插件禁用即消失，SDK 能力不调用即无影响。

## 12. 风险与待决问题

- 完整历史加载在主线程解析大量消息的成本，需要实测；
- Session Map 与现有 Context 面板职责重叠：建议 Context 保留诊断/raw 数据，Session Map 专注导航/概览；
- 压缩摘要可能过期或遗漏，需要显示生成时间，不能当成唯一事实来源；
- “最终回答”在中断轮次中可能不存在，卡片需要明确显示中断；
- 搜索工具输出可能带来隐私和性能问题，默认不纳入；
- 子代理会话是否合并到父会话目录，需要产品确认，默认不合并；
- `reveal` API 是否同步 URL hash，需要和现有深链行为统一；
- 新增预设会改变设置滑块的档位数量，需要检查相关测试和截图。

## 13. 验收标准

- 默认界面、默认预设、快捷键和滚动行为不变；
- 打开 Session Map 后，最近轮次和最新压缩检查点可见；
- 轮次卡片能显示 prompt、时长、step/工具计数、文件数、错误状态；
- 过滤和排序可用，空状态明确；
- 完整历史模式可取消，失败可重试，不影响主时间线；
- 点击轮次能定位到主时间线，且不会把用户锁在底部；
- `overview` 预设保留最终回答、文件分组、压缩检查点和错误；
- 插件异常只影响自身；
- 无额外模型调用、无消息写入、无 schema/API 破坏性变化。

## 14. 参考

- `packages/schema/src/session-message.ts`
- `packages/core/src/session/history.ts`
- `packages/core/src/session/compaction.ts`
- `packages/client/src/solid/data.ts`
- `packages/session-ui/src/timeline/projection.ts`
- `packages/session-ui/src/timeline/detail.ts`
- `packages/session-ui/src/message/message-content.tsx`
- `packages/app/src/session/timeline/virtualizer.tsx`
- `packages/app/src/session/timeline/search-controller.ts`
- `packages/app/src/session/use-session-hash-scroll.ts`
- `packages/plugin/src/gui/registries.ts`
- `packages/plugin/src/gui/host-apis.ts`
- `packages/gui-plugins/src/context/tab.tsx`
- `packages/gui-plugins/src/sources/renderer.tsx`
- `packages/tui/src/routes/session/rows.ts`
- `packages/tui/src/routes/session/dialog-timeline.tsx`
