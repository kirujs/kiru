import * as kiru from "kiru"
import { ElementProps } from "kiru"
import { ValueViewer } from "../../components/value-viewer"
import { ChevronRightIcon } from "../../components/icons/chevron-right-icon"
import { selectedNodeViewData } from "./selected-node-state"

export function SelectedNodeView() {
  return () => {
    const nodeViewData = selectedNodeViewData.value
    if (!nodeViewData) return null

    return (
      <div className="flex-grow p-2 sticky top-0">
        <h2 className="flex justify-between items-center font-bold mb-2 pb-2 border-b-2 border-neutral-800">
          <div className="flex gap-2 items-center">
            {"<" + nodeViewData.name + ">"}
          </div>
        </h2>

        <NodeDataSection
          title={"props"}
          disabled={nodeViewData.props.children.length === 0}
        >
          <ValueViewer root={nodeViewData.props} />
        </NodeDataSection>
      </div>
    )
  }
}

interface NodeDataSectionProps extends ElementProps<"div"> {
  title: string
  children: JSX.Children
  disabled?: boolean
}

const NodeDataSection: Kiru.FC<NodeDataSectionProps> = () => {
  const collapsed = kiru.signal(true)

  return ({ disabled, title, children, className, ...props }) => (
    <div className="flex flex-col">
      <button
        onclick={() => (collapsed.value = !collapsed.value)}
        disabled={disabled}
        className={`${
          disabled ? "opacity-50 cursor-default" : "cursor-pointer"
        }`}
      >
        <span className="flex items-center gap-2 font-medium">
          <ChevronRightIcon
            className={`transition ${collapsed.value ? "" : "rotate-90"}`}
          />
          {title}
        </span>
      </button>
      {collapsed.value ? null : (
        <div className={`p-2 ${className || ""}`} {...props}>
          {children}
        </div>
      )}
    </div>
  )
}
