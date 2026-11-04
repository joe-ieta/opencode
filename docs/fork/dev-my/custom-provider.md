# dev-my 自定义 Provider（本地模型）设计与一期改造方案

> 状态：设计评审稿（未开始编码）
> 分支：`dev-my-models`，基线 `dev-my@ce6f5362fd`
> 日期：2026-11-04

## 1. 需求定位

### 1.1 一句话定位

为 dev-my 桌面端补齐“**运行中模型选择器内的本地模型接入能力**”：用户可以在模型选择器中新建、发现、编辑 **OpenAI Compatible** 的本地推理引擎或私有网关，配置按官方 V2 标准写入服务端 JSONC，API Key 走凭据存储；不进入 Settings → Models / Providers。

### 1.2 背景与问题

- 官方 V2 已支持本地模型：Ollama / LM Studio / vLLM 默认端口自动发现；其他 OpenAI 兼容服务通过 `providers.<id>` 配置手动声明（`services/www/src/docs/content/models.mdx` §Local）。
- 官方桌面端在 2.2.0 移除了 Custom Provider 表单（#56877）；当前 2.2.5 只能手工编辑 `opencode.json[c]`。相关诉求长期未落地：#33704（GUI 编辑自定义 provider）、#49091（TUI `/connect` 注册流程）、#50650（旧表单保存恒失败）、#57325（旧表单无 limits/discovery）、#59603（入口消失）。
- dev-my 用户实际运行 llama.cpp、vLLM、SGLang、LM Studio、Ollama 或私有 OpenAI 兼容网关；需要：
  - 不手写 JSONC 即可接入；
  - 自动拉取 `/models` 并选择模型；
  - 配置 API Key（不落明文配置）；
  - 编辑已有自定义模型的 baseURL、模型、context/output、工具能力。
- 目前这部分能力缺失，且 V1 `provider` 旧格式与项目级配置存在误改风险，需要明确只读边界。

### 1.3 目标用户与核心场景

| 用户 | 场景 |
|---|---|
| 本地开发者 | 在本机/局域网运行 llama.cpp、vLLM、SGLang、LM Studio、Ollama，希望从模型选择器直接新增并选用 |
| 私有网关用户 | 使用公司/自建的 OpenAI 兼容网关，需要 URL + API Key，且 Key 不能写入 JSONC |
| 已有 JSONC 用户 | 已有 `providers.<id>` 自定义模型，希望 UI 编辑 baseURL、模型列表、limits、工具能力 |
| V1 历史用户 | 配置仍是 V1 `provider.<id>` 或位于项目级 JSONC，要求可见但不可被 UI 改写 |

### 1.4 一期目标（Must）

- **G1 新建**：模型选择器内新增 Custom Provider，写入官方 V2 `providers.<id>`。
- **G2 编辑**：编辑全局 JSONC 中已有的 V2 自定义 provider 与其模型条目，保留注释与未知字段。
- **G3 API Key**：表单支持设置/替换凭据，并提供用户主动删除 active/inactive 凭据的能力；Key 存入服务端凭据存储，不写入 JSONC；读取接口不返回明文。
- **G4 模型发现**：通过服务端请求 `{baseURL}/models` 拉取模型，解析 context/output/capabilities（尽力而为），用户勾选导入。
- **G5 推理引擎标识**：表单可选择 `llama.cpp` / `vLLM` / `SGLang` / `LM Studio` / `Ollama` / `OpenAI Compatible`，作为非官方 hint 写入 `settings.engine`（不替代任何官方字段），用于默认地址提示、徽标与发现回退；运行态剥离该字段，始终按 OpenAI Compatible 处理。
- **G6 只读边界**：V1 `provider.<id>`、项目级/托管配置只读，不提供编辑入口；服务端写接口对只读目标返回 409。
- **G7 热更新**：保存后无需重启，服务端配置热重载，模型选择器刷新即可使用。
- **G8 设置页隔离**：不修改 Settings → Models / Providers 及其共享行为。

### 1.5 非目标（Out of scope）

