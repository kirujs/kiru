import { MagicString, TransformCTX } from "./codegen/shared.js"
import {
  prepareHMR,
  prepareJSXHoisting,
  prepareRemoteFunctions,
  preparePageLoaders,
} from "./codegen/index.js"
import { ANSI } from "./ansi.js"
import {
  createPluginState,
  defaultEsBuildOptions,
  resolveRouterModulePaths,
  updatePluginState,
  type PluginState,
} from "./config.js"
import {
  LOADER_MODULES_MANIFEST,
  mergeLoaderModules,
  readLoaderModuleManifest,
  renderLoaderRegistryVirtual,
  writeDevLoaderManifest,
} from "./loaderRegistryVirtual.js"
import { toViteModuleId } from "./resolveModulePattern.js"
import {
  createDevtoolsHtmlTransform,
  devtoolsHeadInjectionHtml,
  setupDevtools,
} from "./devtools.js"
import {
  extractEntryUrls,
  handleSsrDevRequest,
  injectDevCssLinks,
} from "./dev-server.js"
import { createSsgPreviewMiddleware } from "./preview-server.js"
import {
  createLogger,
  normalizeModulePath,
  shouldTransformFile,
} from "./utils.js"
import { promises as fs } from "node:fs"
import path from "node:path"
import { glob } from "tinyglobby"

import type { KiruPluginOptions } from "./types.js"
import type {
  ConfigEnv,
  Plugin,
  PluginOption,
  ResolvedConfig,
  UserConfig,
} from "vite"

const REMOTE_REGISTRY_VIRTUAL_ID = "virtual:kiru:remote-registry"
const LOADER_REGISTRY_VIRTUAL_ID = "virtual:kiru:loader-registry"

function isSsrBundleBuild(userConfig: UserConfig): boolean {
  const ssr = userConfig.build?.ssr
  return ssr === true || typeof ssr === "string"
}

async function readViteClientManifest(
  outDir: string
): Promise<Record<string, unknown> | undefined> {
  const candidates = [
    path.join(outDir, ".vite", "manifest.json"),
    path.join(outDir, "manifest.json"),
  ]
  for (const p of candidates) {
    try {
      const raw = await fs.readFile(p, "utf8")
      return JSON.parse(raw) as Record<string, unknown>
    } catch {
      /* try next */
    }
  }
  return undefined
}

