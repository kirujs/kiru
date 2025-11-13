import path from "node:path"
import fs from "node:fs"
import { globSync } from "glob"
import { pathToFileURL } from "node:url"
import { ANSI } from "./ansi.js"
import type { OutputBundle, OutputOptions } from "rollup"
import type { SSGOptions } from "./types.js"
import type { Manifest } from "vite"
import type { PluginState } from "./config.js"
import type { VirtualSSGServerModuleRenderResult } from "./dev-server.js"

interface VirtualServerModule {
  render: (
    url: string,
    ctx: { registerModule: (id: string) => void }
  ) => Promise<VirtualSSGServerModuleRenderResult>
  generateStaticPaths: () => Promise<Record<string, string>>
}

interface RenderContext {
  registerModule: (moduleId: string) => void
  registerStaticProps: (props: Record<string, unknown>) => void
}

export async function generateStaticSite(
  state: PluginState & { ssgOptions: Required<SSGOptions> },
  outputOptions: OutputOptions,
  bundle: OutputBundle,
  log: (...data: any[]) => void
) {
  const { projectRoot, baseOutDir, manifestPath, ssgOptions } = state
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
  const { clientEntry } = await getClientAssets(clientOutDirAbs, manifestPath)

  // load manifest once for all routes to avoid multiple reads?
  let manifest: Manifest | null = null
  const clientManifestPath = path.resolve(clientOutDirAbs, manifestPath)
  if (fs.existsSync(clientManifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(clientManifestPath, "utf-8"))
    } catch {}
  }

  const routes = Object.keys(paths)
  log(ANSI.cyan("[SSG]"), `discovered ${routes.length} routes:`, routes)

  const renderingChunks: Record<string, string>[] = []
  const maxConcurrentRenders = ssgOptions.build.maxConcurrentRenders

  // chunk by keys
  for (let i = 0; i < routes.length; i += maxConcurrentRenders) {
    const chunkKeys = routes.slice(i, i + maxConcurrentRenders)
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
          manifest
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

  // Generate sitemap if configured
  if (ssgOptions.sitemap?.domain) {
    await generateSitemap(state, routes, clientOutDirAbs, log)
  }
}

async function getClientAssets(clientOutDirAbs: string, manifestPath: string) {
  let clientEntry: string | null = null

  try {
    const clientManifestPath = path.resolve(clientOutDirAbs, manifestPath)
    if (fs.existsSync(clientManifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(clientManifestPath, "utf-8"))
      const clientEntryKey = "virtual:kiru:entry-client"

      if (manifest[clientEntryKey]?.file) {
        clientEntry = manifest[clientEntryKey].file
      }
    }
  } catch {}

  if (!clientEntry) {
    clientEntry = findClientEntry(clientOutDirAbs)
  }

  return { clientEntry }
}

