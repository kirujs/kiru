import * as kiru from "kiru"
import { devtoolsState } from "../../state"
import { appGraph, GraphNode, GraphRoot } from "./apps-tab-state"
import { ChevronRightIcon } from "../../components"
import { className as cls } from "kiru/utils"

const { selectedNode, appSearchTerm, appSearchInput } = devtoolsState

export function SelectedAppGraphView() {
  const handleKeyDown = (_: KeyboardEvent) => {
    // TODO: Handle keyboard navigation for the graph
  }

  window.addEventListener("keydown", handleKeyDown)
  kiru.onCleanup(() => window.removeEventListener("keydown", handleKeyDown))
  return () => (
    <div className="flex-grow p-2 sticky top-0">
      <div className="flex gap-4 pb-2 border-b-2 border-neutral-800 mb-2 items-center">
        <input
          autofocus
          ref={appSearchInput}
          className="bg-[#171616] px-1 py-2 w-full focus:outline focus:outline-primary"
          placeholder="Search for component"
          type="text"
          bind:value={appSearchTerm}
        />
      </div>
      <div className="flex flex-col">
        <kiru.Derive from={appGraph}>
          {(appGraph) => <GraphRootView root={appGraph} />}
        </kiru.Derive>
      </div>
    </div>
  )
}

function GraphRootView({ root }: { root: GraphRoot }) {
  return root.nodes.map((node) => (
    <GraphNodeItem node={node} traverseSiblings={true} />
  ))
}

function GraphNodeItem({
  node,
  traverseSiblings = true,
}: {
  node: GraphNode
  traverseSiblings?: boolean
}) {
  const isCollapsed = node.collapsed.value
  const isSelected = selectedNode.value === node.kiruNode
  const toggleCollapsed = (e: Kiru.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    node.collapsed.value = !node.collapsed.value
  }

  return (
    <>
      <div className="pl-4 mb-1 w-full">
        <button
          className={cls(
            "flex gap-2 items-center px-2 py-0.5 w-full",
            isSelected ? "bg-crimson text-white" : ""
          )}
          onclick={() => (selectedNode.value = node.kiruNode)}
        >
          {node.child && (
            <ChevronRightIcon
              className={cls(
                "transition-transform duration-200 w-4 h-4",
                isCollapsed ? "" : "rotate-90"
              )}
              onclick={toggleCollapsed}
            />
          )}
          <div className={node.child ? "" : "ml-6"}>
            <span className={isSelected ? "" : "text-neutral-400"}>{"<"}</span>
            <span
              className={cls("font-medium", isSelected ? "" : "text-crimson")}
            >
              {node.name}
            </span>
            <span className={isSelected ? "" : "text-neutral-400"}>{">"}</span>
          </div>
        </button>
        {!isCollapsed && node.child && <GraphNodeItem node={node.child} />}
      </div>
      {traverseSiblings && <GraphNodeSiblings node={node} />}
    </>
  )
}

function GraphNodeSiblings({ node }: { node: GraphNode }) {
  if (!node) return null
  let nodes = []
  let n = node.sibling
  while (n) {
    nodes.push(n)
    n = n.sibling
  }
  return (
    <>
      {nodes.map((n) => (
        <GraphNodeItem node={n} traverseSiblings={false} />
      ))}
    </>
  )
}
