import type { ViteDevServer, ModuleNode } from "vite"
import path from "node:path"
import type { Readable } from "node:stream"
import {
  VIRTUAL_ENTRY_SERVER_ID,
  VIRTUAL_ENTRY_CLIENT_ID,
} from "./virtual-modules.js"

interface RenderContext {
  registerModule: (moduleId: string) => void
}

interface RenderResult {
  status: number
  immediate: string
  stream: Readable | null
}

interface VirtualServerModule {
  render: (url: string, ctx: RenderContext) => Promise<RenderResult>
  generateStaticPaths: () => Promise<string[]> | string[]
}

export function injectClientScript(html: string): string {
  const scriptTag = `<script type="module" src="/@id/${VIRTUAL_ENTRY_CLIENT_ID}"></script>`
  if (html.includes("</body>")) {
    return html.replace("</body>", scriptTag + "</body>")
  }
  return html + scriptTag
}

export async function handleSSR(
  server: ViteDevServer,
  url: string,
  projectRoot: string,
  resolveUserDocument: () => string
) {
  const mod = (await server.ssrLoadModule(
    VIRTUAL_ENTRY_SERVER_ID
  )) as VirtualServerModule

  const moduleIds: string[] = []
  const ctx = {
    registerModule: (moduleId: string) => {
      moduleIds.push(moduleId)
    },
  }

  const { status, immediate, stream } = await mod.render(url, ctx)
  let html = injectClientScript(immediate)

  const importedModules: Set<ModuleNode> = new Set()
  const seen = new Set<ModuleNode>()

  const documentModule = resolveUserDocument().substring(projectRoot.length)
  moduleIds.push(documentModule)

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

  return { status, html, stream }
}