- **不支持删除 provider**：provider 固定为 OpenAI Compatible，一期不提供删除；模型条目可增删改。
- 不支持 V1 `provider` 格式的编辑或自动迁移（只读）。
- 不支持项目级配置写入（一期仅全局；项目级只读）。
- 不修改 Settings → Models / Providers 页面与现有连接流程。
- 不做 TUI / CLI 配置 UI（服务端 API 保留复用能力）。
- 不支持非 OpenAI Compatible 的 provider package（Anthropic/Bedrock/Vertex 等）。
- 不改造官方 Ollama / LM Studio / vLLM 自动发现逻辑。
- 不做模型连通性/推理质量测试；发现只验证 `/models` 可访问。
- 不引入 provider 删除、ID 重命名；不做多账号切换 UI，但提供用户主动删除 active/inactive 凭据的能力。

### 1.6 约束与原则

1. **配置遵循官方标准**：只写 `providers.<id>`，`package` 固定 `@opencode/ai/providers/openai-compatible`，`settings.baseURL`，`models` 使用官方 `ConfigProvider.ModelConfig` 字段。
2. **Key 不进 JSONC**：通过 `Credential` / `Integration` 存储；配置中已有的 `settings.apiKey` 保留但只读展示。
3. **引擎 hint 不替代官方字段**：写入 `settings.engine`（官方 settings 允许的扩展键），运行态剥离；所有官方 provider/model 字段原样保留。
4. **全局配置优先**：一期只写全局最高优先级文件；现有 provider 写回其定义所在的全局文件；项目级/托管/V1 一律只读。
5. **保留用户内容**：JSONC 注释、未修改字段、未知 `settings`/模型字段必须保留；编辑采用叶子级 diff。
6. **不重启桌面端/服务端**：依赖 `config.updated` 与 provider 重载；表单等待有界刷新。
7. **不碰设置页**：只在运行时模型选择器及其新对话框内实现。
8. **可回滚**：写入失败不破坏现有配置；Key 保存失败允许重试，不回滚已保存的 provider。
9. **文案规范**：仅新增英文源文案，其他语言留空走 fallback。

### 1.7 成功标准（验收）

- 全新桌面端：不编辑文件，即可新增一个本地 provider（含多个模型）并成功发起 prompt。
- 输入 baseURL + Key 后点击“拉取模型”，能列出并导入模型；401/连接失败有明确提示。
- Key 保存后不出现在 JSONC 中；读取接口不返回明文；重启后仍可用。
- 已有 V2 全局 JSONC（含注释、未知字段）编辑后：目标字段更新，其余内容逐字节保留（除目标叶子）。
- V1 / 项目级 provider：可见但无编辑入口；直接调用写接口返回 409。
- Settings → Models / Providers 行为无变化；现有桌面端测试通过。

## 2. 上游参考与现状

| 参考 | 状态 | 与本案关系 |
|---|---|---|
| #33704 GUI 编辑自定义 provider | open | 需求同源；本期只做运行时选择器入口，不做设置页 |
| #49091 TUI `/connect` 自定义注册 | open | TUI 侧同类需求；本期不做，服务端 API 可复用 |
| #50650 旧桌面表单保存失败 | open | 旧实现教训：必须有服务端配置写入能力 |
| #57997 恢复桌面表单 | open | 可参考其 `Config.Patch`/凭据思路；本期采用独立 experimental API，避免改动 `config.update` |
| #56877 移除桌面自定义表单 | merged (2.2.0) | 当前无 UI 的直接原因 |
| #57161/#59520 模型/限额发现 | open | 本期在服务端自研 `/models` 发现，后续可合并 |
| #51527 custom provider 凭据路径 | open | 本期必须解决 Key 存储 |
| #60496 未知 releaseDate 可见 | merged | dev-my 已包含；自定义模型默认不会被 6 个月过滤器隐藏 |

当前代码事实：

- 桌面端无自定义 provider 表单、无 baseURL 输入；`packages/app/src` 内无 `baseURL/ollama/lmstudio/vllm` 引用。
- 模型选择器已有可扩展点：`select-dialog.tsx` 搜索框 trailing 按钮、provider 分组 header、移动端 action 区；`provider-group.tsx` 已有 `action` 插槽。
- 服务端已有 JSONC 写入基础：`packages/core/src/config.ts` 使用 `jsonc-parser`、`applyEdits`、`updateLock`、`requestReload`。
- `GET /api/config` 返回的 `Config.Document.info` 是**归一化后**的配置（V1 会被迁移到 `providers`），无法在客户端可靠区分 V1/V2，因此需要服务端提供只读元数据。

## 3. 总体方案

