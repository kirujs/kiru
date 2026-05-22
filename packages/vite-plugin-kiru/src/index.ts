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
import { writeGeneratedRoutes } from "./fileRoutesCodegen.js"
import {
  attachFileRoutesDevWatcher,
} from "./fileRoutesDev.js"
import {
  LOADER_MODULES_MANIFEST,
  mergeLoaderModules,
  readLoaderModuleManifest,
  renderLoaderRegistryVirtual,
  writeDevLoaderManifest,
} from "./loaderRegistryVirtual.js"
import { runSsgPrerender } from "./ssgPrerender.js"
import type { SsgWriteBundleRouter } from "./ssgCacheTypes.js"
import {
  resolveSingleModulePattern,
  toViteModuleId,
} from "./resolveModulePattern.js"
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
import { collectSsrDevHeadExtras } from "./devIndexHtml.js"
import {
  capturePreviewRequestUrl,
  createSsgPreviewMiddleware,
  isPreviewAssetPath,
  toPreviewPathname,
} from "./preview-server.js"
import { createPreviewSsrProxy } from "./previewSsrProxy.js"
import {
  previewServerBundleExists,
  resolvePreviewClientDir,
  resolvePreviewServerEntry,
} from "./previewPaths.js"
import {
  createLogger,
  normalizeModulePath,
  shouldTransformFile,
} from "./utils.js"
import { promises as fs } from "node:fs"
import path from "node:path"
import { glob } from "tinyglobby"

import { kiruImagePlugin } from "./image/plugin.js"
import { assertCloudflareRouteBuildMeta } from "./assertCloudflareBuildMeta.js"
import { warnCloudflareISRInPages } from "./isrWarnings.js"
import { generateWranglerSnippet } from "./wranglerSnippet.js"
import { injectClientEntryScripts } from "./injectClientScripts.js"
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

/** Client bundle bootstrap mode for `kiru` compile-time guards (hybrid → `ssr`). */
function resolveRouterBootstrapDefine(
  opts: KiruPluginOptions
): "csr" | "ssr" | "ssg" {
  if (opts.router?.serverEntry) return "ssr"
  if (opts.router?.ssg) return "ssg"
  return "csr"
}

async function ensureSsgPrerenderCache(input: {
  state: PluginState
  opts: KiruPluginOptions
  resolvedViteConfig: ResolvedConfig
}): Promise<NonNullable<PluginState["ssgPrerenderCache"]>> {
  const { state, opts, resolvedViteConfig } = input
  if (state.ssgPrerenderCache) return state.ssgPrerenderCache
  const templateName = opts.router?.htmlTemplate ?? "index.html"
  const templatePath = path.resolve(state.projectRoot, templateName)
  const templateHtml = await fs.readFile(templatePath, "utf8")
  state.ssgPrerenderCache = await runSsgPrerender({
    state,
    opts,
    resolvedViteConfig,
    templateHtml,
  })
  return state.ssgPrerenderCache
}

const STATIC_LOADER_PAYLOAD_CONST = "__kiruStaticLoaderPayload"

