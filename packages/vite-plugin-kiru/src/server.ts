import path from "node:path"
import fs from "node:fs"
import { AsyncLocalStorage } from "node:async_hooks"
import type { Manifest, ModuleNode } from "vite"
import {
  ServerActionResponse,
  ServerRenderOptions,
  SSRRenderResult,
} from "./types.server"
import { VIRTUAL_ENTRY_CLIENT_ID } from "./virtual-modules.js"
import {
  loadRouteRemoteModule,
  getServerEntryModule,
  KIRU_SERVER_GLOBAL,
} from "./globals"
import { makeKiruContextToken, unwrapKiruToken } from "./token"

const als = new AsyncLocalStorage<Kiru.RequestContext>()

async function getClientAssets(
  clientOutDirAbs: string,
  manifestPath: string
): Promise<{ clientEntry: string | null; manifest: Manifest | null }> {
  let clientEntry: string | null = null
  let manifest: Manifest | null = null

  try {
    const clientManifestPath = path.resolve(clientOutDirAbs, manifestPath)
    if (fs.existsSync(clientManifestPath)) {
      const parsedManifest = JSON.parse(
        fs.readFileSync(clientManifestPath, "utf-8")
      ) as Manifest
      manifest = parsedManifest

      if (parsedManifest[VIRTUAL_ENTRY_CLIENT_ID]?.file) {
        clientEntry = parsedManifest[VIRTUAL_ENTRY_CLIENT_ID].file
      }
    }
  } catch {}

  return { clientEntry, manifest }
}

function collectCssForModules(
  manifest: Manifest | null,
  moduleIds: string[],
  projectRoot: string
): string {
  if (!manifest) return ""

  const seen = new Set<string>()
  const cssFiles = new Set<string>()
  const manifestRef = manifest

  const collectCss = (key: string) => {
    if (seen.has(key)) return
    seen.add(key)
    const it = manifestRef[key]
    if (!it) {
      return
    }
    ;(it.css || []).forEach((c: string) => cssFiles.add(c))
    ;(it.imports || []).forEach((imp: string) => collectCss(imp))
  }

  // Include entry client CSS which contains document-level styles
  const entryClientKey = VIRTUAL_ENTRY_CLIENT_ID
  if (manifestRef[entryClientKey] && !seen.has(entryClientKey)) {
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

    if (manifestRef[normalizedId]) {
      collectCss(normalizedId)
      continue
    }

    if (manifestRef["/" + normalizedId]) {
      collectCss("/" + normalizedId)
      continue
    }

    if (manifestRef[moduleId]) {
      collectCss(moduleId)
      continue
    }

    // Fallback: match by basename in case manifest uses different path formats
    for (const key in manifestRef) {
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

export async function renderPage(
  options: ServerRenderOptions
): Promise<SSRRenderResult> {
  const { render, documentModuleId, remoteFunctionSecret } =
    await getServerEntryModule()

  // Track modules for CSS collection
  const moduleIds = [documentModuleId]
  const projectRoot = process.cwd().replace(/\\/g, "/")

  als.enterWith(options.context)

  const { httpResponse } = await render(options.url, {
    userContext: options.context,
    registerModule(moduleId) {
      moduleIds.push(moduleId)
    },
  })

  if (httpResponse === null) {
    return { httpResponse: null }
  }

  const isDevelopment = process.env.NODE_ENV !== "production"
  let html = httpResponse.html

  if (isDevelopment) {
    html = await KIRU_SERVER_GLOBAL.viteDevServer!.transformIndexHtml(
      options.url,
      html
    )
    // In development, Vite handles CSS via the client entry script
    // We just need to inject the client script with the virtual module path
    const scriptTag = `<script type="module" src="/@id/${VIRTUAL_ENTRY_CLIENT_ID}" async></script>`
    html = html.includes("</body>")
      ? html.replace("</body>", scriptTag + "</body>")
      : html + scriptTag

    // Inject CSS via module graph
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

    for (const id of moduleIds) {
      const p = path.join(projectRoot, id).replace(/\\/g, "/")
      const mod = KIRU_SERVER_GLOBAL.viteDevServer!.moduleGraph.getModuleById(p)
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
    if (cssModules.length) {
      const stylesheets = cssModules.map((mod) => {
        const p = mod.id?.replace(projectRoot, "")
        return `<link rel="stylesheet" type="text/css" href="${p}?temp">`
      })
      html = html.replace("<head>", "<head>" + stylesheets.join("\n"))
    }
  } else {
    // In production, use manifest-based CSS collection
    const clientOutDirAbs = path.resolve(projectRoot, "dist/client")
    const { clientEntry, manifest } = await getClientAssets(
      clientOutDirAbs,
      "vite-manifest.json"
    )

    // Inject CSS from manifest
    if (manifest) {
      const cssLinks = collectCssForModules(manifest, moduleIds, projectRoot)
      if (cssLinks) {
        html = html.replace("<head>", "<head>" + cssLinks)
      }
    }

    // Inject client script
    if (clientEntry) {
      const scriptTag = `<script type="module" src="/${clientEntry}" async></script>`
      html = html.includes("</body>")
        ? html.replace("</body>", scriptTag + "</body>")
        : html + scriptTag
    }
  }

  const contextString = JSON.stringify(options.context)
  html = html.replace(
    "</head>",
    `<script type="application/json" k-request-context>${contextString}</script></head>`
  )
  const token = makeKiruContextToken(
    options.context as Record<string, unknown>,
    remoteFunctionSecret
  )
  html = html.replace(
    "</head>",
    `<script type="application/json" k-request-token>${token}</script></head>`
  )

  return {
    httpResponse: {
      ...httpResponse,
      html,
    },
  }
}

export async function getServerActionResponse(
  request: Request
): Promise<ServerActionResponse> {
  let action: (...args: any[]) => unknown
  let actionArgs = []
  let context: Record<string, unknown>
  const { searchParams } = new URL(request.url)

  try {
    let strToken, actionId
    if (
      request.method !== "POST" ||
      request.headers.get("Content-Type") !== "application/json" ||
      !(strToken = request.headers.get("x-kiru-token")) ||
      !(actionId = searchParams.get("action"))
    ) {
      return { httpResponse: null }
    }

    const [route, actionName] = actionId.split(".")
    await loadRouteRemoteModule(route)

    const {
      config: { actions },
      remoteFunctionSecret,
    } = await getServerEntryModule()

    const ctx = unwrapKiruToken(strToken, remoteFunctionSecret)
    if (!ctx) {
      return createBadActionResponse()
    }

    const fileActions = actions.get(route)
    const actionFn = fileActions[actionName]
    const args = await request.json()
    if (typeof actionFn !== "function" || !Array.isArray(args)) {
      return createBadActionResponse()
    }

    action = actionFn
    actionArgs = args
    context = ctx
  } catch {
    return createBadActionResponse()
  }

  return new Promise(async (resolve) => {
    als.run({ ...context }, async () => {
      try {
        const result = await action(...actionArgs)
        resolve({
          httpResponse: {
            body: JSON.stringify(result),
            statusCode: 200,
          },
        })
      } catch {
        resolve(createBadActionResponse())
      }
    })
  })
}

function createBadActionResponse(): ServerActionResponse {
  return {
    httpResponse: { body: null, statusCode: 500 },
  }
}

export function getRequestContext(): Kiru.RequestContext {
  const ctx = als.getStore()
  if (ctx === undefined) {
    throw new Error(
      "[vite-plugin-kiru]: Invalid `getRequestContext` invocation."
    )
  }
  return ctx
}
