import * as kiru from "kiru"
import { ValueViewer } from "../../components/value-viewer"
import { ChevronRightIcon } from "../../components/icons/chevron-right-icon"
import { selectedNodeViewData } from "./selected-node-state"

export function SelectedNodeView() {
  const nodeViewData = selectedNodeViewData.value
  if (!nodeViewData) return null
  const { name, props } = nodeViewData
  const arePropsCollapsed = props.collapsed.value

  return (
    <div className="flex-grow p-2 sticky top-0">
      <h2 className="flex justify-between items-center font-bold mb-2 pb-2 border-b-2 border-neutral-800">
        <div className="flex gap-2 items-center">{"<" + name + ">"}</div>
      </h2>
      <div className="flex flex-col">
        <button
          onclick={() => (props.collapsed.value = !props.collapsed.value)}
          className={
            props.root.children.length === 0
              ? "opacity-50 cursor-default"
              : "cursor-pointer"
          }
        >
          <span className="flex items-center gap-2 font-medium">
            <ChevronRightIcon
              className={`transition ${arePropsCollapsed ? "" : "rotate-90"}`}
            />
            props
          </span>
        </button>
        {arePropsCollapsed ? null : (
          <div className="p-2" {...props}>
            <ValueViewer root={props.root} />
          </div>
        )}
      </div>
    </div>
  )
}