async function injectStaticLoaderPayloadIntoClientChunks(input: {
  clientDir: string
  staticLoaderPayloadByModule: Record<string, Record<string, unknown>>
  clientManifest?: Record<string, unknown>
}): Promise<void> {
  const { clientDir, staticLoaderPayloadByModule, clientManifest } = input
  for (const [moduleKey, payload] of Object.entries(staticLoaderPayloadByModule)) {
    const manifestKey = moduleKey.replace(/^\//, "")
    const entry = clientManifest?.[manifestKey] as { file?: string } | undefined
    const chunkRel = entry?.file
    if (!chunkRel) continue
    const filePath = path.join(clientDir, chunkRel)
    let src: string
    try {
      src = await fs.readFile(filePath, "utf8")
    } catch {
      continue
    }
    if (!src.includes(STATIC_LOADER_PAYLOAD_CONST)) continue
    if (src.includes(`const ${STATIC_LOADER_PAYLOAD_CONST}`)) continue
    const injection = `const ${STATIC_LOADER_PAYLOAD_CONST}=${JSON.stringify(payload)};`
    await fs.writeFile(filePath, `${injection}${src}`, "utf8")
  }
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
        (env.command === "build" || env.isPreview) &&
        !isSsrBundleBuild(config)
      ) {
        const clientOutDir = config.build?.outDir ?? "dist/client"
        partial.build = {
          ...config.build,
          outDir: clientOutDir,
          emptyOutDir:
            env.command === "build"
              ? (config.build?.emptyOutDir ?? true)
              : config.build?.emptyOutDir,
        }
        if (config.environments?.client) {
          partial.environments = {
            ...config.environments,
            client: {
              ...config.environments.client,
              build: {
                ...config.environments.client.build,
                outDir: clientOutDir,
              },
            },
          }
        }
        // Avoid rewriting unknown paths to `/index.html` before Kiru preview middleware runs.
        partial.appType = "mpa"
      }
      if (
        opts.router?.ssg &&
        env.isPreview &&
        !opts.router?.serverEntry &&
        !isSsrBundleBuild(config)
      ) {
        partial.appType = "mpa"
      }
      if (opts.router?.ssg && env.command === "build" && !isSsrBundleBuild(config)) {
        partial.build = {
          ...config.build,
          ...partial.build,
          manifest: true,
        }
      }
      if (!isSsrBundleBuild(config)) {
        partial.define = {
          ...config.define,
          __KIRU_ROUTER_BOOTSTRAP__: JSON.stringify(
            resolveRouterBootstrapDefine(opts)
          ),
        }
      } else {
        partial.define = {
          ...config.define,
          // Server/worker SSR bundles: leave bootstrap unset (must be a JS literal for esbuild).
          __KIRU_ROUTER_BOOTSTRAP__: "undefined",
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

      if (state.router.fileRoutes) {
        await writeGeneratedRoutes(state.router.fileRoutes)
        if (state.router.ssg) {
          state.router.ssg.routesModuleAbs = await resolveSingleModulePattern(
            state.router.ssg.routesModule,
            state.projectRoot,
            "router.ssg.routes"
          )
        }
      }

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
      server.middlewares.use(capturePreviewRequestUrl())
      return () => {
        if (!resolvedViteConfig) return
        const clientDir = resolvePreviewClientDir(resolvedViteConfig, state)
        let serverEntry: string | null = null
        if (state.router.serverEntry) {
          serverEntry = resolvePreviewServerEntry(clientDir)
          if (!previewServerBundleExists(clientDir)) {
            log(
              `${ANSI.yellow("!")} vite preview: no SSR bundle at ${path.relative(resolvedViteConfig.root, serverEntry)} — run \`vite build\` first`
            )
            serverEntry = null
          }
        }
        if (state.router.ssg) {
          server.middlewares.use(
            createSsgPreviewMiddleware(clientDir, {
              requireFilledHtml: Boolean(state.router.serverEntry),
            })
          )
        }
        if (serverEntry) {
          const proxyReady = createPreviewSsrProxy(serverEntry)
          server.middlewares.use((req, res, next) => {
            void proxyReady
              .then(({ middleware }) => middleware(req, res, next))
              .catch(next)
          })
          server.httpServer?.on("close", () => {
            void proxyReady.then((handle) => handle.dispose())
          })
        }
      }
    },
    async buildStart() {
      if (state.router.fileRoutes) {
        await writeGeneratedRoutes(state.router.fileRoutes)
      }
    },
    configureServer(server) {
      if (state.isProduction || state.isBuild) return

      const { devtoolsEnabled, dtHostScriptPath, fileLinkFormatter, router } =
        state

      const attachFileRoutesAfterListen = async () => {
        if (router.fileRoutes) {
          await attachFileRoutesDevWatcher(state, server, log)
        }
      }

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
          const pathname = toPreviewPathname(req.originalUrl ?? "/")
          if (isPreviewAssetPath(pathname)) {
            return next()
          }
          try {
            const templateName = opts.router?.htmlTemplate ?? "index.html"
            const handled = await handleSsrDevRequest(server, req, res, {
              serverEntry: getServerEntry(),
              getEntryUrls,
              getHeadInjection: () =>
                collectSsrDevHeadExtras(
                  server,
                  state.projectRoot,
                  templateName,
                  req.originalUrl ?? "/",
                  devtoolsEnabled
                    ? [
                        devtoolsHeadInjectionHtml(
                          state.dtClientPathname,
                          dtHostScriptPath
                        ),
                      ]
                    : []
                ),
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
        return attachFileRoutesAfterListen
      }

      const routesModuleAbs = router.ssg?.routesModuleAbs
      if (!routesModuleAbs) return attachFileRoutesAfterListen

      // SSG dev mode: register directly so this runs before Vite's
      // indexHtmlMiddleware. We render pages and inject CSS links into the
      // resulting HTML before writing the response.
      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.originalUrl ?? "/"
        const pathname = toPreviewPathname(rawUrl)

        if (isPreviewAssetPath(pathname)) {
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

      return attachFileRoutesAfterListen
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
      if (!resolvedViteConfig) {
        throw new Error(
          "[vite-plugin-kiru]: internal error — missing resolved Vite config for post-client build"
        )
      }

      if (state.router.ssg?.routesModuleAbs) {
        const cache = await ensureSsgPrerenderCache({
          state,
          opts,
          resolvedViteConfig,
        })
        const {
          outputs,
          site,
          pathPolicy,
          localeRouting,
          buildMeta,
          manifest,
        } = cache

        if (state.router.adapter === "cloudflare") {
          assertCloudflareRouteBuildMeta(buildMeta)
        }

        const {
          generateSitemapPaths,
          writeSiteArtifacts,
          matchRoute,
          getRouteBuildMetaEntry,
          persistPrerenderBuildOutput,
          splitAppPathname,
        } = (await import("kiru/router")) as unknown as SsgWriteBundleRouter

        const outputPaths = new Set<string>(
          outputs.map((o: { path: string }) => o.path)
        )
        const hasChildren = (routePath: string) =>
          [...outputPaths].some(
            (p) => p !== routePath && p.startsWith(routePath + "/")
          )

        const clientDir = path.resolve(state.projectRoot, state.outDir)
        const clientManifest = await readViteClientManifest(state.outDir)

        await injectStaticLoaderPayloadIntoClientChunks({
          clientDir,
          staticLoaderPayloadByModule: cache.staticLoaderPayloadByModule,
          clientManifest,
        })

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
          html = injectClientEntryScripts(
            html,
            clientManifest as Record<
              string,
              { file?: string; css?: string[] }
            >
          )
          const writePath = output.diskPath ?? output.path
          const seg = writePath.replace(/^\//, "")
          const relativePath =
            writePath === "/" || hasChildren(output.path)
              ? `${seg ? seg + "/" : ""}index.html`
              : `${seg}.html`

          const target = path.resolve(state.outDir, relativePath)
          await fs.mkdir(path.dirname(target), { recursive: true })
          await fs.writeFile(target, html, "utf8")

          const logicalPath = localeRouting
            ? splitAppPathname(output.path, localeRouting).pathname
            : output.path
          const routeMatch = matchRoute(manifest, logicalPath, pathPolicy)
          if (routeMatch) {
            const metaEntry = getRouteBuildMetaEntry(routeMatch.route, buildMeta)
            persistPrerenderBuildOutput({
              clientDir: state.outDir,
              pathname: output.storageKey ?? output.path,
              htmlAbsolutePath: target,
              revalidate: metaEntry?.revalidate,
              tags: metaEntry?.tags,
            })
          }
        }

        if (site?.sitemap || site?.robots) {
          const sitemapPaths = site.sitemap
            ? await generateSitemapPaths(manifest, site, {
                defaultSsrPaths: Boolean(state.router.serverEntry),
                buildMeta,
              })
            : []
          await writeSiteArtifacts({
            outDir: state.outDir,
            paths: sitemapPaths,
            site,
            buildDate: new Date().toISOString().slice(0, 10),
            localeRouting,
          })
        }
      }

      const serverEntryAbs = state.router.serverEntryAbs
      if (!serverEntryAbs) return

      const root = resolvedViteConfig.root
      const clientOutAbs = path.resolve(root, state.outDir)
      const serverOutAbs = path.join(path.dirname(clientOutAbs), "server")
      const serverEntryRelative =
        path.relative(root, serverEntryAbs).replace(/\\/g, "/") || "."

      const adapter = state.router.adapter
      const isWorker = adapter === "cloudflare"
      const serverBundleLabel = isWorker ? "Worker" : "Node"
      log(
        `${ANSI.green("✓")} SSR ${serverBundleLabel} bundle → ${path.relative(root, path.join(serverOutAbs, "index.js"))}`
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
        ssr: isWorker
          ? {
              target: "webworker",
              resolve: {
                conditions: ["node", "import", "default"],
                externalConditions: ["node", "import", "default"],
              },
            }
          : undefined,
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

      if (isWorker) {
        const clientRel = path.relative(root, clientOutAbs).replace(/\\/g, "/")
        const snippet = generateWranglerSnippet({
          name: path.basename(root),
          main: path
            .relative(root, path.join(serverOutAbs, "index.js"))
            .replace(/\\/g, "/"),
          assetsDirectory: clientRel,
        })
        const wranglerPath = path.join(root, "wrangler.toml.generated")
        await fs.writeFile(wranglerPath, snippet, "utf8")
        log(
          `${ANSI.green("✓")} wrangler.toml.generated (review and rename to wrangler.toml)`
        )

        const pages = await glob(["src/pages/**/*.{tsx,ts}"], {
          cwd: root,
          absolute: true,
        })
        await warnCloudflareISRInPages(pages, (msg) => log(msg))
      }
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
      const staticLoaderClient =
        !!state!.router.ssg && state!.isBuild && !options?.ssr
      const normalized = id.replace(/\\/g, "/")
      const root = state!.projectRoot.replace(/\\/g, "/").replace(/\/+$/, "")
      const relative = normalized.startsWith(root + "/")
        ? normalized.slice(root.length + 1)
        : path.basename(normalized)
      const pageModuleKey = `/${relative}`
      const staticLoaderPayload =
        state!.ssgPrerenderCache?.staticLoaderPayloadByModule[pageModuleKey]
      preparePageLoaders(
        ctx,
        state!.projectRoot,
        !!options?.ssr,
        (ref) => {
        state!.loaderModulesByRouteId.set(ref.routeId, ref.viteModuleId)
        loaderRegistryTouched = true
      },
        { staticLoaderClient, staticLoaderPayload }
      )
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

  const plugins: PluginOption[] = [mainPlugin, remotePlugin]
  if (opts.router?.images) {
    const imageOpts =
      typeof opts.router.images === "object" ? opts.router.images : {}
    plugins.push(kiruImagePlugin(imageOpts))
  }
  return plugins
}

// Export additional utilities
export { defaultEsBuildOptions } from "./config.js"

// @ts-ignore
export function onHMR(callback: () => void) {}