```
模型选择器（DialogSelectModel / Mobile Drawer / Unpaid）
  ├─ “Add custom provider” 入口
  ├─ 可编辑 provider 分组 header 的 “Edit”
  └─ DialogCustomProvider（新建 / 编辑）
        ├─ GET  /api/experimental/config/providers
        │      → 列表 + scope/shape/editable + Key 元数据 + provider 快照
        ├─ POST /api/experimental/config/providers/discover
        │      → GET {baseURL}/models（服务端代理，支持 Key）
        └─ PUT  /api/experimental/config/providers/:id
               → JSON Merge Patch（null 删除字段/模型）
               → 写入官方 providers.<id>
               → 凭据存储 Key
               → 热重载 → 刷新模型选择器
```

设计原则：

- **读写分离**：列表接口返回只读元数据与脱敏快照；写接口只接受 provider 子树补丁。
- **配置与凭据分离**：JSONC 只保存 provider/model；Key 只存凭据。
- **服务端解析原始 JSONC**：V1/V2、全局/项目级由服务端判定，客户端不猜测路径。
- **运行时选择器是唯一入口**：不触碰设置页。

## 4. 服务端设计

### 4.1 列表接口

`GET /api/experimental/config/providers?location=...`

```ts
{
  providers: Array<{
    id: string
    scope: "global" | "project" | "managed"
    shape: "v2" | "v1"
    editable: boolean                 // scope === "global" && shape === "v2"
    key: {
      configured: boolean
      sources: Array<"credential" | "env" | "config">
      credentials: Array<{ id: string; label: string; active: boolean }>  // 仅元数据，无 secret
    }
    provider: ConfigProvider.Info     // 脱敏：移除 settings.apiKey 的值
  }>
}
```

实现要点：

- 枚举 `Config.Service.entries()` 的本地文档；对每个文档读取原始 JSONC 文本，分别检测 `providers` 与 `provider` 键。
- `scope`：路径在全局配置目录下 → `global`；项目目录下 → `project`；well-known/managed → `managed`。
- `shape`：存在 `providers.<id>` → `v2`；仅存在 `provider.<id>` → `v1`；两者同时存在时以 V2 为准并记录告警。
- `editable`：仅全局 + V2；V1、项目级、托管一律 `false`。
- `key.sources`：
  - `credential`：`Credential.Service.list(id)` 中存在 key/oauth 凭据；
  - `env`：`provider.env` 列出的环境变量在服务端进程中存在；
  - `config`：原始 provider 的 `settings.apiKey` 非空。
- `key.credentials` 返回该 provider 的凭据元数据（`id/label/active`），供用户主动删除；**绝不返回值**。
- 返回的 `provider` 必须移除 `settings.apiKey` 的实际值（保留字段存在性），避免明文泄露；`headers` 中疑似鉴权的值也不回显（或整体脱敏）。

### 4.2 保存接口

`PUT /api/experimental/config/providers/:providerID`

```ts
{
  patch: Schema.Json               // RFC 7386 JSON Merge Patch，仅作用于 providers.<id>
  apiKey?: string                  // 写操作：设置/替换凭据；不回显
}
```

响应：

```ts
{
  saved: true
  key: "saved" | "skipped" | "failed" | "config-readonly"
  reloaded: boolean
}
```

语义：

- `patch` 为 JSON Merge Patch：对象递归合并；`null` 删除字段；`patch: null` 不允许（一期不支持删除 provider）。
- 凭据删除不并入保存请求：客户端通过现有 `DELETE /api/credential/:credentialID` 主动删除（见 4.4）。
- 模型删除：`patch.models["<id>"] = null`。
- 服务端先用 `ConfigProvider.Info` 校验合并结果；非法字段/类型 → 400。
- Provider ID：创建后不可改；写接口不接受 ID 变更。

### 4.3 模型发现接口

`POST /api/experimental/config/providers/discover`

```ts
{
  baseURL: string
  apiKey?: string                 // 显式传入时优先（只用于本次请求，不落盘）
  providerID?: string             // 用于复用已保存凭据/配置 Key
  engine?: "llamacpp" | "vllm" | "sglang" | "lmstudio" | "ollama" | "openai-compatible"
}
```

响应：

```ts
{
  models: Array<{
    id: string
    name?: string
    context?: number
    output?: number
    input?: Array<"text" | "image" | "audio" | "video" | "pdf">
    tools?: boolean
  }>
}
```

实现要点：

