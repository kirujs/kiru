import * as kiru from "kiru"
import { ElementProps } from "kiru"
import { ValueViewer } from "../../components/value-viewer"
import { ChevronRightIcon } from "../../components/icons/chevron-right-icon"
import { selectedNodeViewData, SelectedNodeSection } from "./selected-node-state"

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
        {nodeViewData.sections.map((section) => (
          <NodeDataSection
            key={section.title}
            section={section}
            disabled={section.viewer.children.length === 0}
          />
        ))}
      </div>
    )
  }
}

interface NodeDataSectionProps extends ElementProps<"div"> {
  section: SelectedNodeSection
  disabled?: boolean
}

function NodeDataSection({ section, disabled, className, ...props }: NodeDataSectionProps) {
  const isCollapsed = section.collapsed.value

  return (
    <div className="flex flex-col">
      <button
        onclick={() => (section.collapsed.value = !section.collapsed.value)}
        disabled={disabled}
        className={disabled ? "opacity-50 cursor-default" : "cursor-pointer"}
      >
        <span className="flex items-center gap-2 font-medium">
          <ChevronRightIcon
            className={`transition ${isCollapsed ? "" : "rotate-90"}`}
          />
          {section.title}
        </span>
      </button>
      {isCollapsed ? null : (
        <div className={`p-2 ${className || ""}`} {...props}>
          <ValueViewer root={section.viewer} />
        </div>
      )}
    </div>
  )
}
