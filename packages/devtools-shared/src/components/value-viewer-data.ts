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
  children: ViewerNode[]
}

export interface ViewerArrayNode {
  kind: "array"
  label: string
  path: string
  collapsed: kiru.Signal<boolean>
  length: number
  children: ViewerNode[]
}

export interface ViewerArrayChunkNode {
  kind: "array-chunk"
  label: string
  path: string
  collapsed: kiru.Signal<boolean>
  range: { start: number; end: number }
  children: ViewerNode[]
}

export type ViewerNode =
  | ViewerLeafNode
  | ViewerObjectNode
  | ViewerArrayNode
  | ViewerArrayChunkNode

export interface ViewerRoot {
  children: ViewerNode[]
  page: kiru.Signal<number>
}

type SignalCache = {
  collapsed: Map<string, kiru.Signal<boolean>>
  page: Map<string, kiru.Signal<number>>
}

export function emptyCache(): SignalCache {
  return { collapsed: new Map(), page: new Map() }
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
      collectFromNodes(node.children, cache)
    } else if (node.kind === "array" || node.kind === "array-chunk") {
      cache.collapsed.set(node.path, node.collapsed)
      collectFromNodes(node.children, cache)
    }
  }
}

export function disposeCache(cache: SignalCache) {
  for (const s of cache.collapsed.values()) kiru.Signal.dispose(s)
  for (const s of cache.page.values()) kiru.Signal.dispose(s)
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

  if (Array.isArray(raw)) {
    const collapsed = cache.collapsed.get(path) ?? kiru.signal(true)
    cache.collapsed.delete(path)

    let children: ViewerNode[]
    if (raw.length > settings.arrayChunkSize) {
      const numChunks = Math.ceil(raw.length / settings.arrayChunkSize)
      children = Array.from({ length: numChunks }, (_, idx) => {
        const start = idx * settings.arrayChunkSize
        const end = Math.min((idx + 1) * settings.arrayChunkSize, raw.length)
        const chunkPath = `${path}[${start}..${end - 1}]`
        const chunkCollapsed =
          cache.collapsed.get(chunkPath) ?? kiru.signal(true)
        cache.collapsed.delete(chunkPath)
        const chunkChildren = raw
          .slice(start, end)
          .map((item, i) =>
            buildNode(
              item,
              (start + i).toString(),
              `${path}[${start + i}]`,
              cache,
              settings
            )
          )
        return {
          kind: "array-chunk" as const,
          label: `[${start}..${end - 1}]`,
          path: chunkPath,
          collapsed: chunkCollapsed,
          range: { start, end },
          children: chunkChildren,
        }
      })
    } else {
      children = raw.map((item, idx) =>
        buildNode(item, idx.toString(), `${path}[${idx}]`, cache, settings)
      )
    }

    return {
      kind: "array",
      label,
      path,
      collapsed,
      length: raw.length,
      children,
    }
  }

  // Plain object
  const collapsed = cache.collapsed.get(path) ?? kiru.signal(true)
  cache.collapsed.delete(path)
  const page = cache.page.get(path) ?? kiru.signal(0)
  cache.page.delete(path)
  const children = buildObjectChildren(
    raw as Record<string, unknown>,
    path,
    cache,
    settings
  )

  return { kind: "object", label, path, collapsed, page, children }
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

export function buildRoot(
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
