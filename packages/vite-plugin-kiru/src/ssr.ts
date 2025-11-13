import path from "node:path"
import fs from "node:fs"
import { pathToFileURL } from "node:url"
import type { Manifest } from "vite"
import type { PluginState } from "./config.js"
import { ANSI } from "./ansi.js"

export interface SSRRenderContext {
  registerModule: (moduleId: string) => void
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
  render: (url: string, ctx: SSRRenderContext) => Promise<SSRHttpResponse>
}

/**
 * Logs SSR errors with context information
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

    // Log full stack in development
    if (process.env.NODE_ENV !== "production") {
      console.error(ANSI.yellow("Full Stack:"))
      console.error(ANSI.black_bright(error.stack))
    }
  }
}

/**
 * Creates a generic error page for production
 */
function createErrorPage(
  statusCode: number,
  isDevelopment: boolean,
  error?: Error,
  url?: string
): string {
  if (isDevelopment && error) {
    // Development mode: detailed error overlay
    const errorHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SSR Error</title>
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
  </style>
</head>
<body>
  <div class="error-container">
    <h1>⚠️ Server-Side Rendering Error</h1>
    <div class="error-details">
      <span class="error-label">URL:</span>
      <div class="error-url">${escapeHtml(url || "unknown")}</div>
      
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
  </div>
</body>
</html>
    `.trim()
    return errorHtml
  }

  // Production mode: generic error page
  const statusMessages: Record<number, string> = {
    404: "Page Not Found",
    500: "Internal Server Error",
    503: "Service Unavailable",
  }

  const message = statusMessages[statusCode] || "An Error Occurred"

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${message}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .error-container {
      text-align: center;
      color: white;
      padding: 40px;
    }
    h1 {
      font-size: 120px;
      margin: 0;
      font-weight: bold;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
    }
    p {
      font-size: 24px;
      margin: 20px 0;
    }
    a {
      color: white;
      text-decoration: none;
      border: 2px solid white;
      padding: 12px 30px;
      border-radius: 30px;
      display: inline-block;
      margin-top: 20px;
      transition: all 0.3s ease;
    }
    a:hover {
      background: white;
      color: #667eea;
    }
  </style>
</head>
<body>
  <div class="error-container">
    <h1>${statusCode}</h1>
    <p>${message}</p>
    <a href="/">Go Home</a>
  </div>
</body>
</html>
  `.trim()
}

/**
 * Escapes HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }
  return text.replace(/[&<>"']/g, (char) => map[char])
}

/**
 * Creates a render function for production SSR
 * This is called after the server bundle is built
 */
export async function createProductionRenderer(
  state: PluginState,
  serverEntryPath: string
) {
  const mod = (await import(
    pathToFileURL(serverEntryPath).href
  )) as VirtualServerModule

  const clientOutDirAbs = path.resolve(
    state.projectRoot,
    `${state.baseOutDir}/client`
  )
  const { clientEntry, manifest } = await getClientAssets(
    clientOutDirAbs,
    state.manifestPath
  )

  const isDevelopment = process.env.NODE_ENV !== "production"

  return async (url: string): Promise<SSRHttpResponse> => {
    try {
      const moduleIds: string[] = []

      const ctx: SSRRenderContext = {
        registerModule: (moduleId: string) => {
          moduleIds.push(moduleId)
        },
      }

      console.log(ANSI.cyan("[SSR]"), `Rendering ${ANSI.white_bright(url)}`)

      const result = await mod.render(url, ctx)
      let html = result.html

      // Inject CSS
      if (manifest) {
        const cssLinks = collectCssForModules(
          manifest,
          moduleIds,
          state.projectRoot
        )
        if (cssLinks) {
          html = html.replace("<head>", "<head>" + cssLinks)
          console.log(
            ANSI.cyan("[SSR]"),
            `Injected ${ANSI.green(
              (cssLinks.split("<link").length - 1).toString()
            )} CSS files`
          )
        }
      }

      // Inject client script
      if (clientEntry) {
        const scriptTag = `<script type="module" src="/${clientEntry}"></script>`
        html = html.includes("</body>")
          ? html.replace("</body>", scriptTag + "</body>")
          : html + scriptTag
      }

      console.log(
        ANSI.cyan("[SSR]"),
        `${ANSI.green("✓")} Rendered successfully (${result.statusCode})`
      )

      return {
        ...result,
        html,
      }
    } catch (error) {
      const err = error as Error
      logSSRError(err, url, "Production Render Failed")

      // Return error page
      const statusCode = isDevelopment ? 500 : 500
      const errorHtml = createErrorPage(statusCode, isDevelopment, err, url)

      return {
        html: errorHtml,
        statusCode,
        headers: [["Content-Type", "text/html"]],
      }
    }
  }
}

async function getClientAssets(clientOutDirAbs: string, manifestPath: string) {
  let clientEntry: string | null = null
  let manifest: Manifest | null = null

  try {
    const clientManifestPath = path.resolve(clientOutDirAbs, manifestPath)
    if (fs.existsSync(clientManifestPath)) {
      const parsedManifest = JSON.parse(
        fs.readFileSync(clientManifestPath, "utf-8")
      ) as Manifest
      manifest = parsedManifest
      const clientEntryKey = "virtual:kiru:entry-client"

      if (parsedManifest[clientEntryKey]?.file) {
        clientEntry = parsedManifest[clientEntryKey].file
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
  const manifestRef = manifest // Create a const reference for closure

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
  const entryClientKey = "virtual:kiru:entry-client"
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