export default function kiru(opts: KiruPluginOptions = {}): PluginOption {
  let state: PluginState
  let log: (...data: any[]) => void
  let virtualModules: Record<string, () => string> = {}
  let resolvedViteConfig: ResolvedConfig | undefined

  const mainPlugin = {
    name: "vite-plugin-kiru",
    config(config: UserConfig, env: ConfigEnv) {
      const partial: UserConfig = {
        esbuild: { ...defaultEsBuildOptions, ...config.esbuild },
      }
      if (
        opts.router?.serverEntry &&
        env.command === "build" &&
        !isSsrBundleBuild(config)
      ) {
        partial.build = {
          ...config.build,
          outDir: config.build?.outDir ?? "dist/client",
          emptyOutDir: config.build?.emptyOutDir ?? true,
        }
      }
      return partial
    },
    async configResolved(config) {
      resolvedViteConfig = config
      const initialState = createPluginState(opts)
      state = updatePluginState(initialState, config, opts)
      await resolveRouterModulePaths(state, state.projectRoot)
      log = createLogger(state)

      if (state.router.remote) {
        state.remotePaths = (
          await glob(state.router.remote, {
            cwd: state.projectRoot,
            absolute: true,
            onlyFiles: true,
          })
        ).map((filePath) => filePath.replace(/\\/g, "/"))

        virtualModules[REMOTE_REGISTRY_VIRTUAL_ID] = () => {
          const imports = state.remotePaths
            .map((filePath) => {
              const viteId =
                "/" +
                path.relative(state.projectRoot, filePath).replace(/\\/g, "/")
              return `import ${JSON.stringify(viteId)};`
            })
            .join("\n")
          return `${imports}\nexport {};`
        }
      }

      if (state.router.serverEntry) {
        virtualModules[LOADER_REGISTRY_VIRTUAL_ID] = () =>
          renderLoaderRegistryVirtual({})
      }
    },
    transformIndexHtml() {
      if (!state.devtoolsEnabled) return
      return createDevtoolsHtmlTransform(
        state.dtClientPathname,
        state.dtHostScriptPath
      )
    },
    configurePreviewServer(server) {
      if (!state.router.ssg) return
      server.middlewares.use(createSsgPreviewMiddleware(state.outDir))
    },
    configureServer(server) {
      if (state.isProduction || state.isBuild) return

      const { devtoolsEnabled, dtHostScriptPath, fileLinkFormatter, router } =
        state

      if (devtoolsEnabled) {
        setupDevtools(
          server,
          { formatFileLink: fileLinkFormatter },
          dtHostScriptPath,
          log
        )
      }

      // SSR dev mode: register DIRECTLY (not via post-hook) so we intercept
      // requests before Vite's indexHtmlMiddleware would serve index.html.
      // The plugin owns the full request pipeline here, giving us access to
      // the Response object before anything hits the socket — no patching needed.
      // When `serverEntry` is set, always use the SSR dev pipeline — including
      // hybrid apps with `router.ssg` (prerender is build-time only; dev stays SSR).
      if (router.serverEntryAbs) {
        const serverEntry = router.serverEntryAbs

        // The streaming SSR response carries the entry `<script>` tag in the
        // suffix (after the body), so we can't extract it from the response in
        // time to inject CSS into the head. Instead, derive entry URLs from
        // the project's index.html template once and invalidate on edit.
        const templateName = opts.router?.htmlTemplate ?? "index.html"
        const templatePath = path
          .resolve(state.projectRoot, templateName)
          .replace(/\\/g, "/")
        const invalidateVirtualRegistry = (virtualId: string) => {
          const mod = server.moduleGraph.getModuleById("\0" + virtualId)
          if (mod) server.moduleGraph.invalidateModule(mod)
        }
        const invalidateRemoteRegistry = () =>
          invalidateVirtualRegistry(REMOTE_REGISTRY_VIRTUAL_ID)
        const invalidateLoaderRegistry = () =>
          invalidateVirtualRegistry(LOADER_REGISTRY_VIRTUAL_ID)
        let serverEntryVersion = 0
        const getServerEntry = () =>
          serverEntryVersion === 0
            ? serverEntry
            : `${serverEntry}?kiru-html=${serverEntryVersion}`
        let cachedEntryUrls: string[] | null = null
        const getEntryUrls = async (): Promise<string[]> => {
          if (cachedEntryUrls) return cachedEntryUrls
          try {
            const tpl = await fs.readFile(templatePath, "utf8")
            cachedEntryUrls = extractEntryUrls(tpl)
          } catch {
            cachedEntryUrls = []
          }
          return cachedEntryUrls
        }
        server.watcher.on("change", (file) => {
          const resolvedFile = path.resolve(file).replace(/\\/g, "/")
          if (resolvedFile === templatePath) {
            cachedEntryUrls = null
            serverEntryVersion++
            const serverEntryModules =
              server.moduleGraph.getModulesByFile(serverEntry) ?? []
            for (const mod of serverEntryModules) {
              server.moduleGraph.invalidateModule(mod)
            }
          }
          if (state.remotePaths.includes(resolvedFile)) {
            invalidateRemoteRegistry()
          }
          if (
            [...state.loaderModulesByRouteId.values()].some(
              (viteId) =>
                normalizeModulePath(viteId, state.projectRoot) === resolvedFile
            )
          ) {
            invalidateLoaderRegistry()
          }
        })

        server.middlewares.use(async (req, res, next) => {
          const pathname = (req.originalUrl ?? "/").split("?")[0]
          if (
            pathname.startsWith("/@") ||
            pathname.startsWith("/__") ||
            (/\.\w+$/.test(pathname) && !pathname.endsWith(".html"))
          ) {
            return next()
          }
          try {
            const handled = await handleSsrDevRequest(server, req, res, {
              serverEntry: getServerEntry(),
              getEntryUrls,
              devtoolsHeadHtml: devtoolsEnabled
                ? devtoolsHeadInjectionHtml(
                    state.dtClientPathname,
                    dtHostScriptPath
                  )
                : undefined,
              loadRemoteRegistry: state.router.remote
                ? async () => {
                    await server.ssrLoadModule(REMOTE_REGISTRY_VIRTUAL_ID)
                  }
                : undefined,
              loadLoaderRegistry: state.router.serverEntry
                ? async () => {
                    await server.ssrLoadModule(LOADER_REGISTRY_VIRTUAL_ID)
                  }
                : undefined,
            })
            if (!handled) next()
          } catch (e) {
            server.ssrFixStacktrace(e as Error)
            next(e)
          }
        })
        return
      }

      const routesModuleAbs = router.ssg?.routesModuleAbs
      if (!routesModuleAbs) return

      // SSG dev mode: register directly so this runs before Vite's
      // indexHtmlMiddleware. We render pages and inject CSS links into the
      // resulting HTML before writing the response.
      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.originalUrl ?? "/"
        const pathname = rawUrl.split("?")[0]

        if (
          pathname.startsWith("/@") ||
          pathname.startsWith("/__") ||
          (/\.\w+$/.test(pathname) && !pathname.endsWith(".html"))
        ) {
          return next()
        }

        try {
          const templateName = opts.router?.htmlTemplate ?? "index.html"
          const templatePath = path.resolve(state.projectRoot, templateName)
          const templateSource = await fs.readFile(templatePath, "utf8")
          const htmlTemplate = await server.transformIndexHtml(
            rawUrl,
            templateSource
          )

          const routesViteId = toViteModuleId(
            routesModuleAbs,
            state.projectRoot
          )
          const routesMod = await server.ssrLoadModule(routesViteId)
          const routes = routesMod.routes
          if (!routes) return next()

          const { createRenderer } = await server.ssrLoadModule("kiru/router")
          const renderer = createRenderer({ routes, htmlTemplate })
          const result = await renderer.render(rawUrl)
          if (!result) return next()

          const body = await injectDevCssLinks(server, result.body)
          res.statusCode = result.status
          for (const [key, value] of Object.entries(
            result.headers as Record<string, string>
          )) {
            res.setHeader(key, value)
          }
          res.setHeader("content-length", Buffer.byteLength(body, "utf8"))
          res.end(body)
        } catch (e) {
          server.ssrFixStacktrace(e as Error)
          next(e)
        }
      })
    },
    resolveId(id) {
      if (id in virtualModules) {
        return "\0" + id
      }
      return null
    },
    async load(id) {
      if (!id.startsWith("\0")) return null
      const raw = id.slice(1)
      if (raw === LOADER_REGISTRY_VIRTUAL_ID) {
        const clientOutDir = state.isSSRBuild
          ? path.join(path.dirname(path.resolve(state.projectRoot, state.outDir)), "client")
          : path.resolve(state.projectRoot, state.outDir)
        const fromDisk = await readLoaderModuleManifest(
          state.projectRoot,
          clientOutDir
        )
        const modules = mergeLoaderModules(
          state.loaderModulesByRouteId,
          fromDisk
        )
        return renderLoaderRegistryVirtual(modules)
      }
      if (!(raw in virtualModules)) return null
      return virtualModules[raw]()
    },
    async transform(src, id) {
      if (!shouldTransformFile(id, state)) {
        if (
          !state.includedPaths.some((p) => id.startsWith(p)) &&
          !id.startsWith(state.projectRoot)
        ) {
          opts?.onFileExcluded?.(id)
        }
        return { code: src }
      }

      log(`Processing ${ANSI.black(id)}`)

      const ast = this.parse(src)
      const code = new MagicString(src)
      const ctx: TransformCTX = {
        code,
        ast,
        isBuild: state.isBuild,
        fileLinkFormatter: state.fileLinkFormatter,
        filePath: id,
        log,
      }

      if (state.features.staticHoisting) {
        prepareJSXHoisting(ctx)
      }

      if (!state.isProduction && !state.isBuild) {
        prepareHMR(ctx)
      }

      if (!code.hasChanged()) {
        log(ANSI.green("✓"), "No changes")
        return { code: src }
      }

      const map = code.generateMap({
        source: id,
        file: `${id}.map`,
        includeContent: true,
      })
      log(ANSI.green("✓"), "Transformed")

      const result = code.toString()
      opts.onFileTransformed?.(id, result)

      return {
        code: result,
        map: map.toString(),
      }
    },
    async closeBundle() {
      if (!state.isBuild || state.isSSRBuild) return
      const serverEntryAbs = state.router.serverEntryAbs
      // `router.ssg` prerenders HTML in `writeBundle`; it is not mutually
      // exclusive with `serverEntry` — hybrid apps still need the SSR bundle.
      if (!serverEntryAbs) return
      if (!resolvedViteConfig) {
        throw new Error(
          "[vite-plugin-kiru]: internal error — missing resolved Vite config for SSR server build"
        )
      }

      const root = resolvedViteConfig.root
      const clientOutAbs = path.resolve(root, state.outDir)
      const serverOutAbs = path.join(path.dirname(clientOutAbs), "server")
      const serverEntryRelative =
        path.relative(root, serverEntryAbs).replace(/\\/g, "/") || "."

      log(
        `${ANSI.green("✓")} SSR server bundle → ${path.relative(root, path.join(serverOutAbs, "server.js"))}`
      )

      const configFile =
        typeof resolvedViteConfig.configFile === "string" &&
        resolvedViteConfig.configFile
          ? resolvedViteConfig.configFile
          : path.resolve(state.projectRoot, "vite.config.ts")

      const { build } = await import("vite")
      await build({
        configFile,
        root,
        mode: resolvedViteConfig.mode,
        logLevel: resolvedViteConfig.logLevel,
        build: {
          ssr: serverEntryRelative,
          outDir: serverOutAbs,
          emptyOutDir: true,
          rollupOptions: {
            output: {
              entryFileNames: "index.js",
            },
          },
        },
      })
    },
    generateBundle() {
      if (
        state.isBuild &&
        !state.isSSRBuild &&
        state.router.serverEntry &&
        state.loaderModulesByRouteId.size > 0
      ) {
        this.emitFile({
          type: "asset",
          fileName: LOADER_MODULES_MANIFEST,
          source: JSON.stringify(
            Object.fromEntries(state.loaderModulesByRouteId),
            null,
            2
          ),
        })
      }
      if (!state.isBuild || !state.router.ssg?.routesModuleAbs) return
      this.emitFile({
        type: "asset",
        fileName: "kiru-route-manifest.json",
        source: JSON.stringify(
          {
            routesModule: state.router.ssg.routesModule,
            generatedAt: new Date().toISOString(),
          },
          null,
          2
        ),
      })
    },
    async writeBundle() {
      if (
        !state.isBuild ||
        !state.router.ssg?.routesModuleAbs ||
        state.isSSRBuild
      ) {
        return
      }

      if (!resolvedViteConfig) {
        throw new Error(
          "[vite-plugin-kiru]: internal error — missing resolved Vite config for SSG"
        )
      }

      const templateName = opts.router?.htmlTemplate ?? "index.html"
      const templatePath = path.resolve(state.outDir, templateName)
      const templateHtml = await fs.readFile(templatePath, "utf8")

      const routesAbs = state.router.ssg.routesModuleAbs
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
      })

      try {
        const routesMod = await vite.ssrLoadModule(routesViteId)
        const routes = routesMod.routes
        if (!routes) {
          throw new Error(
            `[vite-plugin-kiru]: router.ssg.routes "${state.router.ssg.routesModule}" does not export 'routes'`
          )
        }

        const {
          siteConfigModuleCandidates,
          prerenderStaticRoutes,
          compileRouteTree,
          discoverRouteBuildMeta,
          generateSitemapPaths,
          writeSiteArtifacts,
          matchRoute,
          getRouteBuildMetaEntry,
          getRouteBuildMetaFromModule,
          persistPrerenderBuildOutput,
          normalizeSiteLocales,
          splitAppPathname,
        } = (await vite.ssrLoadModule(
          "kiru/router"
          // @ts-ignore TODO: update peer dep to kiru v2
        )) as typeof import("../../lib/src/router/index.js")

        let site = routesMod.site
        if (!site) {
          const candidates =
            state.router.ssg.siteModuleAbsPaths ??
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
              // try next candidate
            }
          }
        }

        const pathPolicy = site?.pathPolicy
        const siteLocales = site?.locales
          ? normalizeSiteLocales(site.locales)
          : undefined

        const outputs: {
          path: string
          body: string
          document: { headHtml: string; title?: string }
          html?: string
        }[] = await prerenderStaticRoutes({
          routes,
          pathPolicy,
          maxConcurrentRenders: state.router.ssg.maxConcurrentRenders,
          siteLocales,
          i18n: routesMod.i18n ?? routesMod.default?.i18n,
          ...(opts.router?.htmlShell
            ? {}
            : {
                htmlTemplate: templateHtml,
              }),
        })

        const outputPaths = new Set<string>(
          outputs.map((o: { path: string }) => o.path)
        )
        const hasChildren = (routePath: string) =>
          [...outputPaths].some(
            (p) => p !== routePath && p.startsWith(routePath + "/")
          )

        const manifest = compileRouteTree(routes)
        const loadPageModule = async (route: {
          component: () => Promise<unknown>
        }) => route.component()
        const buildMeta = await discoverRouteBuildMeta(manifest, loadPageModule)

        const clientManifest = await readViteClientManifest(state.outDir)

        for (const output of outputs) {
          let html: string
          if (opts.router?.htmlShell) {
            const shellResult = opts.router.htmlShell(
              output.body,
              output.path,
              output.document,
              { manifest: clientManifest }
            )
            html = await Promise.resolve(shellResult)
          } else {
            if (!output.html) {
              throw new Error(
                `[vite-plugin-kiru]: prerenderStaticRoutes() did not return full HTML for "${output.path}".`
              )
            }
            html = output.html
          }
          const seg = output.path.replace(/^\//, "")
          const relativePath =
            output.path === "/" || hasChildren(output.path)
              ? `${seg ? seg + "/" : ""}index.html`
              : `${seg}.html`

          const target = path.resolve(state.outDir, relativePath)
          await fs.mkdir(path.dirname(target), { recursive: true })
          await fs.writeFile(target, html, "utf8")

          const logicalPath = siteLocales
            ? splitAppPathname(output.path, siteLocales).pathname
            : output.path
          const routeMatch = matchRoute(manifest, logicalPath, pathPolicy)
          if (routeMatch) {
            const metaEntry = getRouteBuildMetaEntry(routeMatch.route, buildMeta)
            const pageMod = await routeMatch.route.component()
            const fromMod = getRouteBuildMetaFromModule(pageMod)
            persistPrerenderBuildOutput({
              clientDir: state.outDir,
              pathname: output.path,
              htmlAbsolutePath: target,
              revalidate: metaEntry?.revalidate ?? fromMod?.revalidate,
              tags: metaEntry?.tags ?? fromMod?.tags,
            })
          }
        }

        if (site?.sitemap || site?.robots) {
          const buildMetaForSitemap = site.sitemap
            ? await discoverRouteBuildMeta(manifest, loadPageModule, {
                includeRoutePaths: site.sitemap.include,
              })
            : buildMeta
          const sitemapPaths = site.sitemap
            ? await generateSitemapPaths(manifest, site, {
                defaultSsrPaths: Boolean(state.router.serverEntry),
                buildMeta: buildMetaForSitemap,
              })
            : []
          await writeSiteArtifacts({
            outDir: state.outDir,
            paths: sitemapPaths,
            site,
            buildDate: new Date().toISOString().slice(0, 10),
          })
        }
      } finally {
        await vite.close()
      }
    },
  } satisfies Plugin

  // Runs after vite:esbuild so `this.parse` always receives compiled JS,
  // not raw TypeScript. This is required for `.actions.ts` files which may
  // contain TS type annotations that Rollup's Acorn parser can't handle.
  const remotePlugin = {
    name: "vite-plugin-kiru:remote",
    enforce: "post" as const,
    transform(src, id, options) {
      const normalizedId = normalizeModulePath(id, state!.projectRoot)
      const isRemote = state?.router?.remote
        ? state.remotePaths.some(
            (remotePath) =>
              normalizeModulePath(remotePath, state!.projectRoot) ===
              normalizedId
          )
        : false
      if (!isRemote && (!state || !shouldTransformFile(id, state))) return null

      const ast = this.parse(src)
      const code = new MagicString(src)
      const ctx: TransformCTX = {
        code,
        ast,
        isBuild: state!.isBuild,
        fileLinkFormatter: state!.fileLinkFormatter,
        filePath: id,
        log,
      }

      let loaderRegistryTouched = false
      preparePageLoaders(ctx, state!.projectRoot, !!options?.ssr, (ref) => {
        state!.loaderModulesByRouteId.set(ref.routeId, ref.viteModuleId)
        loaderRegistryTouched = true
      })
      if (isRemote) {
        prepareRemoteFunctions(ctx, state!.projectRoot, !!options?.ssr)
      }

      if (loaderRegistryTouched && state!.router.serverEntry) {
        if (!state!.isBuild) {
          void writeDevLoaderManifest(
            state!.projectRoot,
            Object.fromEntries(state!.loaderModulesByRouteId)
          )
        }
      }

      const serverEntryAbs = state!.router.serverEntryAbs?.replace(/\\/g, "/")
      if (
        options?.ssr &&
        serverEntryAbs &&
        normalizedId === serverEntryAbs
      ) {
        code.prepend(`import ${JSON.stringify(LOADER_REGISTRY_VIRTUAL_ID)};\n`)
      }

      if (!code.hasChanged()) return null

      return {
        code: code.toString(),
        map: code
          .generateMap({ source: id, file: `${id}.map`, includeContent: true })
          .toString(),
      }
    },
  } satisfies Plugin

  return [mainPlugin, remotePlugin]
}

// Export additional utilities
export { defaultEsBuildOptions } from "./config.js"

// @ts-ignore
export function onHMR(callback: () => void) {}
