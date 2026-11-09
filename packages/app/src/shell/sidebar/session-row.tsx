import { Menu } from "@opencode/ui/menu"
import { useGlobal } from "@/runtime/server/runtime"
import { createSessionBranches } from "@/shell/sessions/branches"
import { sessionLastRunLabel } from "@/shell/sessions/labels"
import { pathKey } from "@/workspaces/path-key"
import { createSessionExporter } from "@/session/commands/export-session"
import { createEffect, createMemo, createResource, onCleanup, Show } from "solid-js"
import { useSortable } from "@dnd-kit/solid/sortable"
import { tabHref, type SessionTab, type Tab } from "@/shell/tabs/tabs"
import { ServerConnection, useServers } from "@/runtime/server/registry"
import { TabNavItem } from "@/shell/titlebar/tab-nav"
import { type ServerCtx } from "@/runtime/server/runtime"
import { useLanguage } from "@/runtime/i18n/language"
import { useTabs } from "@/shell/tabs/tabs"
import { createTabComposerState } from "@/composer/persistence"
import { base64Encode } from "@opencode/util/encode"
import { showToast } from "@/shell/notifications/toast"
import { Button } from "@opencode/ui/button"
import { useDialog } from "@opencode/ui/context/dialog"
import { Dialog, DialogFooter, DialogHeader, DialogTitleGroup } from "@opencode/ui/dialog"
import { sessionTreeIDs } from "@/session/requests/session-request-tree"
import { sessionTitle } from "@/session/title"
import { errorMessage } from "@/shell/layout/helpers"
import { notifySessionTabsRemoved } from "@/shell/titlebar/session-events"
import type { SessionInfo } from "@opencode/client/promise"
import { useQueryClient } from "@tanstack/solid-query"

export type SessionTabStatus = { unread: boolean; attention: boolean; loading: boolean }

function SessionTabSlot(props: {
  tab: SessionTab
  id: string
  index: number
  active: boolean
  sortGroup?: string
  sortDisabled?: boolean
  closable?: boolean
  closeLabel?: string
  session: SessionInfo | undefined
  preparing: boolean
  unread: boolean
  attention: boolean
  loading: boolean
  fallbackTitle?: string
  fallbackDirectory?: string
  onRememberTitle: (sessionID: string, title: string | undefined) => void
  onSaveTitle: (sessionID: string, title: string, signal: AbortSignal) => Promise<void>
  onDelete: () => void
  onNavigate: (element: HTMLDivElement) => void
  onClose: () => void
  onIntent: (hovered: boolean) => void
}) {
  const language = useLanguage()
  const global = useGlobal()
  const exporter = createSessionExporter()
  const branches = createSessionBranches()
  const entry = () => {
    const ctx = global.serverCtx(props.tab.server)
    return ctx && props.session ? { ctx, session: props.session, server: props.tab.server } : undefined
  }
  const branch = () => {
    const value = entry()
    return value && branches.branch(value)
  }
  const worktree = createMemo(() => {
    const value = entry()
    const project = value?.ctx.projects.forSession(value.session)
    if (!value || !project) return
    const key = pathKey(value.session.location.directory)
    return (
      project.sandboxes
        .filter((root) => key === pathKey(root) || key.startsWith(`${pathKey(root)}/`))
        .toSorted((a, b) => b.length - a.length)[0] ?? project.worktree
    )
  })
  const sortable = useSortable({
    get id() {
      return props.id
    },
    get index() {
      return props.index
    },
    get disabled() {
      return props.sortDisabled ?? false
    },
    get type() {
      return props.sortGroup
    },
    get accept() {
      return props.sortGroup ? [props.sortGroup] : undefined
    },
  })

  let ref!: HTMLDivElement

  return (
    <div
      ref={sortable.ref}
      data-titlebar-tab-slot
      data-tab-key={props.id}
      data-active={props.active}
      data-orientation="vertical"
      class="relative flex w-full shrink-0"
      onPointerEnter={() => props.onIntent(true)}
      onPointerLeave={() => props.onIntent(false)}
    >
      <TabNavItem
        ref={(el) => {
          ref = el
        }}
        href={tabHref(props.tab)}
        server={props.tab.server}
        session={props.session}
        preparing={props.preparing}
        unread={props.unread}
        attention={props.attention}
        loading={props.loading}
        fallbackTitle={props.fallbackTitle}
        fallbackDirectory={props.fallbackDirectory}
        onRememberTitle={props.onRememberTitle}
        onSaveTitle={props.onSaveTitle}
        onDelete={props.onDelete}
        onNavigate={() => props.onNavigate(ref)}
        onClose={props.onClose}
        closable={props.closable}
        closeLabel={props.closeLabel}
        closeMenuLabel={props.closeLabel ?? language.t("common.close")}
        previewDetails={{
          lastRun: sessionLastRunLabel(props.session?.time, language),
          branch: branch(),
          worktree: worktree(),
        }}
        onPreviewOpenChange={(open) => {
          const value = entry()
          if (open && value) branches.load([value])
        }}
        menuItems={
          <Menu.Item
            disabled={!props.session || exporter.exporting({ server: props.tab.server, sessionID: props.session.id })}
            onSelect={() => {
              if (props.session) exporter.export({ server: props.tab.server, sessionID: props.session.id })
            }}
          >
            {language.t("common.export")}…
          </Menu.Item>
        }
        active={props.active}
        dragging={sortable.isDragSource()}
        orientation="vertical"
      />
    </div>
  )
}

