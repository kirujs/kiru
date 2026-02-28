import * as kiru from "kiru"

export type ViewerLeafKind =
  | "null"
  | "undefined"
  | "string"
  | "number"
  | "bigint"
  | "boolean"
  | "symbol"
  | "function"
  | "dom-node"
  | "error"

export interface ViewerLeafNode {
  kind: ViewerLeafKind
  label: string
  path: string
  raw: unknown
}

export interface ViewerObjectNode {
  kind: "object"
  label: string
  path: string
  collapsed: kiru.Signal<boolean>
  page: kiru.Signal<number>
  /** Null until the node is first expanded. Call buildChildren() to populate. */
  children: kiru.Signal<ViewerNode[] | null>
  buildChildren: () => void
}

export interface ViewerArrayNode {
  kind: "array"
  label: string
  path: string
  collapsed: kiru.Signal<boolean>
  length: number
  /** Null until the node is first expanded. Call buildChildren() to populate. */
  children: kiru.Signal<ViewerNode[] | null>
  buildChildren: () => void
}

export interface ViewerArrayChunkNode {
  kind: "array-chunk"
  label: string
  path: string
  collapsed: kiru.Signal<boolean>
  range: { start: number; end: number }
  /** Null until the chunk is first expanded. Call buildChildren() to populate. */
  children: kiru.Signal<ViewerNode[] | null>
  buildChildren: () => void
}

export interface ViewerSignalNode {
  kind: "signal"
  label: string
  path: string
  signal: kiru.Signal<unknown>
  /**
   * Reactive viewer node for the signal's current value.
   * Rebuilt (and the old inner node's signals disposed) whenever the signal changes.
   */
  viewerNode: kiru.Signal<ViewerNode>
  unsubscribe: () => void
}

export type ViewerNode =
  | ViewerLeafNode
  | ViewerObjectNode
  | ViewerArrayNode
  | ViewerArrayChunkNode
  | ViewerSignalNode

export interface ViewerRoot {
  /** Top-level entries — always built eagerly (one level deep, no recursion). */
  children: ViewerNode[]
  page: kiru.Signal<number>
}

// ---------------------------------------------------------------------------
// Signal cache (for reconciliation across updates)
// ---------------------------------------------------------------------------

type SignalCache = {
  collapsed: Map<string, kiru.Signal<boolean>>
  page: Map<string, kiru.Signal<number>>
  /** Tracked only for disposal — children signals are never reused across builds. */
  children: Map<string, kiru.Signal<ViewerNode[] | null>>
  /** Tracked for unsubscribing and disposing viewerNode signals. */
  signalNodes: Map<string, ViewerSignalNode>
}

export function emptyCache(): SignalCache {
  return {
    collapsed: new Map(),
    page: new Map(),
    children: new Map(),
    signalNodes: new Map(),
  }
}

export function collectFromRoot(
  root: ViewerRoot,
  rootKey: string,
  cache: SignalCache
) {
  cache.page.set(rootKey, root.page)
  collectFromNodes(root.children, cache)
}

function collectFromNodes(nodes: ViewerNode[], cache: SignalCache) {
  for (const node of nodes) {
    if (node.kind === "object") {
      cache.collapsed.set(node.path, node.collapsed)
      cache.page.set(node.path, node.page)
      cache.children.set(node.path, node.children)
      const built = node.children.peek()
      if (built !== null) collectFromNodes(built, cache)
    } else if (node.kind === "array" || node.kind === "array-chunk") {
      cache.collapsed.set(node.path, node.collapsed)
      cache.children.set(node.path, node.children)
      const built = node.children.peek()
      if (built !== null) collectFromNodes(built, cache)
    } else if (node.kind === "signal") {
      cache.signalNodes.set(node.path, node)
      collectFromNodes([node.viewerNode.peek()], cache)
    }
  }
}

export function disposeCache(cache: SignalCache) {
  for (const s of cache.collapsed.values()) kiru.Signal.dispose(s)
  for (const s of cache.page.values()) kiru.Signal.dispose(s)
  for (const s of cache.children.values()) kiru.Signal.dispose(s)
  for (const n of cache.signalNodes.values()) {
    n.unsubscribe()
    kiru.Signal.dispose(n.viewerNode)
  }
}

// ---------------------------------------------------------------------------
// Tree building
// ---------------------------------------------------------------------------

type BuildSettings = { objectKeysChunkSize: number; arrayChunkSize: number }

