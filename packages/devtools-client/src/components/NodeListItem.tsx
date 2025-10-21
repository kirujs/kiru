import { useState, useMemo, useEffect } from "kiru"
import { ChevronIcon } from "devtools-shared"
import {
  appTreeSearch,
  inspectComponent,
  keyboardMap,
  selectedNode,
} from "../state"
import {
  getNodeName,
  isComponent,
  nodeContainsComponent,
  nodeContainsNode,
  searchMatchesItem,
} from "../utils"

export function NodeListItem({
  node,
  traverseSiblings = true,
}: {
  node: Kiru.VNode
  traverseSiblings?: boolean
}) {
  const [collapsed, setCollapsed] = useState(true)
  const _selectedNode = selectedNode.value
  const isSelected = _selectedNode === node

  const id = useMemo(() => crypto.randomUUID(), [])

  const isParentOfInspectNode = useMemo(() => {
    if (inspectComponent.value == null) return null
    return nodeContainsNode(node, inspectComponent.value)
  }, [inspectComponent.value, node])

  useEffect(() => {
    if (isParentOfInspectNode) {
      setCollapsed(false)
    }
  }, [isParentOfInspectNode])

  useEffect(() => {
    if (!node || !isComponent(node)) return

    keyboardMap.peek().set(id, {
      vNode: node,
      setCollapsed,
    })

    return () => {
      keyboardMap.peek().delete(id)
    }
  })
  const search = appTreeSearch.value
  if (!node) return null
  if (
    !isComponent(node) ||
    (search.length > 0 &&
      !searchMatchesItem(search.toLowerCase().split(" "), node.type.name))
  )
    return (
      <>
        {node.child && <NodeListItem node={node.child} />}
        {traverseSiblings && <NodeListItemSiblings node={node} />}
      </>
    )

  const showChildren = node.child && nodeContainsComponent(node.child)
  return (
    <>
      <div className="pl-4 mb-1">
        <h2
          onclick={() => {
            inspectComponent.value = null
            selectedNode.value = isSelected ? null : (node as any)
          }}
          className={`flex gap-2 items-center cursor-pointer mb-1 scroll-m-12 ${
            isSelected ? "font-medium bg-primary selected-vnode" : ""
          }`}
          data-id={id}
        >
          {showChildren && (
            <ChevronIcon
              className={`cursor-pointer transition ${
                collapsed ? "" : "rotate-90"
              }`}
              onclick={(e) => {
                e.preventDefault()
                e.stopImmediatePropagation()
                inspectComponent.value = null
                setCollapsed((prev) => !prev)
              }}
            />
          )}
          <div className={showChildren ? "" : "ml-6"}>
            <span className={isSelected ? "" : "text-neutral-400"}>{"<"}</span>
            <span className={isSelected ? "" : "text-primary"}>
              {getNodeName(node)}
            </span>
            <span className={isSelected ? "" : "text-neutral-400"}>{">"}</span>
          </div>
        </h2>
        {(!collapsed && node.child) ||
        (isParentOfInspectNode != null &&
          isParentOfInspectNode &&
          node.child) ? (
          <NodeListItem node={node.child} />
        ) : null}
      </div>
      {traverseSiblings && <NodeListItemSiblings node={node} />}
    </>
  )
}
function NodeListItemSiblings({ node }: { node?: Kiru.VNode }) {
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
        <NodeListItem node={n} traverseSiblings={false} />
      ))}
    </>
  )
}
