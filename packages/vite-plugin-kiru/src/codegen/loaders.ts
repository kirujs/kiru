import path from "node:path"
import { createHash } from "node:crypto"
import * as AST from "./ast.js"
import { MagicString, TransformCTX, createAliasHandler } from "./shared.js"

type AstNode = AST.AstNode

type LoaderMatch = {
  node: AstNode
  name: string
  kind: "server" | "static" | "universal" | "client"
}

const LOADER_KINDS = ["serverLoader", "staticLoader", "loader", "clientLoader"] as const

export type ServerLoaderModuleRef = {
  routeId: string
  viteModuleId: string
}

export function preparePageLoaders(
  ctx: TransformCTX,
  projectRoot: string,
  ssr: boolean,
  onServerLoaderModule?: (ref: ServerLoaderModuleRef) => void
) {
  const { code, ast } = ctx
  const bodyNodes = ast.body as AstNode[]
  const matches = findExportedLoaderCalls(bodyNodes)
  if (matches.length === 0) return

  const routeId = generateRouteId(ctx.filePath, projectRoot)
  const hasServer = matches.some((m) => m.kind === "server")

  if (ssr) {
    serverRegisterLoaders(matches, code, routeId)
  } else {
    clientFormatLoaders(bodyNodes, matches, code, routeId)
  }

  if (hasServer && onServerLoaderModule) {
    const normalized = ctx.filePath.replace(/\\/g, "/")
    const root = projectRoot.replace(/\\/g, "/").replace(/\/+$/, "")
    const relative = normalized.startsWith(root + "/")
      ? normalized.slice(root.length + 1)
      : path.basename(normalized)
    onServerLoaderModule({
      routeId,
      viteModuleId: `/${relative}`,
    })
  }
}

function clientFormatLoaders(
  bodyNodes: AstNode[],
  matches: LoaderMatch[],
  code: MagicString,
  routeId: string
) {
  const hasServer = matches.some((m) => m.kind === "server")

  if (hasServer) {
    code.prepend(
      `import { __kiruEnsureLoaderDispatch } from "kiru/ssr/router";\nconst __$lr__ = ${JSON.stringify(
        routeId
      )};\nconst __$loadDispatch = () => __kiruEnsureLoaderDispatch();\n`
    )
  }

  bodyNodes.forEach((node) => {
    const match = matches.find((entry) => entry.node === node)
    if (!match) return

    if (match.kind === "static") {
      code.overwrite(node.start, node.end, "")
      return
    }

    if (match.kind === "server") {
      const init = node.declaration?.declarations?.[0]?.init
      if (init?.type === "CallExpression") {
        const arg = init.arguments?.[0]
        if (arg?.type === "ObjectExpression") {
          const fbProp = (arg.properties ?? []).find(
            (p: AstNode) =>
              p.type === "Property" &&
              (p.key?.name === "fallback" || p.key?.value === "fallback")
          )
          const fbValue = fbProp?.value as AstNode | undefined
          const fbExpr =
            fbValue != null
              ? code.slice(fbValue.start, fbValue.end)
              : ""
          code.overwrite(
            node.start,
            node.end,
            `export const ${match.name} = { __kiruLoader: "server", __kiruInvoke: (ctx) => __$loadDispatch()(__$lr__, ctx)${fbExpr ? `, __kiruFallback: ${fbExpr}` : ""} };`
          )
          return
        }
      }
      code.overwrite(
        node.start,
        node.end,
        `export const ${match.name} = { __kiruLoader: "server", __kiruInvoke: (ctx) => __$loadDispatch()(__$lr__, ctx) };`
      )
      return
    }

    // universal + client: keep implementation (already wrapped at runtime)
  })
}

function serverRegisterLoaders(
  matches: LoaderMatch[],
  code: MagicString,
  routeId: string
) {
  const names = matches.map((m) => m.name).join(", ")
  code.append(
    `\nimport { __INTERNAL_LOADER_REGISTRY as __$lr__ } from "kiru/router";\n__$lr__.register(${JSON.stringify(
      routeId
    )}, { ${names} });\n`
  )
}

function findExportedLoaderCalls(bodyNodes: AstNode[]): LoaderMatch[] {
  const handlers = LOADER_KINDS.map((name) => ({
    name,
    handler: createAliasHandler(name, "kiru/router"),
  }))
  const matches: LoaderMatch[] = []

  for (const node of bodyNodes) {
    if (node.type === "ImportDeclaration") {
      for (const h of handlers) h.handler.addAliases(node)
      continue
    }
    if (
      node.type !== "ExportNamedDeclaration" ||
      node.declaration?.type !== "VariableDeclaration"
    ) {
      continue
    }
    const declarations = node.declaration.declarations ?? []
    if (declarations.length !== 1) continue
    const declaration = declarations[0]
    if (declaration.type !== "VariableDeclarator") continue
    if (!declaration.id?.name) continue
    const init = declaration.init
    if (!init) continue

    for (const h of handlers) {
      if (h.handler.isMatchingCallExpression(init)) {
        const kind =
          h.name === "serverLoader"
            ? "server"
            : h.name === "staticLoader"
              ? "static"
              : h.name === "clientLoader"
                ? "client"
                : "universal"
        matches.push({ node, name: declaration.id.name, kind })
        break
      }
    }
  }
  return matches
}

function generateRouteId(filePath: string, projectRoot: string): string {
  const normalizedFile = filePath.replace(/\\/g, "/")
  const normalizedRoot = projectRoot.replace(/\\/g, "/").replace(/\/+$/, "")
  const relativePath = normalizedFile.startsWith(normalizedRoot + "/")
    ? normalizedFile.slice(normalizedRoot.length + 1)
    : path.basename(normalizedFile)
  const routePath = relativePath.replace(/\.[^./]+$/, "")
  const digest = createHash("sha256").update(routePath).digest("hex").slice(0, 12)
  return `r_${digest}`
}
