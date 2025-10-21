import path from "node:path"
import fs from "node:fs"
import { FileRouterOptions } from "./types.js"

export interface RouteInfo {
  path: string
  filePath: string
  params: string[]
  layouts: LayoutInfo[]
}

export interface LayoutInfo {
  path: string
  filePath: string
  level: number
}

export class FileRouterScanner {
  private pagesDir: string
  private pageExtensions: string[]
  private projectRoot: string
  private routes: Map<string, RouteInfo> = new Map()
  private layouts: Map<string, LayoutInfo> = new Map()

  constructor(projectRoot: string, options: FileRouterOptions = {}) {
    this.projectRoot = projectRoot
    this.pagesDir = options.pagesDir ?? "src/pages"
    this.pageExtensions = options.pageExtensions ?? [
      ".tsx",
      ".ts",
      ".jsx",
      ".js",
    ]
  }

  scanRoutes(): Map<string, RouteInfo> {
    this.routes.clear()
    this.layouts.clear()
    const pagesPath = path
      .join(this.projectRoot, this.pagesDir)
      .replace(/\\/g, "/")

    console.log("pagesPath", pagesPath)

    if (!fs.existsSync(pagesPath)) {
      console.log("pagesPath does not exist")
      return this.routes
    }

    this.scanDirectory(pagesPath, "")
    return this.routes
  }

  private scanDirectory(dirPath: string, routePrefix: string): void {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })

    // First, check for layout.tsx in this directory
    const layoutFile = entries.find(
      (entry) =>
        entry.isFile() &&
        entry.name === "layout.tsx" &&
        this.pageExtensions.includes(path.extname(entry.name))
    )

    if (layoutFile) {
      this.addLayout(path.join(dirPath, layoutFile.name), routePrefix)
    }

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)

      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        const newPrefix = routePrefix
          ? `${routePrefix}/${entry.name}`
          : entry.name
        this.scanDirectory(fullPath, newPrefix)
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name)
        if (this.pageExtensions.includes(ext)) {
          const fileName = path.basename(entry.name, ext)
          this.addRoute(fullPath, routePrefix, fileName)
        }
      }
    }
  }

  private addLayout(filePath: string, routePrefix: string): void {
    const layoutPath = routePrefix ? `/${routePrefix}` : "/"
    const level = routePrefix.split("/").length

    const layoutInfo: LayoutInfo = {
      path: layoutPath,
      filePath: filePath.replace(/\\/g, "/"),
      level,
    }

    this.layouts.set(layoutPath, layoutInfo)
  }

  private addRoute(
    filePath: string,
    routePrefix: string,
    fileName: string
  ): void {
    // Only index files count as routes
    if (fileName !== "index") {
      return
    }

    let routePath = "/" + routePrefix

    // Convert [param] to :param in the route path
    routePath = routePath.replace(/\[([^\]]+)\]/g, ":$1")

    // Extract parameter names from the route path
    const params = (routePath.match(/:([^/]+)/g) || []).map((p) => p.slice(1))

    // Find applicable layouts for this route
    const layouts = this.getApplicableLayouts(routePath)

    const routeInfo: RouteInfo = {
      path: routePath,
      filePath: filePath.replace(/\\/g, "/"),
      params,
      layouts,
    }

    this.routes.set(routePath, routeInfo)
  }

  private getApplicableLayouts(routePath: string): LayoutInfo[] {
    const applicableLayouts: LayoutInfo[] = []
    const pathSegments = routePath.split("/").filter(Boolean)

    // Always include root layout if it exists
    const rootLayout = this.layouts.get("/")
    if (rootLayout) {
      applicableLayouts.push(rootLayout)
    }

    // Check for nested layouts
    let currentPath = ""
    for (const segment of pathSegments) {
      currentPath += `/${segment}`
      const layout = this.layouts.get(currentPath)
      if (layout) {
        applicableLayouts.push(layout)
      }
    }

    // Sort by level (ascending) so outer layouts come first
    return applicableLayouts.sort((a, b) => a.level - b.level)
  }

  getRouteInfo(routePath: string): RouteInfo | undefined {
    return this.routes.get(routePath)
  }

  getAllRoutes(): RouteInfo[] {
    return Array.from(this.routes.values())
  }

  generateRouteManifest(): string {
    const routes = this.getAllRoutes()
    const manifest = {
      routes: routes.map((route) => ({
        path: route.path,
        filePath: route.filePath,
        params: route.params,
        layouts: route.layouts,
      })),
    }

    return `export default ${JSON.stringify(manifest, null, 2)}`
  }

  generateRouteLoader(): string {
    const routes = this.getAllRoutes()
    console.log("routes", routes)

    // Collect all unique layout files
    const layoutFiles = new Set<string>()
    routes.forEach((route) => {
      route.layouts.forEach((layout) => {
        layoutFiles.add(layout.filePath)
      })
    })

    const routeImports = routes
      .map((route, index) => `import Route${index} from "${route.filePath}"`)
      .join("\n")

    const layoutImports = Array.from(layoutFiles)
      .map((layoutFile, index) => `import Layout${index} from "${layoutFile}"`)
      .join("\n")

    const routeMap = routes
      .map((route, index) => `  "${route.path}": Route${index}`)
      .join(",\n")

    const layoutMap = Array.from(layoutFiles)
      .map((layoutFile, index) => `  "${layoutFile}": Layout${index}`)
      .join(",\n")

    return `${routeImports}
${layoutImports}

const routeMap = {
${routeMap}
}

const layoutMap = {
${layoutMap}
}

export { routeMap, layoutMap }
export const routePaths = ${JSON.stringify(routes.map((r) => r.path))}
export const routeInfo = ${JSON.stringify(
      routes.map((r) => ({
        path: r.path,
        params: r.params,
        layouts: r.layouts,
      }))
    )}
`
  }
}
