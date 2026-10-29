#!/usr/bin/env bun
import { discover, headers } from "@opencode/client/service"
import { V1MigrationStatus } from "@opencode/protocol/groups/migration"
import { Schema } from "effect"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const binary = process.argv[2] && path.resolve(process.argv[2])
if (!binary || !(await Bun.file(binary).exists())) throw new Error("Pass the compiled desktop CLI path")
const temporary = await fs.realpath(os.tmpdir())
const root = await fs.mkdtemp(path.join(temporary, "opencode-desktop-smoke-"))
Object.assign(process.env, {
  HOME: root,
  USERPROFILE: root,
  OPENCODE_TEST_HOME: root,
  OPENCODE_CONFIG_CONTENT: "{}",
  OPENCODE_DISABLE_MODELS_FETCH: "1",
  XDG_CONFIG_HOME: path.join(root, "config"),
  XDG_CACHE_HOME: path.join(root, "cache"),
  XDG_DATA_HOME: path.join(root, "data"),
  XDG_STATE_HOME: path.join(root, "state"),
})
// An override would hide a wrong compiled channel by forcing both builds onto the fixture database.
delete process.env.OPENCODE_DB
delete process.env.OPENCODE_CONFIG
delete process.env.OPENCODE_CONFIG_DIR
delete process.env.OPENCODE_CLI_CONFIG_CONTENT
const database = path.join(root, "data/opencode/opencode.db")
const { seedLegacy } = await import("../../core/test/fixture/v1-migration")
await seedLegacy(database, root)
const reservation = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() })
const port = reservation.port
await reservation.stop(true)
const child = Bun.spawn([binary, "serve", "--service", "--hostname", "127.0.0.1", "--port", String(port)], {
  env: process.env,
  stdout: "ignore",
  stderr: "pipe",
})
const stderr = new Response(child.stderr).text()
try {
  const file = path.join(root, "state/opencode/service.json")
  const deadline = Date.now() + 30_000
  const service = await (async () => {
    while (Date.now() < deadline) {
      const files = await fs.readdir(path.dirname(file)).catch(() => [])
      const wrong = files.find((name) => /^service-.+\.json$/.test(name))
      if (wrong) throw new Error(`Desktop CLI registered ${wrong} instead of service.json`)
      const found = await discover({ file })
      if (found) return found
      if (child.exitCode !== null) throw new Error(`Desktop CLI exited: ${await stderr}`)
      await Bun.sleep(25)
    }
    throw new Error("Desktop CLI did not become discoverable")
  })()
  const endpoint = new URL("/api/experimental/migration/v1", service.url)
  const before = Schema.decodeUnknownSync(V1MigrationStatus)(
    await fetch(endpoint, { headers: headers(service) }).then((response) => response.json()),
  )
  if (before.status !== "confirmation_required")
    throw new Error(`Legacy history was not found: ${JSON.stringify(before)}`)
  const accepted = await fetch(new URL("/api/experimental/migration/v1/accept", service.url), {
    method: "POST",
    headers: { ...headers(service), "content-type": "application/json" },
    body: JSON.stringify({ acknowledged: true }),
  })
  if (!accepted.ok) throw new Error(`Migration acknowledgment failed: ${accepted.status}`)
  const migrationDeadline = Date.now() + 15_000
  while (true) {
    const status = Schema.decodeUnknownSync(V1MigrationStatus)(
      await fetch(endpoint, { headers: headers(service) }).then((response) => response.json()),
    )
    if (status.status === "completed") break
    if (status.status === "error") throw new Error(status.error)
    if (Date.now() >= migrationDeadline) throw new Error("Fixture migration did not complete")
    await Bun.sleep(25)
  }
  await verifyHistory(database)
  console.log("Desktop CLI smoke passed: service.json discovery, shared V1 database, confirmation and migrated history")
} finally {
  child.kill()
  await child.exited
  await stderr
  if (path.dirname(root) !== temporary || !path.basename(root).startsWith("opencode-desktop-smoke-"))
    throw new Error("Unexpected smoke-test cleanup path")
  await fs.rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
}

async function verifyHistory(filename: string) {
  const { Database } = await import("bun:sqlite")
  const database = new Database(filename, { readonly: true })
  try {
    const legacy = database.query("SELECT id FROM message WHERE id = 'msg_smoke'").get()
    const migrated = database
      .query<
        { text: string },
        []
      >("SELECT json_extract(data, '$.text') AS text FROM session_message WHERE id = 'msg_smoke'")
      .get()
    if (!legacy || !migrated || migrated.text !== "preserved V1 history")
      throw new Error("V1 history was not preserved")
  } finally {
    database.close()
  }
}
