import type { SessionInfo, SessionsResponse } from "@opencode/client/promise"
import { pathKey } from "@/workspaces/path-key"
import { SESSION_RECENT_LIMIT, SESSION_RECENT_WINDOW } from "@/runtime/server/global-sync/types"

// Side bar counts and quiet projects require the full inventory; retain only recent rows while folding each page.
export const SESSION_INDEX_PAGE_LIMIT = 5_000

export const SESSION_LIST_LIMIT = 64

// Rows kept per directory from the fetched index: the visible limit plus the
// recent-window search bucket. Merging locally known sessions and pending
// removals into this subset resolves exactly like merging into the complete
// index, so Home shows the same rows, order, and search results while the
// query cache and every per-update re-merge stay bounded by directory count.
export const SESSION_INDEX_LIMIT = SESSION_LIST_LIMIT + SESSION_RECENT_LIMIT

type SessionList = (
  input: {
    limit: number
    order: "desc"
    parentID: null
    cursor?: string
  },
  options: { signal?: AbortSignal },
) => Promise<SessionsResponse>

export async function loadSessionIndex(list: SessionList, signal?: AbortSignal) {
  return (await loadSessionInventory(list, signal)).sessions
}

export async function loadSessionInventory(list: SessionList, signal?: AbortSignal) {
  const now = Date.now()
  const inventory = new Map<string, Pick<SessionInfo, "id" | "projectID" | "location">>()
  let retained: SessionInfo[] = []
  let cursor: string | undefined

  for (;;) {
    const response = await list(
      {
        limit: SESSION_INDEX_PAGE_LIMIT,
        order: "desc",
        parentID: null,
        ...(cursor ? { cursor } : {}),
      },
      { signal },
    )

    // Fold each page in as it arrives: pages are newest first, so later pages
    // can only fill directories that still have room. Peak allocation is one
    // page plus the retained subset, not the whole history.
    const visible = parseSessionIndex(response.data)
    visible.forEach((session) =>
      inventory.set(session.id, { id: session.id, projectID: session.projectID, location: session.location }),
    )
    retained = retainSessions([...retained, ...visible], SESSION_INDEX_LIMIT, now)

    if (response.data.length < SESSION_INDEX_PAGE_LIMIT || !response.cursor.next)
      return { sessions: retained, inventory: [...inventory.values()] }
    cursor = response.cursor.next
  }
}

export type SessionIndex = Awaited<ReturnType<typeof loadSessionInventory>>

// Keep this filter for locally known sessions merged into the fetched index.
export function parseSessionIndex(sessions: SessionInfo[]) {
  return sessions.filter((session) => !session.parentID && session.time.archived === undefined)
}

export function mergeSessionIndex(fetched: SessionInfo[], known: SessionInfo[]) {
  return parseSessionIndex([
    ...new Map([...fetched, ...known].map((session) => [session.id, session] as const)).values(),
  ])
}

export function retainSessions(sessions: SessionInfo[], limit: number, now: number) {
  return [...Map.groupBy(sessions, (session) => pathKey(session.location.directory)).values()].flatMap((items) => {
    const sorted = items.toSorted((a, b) => {
      const updated = (b.time.updated ?? b.time.created) - (a.time.updated ?? a.time.created)

      return updated || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    })

    const recent = sorted
      .slice(limit)
      .filter((session) => (session.time.updated ?? session.time.created) > now - SESSION_RECENT_WINDOW)
      .slice(0, SESSION_RECENT_LIMIT)

    return [...sorted.slice(0, limit), ...recent]
  })
}
