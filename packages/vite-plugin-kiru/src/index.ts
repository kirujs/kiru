import {
  ModuleNode,
  type ESBuildOptions,
  type IndexHtmlTransformResult,
  type Plugin,
  type UserConfig,
  type ViteDevServer,
} from "vite"
import devtoolsClientBuild from "kiru-devtools-client"
import devtoolsHostBuild from "kiru-devtools-host"
import { MagicString, TransformCTX } from "./codegen/shared.js"
import path from "node:path"
import fs from "node:fs"
import { pathToFileURL } from "node:url"
import { FileLinkFormatter, KiruPluginOptions, AppOptions } from "./types"
import { prepareDevOnlyHooks, prepareHMR } from "./codegen"
import { ANSI } from "./ansi.js"
// (avoid importing Vite programmatically here to prevent CSS binary resolution)

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
  const manifestPath = "vite-manifest.json"

  let projectRoot = process.cwd().replace(/\\/g, "/")
  let includedPaths: string[] = []
  let isSSRBuild = false
  let basePath = "/"
  let outDir = "dist"

  const { app } = opts
  const appOptions: Required<AppOptions> = {
    baseUrl: app?.baseUrl ?? "/",
    dir: app?.dir ?? "./src/pages",
    document: app?.document ?? "document.tsx",
    page: app?.page ?? "index.{tsx,jsx}",
    layout: app?.layout ?? "layout.{tsx,jsx}",
  }

  const VIRTUAL_ROUTES_ID = "virtual:kiru:routes"
  const VIRTUAL_ENTRY_SERVER_ID = "virtual:kiru:entry-server"
  const VIRTUAL_ENTRY_CLIENT_ID = "virtual:kiru:entry-client"

  const virtualModules: Record<string, () => string> = {
    [VIRTUAL_ROUTES_ID]: createRoutesModule,
    [VIRTUAL_ENTRY_SERVER_ID]: createEntryServerModule,
    [VIRTUAL_ENTRY_CLIENT_ID]: createEntryClientModule,
  }

  function resolveUserDocument(): string {
    const { dir, document } = appOptions
    const fp = path.resolve(projectRoot, dir, document)
    if (fs.existsSync(fp)) return fp.replace(/\\/g, "/")
    throw new Error(`Document not found at ${fp}`)
  }

  function createRoutesModule(): string {
    const { dir, baseUrl, page, layout } = appOptions
    return `
import { formatViteImportMap, normalizePrefixPath } from "kiru/router/utils"

const dir = normalizePrefixPath("${dir}")
const baseUrl = normalizePrefixPath("${baseUrl}")
const pagesMap = import.meta.glob(["/**/${page}"])
const layoutsMap = import.meta.glob(["/**/${layout}"])
const pages = formatViteImportMap(pagesMap, dir, baseUrl)
const layouts = formatViteImportMap(layoutsMap, dir, baseUrl)

export { dir, baseUrl, pages, layouts }
`
  }

  function createEntryServerModule(): string {
    const userDoc = resolveUserDocument()
    return `
import { FileRouter } from "kiru/router/server"
import { render as kiruServerRender } from "kiru/router/server"
import { renderToReadableStream } from "kiru/ssr/server"
import Document from "${userDoc}"
import { pages, layouts } from "${VIRTUAL_ROUTES_ID}"

export async function render(url, ctx) {
  return kiruServerRender(url, { ...ctx, Document, pages, layouts })
}
`
  }

  function createEntryClientModule(): string {
    return `
import { onLoadedDev } from "kiru/router/dev"
import { initClient } from "kiru/router/client"
import { dir, baseUrl, pages, layouts } from "${VIRTUAL_ROUTES_ID}"
import "${resolveUserDocument()}" // todo: only include this in dev mode

initClient({ dir, baseUrl, pages, layouts })
if (import.meta.env.DEV) {
  onLoadedDev()
}
`
  }

  function injectClientScript(html: string): string {
    const scriptTag = `<script type="module" src="/@id/${VIRTUAL_ENTRY_CLIENT_ID}"></script>`
    if (html.includes("</body>")) {
      return html.replace("</body>", scriptTag + "</body>")
    }
    return html + scriptTag
  }

  async function dev_handleSSR(server: ViteDevServer, url: string) {
    const mod = await server.ssrLoadModule(VIRTUAL_ENTRY_SERVER_ID)
    const ctx = { moduleIds: [] as string[] }
    const result = await mod.render(url, ctx)
    let html = injectClientScript(result.immediate)
    const importedModules: Set<ModuleNode> = new Set()
    const seen = new Set<ModuleNode>()

    const documentModule = resolveUserDocument().substring(projectRoot.length)
    ctx.moduleIds.push(documentModule)

    const scan = (mod: ModuleNode) => {
      if (importedModules.has(mod)) return
      importedModules.add(mod)
      for (const dep of mod.importedModules) {
        if (seen.has(dep)) continue
        seen.add(dep)
        scan(dep)
      }
    }

    for (const id of ctx.moduleIds) {
      const p = path.join(projectRoot, id).replace(/\\/g, "/")
      const mod = server.moduleGraph.getModuleById(p)
      if (!mod) {
        console.error(`Module not found: ${p}`)
        continue
      }
      scan(mod)
    }
    const localModules = Array.from(importedModules).filter((m) =>
      m.id?.startsWith(projectRoot)
    )
    const cssModules = localModules.filter((m) => m.id?.endsWith(".css"))

    // const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"))

    // find all relevant manifest entries that import non-js

    // Use Vite's transformIndexHtml but with the entry client as context
    // This helps Vite understand which modules are being used
    html = await server.transformIndexHtml(
      url,
      html,
      "\0" + VIRTUAL_ENTRY_CLIENT_ID
    )

    if (cssModules.length) {
      const stylesheets = cssModules.map((mod) => {
        const p = mod.id?.replace(projectRoot, "")
        return `<link rel="stylesheet" type="text/css" href="${p}?temp">`
      })

      html = html.replace("<head>", "<head>" + stylesheets.join("\n"))
    }

    return { status: result.status ?? 200, html, stream: result.stream }
  }

  return {
    name: "vite-plugin-kiru",
    config(config) {
      const isSsrBuild = config.build?.ssr
      const rollup = (config.build as any)?.rollupOptions ?? {}
      let input = rollup.input
      if (!input) {
        input = isSsrBuild ? VIRTUAL_ENTRY_SERVER_ID : VIRTUAL_ENTRY_CLIENT_ID
      }
      // Keep build.ssr as boolean for SSR builds; we route entry via rollupOptions.input
      const ssr = isSsrBuild === true ? true : config.build?.ssr
      return {
        ...config,
        appType: "custom",
        esbuild: {
          ...defaultEsBuildOptions,
          ...config.esbuild,
        },
        build: {
          ...(config.build as any),
          ssr,
          manifest: manifestPath,
          ssrEmitAssets: true,
          ssrEmitManifest: true,
          rollupOptions: {
            ...rollup,
            input,
          },
        },
      } as UserConfig
    },
    configResolved(config) {
      isProduction = config.isProduction
      isBuild = config.command === "build"
      isSSRBuild = !!config.build?.ssr
      devtoolsEnabled = opts.devtools !== false && !isBuild && !isProduction
      loggingEnabled = opts.loggingEnabled === true

      projectRoot = config.root.replace(/\\/g, "/")
      includedPaths = (opts.include ?? []).map((p) =>
        path.resolve(projectRoot, p).replace(/\\/g, "/")
      )
      basePath = (config.base ?? "/") as string
      outDir = (config.build?.outDir ?? "dist") as string
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
            const { status, html, stream } = await dev_handleSSR(server, url)
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
      console.log("writeBundle: ~~~ HERE 0 ~~~", isBuild, isSSRBuild)
      try {
        if (!isBuild || !isSSRBuild) return

        const outDirAbs = path.resolve(
          projectRoot,
          outputOptions?.dir ?? "dist"
        )

        const ssrEntry = Object.values(bundle).find(
          (c) => c.type === "chunk" && c.isEntry
        )
        if (!ssrEntry) return

        const ssrEntryAbs = path.resolve(outDirAbs, ssrEntry.fileName)
        const mod = await import(pathToFileURL(ssrEntryAbs).href)
        console.log("writeBundle: ~~~ HERE 1 ~~~", mod)

        // collect concrete paths (static + generateStaticParams)
        // TODO: generate all valid routes, support generateStaticParams
        const paths: string[] = await (mod.collectPaths?.() ?? [])
        if (paths.length === 0) paths.push("/")

        // find a client entry in client dist
        const clientOutDirAbs = path.resolve(
          projectRoot,
          process.env.KIRU_CLIENT_OUT_DIR || "dist"
        )
        function findClientEntry(dir: string): string | null {
          if (!fs.existsSync(dir)) return null
          const top = fs.readdirSync(dir)
          const topJs = top.find((f) => f.endsWith(".js"))
          if (topJs) return topJs
          const assetsDir = path.join(dir, "assets")
          if (fs.existsSync(assetsDir)) {
            const assetJs = fs
              .readdirSync(assetsDir)
              .find((f) => f.endsWith(".js"))
            return assetJs ? `assets/${assetJs}` : null
          }
          return null
        }
        const clientEntry = findClientEntry(clientOutDirAbs)

        for (const route of paths) {
          const result = await mod.render(route)
          let html: string = result.immediate
          if (result.stream) {
            html += await new Promise<string>((resolve) => {
              let acc = ""
              result.stream.on("data", (c: any) => (acc += String(c)))
              result.stream.on("end", () => resolve(acc))
            })
          }
          if (clientEntry) {
            const scriptTag = `<script type="module" src="/${clientEntry}"></script>`
            html = html.includes("</body>")
              ? html.replace("</body>", scriptTag + "</body>")
              : html + scriptTag
          }

          const filePath =
            route === "/"
              ? path.resolve(clientOutDirAbs, "index.html")
              : path.resolve(clientOutDirAbs, route.slice(1), "index.html")
          fs.mkdirSync(path.dirname(filePath), { recursive: true })
          fs.writeFileSync(filePath, html, "utf-8")
        }
      } catch (e) {
        console.error(ANSI.red("[vite-plugin-kiru]: SSG prerender failed"))
        console.error(e)
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
