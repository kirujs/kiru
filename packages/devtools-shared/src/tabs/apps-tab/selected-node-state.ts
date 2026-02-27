import * as kiru from "kiru"
import { devtoolsState } from "../../state"
import { getNodeName } from "../../utils"
import {
  buildViewerRoot,
  collectFromRoot,
  disposeCache,
  emptyCache,
  ViewerRoot,
} from "../../components/value-viewer-data"

const { selectedNode, viewerSettings } = devtoolsState

export interface SelectedNodeViewData {
  node: Kiru.VNode
  name: string
  props: PropsData
}

interface PropsData {
  root: ViewerRoot
  collapsed: kiru.Signal<boolean>
}

export const selectedNodeViewData = kiru.signal<SelectedNodeViewData | null>(
  null
)

kiru.effect(() => {
  const node = selectedNode.value
  const settings = viewerSettings.value

  const prevData = selectedNodeViewData.peek()

  if (!node) {
    if (prevData) disposePropsData(prevData.props)
    selectedNodeViewData.value = null
    return
  }

  const sameNode = prevData?.node === node

  // Collect viewer-tree signals for reconciliation (only reuse when same node)
  const prevCache = emptyCache()
  if (sameNode && prevData) {
    collectFromRoot(prevData.props.root, "props", prevCache)
  } else if (prevData) {
    disposePropsData(prevData.props)
  }

  const nodeProps = { ...node.props } as Record<string, unknown>
  delete nodeProps.children

  const propsRootCollapsed = sameNode
    ? prevData?.props.collapsed ?? kiru.signal(true)
    : kiru.signal(true)

  const propsViewerRoot = buildViewerRoot(
    nodeProps,
    "props",
    prevCache,
    settings
  )

  // Dispose any viewer-tree signals not reused (same-node prop changes)
  disposeCache(prevCache)

  selectedNodeViewData.value = {
    node,
    name: getNodeName(node),
    props: { root: propsViewerRoot, collapsed: propsRootCollapsed },
  }
})

function disposePropsData(props: PropsData) {
  kiru.Signal.dispose(props.collapsed)
  kiru.Signal.dispose(props.root.page)
  const cache = emptyCache()
  collectFromRoot(props.root, "props", cache)
  disposeCache(cache)
}
