import { useQueries, useQueryClient } from "@tanstack/solid-query"
import { createEffect, createMemo, onCleanup, type Accessor } from "solid-js"
import type { ServerConnection } from "@/runtime/server/registry"
import type { ServerCtx } from "@/runtime/server/runtime"
import { SESSION_LIST_LIMIT, mergeSessionIndex, retainSessions } from "@/runtime/server/session-index"
import { removeIndexedSessions, sessionIndexQuery } from "@/runtime/server/session-queries"

// Home and the sidebar observe one query cache and overlay the same live session store.
export function createSessionIndexes(connections: Accessor<{ conn: ServerConnection.Any; ctx: ServerCtx }[]>) {
  const queryClient = useQueryClient()

  const queries = useQueries(() => ({
    queries: connections().map((item) => ({
      ...sessionIndexQuery(item.conn, item.ctx),
      enabled: item.ctx.sdk.connection.status() === "connected",
    })),
  }))

  createEffect(() => {
    connections().forEach((item, index) => {
      onCleanup(
        item.ctx.data.on("session.deleted", (event) => {
          removeIndexedSessions(queryClient, item.conn, [event.data.sessionID])
        }),
      )
      // A collapsed history row may only have an index snapshot; Data does not refresh unloaded sessions on view.
      onCleanup(
        item.ctx.data.on("session.viewed", (event) => {
          const id = event.data.sessionID

          if (item.ctx.data.session.get(id) || !queries[index]?.data?.()?.sessions.some((session) => session.id === id))
            return
          void item.ctx.data.session.sync(id).catch(() => undefined)
        }),
      )
    })
  })

  return {
    sources: createMemo(() =>
      connections().map((item, index) => {
        const inventory = new Map((queries[index]?.data?.()?.inventory ?? []).map((session) => [session.id, session]))
        item.ctx.data.session.list().forEach((session) => {
          if (session.parentID || session.time.archived !== undefined) {
            inventory.delete(session.id)

            return
          }

          inventory.set(session.id, { id: session.id, projectID: session.projectID, location: session.location })
        })

        return {
          ...item,
          inventory: item.ctx.data.session.filterRemoved([...inventory.values()]),
          sessions: retainSessions(
            item.ctx.data.session.apply(
              mergeSessionIndex(
                queries[index]?.isPending ? [] : (queries[index]?.data?.()?.sessions ?? []),
                item.ctx.data.session.known(),
              ),
            ),
            SESSION_LIST_LIMIT,
            Date.now(),
          ),
        }
      }),
    ),
    loading: () => queries.some((query) => query.isPending),
  }
}
