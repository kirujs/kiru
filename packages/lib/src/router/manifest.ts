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

function computeScore(segments: string[]): number {
  return segments.reduce((score, segment) => {
    if (/^\[[^/]+\]$/.test(segment)) return score + 2
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
  const parts = segments.map((segment) => {
    const dynamic = segment.match(/^\[([^/]+)\]$/)
    if (!dynamic) return escapeRegex(segment)
    params.push(dynamic[1])
    return "([^/]+)"
  })
  return {
    pattern: new RegExp(`^/${parts.join("/")}$`),
    params,
  }
}

export function compileRouteTree(tree: RouteTreeDefinition): RouteManifest {
  const routes: CompiledRoute[] = []
  let routeId = 0
  let scopeId = 0

  const walk = (node: RouteNodeDefinition, parents: CompiledRouteScope[]) => {
    if (node.kind === "scope") {
      const scope: CompiledRouteScope = {
        id: `scope:${scopeId++}`,
        static: node.static ?? false,
        layout: node.layout,
        notFound: node.notFound,
        head: node.head,
      }
      const nextParents = parents.concat(scope)
      for (const child of node.children) walk(child, nextParents)
      return
    }

    const path = normalizePath(node.path)
    const segments = parseSegments(path)
    const { pattern, params } = compilePattern(segments)
    const inheritedStatic = parents.some((scope) => scope.static)
    const isStatic = node.static ?? inheritedStatic

    let head: RouteHeadMeta = {}
    for (const parentScope of parents) {
      head = mergeRouteHead(head, parentScope.head)
    }
    head = mergeRouteHead(head, node.head)

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
      beforeEnter: Array.isArray(node.beforeEnter)
        ? node.beforeEnter
        : node.beforeEnter
        ? [node.beforeEnter]
        : undefined,
    })
  }

  walk(tree.root, [])
  routes.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score
    return a.path.localeCompare(b.path)
  })

  return { routes }
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
      params[route.params[i]] = decodeURIComponent(match[i + 1] ?? "")
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
      let path = route.path
      for (const key of route.params) {
        if (!(key in params)) {
          throw new Error(
            `generateStaticParams for "${route.path}" did not provide "${key}"`
          )
        }
        path = path.replace(`[${key}]`, encodeURIComponent(params[key]))
      }
      out.add(path)
    }
  }

  return Array.from(out).sort()
}
