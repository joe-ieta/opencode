# dev-my 自定义 Provider（本地模型）设计 v0.2

> 状态：P0 手动管理、P1 主动发现和 P2 Ollama/LM Studio 原生元数据已在独立工作树实现并通过自动化验证；P2 高级字段、显式推理测试及真实引擎兼容矩阵仍待后续推进。
> 日期：2026-11-05（Asia/Shanghai）
> 原稿：`origin/dev-my-models@168ee33882`；维护基线：`origin/dev-my@ce6f5362fd`。
> 评审工作树：`.cache/models-design-review`，临时分支 `models-design-review`。
> 本轮核对 upstream/dev：`55276f2108`。详细发现、证据与验证范围见 [评审记录](custom-provider-review.md)。

## 1. 需求与范围

为运行中的模型选择器补齐自定义 OpenAI Compatible 服务的新增、编辑和模型导入能力。用户无需手写 JSONC 即可接入本机、局域网或私有网关；配置写到**当前连接的服务端**，Key 进入现有凭据存储。

原方案的核心方向保留：使用官方 V2 `providers` 格式、从模型选择器进入、不改 Settings → Models / Providers、不迁移 V1、不写项目级配置、不删除或重命名 provider。

用户真正需要的是“配置可保存、模型可见、请求可用、以后可编辑”的闭环。拉取列表只是辅助输入，不能证明模型能聊天、支持工具或给出了准确限额。[官方 Models 文档](https://opencode.ai/v2/docs/models/)说明模型选择取决于当前项目的 provider 可用性及启用状态；模型列表不是配置来源列表。

### 1.1 一期分层

| 优先级 | 范围 | 验收结果 |
| --- | --- | --- |
| P0 | 手动新增、编辑单一全局 V2 自定义 provider，模型增删改，Key 设置/替换，安全写入和刷新 | 不编辑文件即可保存、选用、重开后编辑；真实本地服务可完成 prompt |
| P1 | 用户主动调用通用 `/models`，预览后勾选导入 | 无发现接口、离线或鉴权失败仍可手动保存 |
| P2 | Ollama/LM Studio 原生元数据补充、更多高级字段、显式推理测试 | 原生元数据已实现并通过隔离测试；高级字段、显式推理和真实引擎验收待后续推进 |

P0/P1 均属于本需求，按闭环拆开交付。默认端口的 Ollama/LM Studio/vLLM 已有官方发现插件；不再为它们建立后台轮询系统。原稿将六种引擎适配、凭据历史管理与 UI 一次交付的 10–13 日估算缺少验证依据，取消硬性工期。

### 1.2 明确不做

- provider 删除/ID 重命名、V1 自动迁移、项目/托管/远程来源写入、TUI/CLI 表单。
- 编辑内置 provider 或 `canonical` 继承链、切换非 OpenAI Compatible package。
- 自动发推理请求、自动选中所有发现模型、自动清理历史凭据。
- 新建配置存储、浏览器持久化 Key、为引擎名称修改通用推理 adapter。

上游 [#33704 中已有 Proposal](https://github.com/anomalyco/opencode/issues/33704#issuecomment-6515528622)曾建议 Settings 入口及 Test connection。本 fork 选择模型选择器入口，并将推理测试留到 P2；这是范围取舍，不是上游已经批准的产品设计。

## 2. 评审基线与复用边界

| 已有能力 | 本案如何复用 |
| --- | --- |
| `ConfigProvider.Info` 的 package/settings/models、模型限额及能力覆盖 | 以 `packages/schema/src/config/provider.ts` 为字段事实来源 |
| `Config.entries()` 返回按优先级排序的归一化文档 | 读取原始来源识别 V1/V2；不把归一化对象写回文件 |
| `config.ts` 中 jsonc-parser、updateLock、requestReload | 提取最小共用写入边界；现有 `update()` 只支持 shell，不能声称已有 provider 写接口 |
| `Credential.create`、`Integration.connection.active/resolve` | Key 存储和有效连接解析；不另写鉴权优先级表 |
| `Credential.remove` 会在删除 active 后激活剩余凭据 | UI 明确显示替代凭据，不称为“Clear key” |
| `ConfigProviderPlugin` 已给配置 provider 注册 key 方法 | 保存 Key 不依赖等待该注册；目录刷新另行观察 |
| `select-dialog.tsx` / `provider-group.tsx` / `unpaid.tsx` | 入口和编辑按钮；另提供不依赖可见模型分组的管理列表 |

关键行为在评审基线与上述 upstream/dev 中一致：配置读取/写入、配置 provider 插件、凭据删除、provider 配置 schema、模型选择器目录。没有把上游未合并 PR 当成本地能力。

## 3. 用户流程

### 3.1 新建

1. 在模型选择器进入“Custom providers”，可新增或打开已有配置；无可用模型时也能进入。
2. 填显示名、Provider ID、Base URL、可选 Key，手动添加至少一个聊天模型。引擎预设只辅助填 URL，不写入 JSONC。
3. P1 可先拉取列表、勾选模型，再修正能力和限额；已填写字段不被发现结果覆盖。
4. 保存前显示目标服务器、Global 范围、目标文件及改动摘要，Key 仅显示“将设置/替换”。
5. 保存后分别显示配置写入、凭据保存、目录刷新状态；模型可选后提供“使用此模型”，不替用户改变现有会话的选择。

远程服务端的 `127.0.0.1` 指远程机器。表单应在地址附近说明“从当前服务器访问”，而非使用客户端是否桌面来推断地址含义。

### 3.2 编辑

- 分组旁的 Edit 是快捷入口；独立的配置列表保留被隐藏、禁用、没有可见模型或未加载成功的 provider，避免出错后无法修复。
- ID 创建后不可改。模型配置键与实际请求 `modelID` 分开显示，保留已有别名。
- 不把 `disabled` 改回 false，不覆盖用户手动隐藏状态，不自动重置选中模型。
- 删除模型条目仅删除该全局定义，不是注销或卸载服务端模型。存在其他来源/继承时一期只读，避免删除后从底层重新出现。
- 保存失败保留表单；关闭后清掉未保存的 Key，不进 localStorage、URL、日志或遥测。

### 3.3 表单字段

| 字段 | 规则 |
| --- | --- |
| Provider ID | 新建使用易读 slug；服务端用现有 ID schema 校验。既有 ID 不重新 slugify；全配置和目录查重 |
| Base URL | http/https，无内嵌凭据；默认提示 `/v1`，但不强制以它结尾，允许网关路径前缀 |
| Key | 空白表示保持不变；设置/替换是独立操作；配置模板或 env 提供的 Key 只展示来源 |
| 模型 key / modelID | 模型 key 是配置身份，modelID 是服务端请求名；含 `/` 的名字完整保留 |
| Context / Input limit / Output limit | 三个独立可选正整数。留空表示未设置覆盖；显示运行时 fallback，不能称其为检测结果 |
| Tools | 三态：继承/未验证、支持、不支持。新建默认不写覆盖；不把未发现误写为 false |
| 输入模态 | 新建建议显式 text；启用 image 需用户确认或有来源的发现元数据。编辑保留未展示模态 |
| 其他高级字段 | compatibility、settings、headers、body、cost、variants 原样保留；一期不提供任意 JSON 编辑器 |

当前 schema 对全新未知模型的 fallback 是 tools=true、text/image 输入、text 输出和 200k/32k 限额，见 `packages/schema/src/model.ts`。UI 必须标注这些是运行时假设。若用户选“不支持工具”，说明其无法完成依赖工具的代码任务；不据此改变官方模型过滤规则。

## 4. 配置来源与可编辑性

### 4.1 只读元数据

服务端按 `Config.entries()` 的真实优先级结合原始 JSONC 枚举来源，不用路径字符串前缀猜测。覆盖范围包括 standard global、显式文件、项目、托管、well-known、integration 和内联配置。未识别来源默认只读。

返回每个 ID 的：来源列表、目标文件展示信息、shape、editable、readonlyReason、可编辑字段快照、credential 元数据、有效值与目标值是否相同。**不返回整个 `ConfigProvider.Info`**：未知 settings、headers、body、模型/variant 层可能含 secret，按字段白名单投影更可控。

一期只允许编辑：

- 定义位于当前服务端标准全局 `opencode.json` 或 `opencode.jsonc`；
- 原始条目是 V2，且只有一个配置来源参与该 provider；
- 显式 package 为 `@opencode/ai/providers/openai-compatible`，无 canonical；
- 不是内置或自动发现 provider，即使全局文件存在同名 override；
- 模型没有不同 package/endpoint 等本表单不能准确描述的覆盖；
- 来源文本可解析且支持写入，管理策略允许该操作。

同 ID 多文件、V1/V2 同时存在、项目/托管叠加或继承链，一期显示只读原因并引导编辑源文件。此保守范围替代原稿“只要全局 V2 就可编辑”；不实现字段级跨来源编辑器。

新建只写全局候选文件中最高优先级已存在者（`opencode.jsonc` 高于 `opencode.json`），都不存在时创建 `opencode.jsonc`。已有条目写回唯一原始定义文件。客户端不提交任意磁盘路径；Location 参数仅决定预览/刷新视角，不授予项目配置写权限。

### 4.2 保存与 JSONC

- 使用明确的表单 patch schema，只允许 name、baseURL、模型 name/modelID/limit/受支持 capability 叶子和模型删除。新建时由服务端写固定 package。
- 未提供字段不变；受支持叶子的 null 表示移除覆盖；模型值 null 表示删除条目；provider 根、settings/models 整体 null 及数组/scalar 根拒绝。
- 不接受任意 `Schema.Json` 后只靠 Info 校验：它会允许修改 package、添加 settings.apiKey 或重写不属于表单的字段。
- 从原始 JSONC 对象应用 patch。Schema 只用于校验受改字段和合并后的有效配置，不以解码对象重序列化整个 provider；既有未知字段与未动字段保留。
- 解析错误、重复定义导致的歧义返回可定位错误，不从 `{}` 覆盖损坏文件。
- `jsonc-parser.modify` 每次针对上一步更新后的文本，再 `applyEdits`，避免多个编辑使用旧偏移。路径传数组，模型 ID 中的点和斜线不拆分。
- 保留未编辑区域。修改/删除节点附近的逗号、缩进、注释归属可能变化，不承诺所有非目标字节都恒等；用有代表性的 JSONC 样本验证。
- 保存带服务端生成的 revision，锁内重读并核对；外部修改后返回 409，提示重新加载，不覆盖手工改动。
- 所有此编辑器的写操作走同一全局写入服务并复用配置写入锁，不能在每个 Location 新建互不关联的锁。revision 针对目标原文和来源判定；不承诺对任意外部编辑器提供跨进程事务。
- 写入采用临时文件成功落盘后替换原文件；替换失败保持原文件。现有 `writeWithDirs` 不等于“写入失败必回滚”，实施时验证实际文件系统能力。

## 5. 凭据与保存结果

### 5.1 凭据存储

复用现有 `Credential`，`integrationID = providerID`，value 为 `{ type: "key", key }`。`Credential.create` 本身不要求 integration 注册，不需要原稿中的三秒轮询。

新编排接口仍需执行与 `CredentialHandler` 一致的全局 `integration.connect` 策略检查，不能因为直接调用 Core 而绕过。政策拒绝、只读来源、ID 冲突等在写配置之前检查。

现有 `settings.apiKey`（包括模板）原样保留，并使 Key 写操作只读；env、headers、模型层鉴权覆盖也显示来源和限制。不要把 env 名称存在等同于有效凭据，不要把“有任意历史凭据”当成“当前连接可用”。有效来源通过 `Integration.connection.active/resolve` 判定；源码还允许显式 headers 覆盖请求鉴权，发现与推理必须一致。

新编辑器的列表和保存响应只返回元数据，不调用现有 `credential.list` 给表单取数：该旧端点明确会返回 secret。这里的“不回显”承诺限定新接口，不宣称现有所有 API 都已脱敏。

### 5.2 保存时序与重试

1. 预检来源、revision、字段和策略；Key 是写入操作，发现不自动保存 Key。
2. 在配置写入锁内保存 JSONC，记录本次写入 revision。
3. 若明确设置/替换 Key，创建并激活凭据；未提供 Key 不改凭据。无需等待 integration 注册。
4. 请求并观察本次配置对应的重载，再刷新当前 Location 的 provider/model。优先使用服务端完成信号；兼容旧接口时才有界回读。
5. 返回配置、Key、目录三个阶段的状态，不返回笼统 connected=true。

重试使用稳定 credential ID（现有 CreateInput 支持 id）：同一保存操作重试时先核对该 ID 属于目标 integration，成功则复用，不再创建历史凭据；不同内容的明确替换使用新 ID。前端保持同一在途操作，避免重复提交。这是针对 #57997 已报告的普通重试问题，不增加持久任务队列。

配置已保存但 Key 失败：保留配置，返回部分成功及错误 kind；只重试凭据阶段。目录超时显示“已保存，刷新待完成”，不重写配置/Key，不把超时当作模型不可用。若网络中断无法确认结果，先重新读取状态，不盲目重复保存。

### 5.3 删除

保留逐个删除 active/inactive 凭据能力，但称“删除此凭据”。删除 active 后旧凭据可能被自动启用，全部删除后也可能回退到 env 或配置 Key；UI 展示该后果并刷新有效来源。没有“全部清空”或“断开 provider”语义，不修改既有凭据核心逻辑。

## 6. 模型发现（P1）

### 6.1 协议与元数据

仅由用户点击发起，通用路径为 `baseURL` 去除末尾斜线后追加 `/models`，保留反向代理路径前缀。例如 `https://gateway.example/team/v1` → `/team/v1/models`。不硬编码根 `/v1/models`，不支持在 baseURL query 中夹带 token。

优先解析 OpenAI 形状 `{ data: [{ id: ... }] }`；扩展形状须用相应 adapter schema，不能把任意 `models` 数组当成同一种结构。返回条目包含 modelID、可选 name、`limit.context/input/output`、可选 capabilities、每个元数据的来源及 warnings。

- `max_model_len` / 已确认语义的 `context_length` → context。
- `max_input_tokens` → input；**不等同 context**。
- `max_output_tokens` → output；模糊 `max_tokens` 不自动映射。
- 缺失工具/模态元数据 → unknown，不伪造 false 或 true；`supported_parameters` 出现 tools 只能算端点声明，不能证明服务器已启用工具解析。
- 过滤明确的 embedding/非聊天类型；类型未知可显示“未验证”候选，不自动全选。
- 手工值优先，发现只填未设置字段。正整数校验；声明互相矛盾时提示，不静默 clamp。
- 不写 releaseDate、cost 等猜测；不把运行时 200k/32k fallback 固化为用户覆盖。

原稿的 Ollama/LM Studio 回退移至 P2，因为原生 API 元数据并不同构：Ollama `/api/tags` 主要提供库存；LM Studio `/api/v1/models` 使用 key/display_name/type，还区分加载实例的 context_length 与模型最大值。Ollama/LM Studio 的能力读取可参考现有插件，但不能原样把“模型理论上限”当作“当前运行上限”。参见 [Ollama tags](https://docs.ollama.com/api/tags) 和 [LM Studio models](https://lmstudio.ai/docs/developer/rest/list)。

### 6.2 鉴权与请求边界

发现请求采用互斥形式：

- `saved`：providerID + revision；服务端从已核对配置解析 URL/连接/headers，客户端不能同时覆盖目标 URL。
- `draft`：baseURL + 可选本次显式 Key；不附带 providerID，不自动复用存储凭据。

修改 URL 后需要重新输入本次测试 Key；不能用旧 providerID 将 Key 发送到任意草稿地址。保存 URL 变更时显示有效凭据将用于新地址，由用户明确提交；已有隐藏鉴权覆盖则一期只读。

沿用原稿的请求限制并简化：只允许 http/https，拒绝内嵌凭据和 link-local/云元数据目标，保留 loopback/私网用于本地服务；实现与测试涵盖解析后的 IPv4/IPv6。默认**不跟随重定向**，让用户改填最终 URL，避免设计逐跳授权转发系统。该边界适用于当前有鉴权的服务端，不作为公共无鉴权代理发布。

5 秒为交互超时默认值，2 MB 响应上限，限制条目数，支持取消。错误区分 HTTP 鉴权失败、404/不支持发现、网络错误、超时、过大响应、非法 JSON/schema、空库存；保留 HTTP 状态码但不原样回显可能含 secret 的响应正文。失败不删除配置或清空已编辑模型。

## 7. API 与分层

新接口继续 experimental，建议三个端点（原稿误写“两个”）：

| Method / Path | OpenAPI identifier | 作用 |
| --- | --- | --- |
| GET `/api/experimental/config/providers` | `experimental.config.providers.list` | 来源、只读理由、编辑快照、Key 元数据 |
| PATCH `/api/experimental/config/providers/:providerID` | `experimental.config.providers.update` | typed patch + revision + 可选 Key 操作；新建/编辑明确区分 |
| POST `/api/experimental/config/providers/discover` | `experimental.config.providers.discover` | saved/draft 互斥发现 |

复用 `LocationQuery` 和 `locationQueryOpenApi`，不发明 `?location=/path` 参数；具体编码由生成 SDK 处理。新端点说明包含 `Experimental: may change without compatibility guarantees.`。SDK 应生成 `client.experimental.config.providers.*`，通过生成结果核验，不能只凭前缀测试认定命名完整正确。

更新响应建议表达三个阶段：`config: saved`，`credential: unchanged | saved | failed`，`catalog: ready | pending`，以及 providerID/revision/结构化错误。请求失败与部分成功明确区分。400 字段非法；409 来源/冲突/过期；策略错误遵循现有协议的 kind/状态，不随意声称现有 API 使用 403。

具体 Schema 定义放 Schema 或 Protocol 的恰当边界，不从 Core 导出到 Client。Core 拥有来源读取、文本编辑、发现与编排逻辑；Server handler 负责协议映射及现有策略边界。Client 只依赖 Schema/Protocol；App 使用生成 SDK。公共 API 变化后从 `packages/client` 运行 `bun run generate`。

不扩充通用 `Config.Patch` 的任意 provider 替换语义；复用底层配置写入设施。这样可保留上游 #57997 的架构思路，又满足本案编辑已有 JSONC、只读来源及最小回显的要求。

## 8. 配置示例与引擎预设

以下是假设用户已确认真实限制和工具支持后的示例，不是所有本地模型的默认值：

```jsonc
{
  "providers": {
    "local-vllm": {
      "name": "Local vLLM",
      "package": "@opencode/ai/providers/openai-compatible",
      "settings": { "baseURL": "http://127.0.0.1:8000/v1" },
      "models": {
        "coder": {
          "modelID": "Qwen/Qwen3-Coder-30B-A3B-Instruct",
          "name": "Local coder",
          "limit": { "context": 131072, "output": 16384 },
          "capabilities": { "tools": true, "input": ["text"], "output": ["text"] }
        }
      }
    }
  }
}
```

引擎预设可保留 llama.cpp 8080、vLLM 8000、SGLang 30000、LM Studio 1234、Ollama 11434 的 loopback URL 提示，均可修改；这些是预设，不是探测结果。编辑旧配置无需推断引擎名，一律显示 OpenAI Compatible。

不新增 `settings.engine`。现有 settings 的未知字段会进入 providerOptions，不能说官方客户端自动忽略；为 UI 徽标改动 `packages/ai` 得不偿失。用户原本手写该字段的配置仍按未知字段保留，不替用户删除。若未来必须跨客户端持久化引擎身份，再独立设计 experimental schema。

## 9. 验证与实施顺序

| 阶段 | 交付 | 必过验证 |
| --- | --- | --- |
| M0 | 本修订稿及证据审阅 | 明确一期只读范围、入口与 P0/P1 顺序；不称已批准 |
| M1 | Core 来源/typed patch/JSONC 写入，协议与 handler | 源文件归属、无损保留、冲突与策略；生成 SDK |
| M2 | 手动新建/编辑、Key、目录恢复入口 | 真正保存→可选→prompt→重开编辑；无 Key 的本地服务 |
| M3 | 手动 `/models` 导入 | URL 前缀、鉴权一致性、限额语义、错误恢复 |
| M4 | 移动端、i18n、已有设置回归和实机矩阵 | 四类状态：可见、隐藏、disabled、目录加载失败均可管理 |

最低测试矩阵：

- JSON/JSONC 单一全局、同 ID 双全局、项目覆盖、managed、integration、V1/V2 混合、未知/非法原文、内置 ID、canonical/模型 endpoint 覆盖。
- 多叶子同时编辑、模型 key 含 `/` 和点、未知字段/注释/模板/variants 保留、删除后不复活、revision 变化、写入失败原文不变。
- 无 Key、stored/env/config/header 来源、设置/替换/普通重试、部分成功、删除 active 回退、策略拒绝；新响应与日志无 secret。
- saved 发现不允许任意 URL；draft 不读取保存 Key；重定向、路径前缀、401/403/404、超时、大小、坏 JSON、空库存、未知能力、独立 input/context/output。
- 服务端保存与当前 Location 目录刷新；不同项目/第二客户端；共享全局写入；旧服务器无接口时隐藏入口并给出版本提示。
- 桌面/移动/空态/全部隐藏 provider；关闭表单清理临时 Key；Settings → Models / Providers 原行为不变；未知 releaseDate 可见而显式隐藏仍有效。

按仓库要求，实施测试前读取 `.opencode/skills` 中对应 unit/component/app-e2e 技能；测试从包目录运行。`bun run check` 是根目录规范检查，Protocol/HttpApi 改动后生成客户端并执行 experimental 标识符测试。

手工验收只在隔离测试服务中进行；本轮不连接、重启或修改用户正在运行的背景服务/配置/凭据。

## 10. P0 实施记录

实现位于 `.cache/models-design-review` 的 `models-design-review` 分支，基于 `dev-my-models@168ee33882`；主工作区及 `dev-my@ce6f5362fd` 保持原值。按用户指示在该临时分支提交，不推送。

- 桌面付费、免费和移动模型选择器均可打开配置管理列表；手动新增、编辑全局 OpenAI Compatible provider，不依赖运行时库存。模型 key 与请求 model ID、context/input/output 分开维护，工具和图片能力允许继承。
- 配置仅接受白名单叶子 patch，保留原有 JSONC 注释、body、variants 等字段。多来源、项目来源、内置覆盖及超出一期范围的配置只读；保留配置中的认证来源而不回传 secret。旧服务器缺少新接口时隐藏入口。
- 全局写入锁与既有 shell writer 共享，revision 冲突返回 409，配置使用临时文件替换。Key 单独写入现有 Credential 存储，明确配置保存、凭据失败和目录 pending 状态；稳定 ID 支持幂等重试，删除 active credential 沿用既有回退语义。
- 保存不自动切换当前模型；显式选用只提供当前可用且未隐藏的模型。新接口及默认行为位于 experimental 命名空间，客户端和 OpenAPI 均由生成脚本更新。
- `/models` 发现导入、引擎预设、外部真实服务兼容矩阵及独立的连接检测界面留待后续阶段。

验收已覆盖真实 HTTP 与文件、JSONC 保留、跨 Location 并发冲突、严格 patch、非法 URL、重复 JSON key、项目覆盖与配置认证只读、凭据轮换/回退、实际 SQLite 写入失败及重试幂等。通过本地模拟 OpenAI Compatible 端点完成实际文本生成，确认 `/nested/v1` 前缀、独立请求模型 ID 和存储的 Bearer key 被采用。

- 新增 API 用例连续重复 10 次，共 30 次通过；配置与策略关联回归共 6 项通过。
- experimental 标识符测试及 OpenAPI 同步检查通过；最终 `bun run check` 的 35 个任务全部通过；新增实现文件的 focused lint 为 0 warning / 0 error。
- 构建模式 UI 用 5 个 worker、关闭 retries 连续重复 10 次，共 30 次全部通过，覆盖手动新增、编辑、凭据失败重试、原选择保留、显式选模和移动入口。
- 额外执行的全量 `typecheck:e2e` 仍报告旧场景类型错误，包括 composer 旧 provider default fixture、timeline/review/settings 与 performance 场景；新增用例与夹具没有新增诊断。本轮未扩展到这些已有场景修复。

## 11. P1 实施记录

沿用同一独立工作树与临时分支，新增用户点击触发的 `POST /api/experimental/config/providers/discover`，不引入后台发现任务。请求体为 `{ target: { mode: "saved", providerID, revision } }` 或 `{ target: { mode: "draft", baseURL, key? } }`，位置参数仍使用生成 SDK 的 `location`。两种 target 严格互斥，不能借保存的 providerID 覆盖目标地址。

- saved 模式检查 revision、来源、全局连接政策及插件激活状态，再复用 Provider 与 Integration 的有效连接解析。支持 provider 级存储 Key、env/config Key 和显式 headers；模型/variant 专属鉴权或不支持的认证方式明确拒绝发现，继续保留手动输入。
- draft 模式只使用本次显式输入的 Key。修改 URL 会清除表单 Key 和过期发现结果，必须重新输入；不会把已保存的 Key 或 headers 发往草稿地址。
- 保留 URL 前缀后追加 `/models`；解析域名地址并禁止 link-local、IPv4-mapped link-local 和明确的云元数据地址，允许 loopback/私网。默认不跟随重定向；总发现超时 5 秒，响应上限 2 MiB，最多处理 1,000 条。错误返回类别和可用的 HTTP 状态码，不转发远端响应正文。
- 解析 OpenAI `{ data: [...] }`，ID 保留斜线和点。`max_model_len`、`max_input_tokens`、`max_output_tokens` 分别作为 context/input/output 的服务器声明，携带字段来源；非法限额省略，矛盾声明提示。缺失能力保持未验证，tools 参数声明不自动开启工具支持，`max_tokens` 和未确认语义的 `context_length` 不自动映射。
- 展示预览且默认不选中模型；只导入用户勾选项，按请求 ID 匹配已有别名，保留手填名称、限额和能力，只填空字段。导入停留在草稿，仍需单独保存。桌面和移动入口共用实现，支持取消和关闭清理。

协议核对依据：OpenAI 的 [List models](https://developers.openai.com/api/reference/resources/models/methods/list) 只保证基础模型信息；vLLM 当前 [show_available_models 源码](https://github.com/vllm-project/vllm/blob/main/vllm/entrypoints/openai/models/serving.py) 将服务配置的 `max_model_len` 写入基础模型条目。这里将其展示为服务器声明，不将列表结果称为聊天、工具或图像能力验证。

已完成验证：真实 API 与 P0 关联回归 8 项；构建模式桌面/移动首轮回归 5 项。最终发现 API 连续重复 10 次，20 次全部通过，包含真实 5 秒超时、认证 header 非法值脱敏；构建模式 UI 用 5 个 worker、关闭 retries 重复 10 次，30 次全部通过。最终 `bun run check` 的 35 个任务全部通过，experimental 标识符测试与 OpenAPI 同步检查通过。全量 `typecheck:e2e` 剩余 13 项旧诊断，已逐项对照确认新增用例与夹具没有新增诊断。

P1 验证均使用临时配置、内存数据库及隔离本地端点。该阶段未连接外部实际推理服务，未修改用户运行中的配置、凭据或服务；后续原生元数据实施见第 12 节，外部引擎兼容矩阵仍未验收。

## 12. P2 原生元数据实施记录

2026-11-05，沿用同一独立工作树和 `models-design-review` 分支。此次仅推进 Ollama、LM Studio 原生元数据及对应测试；高级字段和显式推理测试未纳入本次实现。主工作区及 `dev-my` 保持原值；该阶段修改按用户指示在临时分支提交，不推送。

发现请求在原有 `target` 外新增可选 `api: "openai" | "ollama" | "lmstudio"`，省略时仍使用通用 `/models`。Ollama 的可选 `metadata` 接受 1–20 个选中模型 ID；其他 API 不接受该参数。API 类型只控制本次发现，不写入配置，不新增 `settings.engine`，也不改变既有内置插件的发现行为。

- 原生 API 复用当前 saved/draft 的地址和鉴权边界，只移除 baseURL 路径末尾的一个 `/v1` 后追加原生路径，保留代理前缀；不接受额外目标地址。沿用 DNS/地址限制、不跟随重定向和整体 5 秒超时。所有子请求共用 2 MiB 响应预算，候选最多 1,000 条，Ollama 详情并发最多 4 个。
- Ollama 首次只调用 `/api/tags` 展示库存，不自动逐模型读取。用户勾选后显式读取 `/api/ps` 和选中模型的 `/api/show`；服务端先刷新库存确认 ID，不读取未选模型。非聊天能力模型在能力明确后过滤；旧版本缺失能力声明时保持未知，不能当作 `false`。可选详情或运行状态接口失败时保留库存并显示未知/警告；鉴权、重定向、超限及整体超时仍返回明确错误。
- Ollama 仅将 `/api/ps` 中唯一匹配的运行实例 `context_length` 作为当前 context。`model_info` 只按 `general.architecture` 读取对应架构的 `context_length`，作为单独的 `maxContext` 展示；不会用其他架构字段、理论上限或 `parameters` 中的 `num_ctx` 填充当前 context。未加载或实例上下文有歧义时保持未知。
- LM Studio 使用 `GET /api/v1/models`，只保留 `type: "llm"`。每个加载实例以其原始 `loaded_instances[].id` 和独立的 `config.context_length` 成为候选，不合并不同实例的上下文。未加载模型使用 `key`，当前 context 留空；`max_context_length` 只展示为模型理论上限，不导入为运行限额。缺失、非法或非正限额保持未知，工具/图像字段只采用原生 API 的明确布尔声明。
- 桌面和移动端共用发现 API 选择、预览及勾选导入。原生能力仅补齐“继承”字段，context 仅补齐空字段，保留手填名称、限额和明确能力值；`maxContext`、加载状态及 API 选择不写入 provider。取消或读取超时保留库存、选择和表单草稿；切换另一个 provider 后重置发现 API。

字段含义依据官方文档核对：[Ollama tags](https://docs.ollama.com/api/tags)、[show model details](https://docs.ollama.com/api-reference/show-model-details)、[running models](https://docs.ollama.com/api/ps) 及 [context length](https://docs.ollama.com/context-length)；[LM Studio models](https://lmstudio.ai/docs/developer/rest/list)、[load](https://lmstudio.ai/docs/developer/rest/load) 及 [OpenAI-compatible models](https://lmstudio.ai/docs/developer/openai-compat/models)。能力字段展示为服务声明，不表示已通过聊天、工具调用或图像推理验证。

已完成验证：

- 原生 API 与 P0/P1、配置和策略联合回归 11 项通过；原生 API 用例重复 10 轮，30 次通过，含真实 HTTP、5 秒超时、累计响应上限、路径前缀、鉴权、未知字段、实例隔离与理论上限不回填。
- 构建模式桌面/移动关联回归首轮 9 项通过；3 项原生交互用 5 个 worker、关闭 retries 重复 10 轮，30 次全部通过，覆盖取消、超时重试、手填值保留、API 重置及移动导入。
- `bun run check` 的 35 个任务全部通过；本次实现与测试的 focused lint 为 0 warning / 0 error。客户端和 OpenAPI 已按脚本生成，experimental 标识符与生成一致性检查通过。
- 全量 `typecheck:e2e` 仍有 13 项已有诊断，新增用例与夹具未新增诊断；没有扩展到已有 performance、timeline、review、settings 等场景修复。

以上协议和交互验证使用隔离本地 HTTP 端点、临时配置及测试数据库，未连接实际安装的 Ollama/LM Studio，未调用加载或推理 API，也未修改用户运行中的服务、配置或凭据。真实引擎版本兼容矩阵和推理验收仍需后续完成。
