import { mergeRouteHead } from "./meta.js"
import type {
  CompiledRoute,
  CompiledRouteScope,
  GenerateStaticParams,
  RouteManifest,
  RouteMatch,
  RouteHeadMeta,
  RouteNodeDefinition,
  RouteTreeDefinition,
} from "./types.js"

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function parseSegments(pathname: string): string[] {
  return pathname.split("/").filter(Boolean)
}

function normalizePath(path: string): string {
  if (path === "/") return "/"
  return "/" + parseSegments(path).join("/")
}

function commonPrefixLength(a: string[], b: string[]): number {
  const length = Math.min(a.length, b.length)
  let i = 0
  while (i < length && a[i] === b[i]) i++
  return i
}

function mergeShallowMeta(
  ...layers: Array<Record<string, unknown> | undefined>
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const layer of layers) {
    if (!layer) continue
    for (const [k, v] of Object.entries(layer)) {
      out[k] = v
    }
  }
  return out
}

/** Score: higher wins on ambiguous matches (static > dynamic > optional > catch-all). */
function computeScore(segments: string[]): number {
  return segments.reduce((score, segment) => {
    if (/^\[\[\.\.\.[^\]]+\]\]$/.test(segment)) return score + 0
    if (/^\[\[([^/\]]+)\]\]$/.test(segment)) return score + 1
    if (/^\[\.\.\.[^\]]+\]$/.test(segment)) return score + 1
    if (/^\[[^/\]]+\]$/.test(segment)) return score + 2
    return score + 4
  }, 0)
}

function compilePattern(segments: string[]): {
  pattern: RegExp
  params: string[]
} {
  if (segments.length === 0) {
    return { pattern: /^\/$/, params: [] }
  }
  const params: string[] = []
  const parts: string[] = []
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    const catchAll = segment.match(/^\[\.\.\.([^/\]]+)\]$/)
    if (catchAll) {
      if (i !== segments.length - 1) {
        throw new Error(
          `[...${catchAll[1]}] must be the last segment in route path`
        )
      }
      params.push(catchAll[1])
      parts.push("(.*)")
      continue
    }
    const optional = segment.match(/^\[\[([^/\]]+)\]\]$/)
    if (optional) {
      params.push(optional[1])
      parts.push("(?:/([^/]+))?")
      continue
    }
    const dynamic = segment.match(/^\[([^/\]]+)\]$/)
    if (dynamic) {
      params.push(dynamic[1])
      parts.push("([^/]+)")
      continue
    }
    parts.push(escapeRegex(segment))
  }
  return {
    pattern: new RegExp(`^/${parts.join("/")}$`),
    params,
  }
}

export function compileRouteTree(tree: RouteTreeDefinition): RouteManifest {
  const routes: CompiledRoute[] = []
  let routeId = 0
  let scopeId = 0
  const rootHasNotFound = !!tree.root.notFound

  const walk = (node: RouteNodeDefinition, parents: CompiledRouteScope[]) => {
    if (node.kind === "scope") {
      const scope: CompiledRouteScope = {
        id: `scope:${scopeId++}`,
        static: node.static ?? false,
        layout: node.layout,
        notFound: node.notFound,
        head: node.head,
        meta: node.meta,
        error: node.error,
        pending: node.pending,
      }
      const nextParents = parents.concat(scope)
      for (const child of node.children) walk(child, nextParents)
      return
    }

    const path = normalizePath(node.path)
    const segments = parseSegments(path)
    const { pattern, params } = compilePattern(segments)
    const inheritedStatic = parents.some((scope) => scope.static)
    const isStatic =
      node.static === false ? false : (node.static ?? inheritedStatic)

    let head: RouteHeadMeta = {}
    let meta: Record<string, unknown> = {}
    for (const parentScope of parents) {
      head = mergeRouteHead(head, parentScope.head)
      meta = mergeShallowMeta(meta, parentScope.meta)
    }
    head = mergeRouteHead(head, node.head)
    meta = mergeShallowMeta(meta, node.meta)

    const scopeError = [...parents].reverse().find((s) => s.error)?.error
    const scopePending = [...parents].reverse().find((s) => s.pending)?.pending

    routes.push({
      id: `route:${routeId++}`,
      method: node.method,
      path,
      pattern,
      segments,
      score: computeScore(segments),
      params,
      static: isStatic,
      generateStaticParams: node.generateStaticParams as
        | GenerateStaticParams
        | undefined,
      component: node.component,
      scopes: parents,
      head,
      meta,
      beforeEnter: Array.isArray(node.beforeEnter)
        ? node.beforeEnter
        : node.beforeEnter
        ? [node.beforeEnter]
        : undefined,
      beforeActivate: Array.isArray(node.beforeActivate)
        ? node.beforeActivate
        : node.beforeActivate
        ? [node.beforeActivate]
        : undefined,
      error: node.error ?? scopeError,
      pending: node.pending ?? scopePending,
    })
  }

  walk(tree.root, [])
  routes.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score
    return a.path.localeCompare(b.path)
  })

  return { routes, rootHasNotFound }
}

