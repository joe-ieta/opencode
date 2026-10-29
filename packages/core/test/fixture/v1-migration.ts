import { Database } from "@opencode/core/database/database"
import { Global } from "@opencode/util/global"
import { sql } from "drizzle-orm"
import { Effect } from "effect"

export const createLegacyTables = Effect.fnUntraced(function* (db: Database.Interface["db"]) {
  yield* db.run(sql`
    CREATE TABLE session (
      id text PRIMARY KEY,
      project_id text NOT NULL,
      workspace_id text,
      parent_id text,
      slug text NOT NULL,
      directory text NOT NULL,
      path text,
      title text NOT NULL,
      version text NOT NULL,
      share_url text,
      summary_additions integer,
      summary_deletions integer,
      summary_files integer,
      summary_diffs text,
      metadata text,
      cost real DEFAULT 0 NOT NULL,
      tokens_input integer DEFAULT 0 NOT NULL,
      tokens_output integer DEFAULT 0 NOT NULL,
      tokens_reasoning integer DEFAULT 0 NOT NULL,
      tokens_cache_read integer DEFAULT 0 NOT NULL,
      tokens_cache_write integer DEFAULT 0 NOT NULL,
      revert text,
      permission text,
      agent text,
      model text,
      time_created integer NOT NULL,
      time_updated integer NOT NULL,
      time_compacting integer,
      time_archived integer
    )
  `)
  yield* db.run(sql`
    CREATE TABLE message (
      id text PRIMARY KEY,
      session_id text NOT NULL,
      time_created integer NOT NULL,
      time_updated integer NOT NULL,
      data text NOT NULL
    )
  `)
  yield* db.run(sql`
    CREATE TABLE part (
      id text PRIMARY KEY,
      message_id text NOT NULL,
      session_id text NOT NULL,
      time_created integer NOT NULL,
      time_updated integer NOT NULL,
      data text NOT NULL
    )
  `)
})

export async function seedLegacy(filename: string, directory: string) {
  await Effect.runPromise(
    Effect.gen(function* () {
      const database = yield* Database.Service
      yield* createLegacyTables(database.db)
      yield* database.db.run(sql`
        INSERT INTO project (id, worktree, time_created, time_updated, sandboxes)
        VALUES ('global', ${directory}, 1, 2, '[]')
      `)
      yield* database.db.run(sql`
        INSERT INTO session (id, project_id, slug, directory, title, version, time_created, time_updated)
        VALUES ('ses_desktop_smoke', 'global', 'smoke', ${directory}, 'Migration fixture', '1.19.5', 1, 2)
      `)
      yield* database.db.run(sql`
        INSERT INTO message (id, session_id, time_created, time_updated, data)
        VALUES ('msg_smoke', 'ses_desktop_smoke', 1, 2, ${JSON.stringify({ role: "user", time: { created: 1 }, agent: "build", model: { providerID: "openai", modelID: "gpt-4" } })})
      `)
      yield* database.db.run(sql`
        INSERT INTO part (id, message_id, session_id, time_created, time_updated, data)
        VALUES ('prt_smoke', 'msg_smoke', 'ses_desktop_smoke', 1, 2, '{"type":"text","text":"preserved V1 history"}')
      `)
    }).pipe(Effect.provide(Database.layer({ path: filename })), Effect.provide(Global.layerWith({})), Effect.scoped),
  )
}
