export * as SessionActivity from "./activity.js"

import { Session } from "@opencode/schema/session"
import { SessionActivitySource } from "./activity-source.js"
import { SessionStore } from "./store.js"
import { Effect } from "effect"

/** Background/tool activity only. Execution ownership remains available through Session.active. */
export const list = Effect.fn("SessionActivity.list")(function* () {
  const sources = yield* SessionActivitySource.Service
  const store = yield* SessionStore.Service
  const sessions = new Map<Session.ID, Session.Info | undefined>()
  const get = Effect.fnUntraced(function* (id: Session.ID) {
    if (!sessions.has(id)) sessions.set(id, yield* store.get(id))
    return sessions.get(id)
  })
  const work = new Map((yield* sources.list).map((item) => [item.id, item]))
  const items = yield* Effect.forEach([...work.values()], (item) =>
    Effect.gen(function* () {
      const session = yield* get(item.sessionID)
      if (!session) return []
      const ancestors: Session.ID[] = []
      const seen = new Set([session.id])
      let parent = session.parentID
      while (parent && !seen.has(parent)) {
        seen.add(parent)
        const info = yield* get(parent)
        if (!info) break
        ancestors.push(info.id)
        parent = info.parentID
      }
      return [{ ...item, ancestors }]
    }),
  )
  return items.flat()
})
