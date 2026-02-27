import * as kiru from "kiru"
import { devtoolsState } from "../../state"
import { getNodeName } from "../../utils"
import {
  buildRoot,
  collectFromRoot,
  disposeCache,
  emptyCache,
  ViewerRoot,
} from "../../components/value-viewer-data"

const { selectedNode, viewerSettings } = devtoolsState

export interface SelectedNodeSection {
  title: string
  collapsed: kiru.Signal<boolean>
  viewer: ViewerRoot
}

export interface SelectedNodeViewData {
  node: Kiru.VNode
  name: string
  sections: SelectedNodeSection[]
}

export const selectedNodeViewData = kiru.signal<SelectedNodeViewData | null>(
  null
)

kiru.effect(() => {
  const node = selectedNode.value
  const settings = viewerSettings.value

  const prevData = selectedNodeViewData.peek()

  if (!node) {
    if (prevData) disposeSections(prevData.sections)
    selectedNodeViewData.value = null
    return
  }

  const sameNode = prevData?.node === node

  // Collect viewer-tree signals for reconciliation (only reuse when same node)
  const prevCache = emptyCache()
  if (sameNode && prevData) {
    for (const section of prevData.sections) {
      collectFromRoot(section.viewer, section.title, prevCache)
    }
  } else if (prevData) {
    disposeSections(prevData.sections)
  }

  const nodeProps = { ...node.props } as Record<string, unknown>
  delete nodeProps.children

  const propsCollapsed = sameNode
    ? (prevData?.sections.find((s) => s.title === "props")?.collapsed ?? kiru.signal(true))
    : kiru.signal(true)

  const propsViewer = buildRoot(nodeProps, "props", prevCache, settings)

  // Dispose any viewer-tree signals not reused (same-node prop changes)
  disposeCache(prevCache)

  selectedNodeViewData.value = {
    node,
    name: getNodeName(node),
    sections: [{ title: "props", collapsed: propsCollapsed, viewer: propsViewer }],
  }
})

function disposeSections(sections: SelectedNodeSection[]) {
  for (const section of sections) {
    kiru.Signal.dispose(section.collapsed)
    const cache = emptyCache()
    collectFromRoot(section.viewer, section.title, cache)
    disposeCache(cache)
  }
}
