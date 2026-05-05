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

import type { KiruPluginOptions } from "./types.js"
import { type Plugin, type PluginOption } from "vite"

export default function kiru(opts: KiruPluginOptions = {}): PluginOption {
  let state: PluginState
  let log: (...data: any[]) => void
  let virtualModules: Record<string, () => string> = {}

  const mainPlugin = {
    name: "vite-plugin-kiru",
    config(config) {
      return {
        ...config,
        esbuild: { ...defaultEsBuildOptions, ...config.esbuild },
      }
    },
    async configResolved(config) {
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
      const { devtoolsEnabled, dtHostScriptPath, fileLinkFormatter } = state

      if (devtoolsEnabled) {
        setupDevtools(
          server,
          { formatFileLink: fileLinkFormatter },
          dtHostScriptPath,
          log
        )
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
  } satisfies Plugin

  return [mainPlugin]
}

// Export additional utilities
export { defaultEsBuildOptions } from "./config.js"

// @ts-ignore
export function onHMR(callback: () => void) {}
