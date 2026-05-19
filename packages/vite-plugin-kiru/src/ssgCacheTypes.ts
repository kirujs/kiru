/** Build-time shapes for user `defineSiteConfig()` output (loaded via `ssrLoadModule`). */
export type SsgSiteLocales = {
  default: string
  prefixes: readonly string[]
}

export type SsgPathPolicy = {
  baseUrl: string
  trailingSlash: "always" | "never" | "ignore"
}

export type SsgSiteConfig = {
  url: string
  pathPolicy: SsgPathPolicy
  sitemap: false | ({ include?: string[] } & Record<string, unknown>)
  robots: false | Record<string, unknown>
  locales?: SsgSiteLocales
}

export type SsgCompiledRoute = {
  id: string
  path: string
  static?: boolean
  component: () => Promise<unknown>
}

export type SsgRouteManifest = {
  routes: SsgCompiledRoute[]
  rootHasNotFound?: boolean
}

export type SsgRouteBuildMetaEntry = {
  revalidate?: unknown
  tags?: string[]
}

export type SsgRouteBuildMeta = {
  byRouteId: Record<string, SsgRouteBuildMetaEntry>
}

export type SsgPrerenderOutput = {
  path: string
  body: string
  document: { headHtml: string; title?: string }
  html?: string
  routeId: string
  pageData?: unknown
}

export type SsgPrerenderCache = {
  outputs: SsgPrerenderOutput[]
  staticLoaderPayloadByModule: Record<string, Record<string, unknown>>
  site: SsgSiteConfig | null | undefined
  pathPolicy: SsgPathPolicy | undefined
  siteLocales: SsgSiteLocales | undefined
  routes: unknown
  buildMeta: SsgRouteBuildMeta
  manifest: SsgRouteManifest
}

/** `kiru/router` exports used during `runSsgPrerender`. */
export type SsgPrerenderRouter = {
  siteConfigModuleCandidates: (
    routesAbs: string,
    siteModule: null
  ) => string[]
  prerenderStaticRoutes: (
    options: Record<string, unknown>
  ) => Promise<SsgPrerenderOutput[]>
  compileRouteTree: (routes: unknown) => SsgRouteManifest
  discoverRouteBuildMeta: (
    manifest: SsgRouteManifest,
    loadPageModule: (route: SsgCompiledRoute) => Promise<unknown>,
    options?: { includeRoutePaths?: string[] }
  ) => Promise<SsgRouteBuildMeta>
  normalizeSiteLocales: (locales: unknown) => SsgSiteLocales | undefined
  onStaticLoaderPrerenderCapture: (
    listener: (payload: {
      routeId: string
      pathname: string
      pageData: unknown
    }) => void
  ) => () => void
  pageModuleUsesStaticLoader: (mod: unknown) => boolean
}

/** `kiru/router` exports used in `writeBundle` after prerender. */
export type SsgWriteBundleRouter = {
  generateSitemapPaths: (
    manifest: SsgRouteManifest,
    site: SsgSiteConfig,
    options?: { defaultSsrPaths?: boolean; buildMeta?: SsgRouteBuildMeta }
  ) => Promise<string[]>
  writeSiteArtifacts: (args: {
    outDir: string
    paths: string[]
    site: SsgSiteConfig
    buildDate?: string
  }) => Promise<void>
  matchRoute: (
    manifest: SsgRouteManifest,
    pathname: string,
    pathPolicy: SsgPathPolicy | undefined
  ) => { route: SsgCompiledRoute } | null
  getRouteBuildMetaEntry: (
    route: SsgCompiledRoute,
    buildMeta: SsgRouteBuildMeta
  ) => SsgRouteBuildMetaEntry | undefined
  persistPrerenderBuildOutput: (args: {
    clientDir: string
    pathname: string
    htmlAbsolutePath: string
    revalidate?: unknown
    tags?: string[]
  }) => void
  splitAppPathname: (
    pathname: string,
    locales: SsgSiteLocales
  ) => { pathname: string }
}
