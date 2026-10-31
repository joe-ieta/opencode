# oc_core 发布记录（KB）

> 每次发布一行：tag / 源提交 / 内核 / 平台产物 / SHA256 / 冒烟结论。发布流程见 `../ops/release-runbook.md`；版本规则见 `v2-upgrade-roadmap.md` 6.1。
> 构建说明：同尺寸产物的字节内容不可复现（构建含非确定性），**以发布时 `.sha256` 侧车为准**。

| 日期 | tag | 源提交 | 内核 | 产物（平台） | SHA256 | 冒烟 |
|---|---|---|---|---|---|---|
| 2026-10-11 | `oc-headless-v0.1.0`（bootstrap 别名，冻结不回写） | `d42ac37bf4` | 2.0.26 | `oc_core-2.0.26-windows-x64.exe`（188,766,208 B） | `8D380B7553A52D3276A72D0D4FAC924DBC83F8EEF5D268335D83756C849D9883` | 独立复测通过（审计记录，见 `v2-upgrade-roadmap.md` 2.2） |
| 2026-10-11 | `oc-headless-v2.0.26` | `5f2b7ed4ed`（审计修复提交；tag 指向本记录提交） | 2.0.26 | `oc_core-2.0.26-windows-x64.exe`（188,766,208 B）+ `.sha256` | `ccdc8e9b89b4983f7cb4174c1464f24b3dd42e2d23dfd41f0d6845b28c81c79e` | `oc:smoke` PASS（info 200 + 版本一致 / 无凭据 401 / `server.connected` / stderr 空） |
| 2026-10-11 | `oc-headless-v2.0.26.1` | `f85ead60f9`（客户端 e2e 测试；tag 指向本记录提交） | 2.0.26 | 复用 `oc_core-2.0.26-windows-x64.exe`（内核未变；188,766,208 B） | `ccdc8e9b89b4983f7cb4174c1464f24b3dd42e2d23dfd41f0d6845b28c81c79e` | 客户端真实模型 e2e：`tst_v2_session` PASS（Zen `ling-3.1-flash-free` 流式回复 `hello from oc_core`）；ctest 3/3；`oc:sync --skip-typecheck` 工具链验证通过；`oc:contract` / `oc:smoke` PASS；CI `38127834212` 三平台全绿（Windows 2m47s / macOS 1m7s / Ubuntu 2m47s，产物 `oc_core-{Linux,Windows,macOS}` 含 `.sha256`） |
| 2026-10-29 | `oc-headless-v2.2.0` | `c32c227981`（同步上游 V2 2.2.0；tag 指向本记录提交） | 2.2.0 | `oc_core-2.2.0-windows-x64.exe`（227,193,344 B）+ `.sha256` | `8b022fb7d2db2266c64629fac70af4d0752c0e650e0d7d597a4282d21182d2ec` | `oc:contract` PASS（130 路径；较基线新增 12 条信息性路径）；`bun run typecheck` 36/36；`oc:build` 产出 216.7 MB；`oc:smoke` PASS（`/api/info` 200 + 版本 2.2.0 / 无凭据 401 / `server.connected` / stderr 空）；CI **待补**：仓库 GitHub Actions 被禁用（dispatch HTTP 422），恢复后补跑 |
| 2026-10-31 | `oc-headless-v2.2.5` | `2f409d1682`（同步上游 V2 2.2.0 → 2.2.5；tag 指向本记录提交） | 2.2.5 | `oc_core-2.2.5-windows-x64.exe`（234,496,512 B）+ `.sha256` | `f864f46d0dd459e187cc7c5b395d4f4ea041bd456eb0638c11c5190844c0ddbe` | `oc:contract` PASS（138 路径；较基线新增 20 条信息性路径）；`bun run typecheck` 36/36；`oc:build` 产出 223.6 MB；`oc:smoke` PASS（`/api/info` 200 + 版本 2.2.5 / 无凭据 401 / `server.connected` / stderr 空）；CI **待补**：仓库 GitHub Actions 被禁用（dispatch HTTP 422），恢复后补跑 |

## 备注

- `v0.1.0` 与 `v2.0.26` 产物尺寸相同但哈希不同：构建不可字节复现，发布以侧车哈希与复测为准。
- Zen 默认模型 `exo-free` 已弃用（410 `ModelDeprecated`）；端到端与演示使用 `opencode/ling-3.1-flash-free`（免费）或自配模型。
- 后续发布模板：`<tag> | <commit> | <kernel> | <artifact>(<bytes>) | <sha256> | <smoke>`。
