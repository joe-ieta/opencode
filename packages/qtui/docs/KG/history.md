# qtui 问题处理历史（KG）

> 记录 qtoc_core / Qt 客户端集成过程中定位并修复的问题，供后续同步上游、回归排查参考。
> 环境基线：Windows + Bun 1.4.2 + Qt 6.10.3 (MSVC2022 x64)，opencode 版本 `1.18.31`（channel `qt-headless`）。

## 索引

| 编号 | 问题 | 状态 | 提交 |
|---|---|---|---|
| KG-001 | 编译版发 prompt 崩溃（LayerNode undefined） | 已修复 | `9f3419b9da` |
| KG-002 | 插件依赖安装失败（自定义版本号不在 npm） | 已修复 | `9f3419b9da` |
| KG-003 | Qt 客户端聊天窗口无反馈（SSE 缺目录头 + 错误解析） | 已修复 | `25f1983ca3` / `e938cc685a` / `7a07ea49ca` |
| KG-004 | 构建与归档稳定性（EBUSY、调试构建） | 已修复 | `9f3419b9da` |

---

## KG-001 编译版发 prompt 崩溃（LayerNode undefined）

### 现象

- 源码模式（`bun run packages/opencode/src/index.ts serve`）一切正常；
- 编译版 `qtoc_core.exe`：`Start server`、建会话、`prompt_async` 均正常，但随后收到事件
  `error: UnknownError: TypeError: undefined is not an object (evaluating 'a.name')`，
  stack 最外层为 `SystemPrompt.environment`。

### 排查过程

1. **源码 vs 编译对比**：源码模式无法复现 → 锁定为打包/编译差异，而非逻辑错误。
2. **读服务端状态日志**：`<XDG_DATA_HOME>/opencode/log/opencode.log` 显示：
   ```
   loop step=0
   shell tool using shell ...
   init count=1                      # Skill 初始化
   prompt_async failed ... cause="Cause([Die(TypeError ...)])"
   ```
   崩溃点位于 **location 服务启动**阶段（源码日志中该位置之后是 `watcher backend`、`booting location services`）。
3. **未压缩构建**：`QTOC_MINIFY=0` 构建后错误变为 `evaluating 'node.name'`（排除 minify 因素，变量名更可读）。
4. **定位代码**：`node.name` 属于 `packages/core/src/effect/layer-node.ts` 的图层构建器。
5. **增加校验**（保留为长期防御）：
   ```ts
   // layer-node.ts
   function validateNodes(owner, nodes) { /* 报出节点名与索引 */ }
   ```
   重新构建后错误精确到：
   ```
   LayerNode @opencode/v2/FileSystem: invalid dependency at index 2 (undefined)
   ```
6. **根因确认**：`packages/core/src/filesystem.ts`（`deps: [FSUtil.node, Location.node, FileSystemSearch.node]`）
   与 `packages/core/src/filesystem/search.ts` 存在**循环导入**；
   打包后 `FileSystemSearch.node` 为 `undefined`，导致 location 服务图层构建崩溃。
   源码模式因 ESM live binding 恰好规避。

### 修复

`packages/core/src/filesystem/search.ts`：

```ts
// 之前
import { FileSystem } from "../filesystem"
...
FileSystem.Entry.make(...)   // 值引用，形成运行时循环
FileSystem.Match.make(...)

// 之后
import { Entry, Match } from "@opencode-ai/schema/filesystem"
import type { FileSystem } from "../filesystem"
...
Entry.make(...)
Match.make(...)
```

### 验证

- 编译版 + 真实 DeepSeek Key（`openai-compatible` + `deepseek-flash`）：
  助手消息 `time.completed` 正常、`finish: stop`、tokens 记录正常，无任何 error。
- `bun run typecheck` 18/18 通过。

### 经验

- 循环导入在打包后可能表现为 `undefined` 导出，源码模式未必复现；
- 图层/依赖图构建崩溃优先用「未压缩构建 + 节点名校验」定位；
- 服务端问题优先查看 `opencode.log`，比 SSE 事件里的 minified stack 更有信息量。

---

