import * as kiru from "kiru"
import { devtoolsState, kiruGlobal } from "../../state"
import { getNodeName, ifDevtoolsAppRootHasFocus } from "../../utils"

const { selectedApp, selectedNode, appSearchTerm } = devtoolsState

export const appGraph = kiru.signal<GraphRoot>(createGraphRoot())

export const setupKeyboardNavigation = () => {
  window.addEventListener("keydown", handleKeyDown)
  return () => window.removeEventListener("keydown", handleKeyDown)
}

export interface GraphRoot {
  value: "ROOT"
  nodes: GraphNode[]
}

export interface GraphNode {
  id: string
  kiruNode: Kiru.VNode
  name: string
  collapsed: kiru.Signal<boolean>
  parent: GraphNode | null
  child: GraphNode | null
  sibling: GraphNode | null
}

type DiffMapEntry = {
  id: string
  collapsed: kiru.Signal<boolean>
}
type DiffMap = Map<Kiru.VNode, DiffMapEntry>

kiru.effect(() => {
  const app = selectedApp.value
  const search = appSearchTerm.value
  if (!app) {
    disposeGraph(appGraph.peek())
    appGraph.value = createGraphRoot()
    return
  }
  appGraph.value = reconcileGraph(app, search, appGraph.peek())
  expandParentsOfSelectedNode(appGraph.peek())

  const onAppUpdate = (updatedApp: kiru.AppHandle) => {
    if (updatedApp !== app) return
    appGraph.value = reconcileGraph(updatedApp, search, appGraph.peek())
    expandParentsOfSelectedNode(appGraph.peek())
  }
  kiruGlobal().on("update", onAppUpdate)
  return () => kiruGlobal().off("update", onAppUpdate)
})

function disposeGraph(graph: GraphRoot | GraphNode | null) {
  if (!graph) return
  if ("nodes" in graph) {
    graph.nodes.forEach(disposeGraph)
  } else {
    disposeGraph(graph.child)
    disposeGraph(graph.sibling)
  }
}

function reconcileGraph(
  app: kiru.AppHandle,
  search: string,
  currentGraph: GraphRoot
): GraphRoot {
  const existing: DiffMap = new Map()
  collectCollapsedSignals(currentGraph, existing)

  const rootNode = app.rootNode
  const newGraph = createGraphRoot()
  if (rootNode) {
    const trimmed = search.trim().toLowerCase()
    const searchTerms = trimmed ? trimmed.split(/\s+/) : []
    newGraph.nodes.push(...searchFunctionNodes(rootNode, searchTerms, existing))
  }

  // Dispose collapsed signals for nodes that are no longer in the graph
  for (const { collapsed } of existing.values()) {
    kiru.Signal.dispose(collapsed)
  }

  return newGraph
}

function collectCollapsedSignals(
  node: GraphRoot | GraphNode | null,
  map: DiffMap
) {
  if (!node) return
  if ("nodes" in node) {
    for (const child of node.nodes) collectCollapsedSignals(child, map)
  } else {
    const { id, collapsed } = node
    map.set(node.kiruNode, { id, collapsed })
    collectCollapsedSignals(node.child, map)
    collectCollapsedSignals(node.sibling, map)
  }
}

function searchFunctionNodes(
  vNode: Kiru.VNode | null,
  terms: string[],
  existing: DiffMap = new Map()
): GraphNode[] {
  const result: GraphNode[] = []
  let n = vNode
  while (n) {
    const children = searchFunctionNodes(n.child, terms, existing)
    if (typeof n.type !== "function") {
      result.push(...children)
    } else {
      const name = getNodeName(n)
      if (searchMatchesItem(terms, name)) {
        const node = createGraphNode(n, name, existing)
        node.child = children[0] ?? null
        for (let i = 0; i < children.length; i++) {
          children[i].parent = node
          children[i].sibling = children[i + 1] ?? null
        }
        result.push(node)
      } else {
        result.push(...children)
      }
    }

    n = n.sibling
  }
  return result
}