- 所有引擎统一按 OpenAI Compatible 访问；发现路径：
  - 通用：`{baseURL}/models`（`baseURL` 约定以 `/v1` 结尾）；
  - 回退：`ollama` 可尝试 `/api/tags`；`lmstudio` 可尝试 `/api/v1/models`；
  - `llamacpp` / `vllm` / `sglang`：`/v1/models`。
- 解析兼容 `{ data: [...] }`、`{ models: [...] }` 与裸数组；字段尽力解析：
  - `max_model_len`、`context_length`、`max_context_length`、`max_input_tokens` → context；
  - `max_output_tokens`、`max_tokens` → output；
  - `supported_parameters` 含 `tools` → tools=true；
  - `architecture.input_modalities` / `input_modalities` → input。
- 鉴权优先级：显式 `apiKey` > 已保存凭据 > `settings.apiKey` > `provider.env`。
- 安全与限制：
  - 仅允许 `http/https`；拒绝 URL 内嵌凭据；
  - 拒绝 link-local / 元数据地址（如 `169.254.169.254`）；允许 loopback 与私网（本地推理必需）；
  - 超时 5s；响应上限 2MB；重定向最多 2 次且逐跳校验；错误分类为 401/403/连接失败/超时。
- 不返回任何 Key；不写日志明文。

### 4.4 API Key 设计

**存储**

- 使用 `Credential`：`integrationID = provider.id`，`value = { type: "key", key }`，`activate: true`。
- Key 不写入 JSONC；`settings.apiKey` 若已存在则原样保留，表单只读展示“由配置文件提供”。
- 读取接口返回 `key.sources` 与凭据元数据（`id/label/active`），不返回任何 secret。

**保存时序**

1. 校验 patch 与 ID。
2. 写入 JSONC（provider/model）并触发重载。
3. 若提供 `apiKey`：
   - 等待 integration 注册（`ConfigProviderPlugin` 会为配置 provider 注册 key 方法；有界轮询 ≤3s）；
   - `Credential.Service.create({ integrationID, value: key, activate: true })`；
   - 替换场景：新凭据激活后，旧凭据保留为 inactive，由用户主动删除。
4. 返回 `key: saved/skipped/failed`；Key 失败不回滚配置，UI 提示可重试。

**用户主动删除**

- 表单展示 `key.credentials`：active 凭据与 inactive 历史凭据（仅 label/active）。
- “Clear key”：删除 active key 凭据（`DELETE /api/credential/:credentialID`），provider 保留。
- “Remove inactive”：逐个删除 inactive 凭据；删除后刷新 `key.credentials`。
- 删除仅限 `credential` 来源；`settings.apiKey` 与 env 来源不提供 UI 删除。
- 不提供 provider 删除。

**只读与冲突**

- 已存在 `settings.apiKey` 时，`apiKey` 返回 409 `config-key`；UI 禁用 Key 编辑。
- `integration.connect` 策略拒绝时返回 400/403。
- 凭据创建失败但配置已写入：`200` + `key: "failed"`（部分成功），UI 需明确提示。

### 4.5 配置写入规则

**目标文件解析**

1. 全局文档中已定义 `providers.<id>` → 写该文档（最高优先级定义处）。
2. 仅存在 `provider.<id>`（V1）→ `409 legacy-provider`。
3. 仅存在于项目/托管文档 → `409 project-scope`。
4. 新 ID → 写全局写入目标：最后一个已存在的全局 `opencode.json`/`opencode.jsonc`，否则创建 `opencode.jsonc`。
5. ID 与内置 provider（models.dev / 本地发现）冲突且不在配置中 → `409 built-in-provider`。

**JSONC 编辑算法**

- 读取目标文件原始文本，`jsonc-parser` 解析原始 provider 对象。
- 应用 Merge Patch 得到目标对象。
- 递归 diff 原始对象与目标对象，生成叶子级 `modify` 编辑：
  - 只修改变化/新增/删除的路径；
  - 未触碰的注释、空行、未知字段保持不变；
  - 被删除的叶子所在注释会随叶子移除（不可避免）。
- `applyEdits` + `writeWithDirs` + `requestReload`；沿用 `updateLock` 串行化。
- 编辑时保留：
  - provider 级 `headers`、`body`、`compatibility`、`env`、未知 `settings` 键；
  - 模型级 `cost`、`variants`、`compatibility`、`settings`、未知字段；
  - 已有 `settings.apiKey`（除非用户明确迁移，一期不支持）。

