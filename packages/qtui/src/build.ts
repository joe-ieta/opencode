#!/usr/bin/env bun
/**
 * qtoc_core build orchestrator.
 *
 * Usage (from repo root):
 *   bun run qtoc:build                 # install + typecheck + build + stage artifact
 *   bun run qtoc:build --skip-install  # reuse node_modules
 *   bun run qtoc:build --skip-typecheck
 *   bun run qtoc:build --baseline      # build the baseline (non-AVX2) variant
 *
 * Output:
 *   artifacts/qtoc/qtoc_core[.exe]                              stable name
 *   artifacts/qtoc/qtoc_core-<version>-<os>-<arch>[.exe]        versioned copy
 */
import { $ } from "bun"
import fs from "node:fs/promises"
import path from "node:path"

const ROOT = path.resolve(import.meta.dir, "../../..")
process.chdir(ROOT)

const args = new Set(process.argv.slice(2))
const skipInstall = args.has("--skip-install")
const skipTypecheck = args.has("--skip-typecheck")
const baseline = args.has("--baseline")

const pkg = await Bun.file("package.json").json()
const expected = pkg.packageManager?.split("@")[1]
if (expected) {
  const [actualMajor, actualMinor] = Bun.version.split(".").map(Number)
  const [expectedMajor, expectedMinor] = expected.split(".").map(Number)
  if (actualMajor < expectedMajor || (actualMajor === expectedMajor && actualMinor < expectedMinor)) {
    throw new Error(`qtoc build: bun >= ${expected} required, found ${Bun.version}`)
  }
}

if (!skipInstall) {
  console.log("qtoc: bun install")
  await $`bun install`
}

if (!skipTypecheck) {
  console.log("qtoc: typecheck")
  await $`bun run typecheck`
}

// Use a published version so the kernel can install @opencode-ai/plugin into its
// config directory; keep the channel so the build stays a preview build.
const corePkg = await Bun.file(path.join(ROOT, "packages/opencode/package.json")).json()
process.env.OPENCODE_CHANNEL ??= "qt-headless"
process.env.OPENCODE_VERSION ??= String(corePkg.version ?? "0.0.0")
console.log(`qtoc: build qtoc_core (channel=${process.env.OPENCODE_CHANNEL} version=${process.env.OPENCODE_VERSION})`)
const buildArgs = ["run", "--cwd", "packages/opencode", "script/build.ts", "--single", "--skip-install"]
if (baseline) buildArgs.push("--baseline")
await $`bun ${buildArgs}`

const osName = process.platform === "win32" ? "windows" : process.platform
const extension = process.platform === "win32" ? ".exe" : ""
const distDir = path.join(ROOT, "packages/opencode/dist", `opencode-${osName}-${process.arch}`)
const source = path.join(distDir, "bin", `qtoc_core${extension}`)
if (!(await Bun.file(source).exists())) {
  throw new Error(`qtoc build: built binary not found at ${path.relative(ROOT, source)}`)
}

const outDir = path.join(ROOT, "artifacts/qtoc")
await fs.mkdir(outDir, { recursive: true })
const distPkg = await Bun.file(path.join(distDir, "package.json")).json()
const version = String(distPkg.version ?? "0.0.0")
const stable = path.join(outDir, `qtoc_core${extension}`)
const versioned = path.join(outDir, `qtoc_core-${version}-${osName}-${process.arch}${extension}`)
await copyRetry(source, stable)
await copyRetry(source, versioned)

const size = ((await fs.stat(stable)).size / 1024 / 1024).toFixed(1)
console.log("qtoc: done")
console.log(`  ${path.relative(ROOT, stable)} (${size} MB)`)
console.log(`  ${path.relative(ROOT, versioned)}`)

// Windows can hold the destination briefly (antivirus, previous runs); retry.
async function copyRetry(from: string, to: string) {
  for (let attempt = 1; ; attempt++) {
    try {
      await fs.copyFile(from, to)
      return
    } catch (error) {
      if (attempt >= 10) throw error
      console.log(`qtoc: retry copy (${attempt}) ${path.basename(to)}`)
      await Bun.sleep(1000)
    }
  }
}
