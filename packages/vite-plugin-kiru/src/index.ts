import type { Plugin } from "vite"
import { MagicString, TransformCTX } from "./codegen/shared.js"
import type { KiruPluginOptions, SSGOptions } from "./types.js"
import { prepareDevOnlyHooks, prepareHMR } from "./codegen/index.js"
import { ANSI } from "./ansi.js"
import { createVirtualModules } from "./virtual-modules.js"
import { handleSSR } from "./dev-server.js"
import { createPreviewMiddleware } from "./preview-server.js"
import { setupDevtools, createDevtoolsHtmlTransform } from "./devtools.js"
import { generateStaticSite } from "./ssg.js"
import {
  createPluginState,
  createViteConfig,
  updatePluginState,
  type PluginState,
} from "./config.js"
import {
  createLogger,
  resolveUserDocument,
  shouldTransformFile,
} from "./utils.js"

export default function kiru(opts: KiruPluginOptions = {}): Plugin {
  let state: PluginState
  let log: (...data: any[]) => void
  let virtualModules: Record<string, () => string> = {}

  return {
    name: "vite-plugin-kiru",
    config(config) {
      return createViteConfig(config, opts)
    },
    configResolved(config) {
      const initialState = createPluginState(opts)
      state = updatePluginState(initialState, config, opts)
      log = createLogger(state)
      if (state.ssgOptions) {
        virtualModules = createVirtualModules(
          state.projectRoot,
          state.ssgOptions
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

      if (ssgOptions) {
        // SSR HTML middleware using document.tsx
        server.middlewares.use(async (req, res, next) => {
          try {
            const url = req.originalUrl || req.url || "/"
            const accept = req.headers["accept"] || ""
            if (
              typeof accept === "string" &&
              accept.includes("text/html") &&
              !url.startsWith("/node_modules/") &&
              !url.startsWith("/@") &&
              !url.startsWith(dtHostScriptPath) &&
              !url.startsWith(dtClientPathname)
            ) {
              const { status, html, stream } = await handleSSR(
                server,
                url,
                state.projectRoot,
                () => resolveUserDocument(projectRoot, ssgOptions)
              )
              res.statusCode = status
              res.setHeader("Content-Type", "text/html")
              res.write(html)
              if (stream) {
                // @ts-ignore - Node stream
                stream.pipe(res)
              } else {
                res.end()
              }
              return
            }
          } catch (e) {
            console.error(e)
          }
          next()
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
}

// Export additional utilities
export { defaultEsBuildOptions } from "./config.js"

// @ts-ignore
export function onHMR(callback: () => void) {}
