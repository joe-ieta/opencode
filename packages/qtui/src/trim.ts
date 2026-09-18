#!/usr/bin/env bun
/**
 * qtoc headless trim (idempotent).
 *
 * Re-applies the headless distribution profile after syncing with upstream.
 * Run: bun run qtoc:trim
 *
 * It fails loudly when an expected upstream pattern is missing, so a sync that
 * changed a hotspot is caught instead of silently producing a wrong profile.
 */
import fs from "node:fs/promises"
import path from "node:path"

const ROOT = path.resolve(import.meta.dir, "../../..")
process.chdir(ROOT)

const REMOVED_DIRS = [
  "packages/app",
  "packages/desktop",
  "packages/web",
  "packages/session-ui",
  "packages/storybook",
  "packages/enterprise",
  "packages/function",
  "packages/cli",
  "packages/slack",
  "packages/console",
  "packages/stats",
  "github",
  "sdks",
  "nix",
]
const REMOVED_FILES = ["flake.nix", "flake.lock"]
const REMOVED_WORKFLOWS = [
  ".github/workflows/publish.yml",
  ".github/workflows/publish-vscode.yml",
  ".github/workflows/publish-github-action.yml",
  ".github/workflows/release-github-action.yml",
  ".github/workflows/storybook.yml",
  ".github/workflows/stats.yml",
  ".github/workflows/docs-locale-sync.yml",
  ".github/workflows/docs-update.yml",
  ".github/workflows/nix-eval.yml",
  ".github/workflows/nix-hashes.yml",
]
const REMOVED_PATCHES = [
  "patches/@dnd-kit%2Fdom@0.5.0.patch",
  "patches/@pierre%2Ftrees@1.0.0-beta.4.patch",
  "patches/@tanstack%2Fvirtual-core@3.17.3.patch",
]
const REMOVED_WORKSPACE_PATTERNS = ["packages/console/*", "packages/stats/*", "packages/slack"]
const REMOVED_SCRIPTS = ["dev:desktop", "dev:web", "dev:console", "dev:stats", "dev:storybook", "sso", "translate:app"]
const REMOVED_TRUSTED_DEPS = ["tree-sitter", "tree-sitter-bash", "tree-sitter-powershell", "electron"]
const REMOVED_PATCH_DEPS = ["@dnd-kit/dom@0.5.0", "@pierre/trees@1.0.0-beta.4", "@tanstack/virtual-core@3.17.3"]
const REMOVED_COMMANDS = [
  "AcpCommand",
  "TuiThreadCommand",
  "AttachCommand",
  "RunCommand",
  "ConsoleCommand",
  "WebCommand",
  "StatsCommand",
  "GithubCommand",
  "PrCommand",
]
const REMOVED_TURBO_TASKS = ["@opencode-ai/function#test", "@opencode-ai/app#test", "@opencode-ai/session-ui#test"]

const actions: string[] = []

async function exists(rel: string) {
  return fs.stat(path.join(ROOT, rel)).then(
    () => true,
    () => false,
  )
}

async function remove(rel: string) {
  if (!(await exists(rel))) return
  await fs.rm(path.join(ROOT, rel), { recursive: true, force: true })
  actions.push(`removed ${rel}`)
}

async function read(rel: string) {
  return fs.readFile(path.join(ROOT, rel), "utf8")
}

async function write(rel: string, content: string) {
  await fs.writeFile(path.join(ROOT, rel), content)
}

// 1. delete UI applications and unrelated components
for (const dir of REMOVED_DIRS) await remove(dir)
for (const file of REMOVED_FILES) await remove(file)
for (const file of REMOVED_WORKFLOWS) await remove(file)
for (const file of REMOVED_PATCHES) await remove(file)

