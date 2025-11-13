import path from "node:path"
import {
  VIRTUAL_ENTRY_SERVER_ID,
  VIRTUAL_ENTRY_CLIENT_ID,
} from "./virtual-modules.js"
import type { ViteDevServer, ModuleNode } from "vite"
import { ANSI } from "./ansi.js"

interface RenderContext {
  registerModule: (moduleId: string) => void
  registerStaticProps?: (props: Record<string, unknown>) => void
}

export interface VirtualServerModuleRenderResult {
  status: number
  body: string
}

export interface SSRHttpResponse {
  html: string
  statusCode: number
  headers: Array<[string, string]>
  stream?: {
    onData: (callback: (chunk: string) => void) => void
    onFinished: (callback: () => void) => void
  }
}

interface VirtualServerModule {
  render: (
    url: string,
    ctx: RenderContext
  ) => Promise<VirtualServerModuleRenderResult | SSRHttpResponse>
  generateStaticPaths?: () => Promise<Record<string, string>>
}

export function injectClientScript(html: string): string {
  const scriptTag = `<script type="module" src="/@id/${VIRTUAL_ENTRY_CLIENT_ID}"></script>`
  if (html.includes("</body>")) {
    return html.replace("</body>", scriptTag + "</body>")
  }
  return html + scriptTag
}

/**
 * Logs SSR errors with context information for development
 */
function logSSRError(error: Error, url: string, context: string): void {
  console.error(
    ANSI.red(`[SSR Error] ${context}`),
    `\n${ANSI.yellow("URL:")} ${url}`,
    `\n${ANSI.yellow("Error:")} ${error.message}`
  )

  if (error.stack) {
    // Extract component stack trace if available
    const stackLines = error.stack.split("\n")
    const componentStack = stackLines
      .filter(
        (line) =>
          line.includes(".tsx") ||
          line.includes(".jsx") ||
          line.includes("pages/") ||
          line.includes("components/")
      )
      .slice(0, 5) // Limit to first 5 relevant lines

    if (componentStack.length > 0) {
      console.error(ANSI.yellow("Component Stack:"))
      componentStack.forEach((line) => console.error(ANSI.black_bright(line)))
    }

    console.error(ANSI.yellow("Full Stack:"))
    console.error(ANSI.black_bright(error.stack))
  }
}

/**
 * Creates a development error overlay HTML
 */
