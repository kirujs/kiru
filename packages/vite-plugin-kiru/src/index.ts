import path from "node:path"
import { MagicString, TransformCTX } from "./codegen/shared.js"
import { prepareDevOnlyHooks, prepareHMR } from "./codegen/index.js"
import { ANSI } from "./ansi.js"
import {
  createPluginState,
  createViteConfig,
  updatePluginState,
  type PluginState,
} from "./config.js"
import { setupDevtools, createDevtoolsHtmlTransform } from "./devtools.js"
import { handleSSR } from "./dev-server.js"
import { createPreviewMiddleware } from "./preview-server.js"
import { generateStaticSite } from "./ssg.js"
import {
  createLogger,
  resolveUserDocument,
  shouldTransformFile,
} from "./utils.js"
import { createVirtualModules } from "./virtual-modules.js"

import type { KiruPluginOptions, SSGOptions } from "./types.js"
import { build, InlineConfig, type Plugin, type PluginOption } from "vite"

export default function kiru(opts: KiruPluginOptions = {}): PluginOption {
  let state: PluginState
  let log: (...data: any[]) => void
  let virtualModules: Record<string, () => string> = {}
  let inlineConfig: InlineConfig | undefined

  const mainPlugin = {
    name: "vite-plugin-kiru",
    config(config) {
      inlineConfig = config
      return createViteConfig(config, opts)
    },
    async configResolved(config) {
      const initialState = createPluginState(opts)
      state = updatePluginState(initialState, config, opts)
      log = createLogger(state)
      if (state.ssrOptions) {
        virtualModules = await createVirtualModules(
          state.projectRoot,
          state.ssrOptions,
          "ssr"
        )
      } else if (state.ssgOptions) {
        virtualModules = await createVirtualModules(
          state.projectRoot,
          state.ssgOptions,
          "ssg"
        )
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
      if (!state.ssgOptions) return
      server.middlewares.use(
        createPreviewMiddleware(state.projectRoot, state.baseOutDir)
      )
    },
    configureServer(server) {
      if (state.isProduction || state.isBuild) return
      const {
        ssgOptions,
        ssrOptions,
        devtoolsEnabled,
        dtClientPathname,
        dtHostScriptPath,
        fileLinkFormatter,
        projectRoot,
      } = state

      if (devtoolsEnabled) {
        setupDevtools(
          server,
          { dtClientPathname, formatFileLink: fileLinkFormatter },
          dtHostScriptPath,
          log
        )
      }

      // Detect SSR vs SSG mode
      const renderMode = ssrOptions ? "ssr" : ssgOptions ? "ssg" : null
      const renderOptions = ssrOptions || ssgOptions

      if (renderOptions) {
        // SSR/SSG HTML middleware using document.tsx
        server.middlewares.use(async (req, res, next) => {
          try {
            const url = req.originalUrl || req.url || "/"

            const filePath = path.join(state.baseOutDir, "client", url)
            const extName = path.extname(filePath)
            if (extName && extName !== ".html") {
              return next()
            }

            const accept = req.headers["accept"] || ""
            if (
              typeof accept === "string" &&
              accept.includes("text/html") &&
              !url.startsWith("/node_modules/") &&
              !url.startsWith("/@") &&
              !url.startsWith(dtHostScriptPath) &&
              !url.startsWith(dtClientPathname)
            ) {
              const { status, html } = await handleSSR(
                server,
                url,
                state.projectRoot,
                () => resolveUserDocument(projectRoot, renderOptions),
                renderMode!
              )
              res.statusCode = status
              res.setHeader("Content-Type", "text/html")
              res.end(html)
              return
            }
          } catch (e) {
            const error = e as Error
            console.error(
              ANSI.red(`[${renderMode?.toUpperCase()}] Middleware Error`),
              `\n${ANSI.yellow("URL:")} ${req.url}`,
              `\n${ANSI.yellow("Error:")} ${error.message}`
            )
            if (error.stack) {
              console.error(ANSI.black_bright(error.stack))
            }
            // Let Vite handle the error
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
    async writeBundle(outputOptions, bundle) {
      if (!state.ssgOptions) return
      if (!state.isBuild || !state.isSSRBuild) return

      try {
        await generateStaticSite(
          state as PluginState & { ssgOptions: Required<SSGOptions> },
          outputOptions,
          bundle,
          log
        )
      } catch (e) {
        log(ANSI.red("[SSG]: prerender failed"), e)
      }
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

      prepareDevOnlyHooks(ctx)

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
  } satisfies Plugin

  // Only include the SSG post-build plugin when SSG mode is enabled
  // SSR mode doesn't need this plugin since it renders at request time
  const plugins: Plugin[] = [mainPlugin]

  if (opts.ssg) {
    plugins.push({
      name: "vite-plugin-kiru:ssg",
      apply: "build",
      enforce: "post",
      async closeBundle(error) {
        if (error || this.environment.config.build.ssr || !state.ssgOptions)
          return

        log(ANSI.cyan("[SSG]"), "Starting SSG build...")
        await build({
          ...inlineConfig,
          configFile: false,
          build: {
            ...inlineConfig?.build,
            ssr: true,
          },
        })
        log(ANSI.cyan("[SSG]"), "SSG build complete!")
      },
    } satisfies Plugin)
  }

  return plugins
}

// Export additional utilities
export { defaultEsBuildOptions } from "./config.js"

// @ts-ignore
export function onHMR(callback: () => void) {}
