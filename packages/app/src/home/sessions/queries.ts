import type { SessionInfo } from "@opencode/client/promise"
import { queryOptions, skipToken, useQueries, useQueryClient } from "@tanstack/solid-query"
import { createEffect, createMemo, onCleanup, type Accessor } from "solid-js"
import type { ServerConnection } from "@/runtime/server/registry"
import type { ServerCtx } from "@/runtime/server/runtime"
import { HOME_SESSION_LIMIT, loadHomeSessionIndex, mergeHomeSessionIndex, retainHomeSessions } from "./index"

// Keep the immutable result opaque so Solid Query does not recursively unwrap every session on mount.
const selectSessions = (sessions: SessionInfo[]) => () => sessions

export function homeSessionsQuery(conn: ServerConnection.Any | undefined, ctx: ServerCtx | undefined) {
  return queryOptions({
    queryKey: ["home-sessions", conn] as const,
    queryFn: ctx
      ? ({ signal }) => loadHomeSessionIndex((input, options) => ctx.sdk.api.session.list(input, options), signal)
      : skipToken,
    retry: false,
    staleTime: 30_000,
    // Returning to Home shows the last list and refreshes it, instead of loading again once the cache expires.
    gcTime: Infinity,
    refetchOnMount: true,
    refetchOnReconnect: true,
    select: selectSessions,
  })
}

// Home and the sidebar observe one query cache and overlay the same live session store.
export function createSessionIndexes(connections: Accessor<{ conn: ServerConnection.Any; ctx: ServerCtx }[]>) {
  const queryClient = useQueryClient()
  const queries = useQueries(() => ({
    queries: connections().map((item) => ({
      ...homeSessionsQuery(item.conn, item.ctx),
      enabled: item.ctx.sdk.connection.status() === "connected",
    })),
  }))

  createEffect(() => {
    connections().forEach((item) => {
      onCleanup(
        item.ctx.data.on("session.deleted", (event) =>
          queryClient.setQueryData<SessionInfo[]>(["home-sessions", item.conn], (current) =>
            current?.filter((session) => session.id !== event.data.sessionID),
          ),
        ),
      )
    })
  })

  return {
    sources: createMemo(() =>
      connections().map((item, index) => ({
        ...item,
        sessions: retainHomeSessions(
          item.ctx.data.session.apply(
            mergeHomeSessionIndex(
              queries[index]?.isPending ? [] : (queries[index]?.data?.() ?? []),
              item.ctx.data.session.list(),
            ),
          ),
          HOME_SESSION_LIMIT,
          Date.now(),
        ),
      })),
    ),
    loading: () => queries.some((query) => query.isPending),
  }
}
