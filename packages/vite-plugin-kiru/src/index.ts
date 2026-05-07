import { MagicString, TransformCTX } from "./codegen/shared.js"
import { prepareHMR, prepareJSXHoisting } from "./codegen/index.js"
import { ANSI } from "./ansi.js"
import {
  createPluginState,
  defaultEsBuildOptions,
  updatePluginState,
  type PluginState,
} from "./config.js"
import { createDevtoolsHtmlTransform, setupDevtools } from "./devtools.js"
import { createLogger, shouldTransformFile } from "./utils.js"
import { promises as fs } from "node:fs"
import path from "node:path"

import type { KiruPluginOptions } from "./types.js"
import type { Plugin, PluginOption, ResolvedConfig } from "vite"

export default function kiru(opts: KiruPluginOptions = {}): PluginOption {
  let state: PluginState
  let log: (...data: any[]) => void
  let virtualModules: Record<string, () => string> = {}
  let resolvedViteConfig: ResolvedConfig | undefined

  const mainPlugin = {
    name: "vite-plugin-kiru",
    config(config) {
      return {
        ...config,
        esbuild: { ...defaultEsBuildOptions, ...config.esbuild },
      }
    },
    async configResolved(config) {
      resolvedViteConfig = config
      const initialState = createPluginState(opts)
      state = updatePluginState(initialState, config, opts)
      log = createLogger(state)
    },
    transformIndexHtml() {
      if (!state.devtoolsEnabled) return
      return createDevtoolsHtmlTransform(
        state.dtClientPathname,
        state.dtHostScriptPath
      )
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

      if (!router.ssg || !router.routesModule) return

      const routesModule = router.routesModule
      return () => {
        server.middlewares.use(async (req, res, next) => {
          const rawUrl = req.originalUrl ?? "/"
          const pathname = rawUrl.split("?")[0]

          // Skip Vite-internal paths and non-HTML assets
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

            const { createRenderer } =
              await server.ssrLoadModule("kiru/router")
            const renderer = createRenderer({ routes, htmlTemplate })
            const result = await renderer.render(rawUrl)

            if (!result) return next()

            res.statusCode = result.status
            for (const [key, value] of Object.entries(
              result.headers as Record<string, string>
            )) {
              res.setHeader(key, value)
            }
            res.end(result.body)
          } catch (e) {
            server.ssrFixStacktrace(e as Error)
            next(e)
          }
        })
      }
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
    generateBundle() {
      if (!state.isBuild || !state.router.routesModule) return
      this.emitFile({
        type: "asset",
        fileName: "kiru-route-manifest.json",
        source: JSON.stringify(
          {
            routesModule: state.router.routesModule,
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
        !state.router.ssg ||
        !state.router.routesModule ||
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
        state.router.routesModule
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
            `[vite-plugin-kiru]: router.routesModule "${state.router.routesModule}" does not export 'routes'`
          )
        }

        const { prerenderStaticRoutes } =
          await vite.ssrLoadModule("kiru/router")
        const outputs = await prerenderStaticRoutes({
          routes,
          ...(opts.router?.htmlShell
            ? {}
            : {
                htmlTemplate: templateHtml,
              }),
        })

        for (const output of outputs) {
          let html: string
          if (opts.router?.htmlShell) {
            html = opts.router.htmlShell(
              output.body,
              output.path,
              output.document
            )
          } else {
            if (!output.html) {
              throw new Error(
                `[vite-plugin-kiru]: prerenderStaticRoutes() did not return full HTML for "${output.path}".`
              )
            }
            html = output.html
          }
          const relativePath =
            output.path === "/"
              ? "index.html"
              : `${output.path.replace(/^\//, "")}.html`
          const target = path.resolve(state.outDir, relativePath)
          await fs.mkdir(path.dirname(target), { recursive: true })
          await fs.writeFile(target, html, "utf8")
        }
      } finally {
        await vite.close()
      }
    },
  } satisfies Plugin

  return [mainPlugin]
}

// Export additional utilities
export { defaultEsBuildOptions } from "./config.js"

// @ts-ignore
export function onHMR(callback: () => void) {}