function searchMatchesItem(terms: string[], item: string) {
  const toLower = item.toLowerCase()
  return terms.every((term) => toLower.includes(term))
}

function createGraphRoot(...nodes: GraphNode[]): GraphRoot {
  return {
    value: "ROOT",
    nodes,
  }
}

function createGraphNode(
  vNode: Kiru.VNode,
  name: string,
  existing: DiffMap = new Map()
): GraphNode {
  const { id, collapsed } = existing.get(vNode) ?? {
    id: crypto.randomUUID(),
    collapsed: kiru.signal(true),
  }
  existing.delete(vNode)
  return {
    id,
    name,
    kiruNode: vNode,
    collapsed,
    parent: null,
    child: null,
    sibling: null,
  }
}

function expandParentsOfSelectedNode(graph: GraphRoot) {
  const vNode = selectedNode.peek()
  if (!vNode) return
  const graphNode = findGraphNodeByVNode(graph, vNode)
  if (!graphNode) return
  let p = graphNode.parent
  while (p) {
    p.collapsed.value = false
    p = p.parent
  }
}

function onSelectedNodeChange(vNode: Kiru.VNode | null) {
  if (!vNode) return
  expandParentsOfSelectedNode(appGraph.peek())
}

selectedNode.subscribe(onSelectedNodeChange)

const handleKeyDown = (e: KeyboardEvent) => {
  ifDevtoolsAppRootHasFocus((el) => {
    switch (e.key) {
      case "ArrowUp":
        handleNavigation(el, "up")
        break
      case "ArrowDown":
        handleNavigation(el, "down")
        break
      case "ArrowLeft":
        setCollapsed(true)
        break
      case "ArrowRight":
        setCollapsed(false)
        break
      default:
        break
    }
  })
}

function setCollapsed(collapsed: boolean) {
  const currentVNode = selectedNode.peek()
  if (!currentVNode) return
  const graphNode = findGraphNodeByVNode(appGraph.peek(), currentVNode)
  if (!graphNode?.child) return
  graphNode.collapsed.value = collapsed
}

function handleNavigation(el: Element, dir: "up" | "down") {
  const nodes = Array.from(
    el.querySelectorAll("[data-graph-node-id]")
  ) as HTMLElement[]
  if (nodes.length === 0) return

  const currentVNode = selectedNode.peek()
  let currentIndex = -1
  if (currentVNode) {
    const currentGraphNode = findGraphNodeByVNode(appGraph.peek(), currentVNode)
    if (currentGraphNode) {
      currentIndex = nodes.findIndex(
        (n) => n.dataset.graphNodeId === currentGraphNode.id
      )
    }
  }

  const delta = dir === "up" ? -1 : 1
  const nextIndex =
    currentIndex === -1
      ? dir === "down"
        ? 0
        : nodes.length - 1
      : (currentIndex + delta + nodes.length) % nodes.length

  const nextNode = nodes[nextIndex]
  if (!nextNode) return

  const graphNode = findGraphNode(appGraph.peek(), nextNode)
  if (!graphNode) return
  selectedNode.sneak(graphNode.kiruNode)
  selectedNode.notify((sub) => sub !== onSelectedNodeChange)
}

function findGraphNode(root: GraphRoot, node: HTMLElement): GraphNode | null {
  const id = node.dataset.graphNodeId
  if (!id) return null

  const search = (n: GraphNode | null): GraphNode | null => {
    if (!n) return null
    if (n.id === id) return n
    return search(n.child) ?? search(n.sibling)
  }

  for (const rootNode of root.nodes) {
    const found = search(rootNode)
    if (found) return found
  }
  return null
}

function findGraphNodeByVNode(
  root: GraphRoot,
  vNode: Kiru.VNode
): GraphNode | null {
  const search = (n: GraphNode | null): GraphNode | null => {
    if (!n) return null
    if (n.kiruNode === vNode) return n
    return search(n.child) ?? search(n.sibling)
  }

  for (const rootNode of root.nodes) {
    const found = search(rootNode)
    if (found) return found
  }
  return null
}
