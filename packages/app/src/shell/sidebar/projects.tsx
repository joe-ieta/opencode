import { SidebarSessionRow, type SessionTabStatus } from "./session-row"
import { SidebarDraftRow } from "./draft-row"
import "./sidebar.css"
import { createComputed, createEffect, createMemo, For, on, onCleanup, onMount, Show } from "solid-js"
import { createResizeObserver } from "@solid-primitives/resize-observer"
import { createStore } from "solid-js/store"
import { DragDropProvider, PointerSensor } from "@dnd-kit/solid"
import { isSortable } from "@dnd-kit/solid/sortable"
import { Accessibility, AutoScroller, Feedback, PointerActivationConstraints } from "@dnd-kit/dom"
import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers"
import { RestrictToElement } from "@dnd-kit/dom/modifiers"
import { arrayMove } from "@/runtime/array-move"
import { tabKey, type Tab } from "@/shell/tabs/tabs"
import { ServerConnection, serverName, useServers } from "@/runtime/server/registry"
import { useGlobal, useServerCtx } from "@/runtime/server/runtime"
import { useLanguage } from "@/runtime/i18n/language"
import { useCommand } from "@/shell/commands/command"
import { useTabs } from "@/shell/tabs/tabs"
import { useSessionTabAvatarState } from "@/shell/layout/project-avatar-state"
import { adjacentTabKey, mergeVisibleTabOrder } from "@/shell/titlebar/tab-order"
import { Button } from "@opencode/ui/button"
import { IconButton } from "@opencode/ui/icon-button"
import { Icon } from "@opencode/ui/icon"
import { Menu } from "@opencode/ui/menu"
import { displayName } from "@opencode/ui/project-avatar"
import { pathKey } from "@/workspaces/path-key"
import { setSidebarUnread } from "@/shell/sidebar-peek"
import { createSessionIndexes } from "./history"
import { projectRemoteHint } from "./project-remotes"
import { createProjectActions } from "@/shell/projects/actions"
import { ProjectMenuItems } from "@/shell/projects/menu"
import { isServerFailed } from "@/runtime/server/health-machine"
import type { LocalProject } from "@/shell/state/layout"
import { Persist, persisted } from "@/runtime/persistence/storage"
import { Schema } from "effect"
import { previousSessionCommand, nextSessionCommand } from "@/shell/titlebar/tab-strip"

const PROJECT_SESSION_LIMIT = 5