export function matchRoute(
  manifest: RouteManifest,
  pathname: string
): RouteMatch | null {
  const normalizedPath = normalizePath(pathname.split("?")[0] || "/")

  for (const route of manifest.routes) {
    const match = normalizedPath.match(route.pattern)
    if (!match) continue
    const params: Record<string, string> = {}
    for (let i = 0; i < route.params.length; i++) {
      const raw = match[i + 1] ?? ""
      try {
        params[route.params[i]] = raw ? decodeURIComponent(raw) : ""
      } catch {
        params[route.params[i]] = raw
      }
    }
    return {
      route,
      params,
      pathname: normalizedPath,
    }
  }
  return null
}

export function resolveNotFoundScopes(
  manifest: RouteManifest,
  pathname: string
): CompiledRouteScope[] | null {
  const targetSegments = parseSegments(normalizePath(pathname))
  let best:
    | {
        prefix: number
        scopes: CompiledRouteScope[]
      }
    | undefined

  for (const route of manifest.routes) {
    if (!route.scopes.some((scope) => scope.notFound)) continue
    const prefix = commonPrefixLength(route.segments, targetSegments)
    if (!best || prefix > best.prefix) {
      best = { prefix, scopes: route.scopes }
    }
  }

  if (!best) return null
  for (let i = best.scopes.length - 1; i >= 0; i--) {
    if (best.scopes[i].notFound) {
      return best.scopes.slice(0, i + 1)
    }
  }
  return null
}

function applyParamsToPath(
  routePath: string,
  params: Record<string, string>,
  paramNames: string[]
): string {
  let path = routePath
  for (const key of paramNames) {
    if (!(key in params)) {
      throw new Error(
        `generateStaticParams for "${routePath}" did not provide "${key}"`
      )
    }
    const value = params[key]
    const restToken = `[...${key}]`
    if (path.includes(restToken)) {
      const encoded = value
        .split("/")
        .filter(Boolean)
        .map((s) => encodeURIComponent(s))
        .join("/")
      path = path.replace(restToken, encoded)
    } else {
      path = path.replace(`[${key}]`, encodeURIComponent(value))
    }
  }
  return normalizePath(path)
}

export async function generateStaticPaths(
  manifest: RouteManifest
): Promise<string[]> {
  const out = new Set<string>()

  for (const route of manifest.routes) {
    if (!route.static) continue
    if (route.params.length === 0) {
      out.add(route.path)
      continue
    }

    if (!route.generateStaticParams) {
      throw new Error(
        `Route "${route.path}" is static and dynamic, but generateStaticParams is missing`
      )
    }
    const generated = await route.generateStaticParams({ params: {} })
    for (const params of generated) {
      out.add(applyParamsToPath(route.path, params, route.params))
    }
  }

  return Array.from(out).sort()
}
