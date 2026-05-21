import path from "node:path"
import { urlSegmentsToPath } from "./pathFromSegments.js"
import type { FileRouteDirNode, FileRoutesOptions } from "./types.js"

type ModuleImport = {
  varName: string
  importPath: string
}

function posixRelative(fromFile: string, toFile: string): string {
  const rel = path.posix.relative(
    path.posix.dirname(fromFile.replace(/\\/g, "/")),
    toFile.replace(/\\/g, "/")
  )
  if (!rel.startsWith(".")) return `./${rel}`
  return rel
}

function toImportPath(outFile: string, targetFile: string): string {
  const rel = posixRelative(outFile, targetFile)
  return rel.replace(/\.(tsx?|jsx?)$/, "")
}

function assertNoMiddlewareConfigConflict(
  node: FileRouteDirNode,
  label: string
): void {
  if (node.middleware && node.scopeConfig) {
    throw new Error(
      `[file-routes] ${label}: both middleware.ts and scope.config export middleware — use one source`
    )
  }
}

function dirNeedsScope(node: FileRouteDirNode): boolean {
  if (
    node.layout ||
    node.middleware ||
    node.error ||
    node.notFound ||
    node.scopeConfig
  ) {
    return true
  }
  for (const child of node.children.values()) {
    if (dirNeedsScope(child)) return true
  }
  return false
}

function sortedChildEntries(
  node: FileRouteDirNode
): [string, FileRouteDirNode][] {
  return [...node.children.entries()].sort(([a], [b]) => a.localeCompare(b))
}

export type CodegenResult = {
  source: string
  middlewareImports: ModuleImport[]
  leafRouteVars: string[]
}

