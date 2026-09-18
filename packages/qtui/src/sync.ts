#!/usr/bin/env bun
/**
 * qtoc upstream sync.
 *
 * Usage (from repo root):
 *   bun run qtoc:sync                          # fetch + merge upstream/dev + trim + install + typecheck
 *   bun run qtoc:sync --remote upstream --branch dev
 *   bun run qtoc:sync --no-trim --skip-install --skip-typecheck
 *   bun run qtoc:sync --no-commit              # stop after resolving, review the merge manually
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
  throw new Error("qtoc sync: working tree has uncommitted changes; commit or stash first")
}

console.log(`qtoc sync: fetching ${remote}/${branch}`)
await $`git fetch ${remote} ${branch}`

console.log(`qtoc sync: merging ${remote}/${branch}`)
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
    console.log(`qtoc sync: keeping deletion for ${deletions.length} modify/delete conflict(s)`)
    await $`git rm -q --ignore-unmatch ${deletions}`
  }

  if (remaining.length) {
    console.error("qtoc sync: manual conflicts remain:")
    for (const line of remaining) console.error(`  ${line}`)
    throw new Error("qtoc sync: resolve conflicts, then run `bun run qtoc:trim` and commit")
  }

  if (noCommit) {
    console.log("qtoc sync: conflicts resolved; review and commit the merge, then run `bun run qtoc:trim`")
    process.exit(0)
  }
  console.log("qtoc sync: committing merge")
  await $`git commit --no-edit`
} else {
  console.log("qtoc sync: merge complete")
}

if (!skipTrim) {
  console.log("qtoc sync: trim")
  await $`bun run qtoc:trim`
}

if (!skipInstall) {
  console.log("qtoc sync: install")
  await $`bun install`
}

if (!skipTypecheck) {
  console.log("qtoc sync: typecheck")
  await $`bun run typecheck`
}

console.log("qtoc sync: done")
console.log("  next: bun run qtoc:build")
console.log("  then: run the smoke checklist in packages/qtui/docs/ops/qt-headless.md")
