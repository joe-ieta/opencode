import { batch, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import type { SessionActivityInfo, SessionInfo } from "../promise"

type Work = Omit<SessionActivityInfo, "kind"> & { kind: SessionActivityInfo["kind"] | "model" }

/** Combines execution ownership with optional background observation without changing either contract. */
export function createSessionActivity(input: {
  load: () => Promise<SessionActivityInfo[]>
  executing: () => string[]
  execution: () => "loading" | "ready" | "unavailable"
  session: (id: string) => SessionInfo | undefined
  hydrate: (id: string) => Promise<unknown>
}) {
  const [state, setState] = createStore({
    work: [] as SessionActivityInfo[],
    availability: "loading" as "loading" | "ready" | "unavailable",
  })
  let revision = 0
  let connected = false
  let disposed = false
  let dirty = false
  let pending: Promise<void> | undefined

  onCleanup(() => {
    disposed = true
    revision++
  })

  function refresh() {
    revision++
    dirty = true
    setState("availability", "loading")
    if (pending || !connected || disposed) return pending ?? Promise.resolve()
    pending = drain().finally(() => {
      pending = undefined
      if (dirty && connected && !disposed) void refresh()
    })
    return pending
  }

  async function drain() {
    while (dirty && connected && !disposed) {
      dirty = false
      const version = revision
      const result = await input.load().then(
        (work) => ({ work }),
        () => undefined,
      )
      if (disposed || !connected || version !== revision) continue
      if (!result) {
        setState("availability", "unavailable")
        return
      }
      batch(() => {
        setState("work", result.work)
        setState("availability", "ready")
      })
      const ids = new Set(result.work.flatMap((item) => [item.sessionID, ...item.ancestors]))
      void Promise.allSettled([...ids].filter((id) => !input.session(id)).map(input.hydrate))
    }
  }

  const work = () => {
    const items = new Map<string, Work>(state.work.map((item) => [item.id, item]))
    input.executing().forEach((id) => {
      if (items.has(`session:${id}`)) return
      const session = input.session(id)
      const ancestors: string[] = []
      const seen = new Set([id])
      let parent = session?.parentID
      while (parent && !seen.has(parent)) {
        seen.add(parent)
        ancestors.push(parent)
        parent = input.session(parent)?.parentID
      }
      items.set(`session:${id}`, {
        id: `session:${id}`,
        sessionID: id,
        ancestors,
        kind: session?.parentID ? "subagent" : "model",
        title: session?.title,
        startedAt: session?.time.busy ?? 0,
      })
    })
    return [...items.values()]
  }

  const list = (id: string, family = false) =>
    work().filter((item) => item.sessionID === id || (family && item.ancestors.includes(id)))

  return {
    reconnect() {
      connected = true
      return refresh()
    },
    disconnect() {
      connected = false
      revision++
      setState("availability", "loading")
    },
    invalidate: refresh,
    ready: () => state.availability === "ready" && input.execution() === "ready",
    unavailable: () => state.availability === "unavailable" || input.execution() === "unavailable",
    list,
    active: () => [...new Set(work().flatMap((item) => [item.sessionID, ...item.ancestors]))],
    busy: (id: string, family = false) => list(id, family).length > 0,
    since(id: string, family = false) {
      const starts = list(id, family)
        .map((item) => item.startedAt)
        .filter((time) => time > 0)
      return starts.length ? Math.min(...starts) : undefined
    },
  }
}
