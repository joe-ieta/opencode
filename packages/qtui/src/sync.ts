#!/usr/bin/env bun
/**
 * oc-headless upstream sync (V2).
 *
 * Usage (from repo root):
 *   bun run oc:sync                          # fetch + merge upstream/dev (V2) + trim + install + typecheck
 *   bun run oc:sync --remote upstream --branch dev
 *   bun run oc:sync --no-trim --skip-install --skip-typecheck
 *   bun run oc:sync --no-commit              # stop after resolving, review the merge manually
 *
 * Modify/delete conflicts (files upstream still changes but this profile removed)
 * are resolved automatically by keeping the deletion. Any other conflict aborts
 * with a list so hotspots get a deliberate merge.
 */
import { $ } from "bun"
import path from "node:path"

const ROOT = path.resolve(import.meta.dir, "../../..")
process.chdir(ROOT)

const args = process.argv.slice(2)
const flag = (name: string) => args.includes(name)
const value = (name: string, fallback: string) => {
  const index = args.indexOf(name)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}

const remote = value("--remote", "upstream")
const branch = value("--branch", "dev")
const skipTrim = flag("--no-trim")
const skipInstall = flag("--skip-install")
const skipTypecheck = flag("--skip-typecheck")
const noCommit = flag("--no-commit")

const dirty = (await $`git status --porcelain --untracked-files=no`.text()).trim()
if (dirty) {
  throw new Error("oc sync: working tree has uncommitted changes; commit or stash first")
}

console.log(`oc sync: fetching ${remote}/${branch}`)
await $`git fetch ${remote} ${branch}`

console.log(`oc sync: merging ${remote}/${branch}`)
const merge = await $`git merge ${remote}/${branch}`.nothrow().quiet()
if (merge.exitCode !== 0) {
  const unmerged = (await $`git diff --name-only --diff-filter=U`.text())
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  const deletions: string[] = []
  const remaining: string[] = []
  for (const file of unmerged) {
    const line = (await $`git status --porcelain -- ${file}`.text()).trim()
    if (line.startsWith("DU")) deletions.push(file)
    else remaining.push(line)
  }

  if (deletions.length) {
    console.log(`oc sync: keeping deletion for ${deletions.length} modify/delete conflict(s)`)
    await $`git rm -q --ignore-unmatch ${deletions}`
  }

  if (remaining.length) {
    console.error("oc sync: manual conflicts remain:")
    for (const line of remaining) console.error(`  ${line}`)
    throw new Error("oc sync: resolve conflicts, then run `bun run oc:trim` and commit")
  }

  if (noCommit) {
    console.log("oc sync: conflicts resolved; review and commit the merge, then run `bun run oc:trim`")
    process.exit(0)
  }
  console.log("oc sync: committing merge")
  await $`git commit --no-edit`
} else {
  console.log("oc sync: merge complete")
}

if (!skipTrim) {
  console.log("oc sync: trim")
  await $`bun run oc:trim`
}

if (!skipInstall) {
  console.log("oc sync: install")
  await $`bun install`
}

if (!skipTypecheck) {
  console.log("oc sync: typecheck")
  await $`bun run typecheck`
}

console.log("oc sync: done")
console.log("  next: bun run oc:build")
console.log("  then: bun run oc:smoke (see packages/qtui/docs/ops/release-runbook.md)")
