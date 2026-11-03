import type { SessionInfo } from "@opencode/client/promise"
import { Schema } from "effect"
import { startTransition } from "solid-js"
import { useLanguage } from "@/runtime/i18n/language"
import { usePlatform } from "@/runtime/platform/platform"
import { ServerConnection } from "@/runtime/server/registry"
import { useGlobal } from "@/runtime/server/runtime"
import { useSettingsSurface } from "@/settings/surface"
import { errorMessage } from "@/shell/layout/helpers"
import { showToast } from "@/shell/notifications/toast"
import type { LocalProject } from "@/shell/state/layout"
import { useTabs } from "@/shell/tabs/tabs"
import { useRevealProject } from "./reveal"

/** Project actions shared by Home and the project sidebar. */
export function createProjectActions() {
  const global = useGlobal()
  const tabs = useTabs()
  const language = useLanguage()
  const platform = usePlatform()
  const settings = useSettingsSurface()
  const reveal = useRevealProject()

  function openNewSession(conn: ServerConnection.Any, directory: string) {
    global.ensureServerCtx(conn).projects.touch(directory)
    void tabs.newDraft({ server: ServerConnection.key(conn), directory })
  }

  function openSession(conn: ServerConnection.Any, directory: string, session: SessionInfo) {
    const ctx = global.ensureServerCtx(conn)
    void ctx.data.session.message.sync(session.id).catch(() => undefined)
    void startTransition(() => {
      const tab = tabs.addSessionTab({ server: ServerConnection.key(conn), sessionId: session.id })
      tabs.select(tab)
      ctx.data.session.remember(session)
      ctx.projects.touch(directory)
    })
  }

  return {
    openNewSession,
    openSession,
    canImportSession: !!platform.openAttachmentPickerDialog,
    importSession: (conn: ServerConnection.Any, project: LocalProject) => {
      if (!platform.openAttachmentPickerDialog) return
      void platform
        .openAttachmentPickerDialog(
          {
            title: language.t("command.session.import"),
            accept: ["application/json"],
            extensions: ["json"],
          },
          async (file) => {
            const data = await Schema.decodeUnknownPromise(
              Schema.fromJsonString(Schema.Record(Schema.String, Schema.Json)),
            )(await file.text())

            const api = global.ensureServerCtx(conn).sdk.api.experimental.session

            // SAFETY: the import endpoint validates the transcript, including exports written by earlier releases.
            const imported = await api.import({
              ...data,
              location: { directory: project.worktree },
            } as Parameters<typeof api.import>[0])

            openSession(conn, project.worktree, imported)
          },
        )
        .catch((cause: unknown) => {
          showToast({
            title: language.t("common.requestFailed"),
            description: errorMessage(cause, language.t("common.requestFailed")),
          })
        })
    },
    edit: (conn: ServerConnection.Any, project: LocalProject) =>
      settings.openProject({ server: ServerConnection.key(conn), project: project.worktree }),
    hasUnread: (conn: ServerConnection.Any, project: LocalProject) => {
      const notification = global.ensureServerCtx(conn).notification

      return directories(project).some((directory) => notification.project.hasUnread(directory))
    },
    clearNotifications: (conn: ServerConnection.Any, project: LocalProject) => {
      const notification = global.ensureServerCtx(conn).notification
      directories(project).forEach((directory) => notification.project.markViewed(directory))
    },
    hide: (conn: ServerConnection.Any, project: LocalProject) => global.ensureServerCtx(conn).projects.hide(project),
    canReveal: reveal.available,
    reveal: reveal.reveal,
  }
}

function directories(project: LocalProject) {
  return [project.worktree, ...(project.sandboxes ?? [])]
}
