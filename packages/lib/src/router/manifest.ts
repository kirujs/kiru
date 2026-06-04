import {
  inheritedFromScopes,
  resolveRouteHeadLayer,
  resolveRouteMetaLayer,
  resolveRouteMiddlewareLayer,
} from "./routeLayers.js"
import {
  formatPathname,
  pathnameForMatch,
  type RouterPathPolicy,
} from "./pathPolicy.js"
import {
  discoverRouteBuildMeta,
  getRouteGenerateSitemapParams,
  getRouteGenerateStaticParams,
  type RouteBuildMeta,
} from "./routeBuildMeta.js"
import type { SiteConfig } from "./site.js"
import {
  DEFAULT_REQUEST_LIMITS,
  validateRouteParams,
  type ResolvedRequestLimits,
} from "./requestLimits.js"
import type {
  CompiledRoute,
  CompiledRouteScope,
  GenerateSitemapParams,
  GenerateStaticParams,
  RouteManifest,
  RouteMatch,
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
    const optionalCatchAll = segment.match(/^\[\[\.\.\.([^/\]]+)\]\]$/)
    if (optionalCatchAll) {
      if (i !== segments.length - 1) {
        throw new Error(
          `[[...${optionalCatchAll[1]}]] must be the last segment in route path`
        )
      }
      params.push(optionalCatchAll[1])
      const optionalCatchAllPart = "(?:/(.*))?"
      if (parts.length > 0) {
        parts[parts.length - 1] += optionalCatchAllPart
      } else {
        parts.push(optionalCatchAllPart)
      }
      continue
    }
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
      const optionalPart = "(?:/([^/]+))?"
      if (parts.length > 0) {
        parts[parts.length - 1] += optionalPart
      } else {
        parts.push(optionalPart)
      }
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
      const { meta: inheritedMeta, head: inheritedHead, middleware: inheritedMw } =
        inheritedFromScopes(parents)
      const scope: CompiledRouteScope = {
        id: `scope:${scopeId++}`,
        static: node.static ?? false,
        layout: node.layout,
        notFound: node.notFound,
        head: resolveRouteHeadLayer(inheritedHead, node.head),
        meta: resolveRouteMetaLayer(inheritedMeta, node.meta),
        middleware: resolveRouteMiddlewareLayer(inheritedMw, node.middleware),
        error: node.error,
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

    const { meta: inheritedMeta, head: inheritedHead, middleware: inheritedMw } =
      inheritedFromScopes(parents)
    const head = resolveRouteHeadLayer(inheritedHead, node.head)
    const meta = resolveRouteMetaLayer(inheritedMeta, node.meta)
    const middleware = resolveRouteMiddlewareLayer(inheritedMw, node.middleware)

    const scopeError = [...parents].reverse().find((s) => s.error)?.error

    routes.push({
      id: `route:${routeId++}`,
      method: node.method,
      path,
      pattern,
      segments,
      score: computeScore(segments),
      params,
      static: isStatic,
      component: node.component,
      scopes: parents,
      head,
      meta,
      middleware,
      error: node.error ?? scopeError,
    })
  }

  walk(tree.root, [])
  routes.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score
    return a.path.localeCompare(b.path)
  })

  return {
    routes,
    rootHasNotFound,
    rootLayout: tree.root.layout,
    rootError: tree.root.error,
  }
}

/** Re-instantiate in the current realm (Cypress/Electron can break `.match` on foreign RegExps). */
function execRoutePattern(pattern: RegExp, pathname: string): RegExpExecArray | null {
  return new RegExp(pattern.source, pattern.flags).exec(pathname)
}

