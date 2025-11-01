import type { OutputBundle, OutputOptions } from "rollup"
import path from "node:path"
import fs from "node:fs"
import { pathToFileURL } from "node:url"
import type { AppOptions } from "./types.js"
import { ANSI } from "./ansi.js"

interface VirtualServerModule {
  render: (
    url: string,
    ctx: { registerModule: (id: string) => void }
  ) => Promise<{
    status: number
    immediate: string
    stream: any
  }>
  generateStaticPaths: () => Promise<string[]> | string[]
}

export async function generateStaticSite(
  outputOptions: OutputOptions,
  bundle: OutputBundle,
  projectRoot: string,
  baseOutDir: string,
  appOptions: Required<AppOptions>,
  manifestPath: string,
  log: (...data: any[]) => void
) {
  const outDirAbs = path.resolve(projectRoot, outputOptions?.dir ?? "dist")

  const ssrEntry = Object.values(bundle).find(
    (c) => c.type === "chunk" && c.isEntry
  )
  if (!ssrEntry) return

  const ssrEntryAbs = path.resolve(outDirAbs, ssrEntry.fileName)
  const mod = (await import(
    pathToFileURL(ssrEntryAbs).href
  )) as VirtualServerModule

  // Collect concrete paths (static + generateStaticParams)
  let paths: string[] = []
  try {
    paths = await mod.generateStaticPaths()
  } catch {}

  if (paths.length === 0) {
    paths = await derivePathsFromManifest(outDirAbs, manifestPath, appOptions)
  }
  if (paths.length === 0) paths.push("/")

  const clientOutDirAbs = path.resolve(projectRoot, `${baseOutDir}/client`)
  const { clientEntry, cssLinks } = await getClientAssets(
    clientOutDirAbs,
    manifestPath
  )

  log(ANSI.cyan("[SSG]"), "discovered routes:", paths)

  let wroteCount = 0
  for (const route of paths) {
    const html = await renderRoute(mod, route, clientEntry, cssLinks)
    const filePath = getOutputPath(clientOutDirAbs, route)

    log(ANSI.cyan("[SSG]"), "write:", ANSI.black(filePath))
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, html, "utf-8")
    wroteCount++
  }

  // Fallback: render index if no routes were processed
  if (wroteCount === 0) {
    await renderFallbackIndex(mod, clientEntry, cssLinks, clientOutDirAbs, log)
  }
}

async function derivePathsFromManifest(
  outDirAbs: string,
  manifestPath: string,
  appOptions: Required<AppOptions>
): Promise<string[]> {
  try {
    const ssrManifestPath = path.resolve(outDirAbs, manifestPath)
    if (!fs.existsSync(ssrManifestPath)) return []

    const ssrManifest = JSON.parse(fs.readFileSync(ssrManifestPath, "utf-8"))
    const entry = ssrManifest["virtual:kiru:entry-server"]
    const imports: string[] = entry?.dynamicImports ?? []

    const normalize = (p: string) => {
      const dirPrefix = appOptions.dir + "/"
      let k = p
      if (k.startsWith(dirPrefix)) k = k.slice(dirPrefix.length)
      if (k.endsWith("/index.tsx")) k = k.slice(0, -"/index.tsx".length)

      const parts = k.split("/").filter(Boolean)
      const urlParts = parts.filter(
        (seg) => !(seg.startsWith("(") && seg.endsWith(")"))
      )

      // Skip 404 and dynamic routes
      if (urlParts[urlParts.length - 1] === "404") return null
      if (urlParts.some((seg) => seg.startsWith("["))) return null

      return "/" + urlParts.join("/")
    }

    const derived = imports
      .map((i) => normalize(i))
      .filter((v): v is string => !!v)

    return Array.from(new Set(["/", ...derived]))
  } catch {
    return []
  }
}

async function getClientAssets(clientOutDirAbs: string, manifestPath: string) {
  let clientEntry: string | null = null
  let cssLinks = ""

  try {
    const clientManifestPath = path.resolve(clientOutDirAbs, manifestPath)
    if (fs.existsSync(clientManifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(clientManifestPath, "utf-8"))
      const clientEntryKey = "virtual:kiru:entry-client"

      if (manifest[clientEntryKey]?.file) {
        clientEntry = manifest[clientEntryKey].file
      }

      // Find CSS files for the entry
      const entryKey = clientEntry
        ? Object.keys(manifest).find((k) => manifest[k]?.file === clientEntry)
        : null

      if (entryKey) {
        const seen = new Set<string>()
        const cssFiles = new Set<string>()

        const collectCss = (key: string) => {
          if (seen.has(key)) return
          seen.add(key)
          const it = manifest[key]
          if (!it) return
          ;(it.css || []).forEach((c: string) => cssFiles.add(c))
          ;(it.imports || []).forEach((imp: string) => collectCss(imp))
        }

        collectCss(entryKey)
        if (cssFiles.size) {
          cssLinks = Array.from(cssFiles)
            .map((f) => `<link rel="stylesheet" type="text/css" href="/${f}">`)
            .join("")
        }
      }
    }
  } catch {}

  if (!clientEntry) {
    clientEntry = findClientEntry(clientOutDirAbs)
  }

  return { clientEntry, cssLinks }
}

function findClientEntry(dir: string): string | null {
  if (!fs.existsSync(dir)) return null

  const top = fs.readdirSync(dir)
  const topJs = top.find((f) => f.endsWith(".js"))
  if (topJs) return topJs

  const assetsDir = path.join(dir, "assets")
  if (fs.existsSync(assetsDir)) {
    const assetJs = fs.readdirSync(assetsDir).find((f) => f.endsWith(".js"))
    return assetJs ? `assets/${assetJs}` : null
  }

  return null
}

async function renderRoute(
  mod: VirtualServerModule,
  route: string,
  clientEntry: string | null,
  cssLinks: string
): Promise<string> {
  const result = await mod.render(route, { registerModule: () => {} })
  let html = result.immediate

  if (result.stream) {
    html += await new Promise<string>((resolve) => {
      let acc = ""
      result.stream?.on("data", (c: any) => (acc += String(c)))
      result.stream?.on("end", () => resolve(acc))
    })
  }

  if (clientEntry) {
    const scriptTag = `<script type="module" src="/${clientEntry}"></script>`
    const headInjected = cssLinks
      ? html.replace("<head>", "<head>" + cssLinks)
      : html
    html = headInjected.includes("</body>")
      ? headInjected.replace("</body>", scriptTag + "</body>")
      : headInjected + scriptTag
  }

  return html
}

function getOutputPath(clientOutDirAbs: string, route: string): string {
  if (route === "/") {
    return path.resolve(clientOutDirAbs, "index.html")
  }

  const parts = route.replace(/^\//, "").split("/").filter(Boolean)
  if (parts.length === 1) {
    return path.resolve(clientOutDirAbs, `${parts[0]}.html`)
  }

  const dirPath = path.resolve(clientOutDirAbs, parts.slice(0, -1).join("/"))
  let last = parts[parts.length - 1]
  if (last.endsWith("*")) {
    last = last.slice(0, -1)
  }
  return path.resolve(dirPath, `${last}.html`)
}

async function renderFallbackIndex(
  mod: VirtualServerModule,
  clientEntry: string | null,
  cssLinks: string,
  clientOutDirAbs: string,
  log: (...data: any[]) => void
) {
  try {
    const html = await renderRoute(mod, "/", clientEntry, cssLinks)
    const filePath = path.resolve(clientOutDirAbs, "index.html")

    log("[SSG] write:", filePath)
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, html, "utf-8")
  } catch {}
}