## KG-002 插件依赖安装失败（自定义版本号不在 npm）

### 现象

```
background dependency install failed
  @opencode-ai/plugin: No matching version found for @opencode-ai/plugin@0.0.0-qt-headless-<timestamp>.
```

### 根因

内核在配置目录（`<XDG_CONFIG_HOME>/opencode`）自动安装 `@opencode-ai/plugin@<构建版本>`；
本地预览版本号未发布到 npm，安装必然失败（仅为 WARN，不阻塞，但影响 npm 插件使用且日志噪声大）。

### 修复

`packages/qtui/src/build.ts` 构建前默认注入：

```
OPENCODE_CHANNEL=qt-headless      # 保持预览通道
OPENCODE_VERSION=<仓库版本>        # 1.18.31，npm 已发布，插件安装可解析
```

### 验证

- 二进制 `--version` = `1.18.31`；
- 全链路日志中不再出现 `background dependency install failed`。

---

## KG-003 Qt 客户端聊天窗口无反馈

### 现象

`Start server` 正常、`prompt accepted` 正常，但聊天窗口空白，无流式内容。

### 排查与修复（三处）

1. **错误不可见**：服务端错误结构为 `{ name, data: { message } }`，旧代码取 `error.message` 为空，
   且只写入 Server log。
   → `EventRouter` 解析 `data.message`（回退 `message`、再回退 JSON），`session.error` 同时显示到聊天窗口。
2. **模型未配置无提示**：旧判断只读环境变量 `QTOC_MODEL`，设置窗口保存的 QSettings 未参与判断（误报）。
   → 改为读取 `QtocSettings`，启动后查询 `/config/providers`，按「无凭据 / 无模型 / 缺 provider」分别提示。
3. **SSE 缺少目录作用域**：`/event` 请求未带 `x-opencode-directory`，只收到 `server.connected`/heartbeat，
   收不到会话事件（`message.part.updated`、`part.delta`、`session.idle` 等）。
   → `SseClient::open` 增加目录头，与官方 SDK 行为对齐。

### 验证

```bash
# 带目录头订阅，事件流完整（含增量与空闲事件）
curl -N -u opencode:<pw> -H "x-opencode-directory: <urlencoded>" http://127.0.0.1:4096/event
```

观察到：`session.updated`、`message.updated`、`message.part.updated`、`message.part.delta`、
`session.status(busy/idle)`、`session.idle`、`session.diff` 等。

### 附带修复

- `SessionModel`：`message.part.delta` 与 `message.part.updated` 双写导致文本重复 → 记录已增量 part，忽略全量覆盖。

---

## KG-004 构建与归档稳定性

| 问题 | 处理 |
|---|---|
| `qtoc:build` 归档报 `EBUSY`（目标 exe 被运行中的内核占用） | 归档 `copyRetry`（10 次 × 1s） |
| 需要可读堆栈调试编译版 | `packages/opencode/script/build.ts` 支持 `QTOC_MINIFY=0` |
| 图层构建错误信息晦涩 | `layer-node.ts` 增加 `validateNodes`（节点名 + 索引） |
| PowerShell 下 curl JSON 转义易错 | 使用 `--data-binary @prompt.json` 文件方式 |

---

## 验证基线（2026-09-17）

| 项目 | 结果 |
|---|---|
| `bun install` | 1130 packages，无报错 |
| `bun run typecheck` | 18/18 通过 |
| `qtoc:build` | 产物 `qtoc_core.exe`（版本 1.18.31），smoke test 通过 |
| `ctest`（qtui/client） | `sse_parser`、`process` 2/2 通过 |
| 真实模型链路 | DeepSeek `deepseek-flash` 正常回复（流式事件完整） |

## 关键提交

| 提交 | 说明 |
|---|---|
| `7a07ea49ca` | fix(qtui): surface model config errors and stream state in the demo client |
| `e938cc685a` | fix(qtui): read model configuration from settings in provider check |
| `9f3419b9da` | fix(core): resolve bundled layer graph crash from filesystem import cycle |
| `25f1983ca3` | fix(qtui): scope the event stream to the session directory |
