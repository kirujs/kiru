import {
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
import { FileLinkFormatter, KiruPluginOptions, AppOptions } from "./types"
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

  const { app } = opts
  const appOptions: Required<AppOptions> = {
    baseUrl: app?.baseUrl ?? "/",
    dir: app?.dir ?? "./src/pages",
    document: app?.document ?? "document.tsx",
    page: app?.page ?? "index.{tsx,jsx}",
    layout: app?.layout ?? "layout.{tsx,jsx}",
  }

  const VIRTUAL_ROUTES_ID = "virtual:kiru:routes"
  const VIRTUAL_DOCUMENT_ID = "virtual:kiru:document"
  const VIRTUAL_ENTRY_SERVER_ID = "virtual:kiru:entry-server"
  const VIRTUAL_ENTRY_CLIENT_ID = "virtual:kiru:entry-client"

  function resolveUserDocument(): string {
    const fp = path.resolve(projectRoot, appOptions.dir, appOptions.document)
    if (fs.existsSync(fp)) return fp.replace(/\\/g, "/")
    throw new Error(`Document not found at ${fp}`)
  }

  function createRoutesModule(): string {
    // Note: Matching mirrors FileRouterController logic without window usage
    return `
export const dir = "${appOptions.dir}"
export const baseUrl = "${appOptions.baseUrl}"
export const pages = import.meta.glob(["/**/${appOptions.page}"])
export const layouts = import.meta.glob(["/**/${appOptions.layout}"])

function normalizePrefixPath(p) { return p === "/" ? "/" : ("/" + p.replace(/^\\/+|\\/+$/g, "")) }
function toSegments(route) { return route.split("/").filter(Boolean) }
function toRouteFromPath(fp) {
  // convert /.../pages/a/b/index.tsx -> /a/b
  const idx = fp.lastIndexOf(dir)
  const rel = fp.slice(idx + dir.length).split("/").filter(Boolean).slice(0, -1)
  return "/" + rel.join("/")
  }

function buildMap(mods) {
  const map = {}
  for (const key in mods) {
    const route = toRouteFromPath(key)
    const segments = toSegments(route)
    const specificity = segments.reduce((s, seg) => s + (seg.startsWith(":") ? 1 : 2), 0)
    map[route] = { load: mods[key], segments, specificity }
  }
  return map
}

export function getRouteMatch(pathname) {
  const pSegments = toSegments(pathname)
  const pageMap = buildMap(pages)
  console.log("[kiru]: pageMap", pageMap)
  const matches = []
  outer: for (const route in pageMap) {
    const entry = pageMap[route]
    const routeSegments = entry.segments
    const pathMatchingSegments = routeSegments.filter(seg => !(seg.startsWith("(") && seg.endsWith(")")))
    const params = {}
    let hasCatchall = false
    for (let i = 0; i < pathMatchingSegments.length && i < pSegments.length; i++) {
      const routeSeg = pathMatchingSegments[i]
      if (routeSeg.startsWith(":")) {
        const key = routeSeg.slice(1)
        if (routeSeg.endsWith("*")) { hasCatchall = true; const k = key.slice(0, -1); params[k] = pSegments.slice(i).join("/"); break }
        if (i >= pSegments.length) continue outer
        params[key] = pSegments[i]
      } else {
        if (routeSeg !== pSegments[i]) continue outer
      }
    }
    if (!hasCatchall && pathMatchingSegments.length !== pSegments.length) continue
    matches.push({ route, entry, params, routeSegments })
  }
  if (matches.length === 0) return null
  matches.sort((a, b) => b.entry.specificity - a.entry.specificity)
  return matches[0]
}

function parseQuery(search) {
  const params = new URLSearchParams(search || "")
  const query = {}
  for (const [k, v] of params.entries()) {
    if (k in query) {
      const cur = query[k]
      query[k] = Array.isArray(cur) ? cur.concat(v) : [cur, v]
    } else {
      query[k] = v
    }
  }
  return query
}

export async function loadRoute(pathname, search) {
  const match = getRouteMatch(pathname)
  if (!match) return null

  const page = await match.entry.load()
  const routeSegments = match.routeSegments
  const ls = ["/", ...routeSegments].reduce((acc, _, i) => {
    const layoutKey = "/" + routeSegments.slice(0, i).join("/")
    return acc.concat(layoutKey)
  }, [])

  const layoutsMap = buildMap(layouts)
  const layoutImporters = ls.map((k) => {
    // find a matching layout by route key
    const layoutEntry = layoutsMap[k]
    return layoutEntry ? layoutEntry.load() : null
  }).filter(Boolean)

  const layoutMods = await Promise.all(layoutImporters)
  const config = page && typeof page === 'object' ? page.config : undefined
  const { params, route } = match

  return { page, config, layouts: layoutMods.filter(Boolean), params, route, query: parseQuery(search) }
}
`
  }

  function createEntryServerModule(): string {
    return `
import { FileRouter } from "kiru/router/server"
import { renderToReadableStream } from "kiru/ssr/server"
import Document from "${VIRTUAL_DOCUMENT_ID}"
import { loadRoute } from "${VIRTUAL_ROUTES_ID}"
import { createElement } from "kiru"

function wrapWithLayouts(pageEl, layouts) {
  return layouts.reduceRight((children, m) => {
    const L = m.default
    return typeof L === "function" ? createElement(L, { children }) : children
  }, pageEl)
}

 export async function render(url) {
  const u = new URL(url, "http://localhost")
  const routeInfo = await loadRoute(u.pathname, u.search)
  if (!routeInfo) {
    return { status: 404, immediate: "<!doctype html><html><head><title>Not Found</title></head><body><h1>404</h1></body></html>", stream: null }
  }
  const Page = routeInfo.page.default
  const pageEl = createElement(Page, {})
  const children = wrapWithLayouts(pageEl, routeInfo.layouts)
  const doc = createElement(Document, { children })
  const { params, query } = routeInfo
  const frProps = { children: doc, state: { params, query, path: u.pathname } }
  const app = createElement(FileRouter, frProps)
  const { immediate, stream } = renderToReadableStream(app)
  return { status: 200, immediate: "<!doctype html>" + immediate, stream }
}
`
  }

  function createEntryClientModule(): string {
    return `
import { FileRouter } from "kiru/router"
import { hydrate } from "kiru/ssr/client"
import { pages, layouts, loadRoute } from "${VIRTUAL_ROUTES_ID}"
import { createElement } from "kiru"

async function main() {
  const preloaded = await loadRoute(window.location.pathname, window.location.search)
  if (!preloaded) return
  hydrate(createElement(FileRouter, { config: { pages, layouts, preloaded } }), document.body)
}
main()
`
  }

  function injectClientScript(html: string): string {
    const scriptTag = `<script type="module" src="/@id/${VIRTUAL_ENTRY_CLIENT_ID}"></script>`
    if (html.includes("</body>")) {
      return html.replace("</body>", scriptTag + "</body>")
    }
    return html + scriptTag
  }

  async function handleSSR(server: ViteDevServer, url: string) {
    const mod: any = await server.ssrLoadModule(VIRTUAL_ENTRY_SERVER_ID)
    const result = await mod.render(url)
    let html = injectClientScript(result.immediate)
    html = await server.transformIndexHtml(url, html)
    return { status: result.status ?? 200, html, stream: result.stream }
  }

  return {
    name: "vite-plugin-kiru",
    config(config) {
      const isSsrBuild = config.build?.ssr
      const rollup = (config.build as any)?.rollupOptions ?? {}
      const input = rollup.input ?? VIRTUAL_ENTRY_CLIENT_ID
      const ssr =
        isSsrBuild === true ? VIRTUAL_ENTRY_SERVER_ID : config.build?.ssr
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
            const { status, html, stream } = await handleSSR(server, url)
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
      if (
        id === VIRTUAL_ROUTES_ID ||
        id === VIRTUAL_DOCUMENT_ID ||
        id === VIRTUAL_ENTRY_SERVER_ID ||
        id === VIRTUAL_ENTRY_CLIENT_ID
      ) {
        return "\0" + id
      }
      return null
    },
    load(id) {
      if (!id.startsWith("\0")) return null
      const raw = id.slice(1)
      if (raw === VIRTUAL_ROUTES_ID) {
        return createRoutesModule()
      }
      if (raw === VIRTUAL_DOCUMENT_ID) {
        const userDoc = resolveUserDocument()
        return `export { default } from ${JSON.stringify(userDoc)}`
      }
      if (raw === VIRTUAL_ENTRY_SERVER_ID) {
        return createEntryServerModule()
      }
      if (raw === VIRTUAL_ENTRY_CLIENT_ID) {
        return createEntryClientModule()
      }
      return null
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
