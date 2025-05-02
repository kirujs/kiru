import type {
  ESBuildOptions,
  IndexHtmlTransformResult,
  Plugin,
  UserConfig,
} from "vite"
import devtoolsClientBuild from "kaioken-devtools-client"
import devtoolsHostBuild from "kaioken-devtools-host"
import { injectHMRContextPreamble } from "./codegen.js"
import MagicString from "magic-string"
import path from "node:path"
import { FileLinkFormatter, KaiokenPluginOptions } from "./types"

export const defaultEsBuildOptions: ESBuildOptions = {
  jsxInject: `import * as kaioken from "kaioken"`,
  jsx: "transform",
  jsxFactory: "kaioken.createElement",
  jsxFragment: "kaioken.Fragment",
  loader: "tsx",
  include: ["**/*.tsx", "**/*.ts", "**/*.jsx", "**/*.js"],
}

export default function kaioken(opts?: KaiokenPluginOptions): Plugin {
  const tsxOrJsxRegex = /\.(tsx|jsx)$/
  const tsOrJsRegex = /\.(ts|js)$/
  let isProduction = false
  let isBuild = false

  const fileLinkFormatter: FileLinkFormatter =
    opts?.formatFileLink ||
    ((path: string, line: number) => `vscode://file/${path}:${line}`)

  let dtClientPathname = "/__devtools__"
  if (typeof opts?.devtools === "object") {
    dtClientPathname = opts.devtools.pathname ?? dtClientPathname
  }
  const dtHostScriptPath = "/__devtools_host__.js"
  let transformedDtHostBuild = ""
  let transformedDtClientBuild = ""

  let _config: UserConfig | null = null

  return {
    name: "vite-plugin-kaioken",
    buildStart: async function () {
      // transform 'devtoolsHostBuild' to use the correct path for kaioken imports
      const kaiokenPath = await this.resolve("kaioken")
      transformedDtHostBuild = devtoolsHostBuild.replaceAll(
        'from "kaioken"',
        `from "/@fs/${kaiokenPath!.id}"`
      )
      transformedDtClientBuild = devtoolsClientBuild.replaceAll(
        'from"kaioken";',
        `from"/@fs/${kaiokenPath!.id}";`
      )
    },
    config(config) {
      return (_config = {
        ...config,
        esbuild: {
          ...defaultEsBuildOptions,
          ...config.esbuild,
        },
      } as UserConfig)
    },
    transformIndexHtml(html) {
      if (isProduction || isBuild || opts?.devtools === false) return
      return {
        html,
        tags: [
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
    configResolved(config) {
      isProduction = config.isProduction
      isBuild = config.command === "build"
    },
    configureServer(server) {
      if (isProduction || isBuild || opts?.devtools === false) return
      server.middlewares.use(dtHostScriptPath, (_, res) => {
        res.setHeader("Content-Type", "application/javascript")
        res.end(transformedDtHostBuild, "utf-8")
      })
      server.middlewares.use(dtClientPathname, (_, res) => {
        res.end(transformedDtClientBuild)
      })
    },
    transform(code, id) {
      if (isProduction || isBuild) return
      if (!tsxOrJsxRegex.test(id) && !tsOrJsRegex.test(id)) return { code }
      const projectRoot = path.resolve(_config?.root ?? process.cwd())
      const filePath = path.resolve(id)
      if (!filePath.startsWith(projectRoot)) {
        return { code }
      }
      const ast = this.parse(code)
      const transformed: MagicString | null = injectHMRContextPreamble(
        new MagicString(code),
        ast,
        fileLinkFormatter,
        id
      )
      if (transformed === null) return { code }

      const map = transformed.generateMap({
        source: id,
        file: `${id}.map`,
        includeContent: true,
      })

      return {
        code: transformed.toString(),
        map: map.toString(),
      }
    },
  } satisfies Plugin
}
