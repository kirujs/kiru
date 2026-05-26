import path from "node:path"
import { createHash } from "node:crypto"
import * as AST from "./ast.js"
import { isAstExpression } from "./ast.js"
import { MagicString, TransformCTX } from "./shared.js"
import { buildModuleImportScope, isImportedCall } from "./scope.js"

type AstNode = AST.AstNode

function unwrapExpression(node: AstNode | undefined): AstNode | undefined {
  if (!node) return undefined
  if (
    node.type === "TSAsExpression" ||
    node.type === "TSSatisfiesExpression" ||
    node.type === "TSNonNullExpression" ||
    node.type === "ParenthesizedExpression"
  ) {
    return unwrapExpression(node.expression as AstNode)
  }
  return node
}

function readServerLoaderConfigArg(init: AstNode | undefined): AstNode | undefined {
  const call = unwrapExpression(init)
  if (call?.type !== "CallExpression") return undefined
  return unwrapExpression(call.arguments?.[0] as AstNode | undefined)
}

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

const STATIC_LOADER_PAYLOAD_EXPORT = "__kiruStaticLoaderPayload"

export function preparePageLoaders(
  ctx: TransformCTX,
  projectRoot: string,
  ssr: boolean,
  onServerLoaderModule?: (ref: ServerLoaderModuleRef) => void,
  options?: {
    staticLoaderClient?: boolean
    staticLoaderPayload?: Record<string, unknown>
  }
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
    clientFormatLoaders(bodyNodes, matches, code, routeId, options)
    if (
      options?.staticLoaderClient &&
      options.staticLoaderPayload &&
      matches.some((m) => m.kind === "static")
    ) {
      code.append(
        `\nexport const ${STATIC_LOADER_PAYLOAD_EXPORT} = ${JSON.stringify(options.staticLoaderPayload)};\n`
      )
    }
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
  routeId: string,
  options?: {
    staticLoaderClient?: boolean
    staticLoaderPayload?: Record<string, unknown>
  }
) {
  const hasServer = matches.some((m) => m.kind === "server")
  const hasStatic =
    options?.staticLoaderClient && matches.some((m) => m.kind === "static")

  if (hasServer || hasStatic) {
    const lines = [`const __$lr__ = ${JSON.stringify(routeId)};`]
    if (hasServer) {
      lines.unshift(
        `import { __kiruEnsureLoaderDispatch } from "kiru/router/loaderClient";`,
        `const __$loadDispatch = () => __kiruEnsureLoaderDispatch();`
      )
    }
    code.prepend(`${lines.join("\n")}\n`)
  }

  bodyNodes.forEach((node) => {
    const match = matches.find((entry) => entry.node === node)
    if (!match) return

    if (match.kind === "static") {
      if (options?.staticLoaderClient) {
        code.overwrite(
          node.start,
          node.end,
          `export const ${match.name} = { __kiruLoader: "static", __kiruInvoke: (ctx) => Promise.resolve(${STATIC_LOADER_PAYLOAD_EXPORT}[ctx.url.pathname + ctx.url.search]) };`
        )
      } else {
        code.overwrite(node.start, node.end, "")
      }
      return
    }

    if (match.kind === "server") {
      const init = node.declaration?.declarations?.[0]?.init
      const config = readServerLoaderConfigArg(init)
      if (config?.type === "ObjectExpression") {
        const fbProp = (config.properties ?? []).find(
          (p: AstNode) =>
            p.type === "Property" &&
            !p.shorthand &&
            (p.key?.name === "fallback" ||
              (p.key?.type === "Literal" && p.key.value === "fallback"))
        )
        const rawFb = fbProp?.value
        const fbValue = isAstExpression(rawFb) ? rawFb : undefined
        const fbExpr =
          fbValue != null ? code.slice(fbValue.start, fbValue.end) : ""
        code.overwrite(
          node.start,
          node.end,
          `export const ${match.name} = { __kiruLoader: "server", __kiruInvoke: (ctx) => __$loadDispatch()(__$lr__, ctx)${fbExpr ? `, __kiruFallback: ${fbExpr}` : ""} };`
        )
        return
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
    `\nimport { __INTERNAL_LOADER_REGISTRY as __$lr__ } from "kiru/router/loaderRegistry";\n__$lr__.register(${JSON.stringify(
      routeId
    )}, { ${names} });\n`
  )
}

function findExportedLoaderCalls(bodyNodes: AstNode[]): LoaderMatch[] {
  const scope = buildModuleImportScope(bodyNodes)
  const resolve = (name: string) => scope.resolve(name)
  const matches: LoaderMatch[] = []

  for (const node of bodyNodes) {
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

    for (const name of LOADER_KINDS) {
      if (
        isImportedCall(init as AstNode, resolve, {
          imported: name,
          namespace: "kiru/router",
        })
      ) {
        const kind =
          name === "serverLoader"
            ? "server"
            : name === "staticLoader"
              ? "static"
              : name === "clientLoader"
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