// 2. root package.json
{
  const file = "package.json"
  const pkg = JSON.parse(await read(file))
  const before = actions.length
  pkg.workspaces ??= {}
  const packages: string[] = pkg.workspaces.packages ?? []
  const kept = packages.filter((entry) => !REMOVED_WORKSPACE_PATTERNS.includes(entry))
  if (kept.length !== packages.length) {
    pkg.workspaces.packages = kept
    actions.push("package.json: workspaces trimmed")
  }
  pkg.scripts ??= {}
  for (const key of REMOVED_SCRIPTS) {
    if (pkg.scripts[key] === undefined) continue
    delete pkg.scripts[key]
    actions.push(`package.json: removed script ${key}`)
  }
  if (!pkg.scripts["qtoc:trim"]) {
    pkg.scripts["qtoc:trim"] = "bun run --cwd packages/qtui trim"
    actions.push("package.json: added script qtoc:trim")
  }
  if (!pkg.scripts["qtoc:build"]) {
    pkg.scripts["qtoc:build"] = "bun run --cwd packages/qtui build"
    actions.push("package.json: added script qtoc:build")
  }
  if (!pkg.scripts["qtoc:sync"]) {
    pkg.scripts["qtoc:sync"] = "bun run --cwd packages/qtui sync"
    actions.push("package.json: added script qtoc:sync")
  }
  if (Array.isArray(pkg.trustedDependencies)) {
    const keptTrusted = pkg.trustedDependencies.filter((item: string) => !REMOVED_TRUSTED_DEPS.includes(item))
    if (keptTrusted.length !== pkg.trustedDependencies.length) {
      pkg.trustedDependencies = keptTrusted
      actions.push("package.json: trustedDependencies trimmed")
    }
  }
  if (pkg.patchedDependencies) {
    for (const key of REMOVED_PATCH_DEPS) {
      if (!(key in pkg.patchedDependencies)) continue
      delete pkg.patchedDependencies[key]
      actions.push(`package.json: removed patch ${key}`)
    }
  }
  if (actions.length !== before) await write(file, JSON.stringify(pkg, null, 2) + "\n")
}

// 3. CLI command surface
{
  const file = "packages/opencode/src/index.ts"
  let text = await read(file)
  const before = text
  for (const name of REMOVED_COMMANDS) {
    text = text.replace(new RegExp(`^import \\{ ${name} \\} from .*\\r?\\n`, "m"), "")
    text = text.replace(new RegExp(`^\\s*\\.command\\(${name}\\)\\r?\\n`, "m"), "")
  }
  if (text !== before) {
    await write(file, text)
    actions.push("index.ts: removed headless-disabled commands")
  }
}

// 4. build script: headless default + qtoc_core artifact
{
  const file = "packages/opencode/script/build.ts"
  let text = await read(file)
  const before = text
  text = text.replace(
    /const skipEmbedWebUi = process\.argv\.includes\("--skip-embed-web-ui"\)/,
    'const skipEmbedWebUi = !process.argv.includes("--embed-web-ui")',
  )
  text = text.replace(/outfile: `dist\/\$\{name\}\/bin\/opencode`/, "outfile: `dist/${name}/bin/qtoc_core`")
  text = text.replace(/const binaryPath = `dist\/\$\{name\}\/bin\/opencode`/, "const binaryPath = `dist/${name}/bin/qtoc_core`")
  if (text !== before) {
    await write(file, text)
    actions.push("build.ts: headless default + qtoc_core artifact")
  }
  if (!text.includes("/bin/qtoc_core")) {
    throw new Error(
      "qtoc trim: packages/opencode/script/build.ts no longer matches the expected outfile pattern. Review the upstream build script and update packages/qtui/src/trim.ts.",
    )
  }
}

// 5. turbo tasks for removed packages
{
  const file = "turbo.json"
  const doc = JSON.parse(await read(file))
  let dirty = false
  if (doc.tasks) {
    for (const key of REMOVED_TURBO_TASKS) {
      if (!(key in doc.tasks)) continue
      delete doc.tasks[key]
      dirty = true
      actions.push(`turbo.json: removed ${key}`)
    }
  }
  if (dirty) await write(file, JSON.stringify(doc, null, 2) + "\n")
}

// 6. app e2e job
{
  const file = ".github/workflows/test.yml"
  if (await exists(file)) {
    const text = await read(file)
    const index = text.indexOf("\n  e2e:")
    if (index >= 0) {
      await write(file, text.slice(0, index) + "\n")
      actions.push("test.yml: removed app e2e job")
    }
  }
}

console.log(actions.length ? actions.map((item) => `- ${item}`).join("\n") : "- nothing to change (already applied)")
console.log(`qtoc trim: ${actions.length} change(s)`)
