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

export interface SelectedNodeViewData {
  node: Kiru.VNode
  name: string
  props: ViewerRoot
}

export const selectedNodeViewData = kiru.signal<SelectedNodeViewData | null>(
  null
)

kiru.effect(() => {
  const node = selectedNode.value
  const settings = viewerSettings.value

  // Collect all signals from the previous tree so they can be reused or disposed
  const prevData = selectedNodeViewData.peek()
  const prevCache = emptyCache()
  if (prevData) {
    collectFromRoot(prevData.props, "props", prevCache)
  }

  if (!node) {
    disposeCache(prevCache)
    selectedNodeViewData.value = null
    return
  }

  // When the node identity changes, start fresh — dispose all previous signals
  if (prevData?.node !== node) {
    disposeCache(prevCache)
    prevCache.collapsed.clear()
    prevCache.page.clear()
  }

  const nodeProps = { ...node.props } as Record<string, unknown>
  delete nodeProps.children

  const propsRoot = buildRoot(nodeProps, "props", prevCache, settings)

  // Dispose any signals that weren't reused (only relevant for same-node updates)
  disposeCache(prevCache)

  selectedNodeViewData.value = {
    node,
    name: getNodeName(node),
    props: propsRoot,
  }
})
