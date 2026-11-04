import { createStore } from "solid-js/store"
import { onMount } from "solid-js"
import type { CustomProviderListing } from "@opencode/client/promise"
import type { ModelSelection } from "@/providers/models/selection"
import { useServerSDK } from "@/runtime/server/client"
import { useDialog } from "@opencode/ui/context/dialog"

export function createCustomProviderEditor(directory: () => string | undefined, selection?: ModelSelection) {
  const sdk = useServerSDK()
  const dialog = useDialog()
  const [store, setStore] = createStore<{ listing?: CustomProviderListing }>({})
  onMount(() => {
    void sdk.api.experimental.config.providers
      .list({ location: { directory: directory() } })
      .then((listing) => setStore("listing", listing))
      .catch(() => undefined)
  })

  return {
    available: () => !!store.listing,
    editable: (id: string) => !!store.listing?.providers.some((item) => item.id === id && !item.reason),
    open: async (id?: string) => {
      const { DialogCustomProviders } = await import("./dialog")
      void dialog.show(() => <DialogCustomProviders directory={directory()} providerID={id} selection={selection} />)
    },
  }
}
