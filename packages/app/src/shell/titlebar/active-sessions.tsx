import { createEffect, createMemo, createUniqueId, For, Show, startTransition } from "solid-js"
import { ActivityRing } from "@opencode/ui/activity-ring"
import { displayName } from "@opencode/ui/project-avatar"
import { useLanguage } from "@/runtime/i18n/language"
import { ServerConnection, serverName } from "@/runtime/server/registry"
import { useGlobal } from "@/runtime/server/runtime"
import { projectSettingsKey, useSettings } from "@/settings/model"
import { sessionRequests } from "@/shell/layout/project-avatar-state"
import { useLayout } from "@/shell/state/layout"
import { useTabs } from "@/shell/tabs/tabs"
import { sessionTabTitle } from "./tab-title"
import "./active-sessions.css"

/** The server-wide active index includes running sessions without an open tab, including child sessions. */
export function ActiveSessions() {
  const global = useGlobal()
  const language = useLanguage()
  const settings = useSettings()
  const layout = useLayout()
  const tabs = useTabs()
  const heading = createUniqueId()

  const connections = createMemo(() =>
    global.servers.list().map((conn) => ({ conn, ctx: global.serverCtx(ServerConnection.key(conn)) })),
  )

  const entries = createMemo(() =>
    connections().flatMap((item) => {
      const ctx = item.ctx

      if (!ctx || ctx.sdk.connection.status() !== "connected") return []

      return ctx.data.session.active().map((id) => ({
        key: JSON.stringify([ServerConnection.key(item.conn), id]),
        id,
        server: ServerConnection.key(item.conn),
        conn: item.conn,
        ctx,
      }))
    }),
  )

  const byKey = createMemo(() => new Map(entries().map((entry) => [entry.key, entry])))
  const disconnected = () => connections().some((item) => item.ctx?.sdk.connection.status() !== "connected")

  // Read metadata and requests for active IDs only; this overview never loads transcripts or historical indexes.
  createEffect(() => {
    entries().forEach((entry) => {
      void Promise.allSettled([
        entry.ctx.data.session.sync(entry.id),
        entry.ctx.data.session.permission.sync(entry.id),
        entry.ctx.data.session.form.sync(entry.id),
      ])
    })
  })

  return (
    <section data-component="active-sessions" aria-labelledby={heading}>
      <div data-slot="active-sessions-header">
        <h2 id={heading}>{language.t("sidebar.running.title")}</h2>
        <span class="tabular-nums" aria-label={language.plural("sidebar.running.count", entries().length)}>
          {entries().length}
        </span>
      </div>
      <div data-slot="active-sessions-list" data-scrollable>
        <For
          each={[...byKey().keys()]}
          fallback={<p data-slot="active-sessions-empty">{language.t("sidebar.running.empty")}</p>}
        >
          {(key) => (
            <Show when={byKey().get(key)}>
              {(entry) => {
                const session = createMemo(() => entry().ctx.data.session.get(entry().id))

                const project = createMemo(() => {
                  const value = session()

                  return value
                    ? (entry().ctx.projects.forSession(value) ?? { worktree: value.location.directory })
                    : undefined
                })

                const status = createMemo(() => {
                  const value = entry()

                  const requests = sessionRequests(
                    value.ctx.data,
                    value.id,
                    false,
                    settings.permissions.autoApproves(projectSettingsKey(value.ctx.sdk.scope, session()?.projectID)),
                  )

                  if (requests.permission) return "approval"

                  if (requests.form) return "input"

                  return "working"
                })

                const selected = () => {
                  const route = layout.route()

                  return route.type === "session" && route.server === entry().server && route.sessionId === entry().id
                }

                return (
                  <button
                    type="button"
                    data-slot="active-session"
                    data-state={selected() ? "active" : undefined}
                    aria-current={selected() ? "page" : undefined}
                    title={session()?.location.directory}
                    onClick={() => {
                      const value = entry()
                      void startTransition(() => {
                        tabs.select(tabs.addSessionTab({ server: value.server, sessionId: value.id }))
                        const directory = project()?.worktree

                        if (directory) value.ctx.projects.touch(directory)
                      })
                    }}
                  >
                    <span data-slot="active-session-mark" aria-hidden="true">
                      <Show when={status() === "working"} fallback={<span data-slot="active-session-waiting" />}>
                        <ActivityRing />
                      </Show>
                    </span>
                    <span data-slot="active-session-title" dir="auto" title={session()?.title}>
                      {sessionTabTitle(session()?.title, language.t("session.tab.session"))}
                    </span>
                    <span data-slot="active-session-status" data-waiting={status() !== "working" ? "" : undefined}>
                      {language.t(`sidebar.inbox.status.${status()}`)}
                    </span>
                    <span data-slot="active-session-project" dir="auto">
                      <Show when={project()} fallback={language.t("common.loading")}>
                        {(value) => displayName(value())}
                      </Show>
                      <Show when={connections().length > 1}>
                        <span class="ms-1.5">{serverName(entry().conn)}</span>
                      </Show>
                    </span>
                  </button>
                )
              }}
            </Show>
          )}
        </For>
      </div>
      <Show when={disconnected()}>
        <p data-slot="active-sessions-empty">{language.t("sidebar.running.disconnected")}</p>
      </Show>
    </section>
  )
}
