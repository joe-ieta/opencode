import type { ServerApi } from "@/runtime/server/api"
import { useLanguage } from "@/runtime/i18n/language"
import { usePlatform } from "@/runtime/platform/platform"
import { showToast } from "@/shell/notifications/toast"
import { fetchSessionExport, saveSessionExport, sessionExportFilename } from "./export"

export function useSessionExport() {
  const language = useLanguage()
  const platform = usePlatform()

  return async (input: { sessionID: string; api: Pick<ServerApi, "session" | "message"> }) => {
    try {
      const data = await fetchSessionExport(input)
      const filename = sessionExportFilename(data.info)

      if (!(await saveSessionExport(filename, data, platform))) return
      showToast({
        variant: "success",
        icon: "circle-check",
        title: language.t("toast.session.export.success.title"),
        description: language.t("toast.session.export.success.description", { filename }),
      })
    } catch (cause) {
      showToast({
        variant: "error",
        title: language.t("toast.session.export.failed.title"),
        description: cause instanceof Error ? cause.message : language.t("toast.session.export.failed.description"),
      })
    }
  }
}
