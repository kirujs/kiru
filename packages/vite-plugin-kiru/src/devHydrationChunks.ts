import type { ModuleNode, ViteDevServer } from "vite"
import { extractEntryUrls } from "./dev-server.js"
import {
  formatBootstrapPreloadLinksForHtml,
  formatRouteModulePreloadLinksForHtml,
} from "./injectClientScripts.js"
import {
  parseRouteModuleBindings,
  readRoutesSource,
  type HydrationChunksManifest,
  type RouteModuleBinding,
} from "./hydrationChunks.js"
import type { PluginState } from "./config.js"

function moduleKeyToDevUrl(moduleKey: string): string {
  const normalized = moduleKey.replace(/\\/g, "/")
  return normalized.startsWith("/") ? normalized : `/${normalized}`
}

/** Direct static imports of `root` only (shared runtime), not the full route graph. */
function gatherDirectImportModuleUrls(root: ModuleNode): string[] {
  const urls: string[] = []
  for (const dep of root.importedModules) {
    const file = dep.file ?? ""
    if (
      file &&
      !file.includes("node_modules") &&
      /\.(tsx?|jsx?|mjs|cjs)$/.test(file) &&
      dep.url &&
      !dep.url.startsWith("/@id/")
    ) {
      urls.push(dep.url)
    }
  }
  return urls
}

function gatherPreloadModuleUrls(root: ModuleNode): string[] {
  const seen = new Set<string>()
  const urls: string[] = []
  const queue: ModuleNode[] = [root]
  while (queue.length > 0) {
    const mod = queue.shift()!
    if (!mod.id || seen.has(mod.id)) continue
    seen.add(mod.id)
    const file = mod.file ?? ""
    if (
      file &&
      !file.includes("node_modules") &&
      /\.(tsx?|jsx?|mjs|cjs)$/.test(file) &&
      mod.url &&
      !mod.url.startsWith("/@id/")
    ) {
      urls.push(mod.url)
    }
    for (const dep of mod.importedModules) {
      const depFile = dep.file ?? ""
      if (!depFile.includes("node_modules")) queue.push(dep)
    }
  }
  return urls
}

async function resolveDevUrlsForModuleKey(
  server: ViteDevServer,
  moduleKey: string
): Promise<string[]> {
  const url = moduleKeyToDevUrl(moduleKey)
  let mod = await server.moduleGraph.getModuleByUrl(url)
  if (!mod) {
    try {
      await server.transformRequest(url)
      mod = await server.moduleGraph.getModuleByUrl(url)
    } catch {
      return []
    }
  }
  if (!mod) return []
  return gatherPreloadModuleUrls(mod)
}

function moduleKeysForRoutePath(
  routePath: string,
  bindingsByPath: Map<string, RouteModuleBinding>,
  fallbackLayoutKeys: string[]
): string[] {
  const binding =
    bindingsByPath.get(routePath) ??
    bindingsByPath.get(routePath.replace(/\/$/, "") || "/")
  const keys = new Set<string>()
  if (binding) {
    for (const k of binding.layoutModuleKeys) keys.add(k)
    keys.add(binding.pageModuleKey)
  } else {
    for (const k of fallbackLayoutKeys) keys.add(k)
    if (routePath === "/" || routePath === "") keys.add("src/pages/index.tsx")
    else {
      const clean = routePath.replace(/^\//, "").split("/").filter(Boolean)
      if (clean.length) keys.add(`src/pages/${clean.join("/")}.tsx`)
    }
  }
  return [...keys]
}

export async function buildDevHydrationChunksManifest(
  server: ViteDevServer,
  state: PluginState,
  routePaths: string[]
): Promise<HydrationChunksManifest | undefined> {
  const routesModuleAbs = state.router.ssg?.routesModuleAbs
  if (!routesModuleAbs) return undefined

  const routesSource = await readRoutesSource(routesModuleAbs)
  const routeBindings = parseRouteModuleBindings(
    routesSource,
    routesModuleAbs,
    state.projectRoot
  )
  const bindingsByPath = new Map(
    routeBindings.map((b) => [b.pathname, b] as const)
  )
  const fallbackLayoutKeys = routeBindings[0]?.layoutModuleKeys ?? []

  const templateName = "index.html"
  let entryUrls: string[] = []
  try {
    const { promises: fs } = await import("node:fs")
    const pathMod = await import("node:path")
    const tpl = await fs.readFile(
      pathMod.join(state.projectRoot, templateName),
      "utf8"
    )
    entryUrls = extractEntryUrls(tpl)
  } catch {
    entryUrls = []
  }

  const bootstrap = new Set<string>()
  for (const entryUrl of entryUrls) {
    let mod = await server.moduleGraph.getModuleByUrl(entryUrl)
    if (!mod) {
      try {
        await server.transformRequest(entryUrl)
        mod = await server.moduleGraph.getModuleByUrl(entryUrl)
      } catch {
        continue
      }
    }
    if (mod) {
      for (const u of gatherDirectImportModuleUrls(mod)) {
        if (u !== entryUrl) bootstrap.add(u)
      }
    }
  }

  const byPathname: Record<string, string[]> = {}
  for (const routePath of routePaths) {
    const moduleKeys = moduleKeysForRoutePath(
      routePath,
      bindingsByPath,
      fallbackLayoutKeys
    )
    const urls = new Set<string>()
    for (const key of moduleKeys) {
      for (const u of await resolveDevUrlsForModuleKey(server, key)) {
        urls.add(u)
      }
    }
    const entrySet = new Set(entryUrls)
    byPathname[routePath] = [...urls].filter(
      (u) => !entrySet.has(u) && !bootstrap.has(u)
    )
  }

  return {
    version: 1,
    entry: entryUrls[0],
    bootstrap: [...bootstrap],
    modules: {},
    byRouteId: {},
    byPathname,
  }
}

export function formatDevHydrationPreloadHeadHtml(
  pathname: string,
  manifest: HydrationChunksManifest | undefined
): string {
  if (!manifest) return ""
  const route = manifest.byPathname[pathname]
  const boot = manifest.bootstrap ?? []
  const bootSet = new Set(boot)
  const routeUrls = (route ?? []).filter((u) => !bootSet.has(u))
  const links =
    formatBootstrapPreloadLinksForHtml(boot) +
    (boot.length && routeUrls.length ? "\n    " : "") +
    formatRouteModulePreloadLinksForHtml(routeUrls)
  return links ? `\n    ${links}` : ""
}