// Keep local history navigation separate from the upstream open-tab strip.
export function SidebarProjects(props: {
  tabs: Tab[]
  currentTab: Tab | undefined
  onNavigate: (tab: Tab, el?: HTMLDivElement) => void
  onClose: (tab: Tab) => void
}) {
  const global = useGlobal()
  const language = useLanguage()
  const command = useCommand()
  const tabs = useTabs()
  const projectActions = createProjectActions()
  const [projectMenu, setProjectMenu] = createStore<{ open?: string }>({})
  let projectMenuFocus: HTMLButtonElement | undefined
  let listRef!: HTMLDivElement
  let boundsRef!: HTMLDivElement
  let scrollRef!: HTMLDivElement
  // Each vertical edge feathers by as much as there is left to scroll past it, so it appears and leaves without a jump.
  const [fade, setFade] = createStore({ top: 0, bottom: 0 })

  const measureFade = () =>
    setFade({
      top: Math.min(16, Math.round(scrollRef.scrollTop)),
      bottom: Math.min(
        16,
        Math.max(0, Math.round(scrollRef.scrollHeight - scrollRef.clientHeight - scrollRef.scrollTop)),
      ),
    })

  onMount(() => {
    createResizeObserver([scrollRef, listRef], measureFade)
  })
  const [visibility, setVisibility] = createStore<Record<string, boolean>>({})
  const [status, setStatus] = createStore<Record<string, SessionTabStatus | undefined>>({})
  const [expanded, setExpanded] = createStore<Record<string, boolean>>({})
  const collator = createMemo(() => new Intl.Collator(language.intl(), { numeric: true, sensitivity: "base" }))

  const servers = useServers()

  const sidebar = createSessionIndexes(() =>
    servers.visible.flatMap((conn) => {
      const ctx = global.serverCtx(ServerConnection.key(conn))

      return ctx ? [{ conn, ctx }] : []
    }),
  )

  const sidebarOrder = persisted(Persist.window("sidebar.order"), Schema.Array(Schema.String), [])
  const collapsed = persisted(Persist.window("sidebar.collapsedProjects"), Schema.Array(Schema.String), [])
  const pinned = persisted(Persist.window("sidebar.pinnedProjects"), Schema.Array(Schema.String), [])

  const indexed = createMemo(
    () =>
      new Map(
        sidebar
          .sources()
          .flatMap((source) =>
            source.sessions.map(
              (session) =>
                [
                  tabKey({ type: "session", server: ServerConnection.key(source.conn), sessionId: session.id }),
                  { session, ctx: source.ctx, server: ServerConnection.key(source.conn) },
                ] as const,
            ),
          ),
      ),
  )

  const positions = new Map<string, number>()

  // Keep row identities and display order when a tab opens or closes. History is never copied into the tab store.
  const displayedTabs = createMemo((previous: Tab[]) => {
    if (!tabs.sidebar.ready()) return []
    const before = new Map(previous.map((tab) => [tabKey(tab), tab]))
    const candidates = new Map(props.tabs.filter((tab) => !tabs.sidebar.hidden(tab)).map((tab) => [tabKey(tab), tab]))
    indexed().forEach((entry, key) => {
      if (candidates.has(key)) return
      const tab = before.get(key) ?? { type: "session" as const, server: entry.server, sessionId: entry.session.id }

      if (!tabs.sidebar.hidden(tab)) candidates.set(key, tab)
    })
    // Equal timestamps keep their original order even while server metadata arrives at different times.
    candidates.forEach((_, key) => {
      if (!positions.has(key)) positions.set(key, positions.size)
    })

    const projects = new Map(
      sidebar
        .sources()
        .map((source) => [
          ServerConnection.key(source.conn),
          new Set(source.ctx.projects.visible().map((project) => pathKey(project.worktree))),
        ]),
    )

    candidates.forEach((tab, key) => {
      const ctx = global.serverCtx(tab.server)

      const session =
        tab.type === "session" ? (ctx?.data.session.get(tab.sessionId) ?? indexed().get(key)?.session) : undefined

      // Child sessions stay accessible through their parent's subagent view.
      if (session?.parentID) candidates.delete(key)

      const project =
        tab.type === "draft" ? ctx?.projects.forDirectory(tab.directory) : session && ctx?.projects.forSession(session)

      if (project && !projects.get(tab.server)?.has(pathKey(project.worktree))) candidates.delete(key)
    })

    const recent = [...candidates.values()]
      .filter((tab) => tab.type === "session")
      .map((tab) => ({
        key: tabKey(tab),
        updated: Math.max(
          global.serverCtx(tab.server)?.data.session.get(tab.sessionId)?.time.updated ?? 0,
          indexed().get(tabKey(tab))?.session.time.updated ?? 0,
        ),
      }))
      .toSorted(
        (a, b) =>
          b.updated - a.updated || (positions.get(a.key) ?? positions.size) - (positions.get(b.key) ?? positions.size),
      )
      .map((item) => item.key)
      .values()

    const order = [...candidates.values()].map((tab) => (tab.type === "draft" ? tabKey(tab) : recent.next().value!))

    return [...new Set([...(sidebarOrder[0] ?? []), ...order])].flatMap((key) => candidates.get(key) ?? [])
  }, [])

  const opened = createMemo(() => new Set(props.tabs.map(tabKey)))

  const groups = createMemo(() => {
    const result = new Map<
      string,
      {
        key: string
        name: string
        directory?: string
        server?: string
        connection: ServerConnection.Key
        project?: LocalProject
        tabs: Tab[]
      }
    >()

    const totals = new Map<string, string[]>()
    sidebar.sources().forEach((source) =>
      source.inventory.forEach((session) => {
        const root = source.ctx.projects.forSession(session)?.worktree ?? session.location.directory
        const key = JSON.stringify([ServerConnection.key(source.conn), pathKey(root)])
        const sessions = totals.get(key)

        if (sessions) {
          sessions.push(session.id)

          return
        }

        totals.set(key, [session.id])
      }),
    )
    sidebar.sources().forEach((source) => {
      const server = ServerConnection.key(source.conn)
      source.ctx.projects.visible().forEach((project) => {
        const key = JSON.stringify([server, pathKey(project.worktree)])
        result.set(key, {
          key,
          name: displayName(project),
          directory: project.worktree,
          project,
          connection: server,
          server: servers.visible.length > 1 ? serverName(source.conn) : undefined,
          tabs: [],
        })
      })
    })
    displayedTabs().forEach((tab) => {
      const ctx = global.serverCtx(tab.server)

      const session =
        tab.type === "session"
          ? (ctx?.data.session.get(tab.sessionId) ?? indexed().get(tabKey(tab))?.session)
          : undefined

      const directory =
        tab.type === "draft"
          ? tab.directory
          : (session?.location.directory ??
            tabs.pendingSession(tab.server, tab.sessionId)?.draft.directory ??
            tabs.info[tabKey(tab)]?.directory)

      const project = session
        ? ctx?.projects.forSession(session)
        : directory
          ? ctx?.projects.forDirectory(directory)
          : undefined

      const root = project?.worktree ?? directory
      const key = JSON.stringify([tab.server, root ? pathKey(root) : null])
      const existing = result.get(key)

      if (existing) {
        existing.tabs.push(tab)

        return
      }

      const conn = servers.visible.find((item) => ServerConnection.key(item) === tab.server)
      result.set(key, {
        key,
        name: root ? displayName(project ?? { worktree: root }) : language.t("sidebar.grouping.other"),
        directory: root,
        project,
        connection: tab.server,
        server: servers.visible.length > 1 && conn ? serverName(conn) : undefined,
        tabs: [tab],
      })
    })
    const pins = new Set(pinned[0])

    return [...result.values()]
      .map((group) => {
        const sessions = group.tabs.filter((tab) => tab.type === "session")

        return {
          ...group,
          recent: sessions.length,
          total: new Set([...(totals.get(group.key) ?? []), ...sessions.map((tab) => tab.sessionId)]).size,
        }
      })
      .toSorted(
        (a, b) =>
          Number(pins.has(b.key)) - Number(pins.has(a.key)) ||
          collator().compare(a.name, b.name) ||
          servers.visible.findIndex((conn) => ServerConnection.key(conn) === a.connection) -
            servers.visible.findIndex((conn) => ServerConnection.key(conn) === b.connection) ||
          a.key.localeCompare(b.key),
      )
  })

  const groupsByKey = createMemo(() => new Map(groups().map((group) => [group.key, group])))

  const pinnedGroups = createMemo(() =>
    groups()
      .filter((group) => pinned[0].includes(group.key))
      .map((group) => group.key),
  )
  const unpinnedGroups = createMemo(() =>
    groups()
      .filter((group) => !pinned[0].includes(group.key))
      .map((group) => group.key),
  )

  const currentKey = createMemo(() => props.currentTab && tabKey(props.currentTab))

  const projectActivity = createMemo(
    () =>
      new Map(
        groups().map((group) => {
          const activity = group.tabs.flatMap((tab) => {
            const key = tabKey(tab)
            const state = status[key]

            if (!state?.attention && !state?.loading) return []

            return [{ tab, priority: key === currentKey() ? 2 : state.attention ? 1 : 0 }]
          })

          return [group.key, activity.toSorted((a, b) => b.priority - a.priority).map((item) => item.tab)] as const
        }),
      ),
  )

  // Save completed rows before the preview renders their history order.
  createComputed(
    on(projectActivity, (activity, previous) => {
      if (!previous || !sidebarOrder[3]() || !sidebarOrder[0].length) return
      const saved = sidebarOrder[0]
      const recorded = new Set(saved)

      const next = groups().reduce((order, group) => {
        const before = previous.get(group.key)

        if (!before?.length) return order
        const keys = group.tabs.map(tabKey)

        if (!keys.some((key) => recorded.has(key))) return order
        const present = new Set(keys)
        const stillActive = new Set(activity.get(group.key)?.map(tabKey))
        const ended = before.map(tabKey).filter((key) => present.has(key) && status[key] && !stillActive.has(key))

        if (!ended.length) return order
        const completed = new Set(ended)

        return mergeVisibleTabOrder([...new Set([...order, ...keys])], keys, [
          ...ended,
          ...keys.filter((key) => !completed.has(key)),
        ])
      }, saved)

      if (next.length !== saved.length || next.some((key, index) => key !== saved[index])) sidebarOrder[1](() => next)
    }),
  )

  const projectTabs = createMemo(
    () =>
      new Map(
        groups().map((group) => {
          const activity = projectActivity().get(group.key) ?? []
          const promoted = new Set(activity.map(tabKey))

          if (collapsed[0].includes(group.key)) return [group.key, { rows: [] as Tab[], promoted }] as const
          const ordered = [...activity, ...group.tabs.filter((tab) => !promoted.has(tabKey(tab)))]

          if (expanded[group.key]) return [group.key, { rows: ordered, promoted }] as const
          const rows = ordered.slice(0, PROJECT_SESSION_LIMIT)
          const selected = group.tabs.find((tab) => tabKey(tab) === currentKey())

          if (!selected || rows.includes(selected)) return [group.key, { rows, promoted }] as const
          // Keep an otherwise hidden selection after the activity, within the preview limit.
          const index = Math.min(activity.length, PROJECT_SESSION_LIMIT - 1)
          promoted.add(tabKey(selected))

          return [group.key, { rows: [...rows.slice(0, index), selected, ...rows.slice(index, -1)], promoted }] as const
        }),
      ),
  )

  const tabGroups = createMemo(
    () => new Map(groups().flatMap((group) => group.tabs.map((tab) => [tabKey(tab), group] as const))),
  )

  const orderedTabs = createMemo(() => [...projectTabs().values()].flatMap((item) => item.rows))
  const visibleTabs = createMemo(() => orderedTabs().filter((tab) => tab.type === "draft" || visibility[tabKey(tab)]))
  const visibleTabIds = () => visibleTabs().map(tabKey)

  const isUnread = (tab: Tab) =>
    (!props.currentTab || tabKey(tab) !== tabKey(props.currentTab)) && !!status[tabKey(tab)]?.unread

  // Include collapsed projects and rows outside the recent preview, while excluding the current session.
  createEffect(() => {
    setSidebarUnread(displayedTabs().some(isUnread))
    onCleanup(() => setSidebarUnread(false))
  })

  command.register("titlebar-tab-cycle", () => [
    {
      id: `tab.prev`,
      category: "tab",
      title: "",
      keybind: `mod+option+ArrowLeft,ctrl+shift+tab`,
      hidden: true,
      onSelect: () => selectAdjacentTab(-1),
    },
    {
      id: `tab.next`,
      category: "tab",
      title: "",
      keybind: `mod+option+ArrowRight,ctrl+tab`,
      hidden: true,
      onSelect: () => selectAdjacentTab(1),
    },
    {
      ...previousSessionCommand,
      category: language.t("command.category.session"),
      title: language.t("command.session.previous"),
      onSelect: () => selectAdjacentTab(-1),
    },
    {
      ...nextSessionCommand,
      category: language.t("command.category.session"),
      title: language.t("command.session.next"),
      onSelect: () => selectAdjacentTab(1),
    },
    {
      id: "session.previous.unseen",
      category: language.t("command.category.session"),
      title: language.t("command.session.previous.unseen"),
      keybind: "shift+alt+arrowup",
      onSelect: () => selectAdjacentTab(-1, (key) => !!status[key]?.unread),
    },
    {
      id: "session.next.unseen",
      category: language.t("command.category.session"),
      title: language.t("command.session.next.unseen"),
      keybind: "shift+alt+arrowdown",
      onSelect: () => selectAdjacentTab(1, (key) => !!status[key]?.unread),
    },
  ])

  // One registration numbers the visible tabs, so a reorder, a close or a tab coming into view never leaves two tabs
  // holding the same number while their owners update.
  const tabRefs = new Map<string, () => HTMLDivElement | undefined>()

  command.register("titlebar-tab-numbers", () =>
    visibleTabs()
      .slice(0, 9)
      .map((tab, index) => ({
        id: `tab.${index + 1}`,
        category: "tab",
        title: "",
        keybind: `mod+${index + 1}`,
        hidden: true,
        onSelect: () => navigate(tab, tabRefs.get(tabKey(tab))?.()),
      })),
  )

  function selectAdjacentTab(offset: -1 | 1, include?: (key: string) => boolean) {
    const current = props.currentTab
    const key = adjacentTabKey(visibleTabIds(), current ? tabKey(current) : undefined, offset, include)
    const next = displayedTabs().find((tab) => tabKey(tab) === key)

    if (next) navigate(next)
  }

  function navigate(tab: Tab, element?: HTMLDivElement) {
    if (tab.type === "draft") return props.onNavigate(tab, element)
    const entry = indexed().get(tabKey(tab))

    if (entry) entry.ctx.data.session.remember(entry.session)
    props.onNavigate(tabs.addSessionTab({ server: tab.server, sessionId: tab.sessionId }), element)
  }

  const renderTab = (tab: Tab) => {
    const id = tabKey(tab)
    let ref!: HTMLDivElement
    // Live metadata refreshes must not reset the sortable's in-flight index when the row order is unchanged.
    const visibleIndex = createMemo(() => visibleTabs().findIndex((item) => tabKey(item) === id))
    // Hover reads this outside rendering, so own its computation with the row.
    const active = createMemo(() => currentKey() === id)
    const group = () => tabGroups().get(id)

    const sortDisabled = () =>
      projectTabs()
        .get(group()?.key ?? "")
        ?.promoted.has(id)

    const element = () => ref
    tabRefs.set(id, element)
    onCleanup(() => {
      if (tabRefs.get(id) === element) tabRefs.delete(id)
    })

    const serverCtx = useServerCtx(() => {
      if (tab.type !== "session") return

      return global.servers.list().find((item) => ServerConnection.key(item) === tab.server)
    })

    if (tab.type === "session") {
      return (
        <>
          <SidebarSessionRow
            tab={tab}
            currentTab={props.currentTab}
            id={id}
            index={visibleIndex()}
            active={active()}
            sortGroup={group()?.key}
            sortDisabled={sortDisabled()}
            serverCtx={serverCtx()}
            status={status[id]}
            indexed={indexed().get(id)?.session}
            opened={opened().has(id)}
            dismissible
            onVisibleChange={(visible) => setVisibility(id, visible)}
            onNavigate={(element) => {
              ref = element
              navigate(tab, element)
            }}
            onClose={() => {
              if (!opened().has(id)) return tabs.sidebar.hide(tab)
              props.onClose(tab)
            }}
          />
        </>
      )
    }

    return (
      <>
        <SidebarDraftRow
          tab={tab}
          id={id}
          index={visibleIndex()}
          active={active()}
          sortGroup={group()?.key}
          sortDisabled={sortDisabled()}
          title={language.t("sidebar.draft.unsent")}
          onNavigate={(element) => {
            ref = element
            navigate(tab, element)
          }}
          onClose={() => props.onClose(tab)}
        />
      </>
    )
  }

  const groupRemotes = (group: { connection: ServerConnection.Key; directory?: string }) =>
    group.directory
      ? global.serverCtx(group.connection)?.data.location.vcs.info({ directory: group.directory })?.experimental
          ?.remotes
      : undefined

  const loadGroupRemotes = (group: { connection: ServerConnection.Key; directory?: string }) => {
    const directory = group.directory
    const ctx = global.serverCtx(group.connection)

    if (!directory || !ctx) return
    const location = { directory }
    if (ctx.data.location.vcs.info(location)) return
    void ctx.data.location.vcs.sync(location).catch(() => undefined)
  }

  const renderGroup = (key: string) => (
    <>
      <Show when={groupsByKey().get(key)}>
        {(group) => (
          <div
            class="sidebar-project-header mt-3 mb-1 min-w-0 rounded-md bg-v2-background-bg-layer-02 px-1.5 py-1"
            data-menu-open={projectMenu.open === key ? "" : undefined}
            onPointerEnter={() => loadGroupRemotes(group())}
            onFocusIn={() => loadGroupRemotes(group())}
            onContextMenu={(event) => {
              if (!group().project) return
              event.preventDefault()
              projectMenuFocus = event.currentTarget.querySelector<HTMLButtonElement>("h3 button") ?? undefined
              setProjectMenu("open", key)
            }}
            onKeyDown={(event) => {
              if (!group().project || !((event.shiftKey && event.key === "F10") || event.key === "ContextMenu")) return
              event.preventDefault()
              projectMenuFocus = event.currentTarget.querySelector<HTMLButtonElement>("h3 button") ?? undefined
              setProjectMenu("open", key)
            }}
            title={[
              group().name,
              group().directory,
              group().server,
              ...projectRemoteHint(groupRemotes(group())),
              language.plural("sidebar.recent.count", group().total, {
                recent: group().recent,
                shown:
                  projectTabs()
                    .get(key)
                    ?.rows.filter((tab) => tab.type === "session").length ?? 0,
              }),
            ]
              .filter(Boolean)
              .join("\n")}
          >
            <div class="relative flex h-5 min-w-0 items-center">
              <h3
                aria-label={group().name}
                class="min-w-0 flex-1 text-[13px] leading-4 font-medium text-v2-text-text-base"
              >
                <button
                  type="button"
                  class="flex w-full min-w-0 items-center gap-1 rounded-sm text-start outline-none focus-visible:ring-1 focus-visible:ring-v2-border-border-focus"
                  aria-label={language.t(
                    collapsed[0].includes(key) ? "sidebar.project.expand" : "sidebar.project.collapse",
                    { project: group().name },
                  )}
                  aria-expanded={!collapsed[0].includes(key)}
                  onClick={() => {
                    if (!collapsed[3]()) return
                    collapsed[1]((keys) => (keys.includes(key) ? keys.filter((item) => item !== key) : [...keys, key]))
                  }}
                >
                  <Icon name={collapsed[0].includes(key) ? "chevron-right" : "chevron-down"} class="shrink-0" />
                  <Show when={group().tabs.some(isUnread)}>
                    <span
                      role="img"
                      aria-label={language.t("sidebar.project.unread")}
                      class="size-1.5 shrink-0 rounded-full bg-v2-background-bg-accent"
                    />
                  </Show>
                  <span dir="auto" class="min-w-0 flex-1 truncate">
                    {group().name}
                  </span>
                </button>
              </h3>
              <div class="sidebar-project-actions absolute inset-y-0 end-0 z-10 flex items-center gap-2 bg-v2-background-bg-layer-02">
                <span class="shrink-0 rounded px-1 text-[11px] leading-4 tabular-nums text-v2-text-text-faint">
                  {group().recent}/{group().total}
                </span>
                <Show when={group().project}>
                  {(project) => (
                    <Show when={servers.visible.find((conn) => ServerConnection.key(conn) === group().connection)}>
                      {(conn) => (
                        <Menu
                          gutter={6}
                          modal={false}
                          placement="bottom-end"
                          open={projectMenu.open === key}
                          onOpenChange={(open) => setProjectMenu("open", open ? key : undefined)}
                        >
                          <Menu.Trigger
                            as={IconButton}
                            size="small"
                            variant="ghost-muted"
                            class="sidebar-project-action"
                            icon={<Icon name="outline-dots" />}
                            aria-label={language.t("sidebar.project.moreOptions", { project: group().name })}
                          />
                          <Menu.Portal>
                            <Menu.Content
                              onInteractOutside={() => {
                                projectMenuFocus = undefined
                              }}
                              onCloseAutoFocus={(event) => {
                                const focus = projectMenuFocus
                                projectMenuFocus = undefined

                                if (!focus?.isConnected) return
                                event.preventDefault()
                                requestAnimationFrame(() => focus.focus())
                              }}
                            >
                              <ProjectMenuItems
                                server={conn()}
                                project={project()}
                                unread={projectActions.hasUnread(conn(), project())}
                                canImportSession={projectActions.canImportSession}
                                importingSession={projectActions.importingSession()}
                                canRevealProject={projectActions.canReveal}
                                onOpenProjectNewSession={(conn, directory) => {
                                  collapsed[1]((keys) => keys.filter((item) => item !== key))
                                  projectActions.openNewSession(conn, directory)
                                }}
                                onImportSession={projectActions.importSession}
                                onEditProject={projectActions.edit}
                                onRevealProject={projectActions.reveal}
                                onClearNotifications={projectActions.clearNotifications}
                                onHideProject={(conn, project) => {
                                  setProjectMenu("open", undefined)
                                  projectActions.hide(conn, project)
                                }}
                              />
                            </Menu.Content>
                          </Menu.Portal>
                        </Menu>
                      )}
                    </Show>
                  )}
                </Show>
                <Show when={group().directory}>
                  {(directory) => (
                    <IconButton
                      size="small"
                      variant="ghost-muted"
                      class="sidebar-project-action"
                      icon={<Icon name="edit" />}
                      aria-label={language.t("sidebar.project.newSession", { project: group().name })}
                      title={language.t("sidebar.project.newSession", { project: group().name })}
                      onClick={() => {
                        collapsed[1]((keys) => keys.filter((item) => item !== key))
                        const conn = servers.visible.find((item) => ServerConnection.key(item) === group().connection)

                        if (conn) projectActions.openNewSession(conn, directory())
                      }}
                    />
                  )}
                </Show>
                <IconButton
                  size="small"
                  variant="ghost-muted"
                  class="sidebar-project-action"
                  state={pinned[0].includes(key) ? "pressed" : undefined}
                  icon={<Icon name="pin" />}
                  disabled={!pinned[3]()}
                  aria-pressed={!!pinned[0].includes(key)}
                  aria-label={language.t(pinned[0].includes(key) ? "sidebar.project.unpin" : "sidebar.project.pin", {
                    project: group().name,
                  })}
                  title={language.t(pinned[0].includes(key) ? "sidebar.project.unpin" : "sidebar.project.pin", {
                    project: group().name,
                  })}
                  onClick={() =>
                    pinned[1]((keys) => (keys.includes(key) ? keys.filter((item) => item !== key) : [...keys, key]))
                  }
                />
              </div>
            </div>
            <Show when={group().server}>
              <div dir="auto" class="truncate text-[12px] leading-4 text-v2-text-text-faint">
                {group().server}
              </div>
            </Show>
          </div>
        )}
      </Show>
      <div class="flex min-w-0 flex-col gap-1 ps-2">
        <For each={projectTabs().get(key)?.rows}>{renderTab}</For>
      </div>
      <Show when={groupsByKey().get(key)}>
        {(group) => (
          <Show when={!collapsed[0].includes(key) && group().tabs.length > PROJECT_SESSION_LIMIT}>
            <Button
              variant="ghost-muted"
              size="small"
              class="h-7 shrink-0 justify-start"
              aria-expanded={!!expanded[key]}
              aria-label={
                expanded[key]
                  ? language.t("sidebar.recent.collapse", { project: group().name })
                  : language.plural("sidebar.recent.expand", group().tabs.length - PROJECT_SESSION_LIMIT, {
                      project: group().name,
                    })
              }
              onClick={() => setExpanded(key, !expanded[key])}
            >
              {expanded[key]
                ? language.t("sidebar.recent.less")
                : language.plural("sidebar.recent.more", group().tabs.length - PROJECT_SESSION_LIMIT)}
            </Button>
          </Show>
        )}
      </Show>
    </>
  )

  return (
    <div
      ref={boundsRef}
      data-slot="vertical-tabs"
      data-orientation="vertical"
      class="sidebar-sessions relative min-w-0 min-h-0 overflow-hidden"
    >
      {/* Status tracking must outlive rows hidden by a collapsed project or the recent preview. */}
      <For each={displayedTabs()}>
        {(tab) => {
          if (tab.type !== "session") return
          const id = tabKey(tab)

          const state = useSessionTabAvatarState(
            () => tab.server,
            () => tab.sessionId,
            () => true,
            () => indexed().get(id)?.session,
          )

          createEffect(() =>
            setStatus(id, {
              unread: state.unread() && !state.loading(),
              attention: state.attention(),
              loading: state.loading(),
            }),
          )
          onCleanup(() => setStatus(id, undefined))

          return null
        }}
      </For>
      <DragDropProvider
        sensors={[
          PointerSensor.configure({
            activationConstraints: (event) =>
              event.pointerType === "touch"
                ? [new PointerActivationConstraints.Distance({ value: 8 })]
                : [new PointerActivationConstraints.Distance({ value: 4 })],
            preventActivation: (event) =>
              event.target instanceof Element &&
              !!event.target.closest(
                '[data-slot="tab-close"], [contenteditable="true"], [contenteditable="plaintext-only"]',
              ),
          }),
        ]}
        modifiers={[RestrictToVerticalAxis, RestrictToElement.configure({ element: () => boundsRef })]}
        plugins={(defaults) => [
          ...defaults.filter((plugin) => plugin !== Accessibility),
          AutoScroller.configure({ acceleration: 8, threshold: { x: 0, y: 0.05 } }),
          Feedback.configure({ dropAnimation: null }),
        ]}
        onDragEnd={(event) => {
          const source = event.operation.source

          if (event.canceled || !isSortable(source)) return
          const group = tabGroups().get(source.id.toString())
          const promoted = group && projectTabs().get(group.key)?.promoted
          const visible = visibleTabIds()

          const current = group
            ? visible.filter((key) => tabGroups().get(key) === group && !promoted?.has(key))
            : visible

          const from = group ? current.indexOf(source.id.toString()) : source.initialIndex
          const to = group ? current.indexOf(visible[source.index]) : source.index

          if (from !== -1 && to !== -1 && from !== to) {
            const keys = mergeVisibleTabOrder(displayedTabs().map(tabKey), current, arrayMove(current, from, to))
            const save = () => sidebarOrder[1](() => keys)

            if (sidebarOrder[3]()) return save()
            void sidebarOrder[3].promise?.then(save)
          }
        }}
      >
        <>
          <div class="mb-2 flex h-7 shrink-0 items-center justify-between gap-2 [app-region:no-drag]">
            <h2 class="min-w-0 flex-1 text-[13px] leading-4 font-medium text-v2-text-text-muted">
              {language.t("home.projects")}
            </h2>
            <span
              class="shrink-0 rounded px-1 text-[11px] leading-4 tabular-nums text-v2-text-text-faint"
              title={language.plural("sidebar.projects.count", unpinnedGroups().length)}
            >
              {unpinnedGroups().length}
            </span>
            <Show
              when={servers.visible.length === 1}
              fallback={
                <Menu gutter={6} modal={false} placement="bottom-end">
                  <Menu.Trigger
                    as={IconButton}
                    variant="ghost-muted"
                    size="small"
                    icon={<Icon name="folder-add-left" />}
                    aria-label={language.t("home.project.add")}
                    disabled={!servers.visible.length}
                  />
                  <Menu.Portal>
                    <Menu.Content>
                      <For each={servers.visible}>
                        {(conn) => (
                          <Menu.Item
                            disabled={isServerFailed(global.servers.health[ServerConnection.key(conn)])}
                            onSelect={() => projectActions.choose(conn)}
                          >
                            {serverName(conn)}
                          </Menu.Item>
                        )}
                      </For>
                    </Menu.Content>
                  </Menu.Portal>
                </Menu>
              }
            >
              <IconButton
                variant="ghost-muted"
                size="small"
                icon={<Icon name="folder-add-left" />}
                aria-label={language.t("home.project.add")}
                title={language.t("home.project.add")}
                disabled={isServerFailed(global.servers.health[ServerConnection.key(servers.visible[0])])}
                onClick={() => projectActions.choose(servers.visible[0])}
              />
            </Show>
          </div>
        </>
        <div
          ref={scrollRef}
          data-slot="vertical-tabs-scroll"
          data-scrollable
          class="flex min-w-0 min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [app-region:no-drag]"
          style={{ "--vertical-tabs-fade-top": `${fade.top}px`, "--vertical-tabs-fade-bottom": `${fade.bottom}px` }}
          onScroll={() => {
            measureFade()
          }}
        >
          <div
            data-titlebar-tab-list
            data-orientation="vertical"
            class="flex w-full min-w-0 flex-col items-stretch"
            ref={listRef}
          >
            <For each={unpinnedGroups()}>{renderGroup}</For>
          </div>
        </div>
        <Show when={pinnedGroups().length > 0}>
          <section
            aria-label={language.t("sidebar.pinned.title")}
            class="flex min-h-0 max-h-[40%] shrink-0 flex-col border-t border-v2-border-border-base pt-3 pb-3"
          >
            <div class="mb-1 flex shrink-0 items-center gap-2">
              <h2 class="min-w-0 truncate text-[13px] leading-4 font-medium text-v2-text-text-muted">
                {language.t("sidebar.pinned.title")}
              </h2>
              <span
                class="shrink-0 rounded px-1 text-[11px] leading-4 tabular-nums text-v2-text-text-faint"
                title={language.plural("sidebar.pinned.count", pinnedGroups().length)}
              >
                {pinnedGroups().length}
              </span>
            </div>
            <div
              data-slot="sidebar-pinned-scroll"
              data-scrollable
              class="min-h-6 overflow-y-auto overflow-x-hidden overscroll-contain"
            >
              <div
                data-titlebar-tab-list
                data-orientation="vertical"
                class="flex w-full min-w-0 flex-col items-stretch"
              >
                <For each={pinnedGroups()}>{renderGroup}</For>
              </div>
            </div>
          </section>
        </Show>
      </DragDropProvider>
    </div>
  )
}
