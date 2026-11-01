import { SqliteClient } from "@effect/sql-sqlite-bun"
import { Effect, Layer } from "effect"
import { SqlClient } from "effect/sql"
import { classifySqliteError, SqlError } from "effect/sql/SqlError"

export const supportsTuningPragmas = true

// Foreign keys default OFF and can be toggled per connection.
export const supportsForeignKeyToggle = true

// Opening the database can only fail on a broken file or a lock held past
// busyTimeout; Database.layer treats both as fatal.
export const sqliteLayer = (config: SqliteClient.SqliteClientConfig): Layer.Layer<SqlClient.SqlClient> =>
  SqliteClient.layer(config).pipe(
    Layer.catch((error) =>
      Layer.effect(
        SqlClient.SqlClient,
        Effect.fail(
          new SqlError({
            reason: classifySqliteError(error.reason.cause, {
              message: `${error.message}: ${config.filename}`,
              operation: error.reason.operation,
            }),
          }),
        ),
      ),
    ),
    Layer.orDie,
  )