### 4.6 协议与生成

- 两个端点均为 experimental：
  - `/api/experimental/config/providers`（GET）
  - `/api/experimental/config/providers/:providerID`（PUT）
  - `/api/experimental/config/providers/discover`（POST）
- 标识符：`experimental.config.providers.list` / `.update` / `.discover`；满足 `packages/protocol/test/experimental-identifiers.test.ts`。
- 修改 `packages/protocol` 后，按仓库规范在 `packages/client` 执行 `bun run generate`，不手改生成文件。
- 不修改 `Config.Patch` / `PATCH /api/experimental/config`，避免影响现有 `config.update` 语义。

## 5. 桌面端设计

### 5.1 入口

| 位置 | 文件 | 交互 |
|---|---|---|
| 桌面搜索框 trailing | `select-dialog.tsx` | 新增 Custom Provider 图标按钮（与现有 plus/sliders 并列） |
| 桌面 provider 分组 header | `select-dialog.tsx` | 可编辑自定义 provider 显示铅笔按钮 |
| 移动端抽屉操作区 | `select-dialog.tsx` | 新增 “Add custom provider” |
| 移动端 provider header | `ProviderModelSections` 调用处 | 使用已有 `action` 插槽渲染编辑按钮 |
| 无 provider 空态 | `providers/models/unpaid.tsx` | 增加同一入口（P1.5） |

### 5.2 表单

新建/编辑共用 `DialogCustomProvider`：

| 字段 | 说明 |
|---|---|
| Inference Engine | `llama.cpp` / `vLLM` / `SGLang` / `LM Studio` / `Ollama` / `OpenAI Compatible`；写入 `settings.engine`（非官方 hint，编辑时回填），驱动默认 URL、徽标、发现回退 |
| Provider ID | slug；创建后只读；不得与内置 provider 冲突 |
| 显示名称 | 可选，默认同 ID |
| Base URL | 必填；http/https；默认按引擎填充（见附录）；提示需包含 `/v1` |
| API Key | 密码输入；支持设置/替换；已配置显示占位；active/inactive 凭据可主动删除 |
| 模型列表 | 表格；至少 1 个；行内编辑/删除；“Fetch models” 导入 |
| 模型 ID | 必填；服务器真实模型名；作为 OpenCode 模型 key |
| 显示名称 | 可选，默认模型 ID |
| Context / Output | 可选正整数；output > context 警告 |
| Tools | 开关，默认关闭（发现结果明确支持时自动打开） |
| 输入类型 | 默认 text；可选 image |

**发现交互**

1. 点击 “Fetch models” → `POST discover`（使用当前 baseURL/Key；已保存则复用凭据）。
2. 展示可勾选列表（id、context、tools 标记）。
3. “Add selected” 合并到模型表：已存在的模型不覆盖用户已填字段；context/output 仅在空值时填充。
4. 失败：401/403/连接失败/超时分别提示；保留手动录入。

**编辑/只读**

- `editable=false` 的 provider 不显示铅笔；如展示只读徽标，提示 V1/项目级。
- Provider ID 只读；不支持删除；模型条目可增删改。
- 已有 `settings.apiKey`：Key 输入禁用，提示“由配置文件提供”；保存不修改该字段。

### 5.3 刷新与错误

- 保存成功：等待 `config.updated` 或轮询列表接口（≤5s）→ `data.location.provider.invalidate/sync` + `model.sync` → 关闭并 toast。
- 保存成功但 Key 失败：保持配置生效，提示“provider 已保存，Key 未保存”，提供重试。
- 保存超时：提示“已保存，等待重载”，允许手动刷新。
- 失败保留表单与输入。

### 5.4 i18n 与样式

- 仅新增英文源文案（`packages/app/src/runtime/i18n/en.ts`）；其他语言回退。
- 复用现有 Dialog/TextInput/Button/List 样式；不修改 Settings 样式。

## 6. 数据模型与配置示例

```jsonc
{
  "providers": {
    "local-vllm": {
      "name": "Local vLLM",
      "package": "@opencode/ai/providers/openai-compatible",
      "settings": {
        "baseURL": "http://127.0.0.1:8000/v1",
        "engine": "vllm"
      },
      "models": {
        "Qwen/Qwen3-Coder-30B-A3B-Instruct": {
          "modelID": "Qwen/Qwen3-Coder-30B-A3B-Instruct",
          "name": "Qwen3 Coder 30B (local)",
          "limit": { "context": 131072, "output": 16384 },
          "capabilities": {
            "tools": true,
            "input": ["text"],
            "output": ["text"]
          }
        }
      }
    }
  }
}
```