function classifyLeaf(raw: unknown): ViewerLeafKind | null {
  if (raw === null) return "null"
  if (raw === undefined) return "undefined"

  const WinNode = window.opener
    ? (window.opener.Node as typeof window.Node)
    : window.Node
  if (raw instanceof WinNode) return "dom-node"

  const WinError = window.opener
    ? (window.opener.Error as typeof window.Error)
    : window.Error
  if (raw instanceof WinError) return "error"

  const t = typeof raw
  if (t === "string") return "string"
  if (t === "number") return "number"
  if (t === "bigint") return "bigint"
  if (t === "boolean") return "boolean"
  if (t === "symbol") return "symbol"
  if (t === "function") return "function"

  return null
}

function buildNode(
  raw: unknown,
  label: string,
  path: string,
  cache: SignalCache,
  settings: BuildSettings
): ViewerNode {
  const leafKind = classifyLeaf(raw)
  if (leafKind !== null) {
    return { kind: leafKind, label, path, raw }
  }

  if (kiru.Signal.isSignal(raw)) {
    const sig = raw as kiru.Signal<unknown>
    const innerPath = `${path}.$value`
    const innerNode = buildNode(sig.peek(), "value", innerPath, cache, settings)
    const viewerNode = kiru.signal<ViewerNode>(innerNode)

    const unsubscribe = sig.subscribe((newValue) => {
      // Collect old signals by path for reconciliation, then reuse them in the
      // new build so collapse/page state is preserved across value changes
      const prevCache = emptyCache()
      collectFromNodes([viewerNode.peek()], prevCache)
      viewerNode.value = buildNode(newValue, "value", innerPath, prevCache, settings)
      disposeCache(prevCache)
    })

    return { kind: "signal", label, path, signal: sig, viewerNode, unsubscribe }
  }

  if (Array.isArray(raw)) {
    const collapsed = cache.collapsed.get(path) ?? kiru.signal(true)
    cache.collapsed.delete(path)
    // Children signal is always fresh — old signal (if any) stays in cache for disposal
    const children = kiru.signal<ViewerNode[] | null>(null)

    const node: ViewerArrayNode = {
      kind: "array",
      label,
      path,
      collapsed,
      length: raw.length,
      children,
      buildChildren: () => {
        if (children.peek() !== null) return

        if (raw.length > settings.arrayChunkSize) {
          const numChunks = Math.ceil(raw.length / settings.arrayChunkSize)
          children.value = Array.from({ length: numChunks }, (_, idx) => {
            const start = idx * settings.arrayChunkSize
            const end = Math.min(
              (idx + 1) * settings.arrayChunkSize,
              raw.length
            )
            const chunkPath = `${path}[${start}..${end - 1}]`
            const chunkCollapsed = kiru.signal(true)
            const chunkChildren = kiru.signal<ViewerNode[] | null>(null)
            const rawSlice = raw.slice(start, end)
            const chunk: ViewerArrayChunkNode = {
              kind: "array-chunk",
              label: `[${start}..${end - 1}]`,
              path: chunkPath,
              collapsed: chunkCollapsed,
              range: { start, end },
              children: chunkChildren,
              buildChildren: () => {
                if (chunkChildren.peek() !== null) return
                chunkChildren.value = rawSlice.map((item, i) =>
                  buildNode(
                    item,
                    (start + i).toString(),
                    `${path}[${start + i}]`,
                    emptyCache(),
                    settings
                  )
                )
              },
            }
            return chunk
          })
        } else {
          children.value = raw.map((item, idx) =>
            buildNode(
              item,
              idx.toString(),
              `${path}[${idx}]`,
              emptyCache(),
              settings
            )
          )
        }
      },
    }
    return node
  }

  // Plain object
  const collapsed = cache.collapsed.get(path) ?? kiru.signal(true)
  cache.collapsed.delete(path)
  const page = cache.page.get(path) ?? kiru.signal(0)
  cache.page.delete(path)
  // Children signal is always fresh — old signal (if any) stays in cache for disposal
  const children = kiru.signal<ViewerNode[] | null>(null)
  const rawObj = raw as Record<string, unknown>

  const node: ViewerObjectNode = {
    kind: "object",
    label,
    path,
    collapsed,
    page,
    children,
    buildChildren: () => {
      if (children.peek() !== null) return
      children.value = buildObjectChildren(rawObj, path, emptyCache(), settings)
    },
  }
  return node
}

function buildObjectChildren(
  data: Record<string, unknown>,
  path: string,
  cache: SignalCache,
  settings: BuildSettings
): ViewerNode[] {
  return Object.keys(data).map((key) =>
    buildNode(data[key], key, `${path}.${key}`, cache, settings)
  )
}

export function buildViewerRoot(
  data: Record<string, unknown>,
  rootKey: string,
  cache: SignalCache,
  settings: BuildSettings
): ViewerRoot {
  const page = cache.page.get(rootKey) ?? kiru.signal(0)
  cache.page.delete(rootKey)
  const children = buildObjectChildren(data, rootKey, cache, settings)
  return { page, children }
}