export function codegenRouteTree(
  root: FileRouteDirNode,
  options: FileRoutesOptions,
  extendImportPath?: string
): CodegenResult {
  const outFile = path.resolve(options.outFile).replace(/\\/g, "/")
  const middlewareImports: ModuleImport[] = []
  const configImports: ModuleImport[] = []
  const leafRouteVars: string[] = []
  const declLines: string[] = []
  let routeCounter = 0
  let mwCounter = 0
  let cfgCounter = 0

  const nextRouteVar = (): string => `r${routeCounter++}`

  const registerMiddleware = (file: string): string => {
    const varName = `__mw_${mwCounter++}`
    middlewareImports.push({
      varName,
      importPath: toImportPath(outFile, file),
    })
    return varName
  }

  const registerConfig = (file: string): string => {
    const varName = `__cfg_${cfgCounter++}`
    configImports.push({
      varName,
      importPath: toImportPath(outFile, file),
    })
    return varName
  }

  const emitConfigSpread = (configFile: string | undefined): string[] => {
    if (!configFile) return []
    const mod = registerConfig(configFile)
    return [`...resolveRouteConfig(${mod}),`]
  }

  const emitPage = (node: FileRouteDirNode): string => {
    if (node.middleware && node.pageConfig) {
      throw new Error(
        `[file-routes] Route ${urlSegmentsToPath(node.urlSegments)}: both middleware.ts and page config — use one source for middleware`
      )
    }
    const varName = nextRouteVar()
    leafRouteVars.push(varName)
    const routePath = urlSegmentsToPath(node.urlSegments)
    const importPath = toImportPath(outFile, node.page!)
    const pathLiteral = JSON.stringify(routePath)
    const configSpread = emitConfigSpread(node.pageConfig)
    if (configSpread.length > 0) {
      declLines.push(
        `const ${varName} = createRoute(${pathLiteral}, {`,
        ...configSpread.map((l) => `  ${l}`),
        `  component: () => import(${JSON.stringify(importPath)}),`,
        `})`
      )
    } else {
      declLines.push(
        `const ${varName} = createRoute(${pathLiteral}, () => import(${JSON.stringify(importPath)}))`
      )
    }
    return varName
  }

  const emitScopeConfig = (node: FileRouteDirNode, indent: string): string[] => {
    assertNoMiddlewareConfigConflict(node, `Scope ${node.dirPath}`)
    const lines: string[] = []
    const inner = indent + "  "
    lines.push(...emitConfigSpread(node.scopeConfig).map((l) => `${inner}${l}`))

    if (node.layout) {
      const p = toImportPath(outFile, node.layout)
      lines.push(`${inner}layout: () => import(${JSON.stringify(p)}),`)
    }
    if (node.middleware) {
      const v = registerMiddleware(node.middleware)
      lines.push(
        `${inner}middleware: collectRouteMiddlewareModule(${v}),`
      )
    }
    if (node.notFound) {
      const p = toImportPath(outFile, node.notFound)
      lines.push(`${inner}notFound: () => import(${JSON.stringify(p)}),`)
    }
    if (node.error) {
      const p = toImportPath(outFile, node.error)
      lines.push(`${inner}error: () => import(${JSON.stringify(p)}),`)
    }
    return lines
  }

  const emitChildren = (node: FileRouteDirNode): string[] => {
    const childVars: string[] = []

    if (node.page) childVars.push(emitPage(node))

    for (const [, child] of sortedChildEntries(node)) {
      if (dirNeedsScope(child)) {
        childVars.push(emitScope(child))
      } else {
        childVars.push(...emitChildren(child))
      }
    }

    return childVars
  }

  const emitScope = (node: FileRouteDirNode): string => {
    const varName = nextRouteVar()
    const childVars = emitChildren(node)
    const configLines = emitScopeConfig(node, "")
    declLines.push(
      `const ${varName} = createRouteScope({`,
      ...configLines.map((l) => (l.startsWith("  ") ? l : `  ${l}`)),
      `  children: [${childVars.join(", ")}],`,
      `})`
    )
    return varName
  }

  const rootChildVars = emitChildren(root)

  assertNoMiddlewareConfigConflict(root, "Root scope")
  const rootTreeLines: string[] = []
  rootTreeLines.push(
    ...emitConfigSpread(root.scopeConfig).map((l) => `  ${l}`)
  )
  if (root.layout) {
    const p = toImportPath(outFile, root.layout)
    rootTreeLines.push(`  layout: () => import(${JSON.stringify(p)}),`)
  }
  if (root.notFound) {
    const p = toImportPath(outFile, root.notFound)
    rootTreeLines.push(`  notFound: () => import(${JSON.stringify(p)}),`)
  }
  if (root.middleware) {
    const v = registerMiddleware(root.middleware)
    rootTreeLines.push(
      `  middleware: collectRouteMiddlewareModule(${v}),`
    )
  }
  if (root.error) {
    const p = toImportPath(outFile, root.error)
    rootTreeLines.push(`  error: () => import(${JSON.stringify(p)}),`)
  }

  const childrenExpr = extendImportPath
    ? `[${rootChildVars.join(", ")}, ...extendRoutes]`
    : `[${rootChildVars.join(", ")}]`

  rootTreeLines.push(`  children: ${childrenExpr},`)

  const importLines = [
    ...configImports.map(
      (m) => `import * as ${m.varName} from ${JSON.stringify(m.importPath)}`
    ),
    ...middlewareImports.map(
      (m) => `import * as ${m.varName} from ${JSON.stringify(m.importPath)}`
    ),
  ]

  if (extendImportPath) {
    importLines.push(
      `import { extendRoutes } from ${JSON.stringify(toImportPath(outFile, extendImportPath))}`
    )
  }

  const augmentParts: string[] = []
  if (leafRouteVars.length > 0 || extendImportPath) {
    const registryTypes = leafRouteVars.map((v) => `typeof ${v}`).join(", ")
    const routesTuple =
      registryTypes.length > 0 && extendImportPath
        ? `[${registryTypes}, ...(typeof extendRoutes)]`
        : registryTypes.length > 0
          ? `[${registryTypes}]`
          : "[...(typeof extendRoutes)]"
    augmentParts.push(
      'declare module "kiru/router" {',
      "  interface RouteTree {",
      `    routes: ${routesTuple}`,
      "  }",
      "}"
    )
  }

  const source = [
    `/**\n* @generated by vite-plugin-kiru — do not edit\n*/`,
    "import {",
    "  collectRouteMiddlewareModule,",
    "  createRoute,",
    "  createRouteScope,",
    "  createRouteTree,",
    ...(configImports.length > 0 ? ["  resolveRouteConfig,"] : []),
    '} from "kiru/router"',
    ...importLines,
    "",
    ...declLines,
    "",
    "export const routes = createRouteTree({",
    ...rootTreeLines,
    "})",
    ...(augmentParts.length > 0 ? ["", ...augmentParts, ""] : [""]),
  ].join("\n")

  return { source, middlewareImports, leafRouteVars }
}
