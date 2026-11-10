import { useSortable } from "@dnd-kit/solid/sortable"
import { tabHref, type Tab } from "@/shell/tabs/tabs"
import { DraftTabItem } from "@/shell/titlebar/tab-nav"

export function SidebarDraftRow(props: {
  tab: Extract<Tab, { type: "draft" }>
  id: string
  index: number
  active: boolean
  sortGroup?: string
  sortDisabled?: boolean
  title: string
  onNavigate: (element: HTMLDivElement) => void
  onClose: () => void
}) {
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
    >
      <DraftTabItem
        ref={(el) => {
          ref = el
        }}
        href={tabHref(props.tab)}
        title={props.title}
        onNavigate={() => props.onNavigate(ref)}
        onClose={props.onClose}
        active={props.active}
        dragging={sortable.isDragSource()}
        orientation="vertical"
      />
    </div>
  )
}