function collectCssForModules(
  manifest: Manifest,
  moduleIds: string[],
  projectRoot: string
): string {
  const seen = new Set<string>()
  const cssFiles = new Set<string>()

  const collectCss = (key: string) => {
    if (seen.has(key)) return
    seen.add(key)
    const it = manifest[key]
    if (!it) {
      return
    }
    ;(it.css || []).forEach((c: string) => cssFiles.add(c))
    ;(it.imports || []).forEach((imp: string) => collectCss(imp))
  }

  // Include entry client CSS which contains document-level styles
  const entryClientKey = "virtual:kiru:entry-client"
  if (manifest[entryClientKey] && !seen.has(entryClientKey)) {
    collectCss(entryClientKey)
  }

  for (const moduleId of moduleIds) {
    let normalizedId = moduleId.replace(/\\/g, "/")
    if (normalizedId.startsWith(projectRoot)) {
      normalizedId = normalizedId.substring(projectRoot.length)
    }
    if (normalizedId.startsWith("/")) {
      normalizedId = normalizedId.substring(1)
    }

    if (manifest[normalizedId]) {
      collectCss(normalizedId)
      continue
    }

    if (manifest["/" + normalizedId]) {
      collectCss("/" + normalizedId)
      continue
    }

    if (manifest[moduleId]) {
      collectCss(moduleId)
      continue
    }

    // Fallback: match by basename in case manifest uses different path formats
    for (const key in manifest) {
      const keyNormalized = key.replace(/\\/g, "/")
      const moduleBaseName = path.basename(normalizedId)
      const keyBaseName = path.basename(keyNormalized)

      if (
        (keyNormalized.endsWith(normalizedId) ||
          normalizedId.endsWith(keyNormalized)) &&
        moduleBaseName === keyBaseName
      ) {
        collectCss(key)
        break
      }
    }
  }

  if (cssFiles.size) {
    const links = Array.from(cssFiles)
      .map((f) => `<link rel="stylesheet" type="text/css" href="/${f}">`)
      .join("")
    return links
  }

  return ""
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
  manifest: Manifest | null
): Promise<string> {
  const moduleIds: string[] = []
  const { projectRoot, ssgOptions } = state

  const documentPath = path.resolve(
    projectRoot,
    ssgOptions.dir,
    ssgOptions.document
  )
  const documentModuleId = documentPath.replace(/\\/g, "/")
  moduleIds.push(documentModuleId)

  const ctx: RenderContext = {
    registerModule: (moduleId: string) => {
      moduleIds.push(moduleId)
    },
    registerStaticProps: (props) => {
      ;(state.staticProps[srcFilePath] ??= {})[route] = props
    },
  }
  const result = await mod.render(route, ctx)
  let html = result.body
  let cssLinks = ""
  if (manifest) {
    cssLinks = collectCssForModules(manifest, moduleIds, projectRoot)
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

async function generateSitemap(
  state: PluginState & { ssgOptions: Required<SSGOptions> },
  routes: string[],
  clientOutDirAbs: string,
  log: (...data: any[]) => void
) {
  const sitemapConfig = state.ssgOptions.sitemap!
  const {
    domain,
    lastmod: lastModified,
    changefreq = "weekly",
    priority = 0.5,
    overrides = {},
  } = sitemapConfig
  const baseUrl = state.ssgOptions.baseUrl

  // Normalize domain (remove trailing slash)
  const normalizedDomain = domain.replace(/\/$/, "")
  // Normalize baseUrl (ensure it starts with / and doesn't end with / unless it's just "/")
  const normalizedBaseUrl = baseUrl === "/" ? "" : baseUrl.replace(/\/$/, "")

  // Check if we need image or video namespaces
  let hasImages = false
  let hasVideos = false
  for (const route of routes) {
    const override = overrides[route]
    if (override?.images?.length) {
      hasImages = true
    }
    if (override?.videos?.length) {
      hasVideos = true
    }
  }

  // Sort routes by specificity: "/" first, then by depth (fewer segments first), then alphabetically
  const sortedRoutes = [...routes]
    .filter((route) => !route.endsWith("/404")) // Exclude 404 pages
    .sort((a, b) => {
      // "/" always comes first
      if (a === "/") return -1
      if (b === "/") return 1

      // Count path segments (depth)
      const aDepth = a.split("/").filter(Boolean).length
      const bDepth = b.split("/").filter(Boolean).length

      // Sort by depth first (fewer segments = less specific = comes first)
      if (aDepth !== bDepth) {
        return aDepth - bDepth
      }

      // If same depth, sort alphabetically (simple string comparison for URL paths)
      return a < b ? -1 : a > b ? 1 : 0
    })

  // Generate sitemap XML
  const urls = sortedRoutes
    .map((route) => {
      // Normalize route (ensure it starts with /)
      const normalizedRoute = route.startsWith("/") ? route : `/${route}`
      // Combine domain, baseUrl, and route
      const url = `${normalizedDomain}${normalizedBaseUrl}${normalizedRoute}`

      // Get override for this route
      const override = overrides[route] || {}
      const routeChangefreq = override.changefreq ?? changefreq
      const routePriority = override.priority ?? priority
      const routeLastModified = override.lastmod ?? lastModified

      // Build URL entry
      let urlEntry = `  <url>
    <loc>${escapeXml(url)}</loc>
    <changefreq>${routeChangefreq}</changefreq>
    <priority>${routePriority}</priority>`

      // Add lastModified if provided (use override first, then global)
      if (routeLastModified) {
        const lastMod = routeLastModified.toISOString().split("T")[0]
        urlEntry += `\n    <lastmod>${lastMod}</lastmod>`
      }

      // Add images if provided
      if (override.images?.length) {
        for (const image of override.images) {
          const imageUrl = image.startsWith("http")
            ? image
            : `${normalizedDomain}${normalizedBaseUrl}${
                image.startsWith("/") ? image : `/${image}`
              }`
          urlEntry += `\n    <image:image>
      <image:loc>${escapeXml(imageUrl)}</image:loc>
    </image:image>`
        }
      }

      // Add videos if provided
      if (override.videos?.length) {
        for (const video of override.videos) {
          const thumbnailUrl = video.thumbnail_loc.startsWith("http")
            ? video.thumbnail_loc
            : `${normalizedDomain}${normalizedBaseUrl}${
                video.thumbnail_loc.startsWith("/")
                  ? video.thumbnail_loc
                  : `/${video.thumbnail_loc}`
              }`
          urlEntry += `\n    <video:video>
      <video:title>${escapeXml(video.title)}</video:title>
      <video:thumbnail_loc>${escapeXml(thumbnailUrl)}</video:thumbnail_loc>`
          if (video.description) {
            urlEntry += `\n      <video:description>${escapeXml(
              video.description
            )}</video:description>`
          }
          urlEntry += `\n    </video:video>`
        }
      }

      urlEntry += `\n  </url>`
      return urlEntry
    })
    .join("\n")

  // Build namespaces
  const namespaces = [
    'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    hasImages &&
      'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"',
    hasVideos &&
      'xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"',
  ]
    .filter(Boolean)
    .join(" ")

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset ${namespaces}>
${urls}
</urlset>`

  const sitemapPath = path.resolve(clientOutDirAbs, "sitemap.xml")
  fs.writeFileSync(sitemapPath, sitemapXml, "utf-8")
  log(ANSI.cyan("[SSG]"), "Generated sitemap:", ANSI.black(sitemapPath))
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
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
