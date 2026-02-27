import * as kiru from "kiru"
import { devtoolsState, kiruGlobal } from "../../state"
import { getNodeName, ifDevtoolsAppRootHasFocus } from "../../utils"

const { selectedApp, appSearchTerm } = devtoolsState

export const appGraph = kiru.signal<GraphRoot>(createGraphRoot())

const handleKeyDown = (e: KeyboardEvent) => {
  ifDevtoolsAppRootHasFocus(() => {
    console.log(e.key)
    switch (e.key) {
      case "ArrowUp":
        break
      case "ArrowDown":
        break
      case "ArrowLeft":
        break
      case "ArrowRight":
        break
      default:
        break
    }
  })
}

export const setupKeyboardNavigation = () => {
  window.addEventListener("keydown", handleKeyDown)
  return () => window.removeEventListener("keydown", handleKeyDown)
}

export interface GraphRoot {
  value: "ROOT"
  nodes: GraphNode[]
}

export interface GraphNode {
  kiruNode: Kiru.VNode
  name: string
  collapsed: kiru.Signal<boolean>
  child: GraphNode | null
  sibling: GraphNode | null
}

kiru.effect(() => {
  const app = selectedApp.value
  const search = appSearchTerm.value
  if (!app) {
    disposeGraph(appGraph.peek())
    appGraph.value = createGraphRoot()
    return
  }
  let currentGraph = (appGraph.value = reconcileGraph(
    app,
    search,
    appGraph.peek()
  ))

  const onAppUpdate = (updatedApp: kiru.AppHandle) => {
    if (updatedApp !== app) return
    const newGraph = reconcileGraph(updatedApp, search, currentGraph)
    currentGraph = newGraph
    appGraph.value = newGraph
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
  const existing = new Map<Kiru.VNode, kiru.Signal<boolean>>()
  collectCollapsedSignals(currentGraph, existing)

  const rootNode = app.rootNode
  const newGraph = createGraphRoot()
  if (rootNode) {
    const trimmed = search.trim().toLowerCase()
    const searchTerms = trimmed ? trimmed.split(/\s+/) : []
    newGraph.nodes.push(...searchFunctionNodes(rootNode, searchTerms, existing))
  }

  // Dispose collapsed signals for nodes that are no longer in the graph
  for (const signal of existing.values()) {
    kiru.Signal.dispose(signal)
  }

  return newGraph
}

function collectCollapsedSignals(
  node: GraphRoot | GraphNode | null,
  map: Map<Kiru.VNode, kiru.Signal<boolean>>
) {
  if (!node) return
  if ("nodes" in node) {
    for (const child of node.nodes) collectCollapsedSignals(child, map)
  } else {
    map.set(node.kiruNode, node.collapsed)
    collectCollapsedSignals(node.child, map)
    collectCollapsedSignals(node.sibling, map)
  }
}

function searchFunctionNodes(
  vNode: Kiru.VNode | null,
  terms: string[],
  existing: Map<Kiru.VNode, kiru.Signal<boolean>> = new Map()
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
        for (let i = 0; i < children.length - 1; i++) {
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
  existing: Map<Kiru.VNode, kiru.Signal<boolean>> = new Map()
): GraphNode {
  const collapsed = existing.get(vNode) ?? kiru.signal(true)
  existing.delete(vNode)
  return {
    name,
    kiruNode: vNode,
    collapsed,
    child: null,
    sibling: null,
  }
}