说明：

- `package` 固定为 `@opencode/ai/providers/openai-compatible`（创建时写入；编辑时保留原值）。
- Key 不在此文件中；`settings.apiKey` 仅作为兼容保留，不在 UI 编辑。
- 引擎标识写入 `settings.engine`（非官方 hint，取值见附录），运行态剥离，不替代任何官方字段；官方 provider/model 字段原样保留。

## 7. 代码边界

### 7.1 服务端（新增/修改）

| 文件 | 改动 |
|---|---|
| `packages/protocol/src/groups/config.ts` 或新增 `groups/custom-provider.ts` | 三个 experimental 端点与 schema |
| `packages/core/src/config.ts` / 新 `config/provider-model.ts` | 原始 JSONC 枚举、V1/V2/scope 识别、Merge Patch、叶子级写入、目标文件解析 |
| `packages/server/src/handlers/config.ts` 或新 handler | 薄 handler；错误映射；Key 编排 |
| `packages/schema/src/config/provider.ts` | 复用 `ConfigProvider.Info`；必要时新增 API 局部 schema |
| `packages/ai/src/providers/openai-compatible.ts` | 在构建 provider options 前剥离 `settings.engine`，避免 hint 进入运行态请求 |
| `packages/client` | `bun run generate` 生成 SDK/类型 |
| `packages/core/test/config/*`、`packages/protocol/test/*` | 新增测试 |

### 7.2 桌面端（新增/修改）

| 文件 | 改动 |
|---|---|
| `packages/app/src/providers/models/custom-provider-dialog.tsx` | 新增表单 |
| `packages/app/src/providers/models/custom-provider.ts` | 列表/保存/发现 hook、变更 patch、刷新、凭据删除 |
| `packages/app/src/providers/models/select-dialog.tsx` | 入口与编辑动作 |
| `packages/app/src/runtime/i18n/en.ts` | 英文文案 |
| 测试：`custom-provider.test.ts`、组件 story/test | 表单/过滤/保存流程 |

### 7.3 明确不改

- `packages/app/src/providers/models/manage.tsx`（Settings → Models）
- `packages/app/src/providers/connect/dialog.tsx`（Settings → Providers）
- Settings 路由、`providers/catalog/*`
- `composer.tsx` / `composer/commands.tsx` 入口逻辑（仍打开改造后的选择器）
- 官方自动发现插件 `packages/core/src/plugin/provider/{ollama,lmstudio,vllm}.ts`
- TUI / CLI

## 8. 测试计划

**服务端**

- 列表：V2 全局、V1 全局、项目级、managed、无配置；Key 来源；`settings.apiKey` 脱敏。
- 保存：新建、编辑 baseURL/名称、模型增删改、`null` 清除字段、V1/项目级/内置冲突 409、ID 不可变。
- JSONC：注释保留、未知字段保留、目标文件解析、并发锁、非法 payload、写入失败回滚。
- engine hint：写入/回填；运行态剥离，不进入 provider options。
- Key：设置/替换/主动删除（active/inactive）、integration 未注册、策略拒绝、部分成功、明文不出现。
- 发现：OpenAI 兼容响应、vLLM/llama.cpp/SGLang 字段、401/403/超时/连接失败、SSRF 拒绝、大小限制。

**协议**

- `bun run generate` 后类型/OpenAPI 正确；experimental 标识符测试通过。

**桌面端**

- 表单校验、Merge Patch 生成、发现合并、Key 状态展示、只读过滤。
- Picker：仅 `editable` provider 显示编辑；V1/项目级不显示。
- 保存后刷新与选中；失败保留表单；Settings 回归无变化。

**手工矩阵**

- llama.cpp / vLLM / SGLang / LM Studio / Ollama；本地与局域网；带 Key 与无 Key；重启持久化；带注释 JSONC 编辑；V1/项目级只读。

## 9. 里程碑

