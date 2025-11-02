import type { OutputBundle, OutputOptions } from "rollup"
import path from "node:path"
import fs, { globSync } from "node:fs"
import { pathToFileURL } from "node:url"
import type { SSGOptions } from "./types.js"
import { ANSI } from "./ansi.js"
import type { Manifest } from "vite"
import { PluginState } from "./config.js"

interface VirtualServerModule {
  render: (
    url: string,
    ctx: { registerModule: (id: string) => void }
  ) => Promise<{
    status: number
    immediate: string
    stream: any
  }>
  generateStaticPaths: () => Promise<Record<string, string>>
}

interface RenderContext {
  registerModule: (moduleId: string) => void
  registerPreloadedPageProps: (props: Record<string, unknown>) => void
}

export async function generateStaticSite(
  state: PluginState & { ssgOptions: Required<SSGOptions> },
  outputOptions: OutputOptions,
  bundle: OutputBundle,
  log: (...data: any[]) => void
) {
  const { projectRoot, baseOutDir, manifestPath } = state
  const outDirAbs = path.resolve(projectRoot, outputOptions?.dir ?? "dist")

  const ssrEntry = Object.values(bundle).find(
    (c) => c.type === "chunk" && c.isEntry
  )
  if (!ssrEntry) return

  const ssrEntryAbs = path.resolve(outDirAbs, ssrEntry.fileName)
  const mod = (await import(
    pathToFileURL(ssrEntryAbs).href
  )) as VirtualServerModule

  const paths = await mod.generateStaticPaths()

  const clientOutDirAbs = path.resolve(projectRoot, `${baseOutDir}/client`)
  const { clientEntry, cssLinks } = await getClientAssets(
    clientOutDirAbs,
    manifestPath
  )

  log(ANSI.cyan("[SSG]"), "discovered routes:", Object.keys(paths))

  const renderingChunks: Record<string, string>[] = []
  const keys = Object.keys(paths)
  const maxConcurrentRenders = state.ssgOptions.build.maxConcurrentRenders

  // chunk by keys
  for (let i = 0; i < keys.length; i += maxConcurrentRenders) {
    const chunkKeys = keys.slice(i, i + maxConcurrentRenders)
    renderingChunks.push(
      chunkKeys.reduce((acc, key) => {
        acc[key] = paths[key]
        return acc
      }, {} as Record<string, string>)
    )
  }

  for (const chunk of renderingChunks) {
    await Promise.all(
      Object.entries(chunk).map(async ([route, srcFilePath]) => {
        const html = await renderRoute(
          state,
          mod,
          route,
          srcFilePath,
          clientEntry,
          cssLinks
        )
        const filePath = getOutputPath(clientOutDirAbs, route)

        log(ANSI.cyan("[SSG]"), "write:", ANSI.black(filePath))
        fs.mkdirSync(path.dirname(filePath), { recursive: true })
        fs.writeFileSync(filePath, html, "utf-8")
      })
    )
  }

  // Collect and append static props to client modules
  await appendStaticPropsToClientModules(state, clientOutDirAbs, log)
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
  state: PluginState & { ssgOptions: Required<SSGOptions> },
  mod: VirtualServerModule,
  route: string,
  srcFilePath: string,
  clientEntry: string | null,
  cssLinks: string
): Promise<string> {
  const ctx: RenderContext = {
    registerModule: () => {},
    registerPreloadedPageProps: (props) => {
      ;(state.staticProps[srcFilePath] ??= {})[route] = props
    },
  }
  const result = await mod.render(route, ctx)
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

async function appendStaticPropsToClientModules(
  state: PluginState & { ssgOptions: Required<SSGOptions> },
  clientOutDirAbs: string,
  log: (...data: any[]) => void
) {
  const { projectRoot, manifestPath, ssgOptions } = state
  try {
    log(ANSI.cyan("[SSG]"), "Starting static props collection...")
    const clientManifestPath = path.resolve(clientOutDirAbs, manifestPath)
    if (!fs.existsSync(clientManifestPath)) {
      log(
        ANSI.yellow("[SSG]"),
        "Client manifest not found, skipping static props"
      )
      return
    }
    log(ANSI.cyan("[SSG]"), "Found client manifest at:", clientManifestPath)

    const srcPages = globSync(`${ssgOptions.dir}/**/${ssgOptions.page}`, {
      cwd: projectRoot,
    }).map((s) => s.replace(/\\/g, "/"))

    const manifest: Manifest = JSON.parse(
      fs.readFileSync(clientManifestPath, "utf-8")
    )
    log(
      ANSI.cyan("[SSG]"),
      "Parsed manifest with",
      Object.keys(manifest).length,
      "entries"
    )

    const clientEntryChunk = manifest["virtual:kiru:entry-client"]
    if (!clientEntryChunk) {
      throw new Error("Client entry chunk not found in manifest")
    }

    await Promise.all(
      srcPages.map(async (moduleId) => {
        const staticProps = state.staticProps[`/` + moduleId]
        if (!staticProps) return

        const chunk = manifest[moduleId]
        if (!chunk) {
          log(ANSI.red(`failed to get manifest chunk for module "${moduleId}"`))
          return
        }
        const filePath = path.resolve(clientOutDirAbs, chunk.file)
        const code = `export const __KIRU_STATIC_PROPS__ = ${JSON.stringify(
          staticProps
        )};`
        fs.appendFileSync(filePath, `\n${code}`, "utf-8")
        log(ANSI.cyan("[SSG]"), "Added static props to:", chunk.file)
      })
    )
  } catch (error) {
    log(ANSI.red("[SSG]"), "Failed to append static props:", error)
  }
}
