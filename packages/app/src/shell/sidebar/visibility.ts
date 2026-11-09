import { Schema } from "effect"
import { Persist, persisted } from "@/runtime/persistence/storage"

export function createSidebarVisibility() {
  const [hidden, setHidden, , ready] = persisted(Persist.window("sidebar.hidden"), Schema.Array(Schema.String), [])

  // Desktop hydration must finish before applying hide/reopen operations in their original order.
  const update = (key: string, hide: boolean) => {
    const apply = () =>
      setHidden((current) =>
        hide ? (current.includes(key) ? current : [...current, key]) : current.filter((item) => item !== key),
      )

    if (ready()) return apply()
    void ready.promise?.then(apply)
  }

  return { ready, hidden: (key: string) => hidden.includes(key), update }
}
