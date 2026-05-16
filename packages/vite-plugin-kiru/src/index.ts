import { MagicString, TransformCTX } from "./codegen/shared.js"
import { prepareHMR, prepareJSXHoisting, prepareRemoteFunctions } from "./codegen/index.js"
import { ANSI } from "./ansi.js"
import {
  createPluginState,
  defaultEsBuildOptions,
  updatePluginState,
  type PluginState,
} from "./config.js"
import { createDevtoolsHtmlTransform, setupDevtools } from "./devtools.js"
import {
  extractEntryUrls,
  handleSsrDevRequest,
  injectDevCssLinks,
} from "./dev-server.js"
import { createSsgPreviewMiddleware } from "./preview-server.js"
import { createLogger, shouldTransformFile } from "./utils.js"
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
      log = createLogger(state)

      if (state.router.remote) {
        state.remotePaths = (
          await glob(state.router.remote, {
            cwd: state.projectRoot,
            absolute: true,
            onlyFiles: true,
          })
        ).map((filePath) => filePath.replace(/\\/g, "/"))
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
      if (!router.ssg && router.serverEntry) {
        const serverEntry = path.resolve(state.projectRoot, router.serverEntry)

        // The streaming SSR response carries the entry `<script>` tag in the
        // suffix (after the body), so we can't extract it from the response in
        // time to inject CSS into the head. Instead, derive entry URLs from
        // the project's index.html template once and invalidate on edit.
        const templateName = opts.router?.htmlTemplate ?? "index.html"
        const templatePath = path.resolve(state.projectRoot, templateName)
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
          if (path.resolve(file) === templatePath) cachedEntryUrls = null
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
              serverEntry,
              getEntryUrls,
            })
            if (!handled) next()
          } catch (e) {
            server.ssrFixStacktrace(e as Error)
            next(e)
          }
        })
        return
      }

      const routesModule = router.ssg?.routesModule
      if (!routesModule) return

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

          const routesAbs = path.resolve(state.projectRoot, routesModule)
          const routesViteId =
            "/" +
            path.relative(state.projectRoot, routesAbs).replace(/\\/g, "/")
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
    load(id) {
      if (!id.startsWith("\0")) return null
      const raw = id.slice(1)
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
      const serverEntry = state.router.serverEntry
      if (!serverEntry || state.router.ssg) return
      if (!resolvedViteConfig) {
        throw new Error(
          "[vite-plugin-kiru]: internal error — missing resolved Vite config for SSR server build"
        )
      }

      const root = resolvedViteConfig.root
      const clientOutAbs = path.resolve(root, state.outDir)
      const serverOutAbs = path.join(path.dirname(clientOutAbs), "server")
      const serverEntryAbs = path.resolve(root, serverEntry)
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
      if (!state.isBuild || !state.router.ssg?.routesModule) return
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
        !state.router.ssg?.routesModule ||
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

      const routesAbs = path.resolve(
        state.projectRoot,
        state.router.ssg.routesModule
      )
      const routesViteId =
        "/" + path.relative(state.projectRoot, routesAbs).replace(/\\/g, "/")

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

        const { prerenderStaticRoutes } = await vite.ssrLoadModule(
          "kiru/router"
        )
        const outputs: {
          path: string
          body: string
          document: { headHtml: string; title?: string }
          html?: string
        }[] = await prerenderStaticRoutes({
          routes,
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
      if (!state?.router?.remote) return null
      const cleanedId = id.split("?")[0].split("#")[0]
      const normalizedId = path.resolve(cleanedId).replace(/\\/g, "/")
      if (!state.remotePaths.includes(normalizedId)) return null

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

      prepareRemoteFunctions(ctx, state.projectRoot, !!options?.ssr)

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