export function SidebarSessionRow(props: {
  tab: SessionTab
  currentTab?: Tab
  id: string
  index: number
  active: boolean
  sortGroup?: string
  sortDisabled?: boolean
  indexed?: SessionInfo
  opened?: boolean
  dismissible?: boolean
  serverCtx: ServerCtx | undefined
  status: SessionTabStatus | undefined
  onVisibleChange: (visible: boolean) => void
  onNavigate: (element: HTMLDivElement) => void
  onClose: () => void
}) {
  const tabs = useTabs()
  const language = useLanguage()
  const dialog = useDialog()
  const queryClient = useQueryClient()
  const servers = useServers()
  const sdk = createMemo(() => props.serverCtx?.sdk ?? null)
  const pending = createMemo(() => tabs.pendingSession(props.tab.server, props.tab.sessionId))
  const cachedSession = createMemo(() => props.serverCtx?.data.session.get(props.tab.sessionId))
  const persisted = createMemo(() => tabs.info[props.id])

  const [loadedSession] = createResource(
    () => {
      if (pending() || props.indexed || (!props.active && persisted()?.title)) return null
      const ctx = props.serverCtx

      return ctx ? { id: props.tab.sessionId, ctx } : null
    },
    ({ id, ctx }) =>
      ctx.data.session
        .sync(id)
        .then(() => ctx.data.session.get(id))
        .catch(() => undefined),
  )

  const session = createMemo(() =>
    pending()
      ? undefined
      : (cachedSession() ??
        props.indexed ??
        (loadedSession.state === "ready" || loadedSession.state === "refreshing" ? loadedSession.latest : undefined)),
  )
  const missingSession = createMemo(() => !pending() && !!props.serverCtx && !loadedSession.loading && !session())
  const visible = createMemo(() => !!pending() || !!session() || missingSession() || !!persisted()?.title)

  const rememberTitle = (sessionID: string, title: string | undefined) => {
    const value = session()
    if (value?.id === sessionID) props.serverCtx?.data.session.remember({ ...value, title })
  }

  const saveTitle = async (sessionID: string, title: string, signal: AbortSignal) => {
    const ctx = props.serverCtx
    if (!ctx) throw new Error(language.t("common.requestFailed"))
    await ctx.sdk.api.session.update({ sessionID, title }, { signal })
    const conn = servers.list.find((item) => ServerConnection.key(item) === props.tab.server)
    if (conn)
      queryClient.setQueryData<SessionInfo[]>(["home-sessions", conn], (current) =>
        current?.map((item) => (item.id === sessionID ? { ...item, title } : item)),
      )
  }

  function DeleteDialog() {
    const confirm = async () => {
      const value = session()
      const ctx = props.serverCtx

      dialog.close()

      if (!value || !ctx) return
      const ids = sessionTreeIDs(ctx.data.session.list(), value.id)

      try {
        await ctx.data.session.remove(value.id)
        notifySessionTabsRemoved({ server: props.tab.server, directory: value.location.directory, sessionIDs: ids })
      } catch (cause) {
        showToast({
          title: language.t("session.delete.failed.title"),
          description: errorMessage(cause, language.t("session.delete.failed.title")),
        })
      }
    }

    return (
      <Dialog fit>
        <DialogHeader hideClose>
          <DialogTitleGroup
            title={language.t("session.delete.title")}
            description={language.t("session.delete.confirm", {
              name: sessionTitle(session()?.title) ?? language.t("session.tab.session"),
            })}
          />
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" autofocus onClick={() => dialog.close()}>
            {language.t("common.cancel")}
          </Button>
          <Button variant="danger" onClick={confirm}>
            {language.t("session.delete.button")}
          </Button>
        </DialogFooter>
      </Dialog>
    )
  }

  createEffect(() => props.onVisibleChange(visible()))

  createEffect(() => {
    const ctx = props.serverCtx
    const id = props.tab.sessionId

    if (
      props.opened === false ||
      pending() ||
      !ctx ||
      props.active ||
      ctx.data.session.missing(id) ||
      (!session() && !persisted()?.title) ||
      ctx.sdk.connection.status() !== "connected"
    )
      return

    const current = props.currentTab

    if (current?.type === "session" && current.server === props.tab.server && current.sessionId !== id) {
      const active = ctx.data.session.get(current.sessionId)

      if (
        !active ||
        ctx.data.location.agent.list(active.location) === undefined ||
        ctx.data.location.provider.list(active.location) === undefined ||
        ctx.data.location.model.list(active.location) === undefined ||
        ctx.data.location.skill.list(active.location) === undefined
      )
        return
    }

    const running = [id, ...ctx.data.session.family(id)].some(
      (sessionID) => ctx.data.session.status(sessionID) === "running",
    )

    const timer = window.setTimeout(
      () =>
        void Promise.allSettled([
          ctx.data.session.sync(id, { children: true }),
          // The selected timeline loads the transcript; inactive tabs need metadata and the inbox,
          // whose waiting work keeps the tab busy. Only a running session can wait on a permission
          // or form, and reading either boots the session's location on the server.
          ...(running ? [ctx.data.session.permission.sync(id), ctx.data.session.form.sync(id)] : []),
          ctx.data.session.pending.sync(id),
        ]),
      300 + props.index * 50,
    )

    onCleanup(() => window.clearTimeout(timer))
  })

  // A pointer resting on a tab usually clicks it next, so its transcript loads during the dwell. Passing over loads nothing.
  let intent: number | undefined

  const hover = (hovered: boolean) => {
    window.clearTimeout(intent)
    const ctx = props.serverCtx
    const value = session()

    if (!hovered || !ctx || !value || props.active || ctx.sdk.connection.status() !== "connected") return
    intent = window.setTimeout(() => void ctx.data.session.message.sync(value.id).catch(() => undefined), 100)
  }

  onCleanup(() => window.clearTimeout(intent))

  createEffect(() => {
    if (props.opened === false) return
    const value = session()

    if (!value) return
    tabs.rememberSessionInfo(
      props.tab,
      value,
      props.serverCtx?.data.session.message.list(value.id).some((message) => message.type === "user") ?? false,
    )
    const current = sdk()

    if (!current) return
    createTabComposerState(tabs, props.tab, current.scope, {
      dir: base64Encode(value.location.directory),
      id: value.id,
    })
  })

  return (
    <Show when={visible()}>
      <SessionTabSlot
        tab={props.tab}
        id={props.id}
        index={props.index}
        active={props.active}
        sortGroup={props.sortGroup}
        sortDisabled={props.sortDisabled}
        closable={props.opened !== false || props.dismissible}
        closeLabel={props.opened === false ? language.t("sidebar.recent.hide") : undefined}
        session={session()}
        preparing={!!pending()}
        unread={!!props.status?.unread}
        attention={!!props.status?.attention}
        loading={!!props.status?.loading}
        fallbackTitle={
          pending()
            ? language.t("session.tab.session")
            : (persisted()?.title ?? (missingSession() ? language.t("session.tab.unknown") : undefined))
        }
        fallbackDirectory={pending()?.draft.directory ?? persisted()?.directory}
        onRememberTitle={rememberTitle}
        onSaveTitle={saveTitle}
        onDelete={() => dialog.show(() => <DeleteDialog />)}
        onNavigate={props.onNavigate}
        onClose={props.onClose}
        onIntent={hover}
      />
    </Show>
  )
}
