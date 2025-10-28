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
    map[route] = { load: mods[key], segments, specificity, key }
  }
  return map
}

export function getRouteMatch(pathname) {
  const pSegments = toSegments(pathname)
  const pageMap = buildMap(pages)
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

  const { entry, params, routeSegments, route } = match

  const moduleIds = [entry.key]
  const page = await entry.load()
  const config = page && typeof page === 'object' ? page.config : undefined

   const ls = ["/", ...routeSegments].reduce((acc, _, i) => {
    const layoutKey = "/" + routeSegments.slice(0, i).join("/")
    return acc.concat(layoutKey)
  }, [])

  const layoutsMap = buildMap(layouts)
  const layoutImporters = ls.map((k) => {
    // find a matching layout by route key
    const layoutEntry = layoutsMap[k]
    if (layoutEntry) {
      moduleIds.push(layoutEntry.key)
      return layoutEntry.load()
    }
    return null
  }).filter(Boolean)

  const layoutMods = await Promise.all(layoutImporters)
  const query = parseQuery(search)

  return { page, config, layouts: layoutMods.filter(Boolean), params, route, query, moduleIds }
}
`
  }

  function createEntryServerModule(): string {
    return `
import { FileRouter } from "kiru/router/server"
import { renderToReadableStream } from "kiru/ssr/server"
import Document from "${VIRTUAL_DOCUMENT_ID}"
import { loadRoute, pages } from "${VIRTUAL_ROUTES_ID}"
import { createElement } from "kiru"

function wrapWithLayouts(pageEl, layouts) {
  return layouts.reduceRight((children, m) => {
    const L = m.default
    return typeof L === "function" ? createElement(L, { children }) : children
  }, pageEl)
}

 export async function render(url, ctx) {
  const u = new URL(url, "http://localhost")
  const routeInfo = await loadRoute(u.pathname, u.search)
  if (!routeInfo) {
    return { status: 404, immediate: "<!doctype html><html><head><title>Not Found</title></head><body><h1>404</h1></body></html>", stream: null }
  }
  ctx.moduleIds.push(...routeInfo.moduleIds)

  const Page = routeInfo.page.default
  const pageEl = createElement(Page, {})
  const children = wrapWithLayouts(pageEl, routeInfo.layouts)
  const doc = createElement(Document, { children, config: routeInfo.config })

  const { params, query } = routeInfo
  const frProps = { children: doc, state: { params, query, path: u.pathname } }
  const app = createElement(FileRouter, frProps)

  const { immediate, stream } = renderToReadableStream(app)
  return { status: 200, immediate: "<!doctype html>" + immediate, stream }
}

export async function collectPaths() {
  const dir = "${appOptions.dir}"
  const dirIndex = (key) => key.indexOf(dir)
  const toSegments = (key) => {
    let k = key.slice(dirIndex(key) + dir.length)
    if (k.startsWith("/")) k = k.slice(1)
    const parts = k.split("/").slice(0, -1)
    return parts
  }
  const toRoutePattern = (segments) => segments.map((part, i, arr) => {
    if (part.startsWith("[...") && part.endsWith("]")) return ":" + part.slice(4, -1) + "*"
    if (part.startsWith("[") && part.endsWith("]")) return ":" + part.slice(1, -1)
    return part
  })
  const hasDynamic = (segs) => segs.some((s) => s.startsWith(":"))
  const paths = new Set()
  const keys = Object.keys(pages)
  for (const key of keys) {
    const segs = toSegments(key)
    const pattern = toRoutePattern(segs)
    if (!hasDynamic(pattern)) {
      const route = "/" + pattern.filter(Boolean).join("/")
      paths.add(route === "/" ? "/" : route)
      continue
    }
    try {
      const mod = await pages[key]()
      const cfg = mod && typeof mod === 'object' ? mod.config : undefined
      const gen = cfg && cfg.generateStaticParams
      if (!gen) continue
      const paramSets = await gen()
      for (const params of paramSets || []) {
        const concrete = pattern.map((p) => p.startsWith(":") ? (params[p.slice(1).replace(/\\*$/, '')] ?? "") : p)
        const pathname = "/" + concrete.filter(Boolean).join("/")
        paths.add(pathname === "/" ? "/" : pathname)
      }
    } catch {}
  }
  return Array.from(paths)
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

  async function dev_handleSSR(server: ViteDevServer, url: string) {
    const mod = await server.ssrLoadModule(VIRTUAL_ENTRY_SERVER_ID)
    const ctx = { moduleIds: [] as string[] }
    const result = await mod.render(url, ctx)
    let html = injectClientScript(result.immediate)
    const importedModules: Set<ModuleNode> = new Set()
    const seen = new Set<ModuleNode>()

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
      if (!mod) continue
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
      html = html.replace(
        "</body>",
        `<script type="module" id="kiru-css-cleanup">
        const d = document;
        
        function clean() {
          let isCleaned = true;
          const VITE_ID = 'data-vite-dev-id';
          const injectedByVite = [...document.querySelectorAll(\`style[\${VITE_ID}]\`)].map((style) => style.getAttribute(VITE_ID));

          const suffix = "?temp";
          const injectedByKiru = [...document.querySelectorAll(\`link[rel="stylesheet"][type="text/css"][href$="\${suffix}"]\`)];
          
          injectedByKiru.forEach((linkKiru) => {
            const href = linkKiru.getAttribute("href");
            let filePathAbsoluteUserRootDir = href.slice(0, -suffix.length);
            const prefix = '/@fs/';
            if (filePathAbsoluteUserRootDir.startsWith(prefix))
                filePathAbsoluteUserRootDir = filePathAbsoluteUserRootDir.slice(prefix.length);
            
            if (injectedByVite.some((filePathAbsoluteFilesystem) => filePathAbsoluteFilesystem.endsWith(filePathAbsoluteUserRootDir))) {
              linkKiru.remove();
            }
            else {
              isCleaned = false;
              console.log("Not cleaned: ", filePathAbsoluteUserRootDir);
            }            
          })
          return isCleaned;
        }

        function removeInjectedStyles() {
          let sleep = 2;

          function runClean() {
            if (clean()) {
              console.log("Cleaned");
              document.getElementById("kiru-css-cleanup").remove();
              return;
            }
            if (sleep < 1000) {
              sleep *= 2;
            }
            setTimeout(runClean, sleep);
          }
            
          setTimeout(runClean, sleep);
        }

        removeInjectedStyles();

      </script></body>`
      )
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
    async writeBundle(outputOptions, bundle) {
      console.log("writeBundle: ~~~ HERE 0 ~~~", isBuild, isSSRBuild)
      try {
        if (!isBuild || !isSSRBuild) return

        const outDirAbs = path.resolve(
          projectRoot,
          outputOptions?.dir ?? "dist"
        )

        // locate SSR entry emitted by this build
        let ssrEntryFile: string | null = null
        for (const [, output] of Object.entries(bundle)) {
          const c = output
          if (c.type === "chunk" && c.isEntry) {
            ssrEntryFile = c.fileName
            break
          }
        }
        if (!ssrEntryFile) return

        const ssrEntryAbs = path.resolve(outDirAbs, ssrEntryFile)
        const mod: any = await import(pathToFileURL(ssrEntryAbs).href)
        console.log("writeBundle: ~~~ HERE 1 ~~~", mod)

        // collect concrete paths (static + generateStaticParams)
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