| 阶段 | 内容 | 交付 |
|---|---|---|
| M0 | 本文档评审确认 | 设计冻结 |
| M1 | core：JSONC 枚举/写入/只读识别 + 测试 | `feat(core): manage custom providers in config` |
| M2 | protocol + server 三端点 + `bun run generate` | `feat(protocol): add custom provider API` |
| M3 | app：列表/新建表单/Key/发现 | `feat(app): add custom provider editor` |
| M4 | app：编辑现有 provider/只读/移动端 | `feat(app): edit configured custom providers` |
| M5 | 校验/刷新/组件测试/手工矩阵 | `test(app): cover custom provider editing` |

预估：**10–13 个开发日**（含 Key 与发现）。

## 10. 风险与待确认

| 风险/决策 | 说明 | 建议 |
|---|---|---|
| 引擎标识存放 | `settings.engine` 为非官方 hint，官方客户端会忽略；上游 schema 变更时需保持兼容 | 运行态剥离，不进入 provider options；官方字段不动；上游同步时保留映射 |
| Key 替换遗留旧凭据 | `Credential.create` 新凭据激活，旧凭据保留为 inactive | 表单展示 active/inactive 并提供用户主动删除；删除不影响 provider |
| 配置已含 `settings.apiKey` | 与凭据来源冲突 | 一期只读并禁止 UI 修改；避免静默覆盖 |
| 注释保留粒度 | 删除字段会带走该行注释 | 叶子级 diff；测试锁定；文档说明 |
| 项目级只读 | 用户可能期望编辑项目配置 | 一期只读并提示；二期再评估 |
| 发现 SSRF | 服务端访问用户输入 URL | 仅 http/https、拒绝 link-local、允许私网、超时/大小限制、重定向逐跳校验 |
| 自动发现重复 | 同端口 Ollama/LM Studio/vLLM 已有内置 provider | 表单提示可能重复；不阻止 |
| 无删除/ID 不可变 | 误建 provider 难以清理 | 表单创建前确认 ID；二期再评估删除/重命名 |
| 刷新时序 | provider 重载异步 | 有界轮询 + 事件；超时提示 |

## 附录 A：引擎默认值与发现路径

| Engine | 默认 Base URL 提示 | 发现路径（优先 → 回退） |
|---|---|---|
| llama.cpp | `http://127.0.0.1:8080/v1` | `/v1/models` |
| vLLM | `http://127.0.0.1:8000/v1` | `/v1/models` |
| SGLang | `http://127.0.0.1:30000/v1` | `/v1/models` |
| LM Studio | `http://127.0.0.1:1234/v1` | `/v1/models` → `/api/v1/models` |
| Ollama | `http://127.0.0.1:11434/v1` | `/v1/models` → `/api/tags` |
| OpenAI Compatible | 空 | `/v1/models` |

配置中的 engine 取值：`llamacpp` / `vllm` / `sglang` / `lmstudio` / `ollama` / `openai-compatible`；缺省按 `openai-compatible` 处理。

说明：Ollama / LM Studio / vLLM 默认端口已有官方自动发现；上述默认值用于非默认端口或远程主机的 custom provider。

## 附录 B：接口示例

**列表**

```http
GET /api/experimental/config/providers?location=%2Fworkspace%2Fproject
```

```json
{
  "providers": [
    {
      "id": "local-vllm",
      "scope": "global",
      "shape": "v2",
      "editable": true,
      "key": { "configured": true, "sources": ["credential"], "credentials": [] },
      "provider": {
        "name": "Local vLLM",
        "package": "@opencode/ai/providers/openai-compatible",
        "settings": { "baseURL": "http://127.0.0.1:8000/v1" },
        "models": {}
      }
    }
  ]
}
```

**保存**

```http
PUT /api/experimental/config/providers/local-vllm
```

```json
{
  "patch": {
    "name": "Local vLLM",
    "settings": { "baseURL": "http://127.0.0.1:8001/v1", "engine": "vllm" },
    "models": {
      "Qwen/Qwen3-Coder-30B-A3B-Instruct": {
        "limit": { "context": 131072, "output": 16384 },
        "capabilities": { "tools": true, "input": ["text"], "output": ["text"] }
      },
      "old-model": null
    }
  },
  "apiKey": "sk-local"
}
```

**发现**

```http
POST /api/experimental/config/providers/discover
```

```json
{
  "baseURL": "http://127.0.0.1:8000/v1",
  "providerID": "local-vllm",
  "engine": "vllm"
}
```

```json
{
  "models": [
    {
      "id": "Qwen/Qwen3-Coder-30B-A3B-Instruct",
      "context": 131072,
      "tools": true
    }
  ]
}
```