export function matchRoute(
  manifest: RouteManifest,
  pathname: string,
  pathPolicy?: RouterPathPolicy,
  limits: ResolvedRequestLimits = DEFAULT_REQUEST_LIMITS
): RouteMatch | null {
  const normalizedPath = normalizePath(
    pathnameForMatch(pathname.split("?")[0] || "/", pathPolicy)
  )
  if (normalizedPath.length > limits.maxPathnameLength) return null

  for (const route of manifest.routes) {
    const match = execRoutePattern(route.pattern, normalizedPath)
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
    if (!validateRouteParams(params, limits)) continue
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
  paramNames: string[],
  paramsLabel = "generateStaticParams"
): string {
  let path = routePath
  for (const key of paramNames) {
    if (!(key in params)) {
      throw new Error(
        `${paramsLabel} for "${routePath}" did not provide "${key}"`
      )
    }
    const value = params[key]
    const optionalRestToken = `[[...${key}]]`
    const restToken = `[...${key}]`
    if (path.includes(optionalRestToken)) {
      if (value === "") {
        path = path.replace(optionalRestToken, "")
      } else {
        const encoded = value
          .split("/")
          .filter(Boolean)
          .map((s) => encodeURIComponent(s))
          .join("/")
        path = path.replace(optionalRestToken, encoded)
      }
    } else if (path.includes(restToken)) {
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

function isSegmentPrefix(
  parentSegments: string[],
  childSegments: string[]
): boolean {
  if (parentSegments.length >= childSegments.length) return false
  for (let i = 0; i < parentSegments.length; i++) {
    if (parentSegments[i] !== childSegments[i]) return false
  }
  return true
}

function findParentInFamily(
  route: CompiledRoute,
  familyRoutes: CompiledRoute[]
): CompiledRoute | null {
  let best: CompiledRoute | null = null
  for (const candidate of familyRoutes) {
    if (candidate.id === route.id) continue
    if (!isSegmentPrefix(candidate.segments, route.segments)) continue
    if (!best || candidate.segments.length > best.segments.length) {
      best = candidate
    }
  }
  return best
}

type ParamGeneratorSource = {
  label: "generateStaticParams" | "generateSitemapParams"
  getParams: (
    route: CompiledRoute,
    meta: RouteBuildMeta
  ) => GenerateStaticParams | GenerateSitemapParams | undefined
  missingMessage: (routePath: string) => string
  parentMissingMessage: (routePath: string, parentPath: string) => string
}

const staticParamsSource: ParamGeneratorSource = {
  label: "generateStaticParams",
  getParams: getRouteGenerateStaticParams,
  missingMessage: (routePath) =>
    `Route "${routePath}" is static and dynamic, but generateStaticParams is missing from the page module`,
  parentMissingMessage: (routePath, parentPath) =>
    `Route "${routePath}" has static parent "${parentPath}" with dynamic segments, but parent generateStaticParams is missing from the page module`,
}

const sitemapParamsSource: ParamGeneratorSource = {
  label: "generateSitemapParams",
  getParams: getRouteGenerateSitemapParams,
  missingMessage: (routePath) =>
    `sitemap.include route "${routePath}" is dynamic, but generateSitemapParams is missing from the page module`,
  parentMissingMessage: (routePath, parentPath) =>
    `sitemap.include route "${routePath}" has parent "${parentPath}" with dynamic segments, but parent generateSitemapParams is missing from the page module`,
}

async function collectParamSetsForRoute(
  route: CompiledRoute,
  familyRoutes: CompiledRoute[],
  cache: Map<string, Array<Record<string, string>>>,
  buildMeta: RouteBuildMeta,
  source: ParamGeneratorSource
): Promise<Array<Record<string, string>>> {
  const cached = cache.get(route.id)
  if (cached) return cached

  if (route.params.length === 0) {
    const empty: Array<Record<string, string>> = [{}]
    cache.set(route.id, empty)
    return empty
  }

  const generateParams = source.getParams(route, buildMeta)
  if (!generateParams) {
    throw new Error(source.missingMessage(route.path))
  }

  const parent = findParentInFamily(route, familyRoutes)
  if (parent?.params.length && !source.getParams(parent, buildMeta)) {
    throw new Error(source.parentMissingMessage(route.path, parent.path))
  }

  const parentParamNames = parent?.params ?? []
  const ownParamNames = route.params.filter(
    (p) => !parentParamNames.includes(p)
  )

  let result: Array<Record<string, string>> = []

  if (!parent || parent.params.length === 0) {
    const generated = await generateParams({ params: {} })
    for (const row of generated) {
      validateChildParams(
        route.path,
        row,
        {},
        ownParamNames,
        route.params,
        source.label
      )
      result.push(mergeParamRow({}, row, route.params, source.label))
    }
  } else {
    const parentSets = await collectParamSetsForRoute(
      parent,
      familyRoutes,
      cache,
      buildMeta,
      source
    )
    for (const parentParams of parentSets) {
      const generated = await generateParams({
        params: { ...parentParams },
      })
      for (const row of generated) {
        validateChildParams(
          route.path,
          row,
          parentParams,
          ownParamNames,
          route.params,
          source.label
        )
        result.push(
          mergeParamRow(parentParams, row, route.params, source.label)
        )
      }
    }
  }

  cache.set(route.id, result)
  return result
}

function validateChildParams(
  routePath: string,
  childRow: Record<string, string>,
  parentParams: Record<string, string>,
  ownParamNames: string[],
  allParamNames: string[],
  paramsLabel: "generateStaticParams" | "generateSitemapParams"
): void {
  for (const key of Object.keys(childRow)) {
    if (key in parentParams || !ownParamNames.includes(key)) {
      throw new Error(
        `${paramsLabel} for "${routePath}" must only return params for [${ownParamNames.join(", ")}], got unexpected key "${key}"`
      )
    }
  }
  const merged = { ...parentParams, ...childRow }
  for (const key of allParamNames) {
    if (!(key in merged)) {
      throw new Error(
        `${paramsLabel} for "${routePath}" did not provide "${key}"`
      )
    }
  }
}

function mergeParamRow(
  parentParams: Record<string, string>,
  childRow: Record<string, string>,
  allParamNames: string[],
  paramsLabel: "generateStaticParams" | "generateSitemapParams"
): Record<string, string> {
  const merged = { ...parentParams, ...childRow }
  for (const key of allParamNames) {
    if (!(key in merged)) {
      throw new Error(`${paramsLabel} merge missing "${key}"`)
    }
  }
  return merged
}

function applyExclude(
  paths: Set<string>,
  exclude: string[],
  pathPolicy?: RouterPathPolicy
): void {
  if (!exclude.length) return
  const excluded = new Set(
    exclude.map((p) => formatPathname(p, pathPolicy))
  )
  for (const path of paths) {
    if (excluded.has(path)) paths.delete(path)
  }
}

function resolveIncludedRoutes(
  manifest: RouteManifest,
  include: string[]
): CompiledRoute[] {
  const routes: CompiledRoute[] = []
  for (const template of include) {
    const route = manifest.routes.find((r) => r.path === template)
    if (!route) {
      throw new Error(`sitemap.include: no route "${template}"`)
    }
    routes.push(route)
  }
  return routes
}

async function expandFamilyPaths(
  familyRoutes: CompiledRoute[],
  pathPolicy: RouterPathPolicy | undefined,
  buildMeta: RouteBuildMeta,
  source: ParamGeneratorSource,
  out: Set<string>
): Promise<void> {
  const sorted = [...familyRoutes].sort(
    (a, b) => a.segments.length - b.segments.length
  )
  const cache = new Map<string, Array<Record<string, string>>>()

  for (const route of sorted) {
    if (route.params.length === 0) {
      out.add(formatPathname(route.path, pathPolicy))
      continue
    }

    const paramSets = await collectParamSetsForRoute(
      route,
      sorted,
      cache,
      buildMeta,
      source
    )
    for (const params of paramSets) {
      out.add(
        formatPathname(
          applyParamsToPath(
            route.path,
            params,
            route.params,
            source.label
          ),
          pathPolicy
        )
      )
    }
  }
}

export async function generateStaticPaths(
  manifest: RouteManifest,
  pathPolicy?: RouterPathPolicy,
  buildMeta?: RouteBuildMeta
): Promise<string[]> {
  const meta =
    buildMeta ??
    (await discoverRouteBuildMeta(manifest, (route) => route.component()))
  const out = new Set<string>()
  const staticRoutes = manifest.routes
    .filter((r) => r.static)
    .sort((a, b) => a.segments.length - b.segments.length)
  const cache = new Map<string, Array<Record<string, string>>>()

  for (const route of staticRoutes) {
    if (route.params.length === 0) {
      out.add(formatPathname(route.path, pathPolicy))
      continue
    }

    const paramSets = await collectParamSetsForRoute(
      route,
      staticRoutes,
      cache,
      meta,
      staticParamsSource
    )
    for (const params of paramSets) {
      out.add(
        formatPathname(
          applyParamsToPath(
            route.path,
            params,
            route.params,
            staticParamsSource.label
          ),
          pathPolicy
        )
      )
    }
  }

  return Array.from(out).sort()
}

/** Static paths expanded per locale for prerender / disk cache lookup. */
export async function generatePublicStaticPaths(
  manifest: RouteManifest,
  pathPolicy?: RouterPathPolicy,
  buildMeta?: RouteBuildMeta,
  localeRouting?: import("./i18n/localeRouting.js").I18nLocaleRouting
): Promise<string[]> {
  const logical = await generateStaticPaths(manifest, pathPolicy, buildMeta)
  if (!localeRouting) return logical
  const { expandPathsForLocales } = await import("./i18n/expandPaths.js")
  return expandPathsForLocales(logical, localeRouting, pathPolicy)
}

export async function generateSitemapPaths(
  manifest: RouteManifest,
  site: SiteConfig,
  options?: {
    defaultSsrPaths?: boolean
    buildMeta?: RouteBuildMeta
  }
): Promise<string[]> {
  if (!site.sitemap) {
    throw new Error("generateSitemapPaths: site.sitemap is not enabled")
  }

  const pathPolicy = site.pathPolicy
  const sitemapOpts = site.sitemap
  const meta =
    options?.buildMeta ??
    (await discoverRouteBuildMeta(
      manifest,
      (route) => route.component(),
      { includeRoutePaths: sitemapOpts.include }
    ))

  const out = new Set(
    await generateStaticPaths(manifest, pathPolicy, meta)
  )

  if (options?.defaultSsrPaths) {
    for (const route of manifest.routes) {
      if (route.static || route.params.length > 0) continue
      out.add(formatPathname(route.path, pathPolicy))
    }
  }

  if (sitemapOpts.include.length > 0) {
    const includedRoutes = resolveIncludedRoutes(manifest, sitemapOpts.include)
    const dynamicIncluded = includedRoutes.filter((r) => r.params.length > 0)
    if (dynamicIncluded.length > 0) {
      await expandFamilyPaths(
        dynamicIncluded,
        pathPolicy,
        meta,
        sitemapParamsSource,
        out
      )
    }
    for (const route of includedRoutes) {
      if (route.params.length === 0 && !route.static) {
        out.add(formatPathname(route.path, pathPolicy))
      }
    }
  }

  applyExclude(out, sitemapOpts.exclude, pathPolicy)

  return Array.from(out).sort()
}
