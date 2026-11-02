import { expect, test } from "bun:test"
import { createRoot } from "solid-js"
import { createStore } from "solid-js/store"
import { createSessionActivity } from "../src/solid/session-activity"
import type { SessionActivityInfo, SessionInfo } from "../src/promise"

test("combines child execution and its Job once while retaining descendant shells", async () => {
  const setup = createRoot((dispose) => {
    const [state, setState] = createStore({
      executing: ["ses_child"],
      background: [
        { id: "session:ses_child", sessionID: "ses_child", kind: "subagent", startedAt: 10, ancestors: ["ses_root"] },
        {
          id: "shell:sh_nested",
          sessionID: "ses_grandchild",
          kind: "shell",
          startedAt: 20,
          ancestors: ["ses_child", "ses_root"],
        },
      ] as SessionActivityInfo[],
    })
    const activity = createSessionActivity({
      load: async () => [...state.background],
      executing: () => state.executing,
      execution: () => "ready",
      session: () => undefined,
      hydrate: async () => undefined,
    })
    return { activity, setState, dispose }
  })
  try {
    await setup.activity.reconnect()
    expect(setup.activity.ready()).toBe(true)
    expect(setup.activity.list("ses_root", true).map((work) => work.kind)).toEqual(["subagent", "shell"])
    expect(setup.activity.active()).toEqual(["ses_child", "ses_root", "ses_grandchild"])
    expect(setup.activity.since("ses_root", true)).toBe(10)
    setup.setState("executing", [])
    expect(setup.activity.busy("ses_root", true)).toBe(true)
    setup.setState("background", [])
    await setup.activity.invalidate()
    expect(setup.activity.active()).toEqual([])
  } finally {
    setup.dispose()
  }
})

test.each(["invalidate", "reconnect"] as const)("discards an older snapshot after %s during a read", async (change) => {
  const reads: ReturnType<typeof Promise.withResolvers<SessionActivityInfo[]>>[] = []
  const second = Promise.withResolvers<void>()
  const setup = createRoot((dispose) => ({
    dispose,
    activity: createSessionActivity({
      load: () => {
        const read = Promise.withResolvers<SessionActivityInfo[]>()
        reads.push(read)
        if (reads.length === 2) second.resolve()
        return read.promise
      },
      executing: () => [],
      execution: () => "ready",
      session: () => undefined,
      hydrate: async () => undefined,
    }),
  }))
  try {
    const loaded = setup.activity.reconnect()
    if (change === "reconnect") setup.activity.disconnect()
    void setup.activity[change]()
    reads[0]!.resolve([{ id: "shell:sh_old", sessionID: "ses_root", kind: "shell", startedAt: 1, ancestors: [] }])
    await second.promise
    expect(setup.activity.ready()).toBe(false)
    expect(setup.activity.active()).toEqual([])
    reads[1]!.resolve([])
    await loaded
    expect(setup.activity.ready()).toBe(true)
    expect(setup.activity.active()).toEqual([])
    expect(reads).toHaveLength(2)
  } finally {
    setup.dispose()
    reads.forEach((read) => read.resolve([]))
  }
})

test("keeps execution visible when background observation is unsupported", async () => {
  const sessions = new Map<string, SessionInfo>()
  const setup = createRoot((dispose) => ({
    dispose,
    activity: createSessionActivity({
      load: async () => {
        throw new Error("Not found")
      },
      executing: () => ["ses_running"],
      execution: () => "ready",
      session: (id) => sessions.get(id),
      hydrate: async () => undefined,
    }),
  }))
  try {
    await setup.activity.reconnect()
    expect(setup.activity.unavailable()).toBe(true)
    expect(setup.activity.ready()).toBe(false)
    expect(setup.activity.active()).toEqual(["ses_running"])
    setup.activity.disconnect()
    expect(setup.activity.ready()).toBe(false)
  } finally {
    setup.dispose()
  }
})
