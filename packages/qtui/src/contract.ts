#!/usr/bin/env bun
/**
 * oc_core API contract gate (oc-headless P3).
 *
 * Usage (from repo root):
 *   bun run --cwd packages/qtui contract            # verify openapi against baseline + stable surface
 *   bun run --cwd packages/qtui contract --update   # regenerate contract/openapi-paths.baseline.json
 *
 * Checks:
 *   1. Every {method, path} in contract/stable-surface.json exists in
 *      packages/protocol/openapi.json (path and verb are validated separately).
 *   2. The full openapi path set did not lose paths against
 *      contract/openapi-paths.baseline.json: a removed path that is in the stable
 *      surface is an ERROR, any other removed path is a WARN; added paths are listed.
 *
 * Exit code 0 only when there are no errors. Default mode never writes; --update
 * rewrites the baseline snapshot and prints what changed.
 */
import path from "node:path"

const ROOT = path.resolve(import.meta.dir, "../../..")
process.chdir(ROOT)

const OPENAPI = "packages/protocol/openapi.json"
const SURFACE = "packages/qtui/contract/stable-surface.json"
const BASELINE = "packages/qtui/contract/openapi-paths.baseline.json"

type OpenApi = { paths?: Record<string, Record<string, unknown>> }
type SurfaceEntry = { method: string; path: string }

const update = new Set(process.argv.slice(2)).has("--update")

const openapi = (await Bun.file(OPENAPI).json()) as OpenApi
const surface = (await Bun.file(SURFACE).json()) as SurfaceEntry[]
const baselineExists = await Bun.file(BASELINE).exists()
const baseline = baselineExists ? ((await Bun.file(BASELINE).json()) as string[]) : []

const paths = Object.keys(openapi.paths ?? {}).sort()
const pathSet = new Set(paths)
const baselineSet = new Set(baseline)
const surfacePaths = new Set(surface.map((entry) => entry?.path))

const errors = checkStableSurface(openapi, surface)
const added = paths.filter((entry) => !baselineSet.has(entry))
const removed = baseline.filter((entry) => !pathSet.has(entry))

const warnings: string[] = []
for (const removedPath of removed) {
  if (surfacePaths.has(removedPath)) errors.push(`removed path is in the stable surface: ${removedPath}`)
  else warnings.push(`removed path not in the stable surface: ${removedPath}`)
}
if (!update && !baselineExists) {
  errors.push(`baseline missing at ${BASELINE}; run: bun run --cwd packages/qtui contract --update`)
}

console.log(
  `oc contract: openapi ${paths.length} paths, baseline ${baseline.length} paths, stable surface ${surface.length} entries`,
)
if (added.length) {
  console.log(`oc contract: added ${added.length} path(s) since baseline (informational):`)
  for (const addedPath of added) console.log(`  + ${addedPath}`)
}
if (removed.length) {
  console.log(`oc contract: removed ${removed.length} path(s) since baseline:`)
  for (const removedPath of removed) console.log(`  - ${removedPath}`)
}
for (const warning of warnings) console.log(`oc contract: WARN ${warning}`)

if (update) {
  const changed = added.length > 0 || removed.length > 0
  if (errors.length) {
    console.log("oc contract: baseline not written (errors above)")
  } else if (changed) {
    await Bun.write(BASELINE, `${JSON.stringify(paths, null, 2)}\n`)
    console.log(`oc contract: baseline updated (${baseline.length} -> ${paths.length} paths) ${BASELINE}`)
  } else {
    console.log("oc contract: baseline unchanged; nothing written")
  }
}

if (errors.length) {
  for (const error of errors) console.error(`oc contract: ERROR ${error}`)
  console.error(`oc contract: FAIL (${errors.length} error(s))`)
  process.exit(1)
}
console.log(`oc contract: stable surface ok (${surface.length} entries)`)
console.log("oc contract: PASS")

function checkStableSurface(openapi: OpenApi, surface: SurfaceEntry[]) {
  const errors: string[] = []
  const seen = new Set<string>()
  for (const entry of surface) {
    if (!entry || typeof entry.method !== "string" || typeof entry.path !== "string") {
      errors.push(`invalid stable surface entry: ${JSON.stringify(entry)}`)
      continue
    }
    const method = entry.method.toLowerCase()
    const key = `${method} ${entry.path}`
    if (seen.has(key)) errors.push(`duplicate stable surface entry: ${entry.method.toUpperCase()} ${entry.path}`)
    seen.add(key)
    const operation = openapi.paths?.[entry.path]
    if (!operation) errors.push(`stable surface path missing: ${entry.method.toUpperCase()} ${entry.path}`)
    else if (!operation[method]) errors.push(`stable surface method missing: ${entry.method.toUpperCase()} ${entry.path}`)
  }
  return errors
}