function createDevErrorOverlay(error: Error, url: string): string {
  const escapeHtml = (text: string): string => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }
    return text.replace(/[&<>"']/g, (char) => map[char])
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SSR Error - Development</title>
  <style>
    body {
      margin: 0;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: #1a1a1a;
      color: #e0e0e0;
    }
    .error-container {
      max-width: 900px;
      margin: 0 auto;
      background: #2a2a2a;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    }
    h1 {
      color: #ff6b6b;
      margin-top: 0;
      font-size: 24px;
      border-bottom: 2px solid #ff6b6b;
      padding-bottom: 10px;
    }
    .error-details {
      margin: 20px 0;
    }
    .error-label {
      color: #ffd93d;
      font-weight: bold;
      margin-top: 15px;
      display: block;
    }
    .error-message {
      background: #1a1a1a;
      padding: 15px;
      border-radius: 4px;
      margin-top: 5px;
      color: #ff6b6b;
      font-family: "Courier New", monospace;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .error-stack {
      background: #1a1a1a;
      padding: 15px;
      border-radius: 4px;
      margin-top: 5px;
      color: #a0a0a0;
      font-family: "Courier New", monospace;
      font-size: 12px;
      overflow-x: auto;
      white-space: pre;
    }
    .error-url {
      background: #1a1a1a;
      padding: 10px;
      border-radius: 4px;
      margin-top: 5px;
      color: #6bcf7f;
      font-family: "Courier New", monospace;
    }
    .hint {
      background: #2a4a5a;
      padding: 15px;
      border-radius: 4px;
      margin-top: 20px;
      border-left: 4px solid #6bcf7f;
    }
    .hint-title {
      color: #6bcf7f;
      font-weight: bold;
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <div class="error-container">
    <h1>⚠️ Server-Side Rendering Error (Development)</h1>
    <div class="error-details">
      <span class="error-label">URL:</span>
      <div class="error-url">${escapeHtml(url)}</div>
      
      <span class="error-label">Error Message:</span>
      <div class="error-message">${escapeHtml(error.message)}</div>
      
      ${
        error.stack
          ? `
        <span class="error-label">Stack Trace:</span>
        <div class="error-stack">${escapeHtml(error.stack)}</div>
      `
          : ""
      }
    </div>
    
    <div class="hint">
      <div class="hint-title">💡 Development Mode</div>
      <div>This detailed error page is only shown in development. In production, users will see a generic error page.</div>
    </div>
  </div>
</body>
</html>
  `.trim()
}

export async function handleSSR(
  server: ViteDevServer,
  url: string,
  projectRoot: string,
  resolveUserDocument: () => string,
  mode: "ssg" | "ssr" = "ssg"
) {
  try {
    console.log(
      ANSI.cyan(`[${mode.toUpperCase()}]`),
      `Rendering ${ANSI.white_bright(url)}`
    )

    const mod = (await server.ssrLoadModule(
      VIRTUAL_ENTRY_SERVER_ID
    )) as VirtualServerModule

    const moduleIds: string[] = []
    const documentModule = resolveUserDocument().substring(projectRoot.length)
    moduleIds.push(documentModule)

    const ctx: RenderContext = {
      registerModule: (moduleId: string) => {
        moduleIds.push(moduleId)
      },
    }

    // Only pass registerStaticProps in SSG mode
    if (mode === "ssg") {
      ctx.registerStaticProps = () => {}
    }

    const result = await mod.render(url, ctx)

    // Handle both SSG format (status, body) and SSR format (statusCode, html, headers)
    let status: number
    let body: string

    if ("statusCode" in result && "html" in result) {
      // SSR format
      status = result.statusCode
      body = result.html
    } else {
      // SSG format
      status = result.status
      body = result.body
    }

    let html = injectClientScript(body)

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
      const mod = server.moduleGraph.getModuleById(p)
      if (!mod) {
        console.error(
          ANSI.yellow(`[${mode.toUpperCase()}]`),
          `Module not found: ${p}`
        )
        continue
      }
      scan(mod)
    }

    const localModules = Array.from(importedModules).filter((m) =>
      m.id?.startsWith(projectRoot)
    )
    const cssModules = localModules.filter((m) => m.id?.endsWith(".css"))

    // Inject CSS modules before transformIndexHtml so Vite can process them for HMR
    if (cssModules.length) {
      const stylesheets = cssModules
        .map((mod) => {
          // Use the module's URL for proper Vite dev server resolution
          const moduleUrl = mod.url || mod.id?.replace(projectRoot, "")
          if (!moduleUrl) return null

          // Vite dev server expects paths without query params for CSS HMR
          // The rel="stylesheet" will make Vite handle it properly
          return `<link rel="stylesheet" type="text/css" href="${moduleUrl}">`
        })
        .filter(Boolean)
        .join("\n")

      if (stylesheets) {
        // Insert CSS links before closing head tag
        // If no head tag exists, insert after opening html tag
        if (html.includes("</head>")) {
          html = html.replace("</head>", `${stylesheets}\n</head>`)
        } else if (html.includes("<head>")) {
          html = html.replace("<head>", `<head>\n${stylesheets}`)
        } else if (html.includes("<html>")) {
          html = html.replace(
            "<html>",
            `<html>\n<head>\n${stylesheets}\n</head>`
          )
        }
      }

      console.log(
        ANSI.cyan(`[${mode.toUpperCase()}]`),
        `Injected ${ANSI.green(cssModules.length.toString())} CSS modules`
      )
    }

    // Use Vite's transformIndexHtml but with the entry client as context
    // This helps Vite understand which modules are being used and enables HMR
    html = await server.transformIndexHtml(
      url,
      html,
      "\0" + VIRTUAL_ENTRY_CLIENT_ID
    )

    console.log(
      ANSI.cyan(`[${mode.toUpperCase()}]`),
      `${ANSI.green("✓")} Rendered successfully (${status})`
    )

    return { status, html }
  } catch (error) {
    const err = error as Error
    logSSRError(err, url, `${mode.toUpperCase()} Development Render Failed`)

    // Return development error overlay
    const errorHtml = createDevErrorOverlay(err, url)

    return { status: 500, html: errorHtml }
  }
}
