import path from "node:path"
import { urlSegmentsToPath } from "./pathFromSegments.js"
import type { FileRouteDirNode, FileRoutesOptions } from "./types.js"

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

function dirNeedsScope(node: FileRouteDirNode): boolean {
  if (node.layout || node.error || node.notFound || node.scopeConfig) {
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

const MAX_INLINE_LINE = 80

function emitNamedImport(names: string[], from: string): string[] {
  const fromLiteral = JSON.stringify(from)
  const singleLine = `import { ${names.join(", ")} } from ${fromLiteral}`
  if (singleLine.length <= MAX_INLINE_LINE) {
    return [singleLine]
  }
  return [
    "import {",
    ...names.map((name) => `  ${name},`),
    `} from ${fromLiteral}`,
  ]
}

function emitAppRouteTypeLines(parts: string[]): string[] {
  if (parts.length === 0) return []
  const singleLine = `type AppRoute = ${parts.join(" | ")}`
  if (singleLine.length <= MAX_INLINE_LINE) {
    return [singleLine, ""]
  }
  return ["type AppRoute =", ...parts.map((part) => `  | ${part}`), ""]
}

function formatArrayItem(expr: string, indent: string): string {
  const lines = expr.split("\n")
  if (lines.length === 1) {
    return `${indent}${expr},`
  }
  return lines
    .map((line, index) =>
      index === lines.length - 1 ? `${indent}${line},` : `${indent}${line}`
    )
    .join("\n")
}

export type CodegenResult = {
  source: string
}

export function codegenRouteTree(
  root: FileRouteDirNode,
  options: FileRoutesOptions,
  extendImportPath?: string
): CodegenResult {
  const outFile = path.resolve(options.outFile).replace(/\\/g, "/")
  const leafRoutePaths: string[] = []
  let usesRouteScope = false

  const emitConfigLoaderProp = (
    configFile: string | undefined,
    indent: string
  ): string[] => {
    if (!configFile) return []
    const importPath = toImportPath(outFile, configFile)
    return [`${indent}config: () => import(${JSON.stringify(importPath)}),`]
  }

  const emitPage = (node: FileRouteDirNode): string => {
    const routePath = urlSegmentsToPath(node.urlSegments)
    leafRoutePaths.push(routePath)
    const importPath = toImportPath(outFile, node.page!)
    const pathLiteral = JSON.stringify(routePath)
    if (!node.pageConfig) {
      return `createRoute(${pathLiteral}, () => import(${JSON.stringify(
        importPath
      )}))`
    }
    return [
      `createRoute(${pathLiteral}, {`,
      ...emitConfigLoaderProp(node.pageConfig, "  "),
      `  component: () => import(${JSON.stringify(importPath)}),`,
      `})`,
    ].join("\n")
  }

  const emitScopeConfig = (
    node: FileRouteDirNode,
    indent: string
  ): string[] => {
    const lines: string[] = []
    lines.push(...emitConfigLoaderProp(node.scopeConfig, indent))

    if (node.layout) {
      const p = toImportPath(outFile, node.layout)
      lines.push(`${indent}layout: () => import(${JSON.stringify(p)}),`)
    }
    if (node.notFound) {
      const p = toImportPath(outFile, node.notFound)
      lines.push(`${indent}notFound: () => import(${JSON.stringify(p)}),`)
    }
    if (node.error) {
      const p = toImportPath(outFile, node.error)
      lines.push(`${indent}error: () => import(${JSON.stringify(p)}),`)
    }
    return lines
  }

  const emitChildren = (node: FileRouteDirNode): string[] => {
    const childExprs: string[] = []

    if (node.page) childExprs.push(emitPage(node))

    for (const [, child] of sortedChildEntries(node)) {
      if (dirNeedsScope(child)) {
        childExprs.push(emitScope(child))
      } else {
        childExprs.push(...emitChildren(child))
      }
    }

    return childExprs
  }

  const emitChildrenArrayExpr = (
    childExprs: string[],
    linePrefix: string
  ): string => {
    if (childExprs.length === 0) return "[]"
    const useMultiline =
      childExprs.length > 1 ||
      childExprs.some((expr) => expr.includes("\n")) ||
      (childExprs.length === 1 &&
        `${linePrefix}[${childExprs[0]}],`.length > MAX_INLINE_LINE)
    if (!useMultiline) {
      return `[${childExprs[0]}]`
    }
    return [
      "[",
      ...childExprs.map((expr) => formatArrayItem(expr, "    ")),
      "  ]",
    ].join("\n")
  }

  const emitScope = (node: FileRouteDirNode): string => {
    usesRouteScope = true
    const childExprs = emitChildren(node)
    const configLines = emitScopeConfig(node, "  ")
    return [
      "createRouteScope({",
      ...configLines,
      `  children: ${emitChildrenArrayExpr(childExprs, "  children: ")},`,
      "})",
    ].join("\n")
  }

  const rootChildExprs = emitChildren(root)

  const rootTreeLines: string[] = []
  rootTreeLines.push(...emitConfigLoaderProp(root.scopeConfig, "  "))
  if (root.layout) {
    const p = toImportPath(outFile, root.layout)
    rootTreeLines.push(`  layout: () => import(${JSON.stringify(p)}),`)
  }
  if (root.notFound) {
    const p = toImportPath(outFile, root.notFound)
    rootTreeLines.push(`  notFound: () => import(${JSON.stringify(p)}),`)
  }
  if (root.error) {
    const p = toImportPath(outFile, root.error)
    rootTreeLines.push(`  error: () => import(${JSON.stringify(p)}),`)
  }

  const childrenLines: string[] = ["  children: ["]
  for (const expr of rootChildExprs) {
    childrenLines.push(formatArrayItem(expr, "    "))
  }
  if (extendImportPath) {
    childrenLines.push("    ...extendRoutes,")
  }
  childrenLines.push("  ],")
  rootTreeLines.push(...childrenLines)

  const importLines: string[] = []
  if (extendImportPath) {
    importLines.push(
      ...emitNamedImport(
        ["extendRoutes"],
        toImportPath(outFile, extendImportPath)
      )
    )
  }

  const augmentParts: string[] = []
  const augmentRouteTree = options.augmentRouteTree !== false
  if (augmentRouteTree && (leafRoutePaths.length > 0 || extendImportPath)) {
    augmentParts.push(
      'declare module "kiru/router" {',
      "  interface RouteTree {",
      "    routes: AppRoute",
      "  }",
      "}"
    )
  }

  const routerImports = [
    "createRoute",
    ...(usesRouteScope ? ["createRouteScope"] : []),
    "createRouteTree",
  ]

  const exportLine =
    leafRoutePaths.length > 0 || !!extendImportPath
      ? "export { routes, type AppRoute }"
      : "export { routes }"

  const appRouteTypeParts: string[] = leafRoutePaths.map((p) =>
    JSON.stringify(p)
  )
  if (extendImportPath) {
    appRouteTypeParts.push('(typeof extendRoutes)[number]["path"]')
  }
  const appRouteTypeLines = emitAppRouteTypeLines(appRouteTypeParts)

  const routesBlock = [
    "const routes = createRouteTree({",
    ...rootTreeLines,
    "})",
  ].join("\n")

  const source = [
    `/**\n * @generated by vite-plugin-kiru — do not edit\n */`,
    ...emitNamedImport(routerImports, "kiru/router"),
    ...importLines,
    "",
    exportLine,
    "",
    ...appRouteTypeLines,
    routesBlock,
    ...(augmentParts.length > 0 ? ["", ...augmentParts, ""] : [""]),
  ].join("\n")

  return { source }
}
