import * as kiru from "kiru"
import { devtoolsState } from "../../state"
import { getNodeName } from "../../utils"

const { selectedApp, appSearchTerm } = devtoolsState

export const appGraph = kiru.signal<GraphRoot>(createGraphRoot())

export interface GraphRoot {
  value: "ROOT"
  collapsed: kiru.Signal<boolean>
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
  disposeGraph(appGraph.peek())
  if (!selectedApp.value) {
    appGraph.value = createGraphRoot()
    return
  }
  const app = selectedApp.value
  const search = appSearchTerm.value
  appGraph.value = buildGraph(app, search)
})

function disposeGraph(graph: GraphRoot | GraphNode | null) {
  if (!graph) return
  kiru.Signal.dispose(graph.collapsed)
  if ("nodes" in graph) {
    graph.nodes.forEach(disposeGraph)
  } else {
    disposeGraph(graph.child)
    disposeGraph(graph.sibling)
  }
}

function buildGraph(app: kiru.AppHandle, search: string): GraphRoot {
  const rootNode = app.rootNode
  const graphRoot = createGraphRoot()
  if (!rootNode) return graphRoot

  const trimmed = search.trim().toLowerCase()
  const searchTerms = trimmed ? trimmed.split(/\s+/) : []

  graphRoot.nodes.push(...searchFunctionNodes(rootNode, searchTerms))
  return graphRoot
}

function searchFunctionNodes(
  vNode: Kiru.VNode | null,
  terms: string[]
): GraphNode[] {
  const result: GraphNode[] = []
  let n = vNode
  while (n) {
    const children = searchFunctionNodes(n.child, terms)
    if (typeof n.type !== "function") {
      result.push(...children)
    } else {
      const name = getNodeName(n)
      if (searchMatchesItem(terms, name)) {
        const node = createGraphNode(n, name)
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
    collapsed: kiru.signal(true),
    nodes,
  }
}

function createGraphNode(vNode: Kiru.VNode, name: string): GraphNode {
  return {
    name,
    kiruNode: vNode,
    collapsed: kiru.signal(true),
    child: null,
    sibling: null,
  }
}
