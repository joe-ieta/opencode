import { expect } from "bun:test"
import { Effect } from "effect"
import { it } from "../../core/test/lib/effect"
import { ServerFetch } from "../src/fetch"

it.live("serves background observation separately from execution ownership", () =>
  Effect.gen(function* () {
    const handler = yield* ServerFetch.make({
      app: { version: "test" },
      database: { path: ":memory:" },
      fs: { filewatcher: false },
    })
    const activity = yield* Effect.promise(() =>
      handler(new Request("http://opencode.local/api/experimental/session/activity")),
    )
    expect(activity.status).toBe(200)
    expect(yield* Effect.promise(() => activity.json())).toEqual({ data: [] })
    const execution = yield* Effect.promise(() => handler(new Request("http://opencode.local/api/session/active")))
    expect(execution.status).toBe(200)
    expect(yield* Effect.promise(() => execution.json())).toEqual({ data: {} })
  }).pipe(Effect.scoped),
)
