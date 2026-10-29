#!/usr/bin/env bun
import { $ } from "bun"
import { createHash } from "node:crypto"
import { cp, mkdir, mkdtemp, stat } from "node:fs/promises"
import path from "node:path"
import semver from "semver"
import rootPackage from "../../../package.json"

// The official workflow builds the CLI and Electron app before wrapping the app in NSIS.
// This fork uses the same scripts without the official signing and publishing services.
if (process.platform !== "win32" || process.arch !== "x64") throw new Error("Run this release on Windows x64")
if (process.versions.bun !== rootPackage.packageManager.slice("bun@".length))
  throw new Error(`Use the pinned ${rootPackage.packageManager} runtime for release builds`)
const version = process.argv.find((argument) => argument.startsWith("--version="))?.slice("--version=".length)
if (!version || !semver.valid(version) || !/^\d+\.\d+\.\d+-dev-my\.\d+$/.test(version))
  throw new Error("Pass --version=<major>.<minor>.<patch>-dev-my.<release>")

const root = path.resolve(import.meta.dir, "../../..")
const tag = `v${version}`
const work = path.join(root, ".cache", "desktop-my", version)
const output = path.join(root, "dist", "releases", tag)
await mkdir(work, { recursive: true })
await mkdir(output, { recursive: true })
process.chdir(root)

process.env.OPENCODE_VERSION = version
process.env.OPENCODE_CHANNEL = "dev-my"
process.env.OPENCODE_DESKTOP_APP_ID = "ai.opencode.desktop.dev-my"
process.env.OPENCODE_DESKTOP_PRODUCT_NAME = "OpenCode My"
process.env.OPENCODE_DESKTOP_UPDATE_URL = `https://github.com/joe-ieta/opencode/releases/download/${tag}/`
process.env.CSC_IDENTITY_AUTO_DISCOVERY = "false"
process.env.OPENCODE_MODELS_SNAPSHOT = path.join(work, "models-catalog.json")
process.env.NODE_OPTIONS = "--max-old-space-size=4096"

await $`bun packages/core/script/update-models-snapshot.ts ${process.env.OPENCODE_MODELS_SNAPSHOT}`
process.env.OPENCODE_TARGET = "windows-x64-baseline"
// The pinned native Bun runtime can compile itself; no second runtime download is needed.
delete process.env.BUN_COMPILE_RELEASE
await $`bun run --cwd packages/cli build --single --baseline --skip-install`
const cli = path.join(root, "packages/cli/dist/cli-windows-x64-baseline/bin/opencode.exe")
if ((await $`${cli} --version`.text()).trim() !== `opencode v${version}`)
  throw new Error("Built CLI version does not match release")
await $`bun packages/cli/script/catalog-smoke.ts ${cli}`

process.env.OPENCODE_TARGET = "windows-x64"
await $`bun run --cwd packages/desktop build`
await $`bun run --cwd packages/desktop pack`
// pack clears dist/desktop before each pass, so the NSIS input must live outside it.
const app = await mkdtemp(path.join(work, "app-"))
await cp(path.join(root, "dist/desktop/app"), app, { recursive: true })
process.env.OPENCODE_DESKTOP_APP = app
await $`bun run --cwd packages/desktop pack`
delete process.env.OPENCODE_DESKTOP_APP

const name = "opencode-desktop-win-x64.exe"
const installer = path.join(output, name)
await cp(path.join(root, "dist/desktop", name), installer)
const bytes = await Bun.file(installer).arrayBuffer()
const sha512 = createHash("sha512").update(Buffer.from(bytes)).digest("base64")
await Bun.write(
  path.join(output, "latest.yml"),
  [
    `version: ${version}`,
    "files:",
    `  - url: ${name}`,
    `    sha512: ${sha512}`,
    `    size: ${(await stat(installer)).size}`,
    `path: ${name}`,
    `sha512: ${sha512}`,
    `releaseDate: '${new Date().toISOString()}'`,
    "",
  ].join("\n"),
)
await Bun.write(
  path.join(output, "SHA256SUMS"),
  `${createHash("sha256").update(Buffer.from(bytes)).digest("hex")}  ${name}\n`,
)
await Bun.write(
  path.join(output, "build.json"),
  JSON.stringify(
    {
      version,
      tag,
      commit: (await $`git rev-parse HEAD`.text()).trim(),
      target: "windows-x64",
      bun: process.versions.bun,
      signed: false,
      appId: process.env.OPENCODE_DESKTOP_APP_ID,
      updateUrl: process.env.OPENCODE_DESKTOP_UPDATE_URL,
    },
    null,
    2,
  ) + "\n",
)
console.log(`Unsigned Windows x64 release ready in ${output}`)
