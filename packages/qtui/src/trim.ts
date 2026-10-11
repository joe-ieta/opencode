#!/usr/bin/env bun
/**
 * oc headless trim (V2 minimal-delta profile).
 *
 * V2 strategy: no package deletions. "Headless" is a build-time concern
 * (`--skip-web-ui` on packages/cli/script/build.ts), so this script only
 * verifies the upstream build script still supports the flags oc_core relies on.
 * It fails loudly when an expected upstream pattern is missing, so a sync that
 * changed a hotspot is caught instead of silently producing a wrong profile.
 */
import path from "node:path"

const ROOT = path.resolve(import.meta.dir, "../../..")
process.chdir(ROOT)

const file = "packages/cli/script/build.ts"
const text = await Bun.file(file).text()
const required = ["--single", "--skip-install", "--skip-web-ui"]
const missing = required.filter((flag) => !text.includes(flag))
if (missing.length) {
  throw new Error(`oc trim: ${file} no longer supports ${missing.join(", ")}; update packages/qtui/src/trim.ts`)
}
if (!text.includes("bin")) {
  throw new Error(`oc trim: ${file} no longer writes the binary under bin/; update packages/qtui/src/trim.ts`)
}
console.log("oc trim: V2 minimal-delta profile ok (no package deletions)")
