import {
  type ESBuildOptions,
  type IndexHtmlTransformResult,
  type Plugin,
  type UserConfig,
} from "vite"
import devtoolsClientBuild from "kiru-devtools-client"
import devtoolsHostBuild from "kiru-devtools-host"
import { MagicString, TransformCTX } from "./codegen/shared.js"
import path from "node:path"
import { FileLinkFormatter, KiruPluginOptions } from "./types"
import { prepareDevOnlyHooks, prepareHMR } from "./codegen"
import { ANSI } from "./ansi.js"

export const defaultEsBuildOptions: ESBuildOptions = {
  jsxInject: `import { createElement as _jsx, Fragment as _jsxFragment } from "kiru"`,
  jsx: "transform",
  jsxFactory: "_jsx",
  jsxFragment: "_jsxFragment",
  loader: "tsx",
  include: ["**/*.tsx", "**/*.ts", "**/*.jsx", "**/*.js"],
}

export default function kiru(opts: KiruPluginOptions = {}): Plugin {
  let isProduction = false
  let isBuild = false
  let devtoolsEnabled = false

  let loggingEnabled = false
  const log = (...data: any[]) => {
    if (!loggingEnabled) return
    console.log(ANSI.cyan("[vite-plugin-kiru]"), ...data)
  }

  let fileLinkFormatter: FileLinkFormatter = (path: string, line: number) =>
    `vscode://file/${path}:${line}`

  let dtClientPathname = "/__devtools__"
  if (typeof opts.devtools === "object") {
    dtClientPathname = opts.devtools.pathname ?? dtClientPathname
    fileLinkFormatter = opts.devtools.formatFileLink ?? fileLinkFormatter
  }
  const dtHostScriptPath = "/__devtools_host__.js"

  let projectRoot = process.cwd().replace(/\\/g, "/")
  let includedPaths: string[] = []

  return {
    name: "vite-plugin-kiru",
    config(config) {
      return {
        ...config,
        esbuild: {
          ...defaultEsBuildOptions,
          ...config.esbuild,
        },
      } as UserConfig
    },
    configResolved(config) {
      isProduction = config.isProduction
      isBuild = config.command === "build"
      devtoolsEnabled = opts.devtools !== false && !isBuild && !isProduction
      loggingEnabled = opts.loggingEnabled === true

      projectRoot = config.root.replace(/\\/g, "/")
      includedPaths = (opts.include ?? []).map((p) =>
        path.resolve(projectRoot, p).replace(/\\/g, "/")
      )
    },
    transformIndexHtml(html) {
      if (!devtoolsEnabled) return
      return {
        html,
        tags: [
          {
            tag: "script",
            children: `window.__KIRU_DEVTOOLS_PATHNAME__ = "${dtClientPathname}";`,
          },
          {
            tag: "script",
            attrs: {
              type: "module",
              src: dtHostScriptPath,
            },
          },
        ],
      } satisfies IndexHtmlTransformResult
    },
    configureServer(server) {
      if (isProduction || isBuild) return
      if (devtoolsEnabled) {
        log(`Serving devtools host at ${ANSI.magenta(dtHostScriptPath)}`)
        server.middlewares.use(dtHostScriptPath, (_, res) => {
          res.setHeader("Content-Type", "application/javascript")
          res.end(devtoolsHostBuild, "utf-8")
        })
        log(`Serving devtools client at ${ANSI.magenta(dtClientPathname)}`)
        server.middlewares.use(dtClientPathname, (_, res) => {
          res.end(devtoolsClientBuild, "utf-8")
        })
      }
    },
    transform(src, id) {
      if (
        id.startsWith("\0") ||
        id.startsWith("vite:") ||
        id.includes("/node_modules/")
      )
        return { code: src }

      if (!/\.[cm]?[jt]sx?$/.test(id)) return { code: src }

      const filePath = path.resolve(id).replace(/\\/g, "/")
      const isIncludedByUser = includedPaths.some((p) => filePath.startsWith(p))

      if (!isIncludedByUser && !filePath.startsWith(projectRoot)) {
        opts?.onFileExcluded?.(id)
        return { code: src }
      }

      log(`Processing ${ANSI.black(id)}`)

      const ast = this.parse(src)
      const code = new MagicString(src)
      const ctx: TransformCTX = {
        code,
        ast,
        isBuild,
        fileLinkFormatter,
        filePath: id,
        log,
      }

      prepareDevOnlyHooks(ctx)

      if (!isProduction && !isBuild) {
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

// @ts-ignore
export function onHMR(callback: () => void) {}
