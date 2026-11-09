import { queryOptions, skipToken, type QueryClient } from "@tanstack/solid-query"
import type { ServerConnection } from "@/runtime/server/registry"
import type { ServerCtx } from "@/runtime/server/runtime"
import { loadSessionInventory, type SessionIndex } from "./session-index"

// Keep the immutable snapshot opaque so Solid Query does not unwrap every session on mount.
export function sessionIndexQuery(conn: ServerConnection.Any | undefined, ctx: ServerCtx | undefined) {
  return queryOptions({
    queryKey: ["home-sessions", conn] as const,
    queryFn: ctx
      ? ({ signal }) => loadSessionInventory((input, options) => ctx.sdk.api.session.list(input, options), signal)
      : skipToken,
    retry: false,
    staleTime: 30_000,
    // The retained sessions and project counts describe the same snapshot and expire together.
    gcTime: Infinity,
    refetchOnMount: true,
    refetchOnReconnect: true,
    select: (index: SessionIndex) => () => index,
  })
}

export function removeIndexedSessions(
  queryClient: QueryClient,
  conn: ServerConnection.Any | undefined,
  ids: readonly string[],
) {
  queryClient.setQueryData<SessionIndex>(
    ["home-sessions", conn],
    (current) =>
      current && {
        sessions: current.sessions.filter((item) => !ids.includes(item.id)),
        inventory: current.inventory.filter((item) => !ids.includes(item.id)),
      },
  )
}

export function renameIndexedSession(queryClient: QueryClient, conn: ServerConnection.Any, id: string, title: string) {
  queryClient.setQueryData<SessionIndex>(
    ["home-sessions", conn],
    (current) =>
      current && { ...current, sessions: current.sessions.map((item) => (item.id === id ? { ...item, title } : item)) },
  )
}
