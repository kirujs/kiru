import { promises as fs } from "node:fs"
import path from "node:path"
import type { ViteDevServer } from "vite"
import type { ResolvedConfig } from "vite"
import type { KiruPluginOptions } from "./types.js"
import type { PluginState } from "./config.js"
import { toViteModuleId } from "./resolveModulePattern.js"
import type {
  SsgPrerenderCache,
  SsgPrerenderRouter,
  SsgSiteConfig,
} from "./ssgCacheTypes.js"

export type { SsgPrerenderCache } from "./ssgCacheTypes.js"

export type StaticLoaderPayloadByModule = Record<
  string,
  Record<string, unknown>
>

function resolveSsrModuleFile(
  vite: ViteDevServer,
  mod: unknown
): string | undefined {
  if (mod && typeof mod === "object") {
    const meta = (mod as { __vite_ssr_import_meta__?: { filename?: string } })
      .__vite_ssr_import_meta__
    if (meta?.filename) return meta.filename
  }
  if (!mod || typeof mod !== "object") return undefined
  const exports = mod as Record<string, unknown>
  for (const node of vite.moduleGraph.idToModuleMap.values()) {
    if (!node.file) continue
    if (node.ssrModule === mod) return node.file
    const ssr = node.ssrModule
    if (!ssr || typeof ssr !== "object") continue
    const ssrExports = ssr as Record<string, unknown>
    if (exports.load && ssrExports.load === exports.load) return node.file
    if (exports.default && ssrExports.default === exports.default) return node.file
  }
  return undefined
}

async function buildStaticLoaderPayloadByModule(input: {
  vite: ViteDevServer
  projectRoot: string
  manifest: { routes: Array<{ id: string; component: () => Promise<unknown> }> }
  byRouteId: Record<string, Record<string, unknown>>
  pageModuleUsesStaticLoader: (mod: unknown) => boolean
}): Promise<StaticLoaderPayloadByModule> {
  const { vite, projectRoot, manifest, byRouteId, pageModuleUsesStaticLoader } =
    input
  const payloadByModule: StaticLoaderPayloadByModule = {}

  for (const route of manifest.routes) {
    const payloads = byRouteId[route.id]
    if (!payloads) continue

    const mod = await route.component()
    if (!pageModuleUsesStaticLoader(mod)) continue

    const file = resolveSsrModuleFile(vite, mod)
    if (!file) continue

    const moduleKey = toViteModuleId(file, projectRoot)
    payloadByModule[moduleKey] = payloads
  }

  return payloadByModule
}

export async function runSsgPrerender(input: {
  state: PluginState
  opts: KiruPluginOptions
  resolvedViteConfig: ResolvedConfig
  templateHtml: string
}): Promise<SsgPrerenderCache> {
  const { state, opts, resolvedViteConfig, templateHtml } = input
  const routesAbs = state.router.ssg!.routesModuleAbs
  const routesViteId = toViteModuleId(routesAbs, state.projectRoot)

  const { createServer } = await import("vite")
  const configFile =
    typeof resolvedViteConfig.configFile === "string" &&
    resolvedViteConfig.configFile
      ? resolvedViteConfig.configFile
      : path.resolve(state.projectRoot, "vite.config.ts")
  const vite = await createServer({
    configFile,
    server: { middlewareMode: true },
    appType: "custom",
    build: { outDir: state.outDir },
  })

  try {
    const routesMod = await vite.ssrLoadModule(routesViteId)
    const routes = routesMod.routes
    if (!routes) {
      throw new Error(
        `[vite-plugin-kiru]: router.ssg.routes "${state.router.ssg!.routesModule}" does not export 'routes'`
      )
    }

    const {
      siteConfigModuleCandidates,
      prerenderStaticRoutes,
      compileRouteTree,
      discoverRouteBuildMeta,
      getI18nLocaleRouting,
      onStaticLoaderPrerenderCapture,
      pageModuleUsesStaticLoader,
    } = (await vite.ssrLoadModule("kiru/router")) as SsgPrerenderRouter

    let site = routesMod.site
    if (!site) {
      const candidates =
        state.router.ssg!.siteModuleAbsPaths ??
        siteConfigModuleCandidates(routesAbs, null).map((candidate) =>
          path.isAbsolute(candidate)
            ? candidate
            : path.resolve(state.projectRoot, candidate)
        )
      for (const siteAbs of candidates) {
        try {
          await fs.access(siteAbs)
          const siteViteId = toViteModuleId(siteAbs, state.projectRoot)
          const siteMod = await vite.ssrLoadModule(siteViteId)
          site = siteMod.site ?? siteMod.default
          break
        } catch {
          /* try next */
        }
      }
    }

    const pathPolicy = (site as { pathPolicy?: unknown } | undefined)?.pathPolicy
    const i18n = routesMod.i18n ?? routesMod.default?.i18n
    const localeRouting = i18n ? getI18nLocaleRouting(i18n) : undefined

    const byRouteId: Record<string, Record<string, unknown>> = {}
    const offCapture = onStaticLoaderPrerenderCapture(
      ({ routeId, pathname, pageData }) => {
        ;(byRouteId[routeId] ??= {})[pathname] = pageData
      }
    )

    const buildAbort = new AbortController()
    let sigintHook: (() => void) | undefined
    if (typeof process !== "undefined" && typeof process.once === "function") {
      sigintHook = () => {
        buildAbort.abort()
      }
      process.once("SIGINT", sigintHook)
    }

    let outputs: SsgPrerenderCache["outputs"]
    try {
      outputs = await prerenderStaticRoutes({
        routes,
        pathPolicy: pathPolicy as Parameters<
          typeof prerenderStaticRoutes
        >[0]["pathPolicy"],
        maxConcurrentRenders: state.router.ssg!.maxConcurrentRenders,
        i18n,
        signal: buildAbort.signal,
        ...(opts.router?.htmlShell
          ? {}
          : {
              htmlTemplate: templateHtml,
            }),
      })
    } finally {
      if (sigintHook && typeof process !== "undefined" && process.off) {
        process.off("SIGINT", sigintHook)
      }
      offCapture()
    }

    const manifest = compileRouteTree(routes)
    const loadPageModule = async (route: {
      component: () => Promise<unknown>
    }) => route.component()
    let buildMeta = await discoverRouteBuildMeta(manifest, loadPageModule)
    const sitemapConfig = (site as { sitemap?: boolean | { include?: string[] } })
      ?.sitemap
    if (sitemapConfig && typeof sitemapConfig === "object" && sitemapConfig.include) {
      buildMeta = await discoverRouteBuildMeta(manifest, loadPageModule, {
        includeRoutePaths: sitemapConfig.include,
      })
    }

    const staticLoaderPayloadByModule = await buildStaticLoaderPayloadByModule({
      vite,
      projectRoot: state.projectRoot,
      manifest,
      byRouteId,
      pageModuleUsesStaticLoader,
    })

    return {
      outputs,
      staticLoaderPayloadByModule,
      site: site as SsgSiteConfig | null | undefined,
      pathPolicy: pathPolicy as SsgSiteConfig["pathPolicy"] | undefined,
      localeRouting,
      routes,
      buildMeta,
      manifest,
    }
  } finally {
    await vite.close()
  }
}
