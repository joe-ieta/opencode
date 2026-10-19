import { expect, test } from "bun:test"
import { Cause, Effect, Layer } from "effect"
import { SqlClient } from "effect/sql"
import { SqlError } from "effect/sql/SqlError"
import { sqliteLayer } from "@opencode/core/database/sqlite.bun"
import path from "node:path"
import { tmpdir } from "./fixture/tmpdir"

test.each(["records", "values"] as const)("reports %s preparation failures as SQL errors", async (mode) => {
  const error = await Effect.runPromise(
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      const query = sql`SELECT * FROM missing_table`
      return yield* (mode === "values" ? query.values.pipe(Effect.flip) : query.pipe(Effect.flip))
    }).pipe(Effect.provide(sqliteLayer({ filename: ":memory:" })), Effect.scoped),
  )
  expect(error).toBeInstanceOf(SqlError)
  expect(error.reason.operation).toBe("execute")
  expect(error.reason.cause).toMatchObject({ message: "no such table: missing_table" })
})

test.each(["open", "wal"] as const)("identifies the database and %s initialization failure", async (operation) => {
  await using tmp = await tmpdir()
  const filename = path.join(tmp.path, operation === "open" ? "missing/opencode.db" : "opencode.db")
  if (operation === "wal") await Bun.write(filename, "not a database")
  const exit = await Effect.runPromise(Layer.build(sqliteLayer({ filename })).pipe(Effect.scoped, Effect.exit))
  expect(exit._tag).toBe("Failure")
  if (exit._tag !== "Failure") throw new Error("Expected SQLite initialization to fail")
  const error = Cause.squash(exit.cause)
  expect(error).toBeInstanceOf(SqlError)
  if (!(error instanceof SqlError)) throw error
  expect(error.message).toContain(filename)
  expect(error.reason.operation).toBe(operation === "open" ? "open" : "PRAGMA journal_mode = WAL")
  expect(error.reason.cause).toMatchObject({ code: operation === "open" ? "SQLITE_CANTOPEN" : "SQLITE_NOTADB" })
})
