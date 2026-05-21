import path from "node:path"
import { createHash } from "node:crypto"
import * as AST from "./ast.js"
import { MagicString, TransformCTX, createAliasHandler } from "./shared.js"

type AstNode = AST.AstNode

interface ActionMatch {
  node: AstNode
  name: string
  kind: "action" | "form"
  method?: "GET" | "POST"
}

export function prepareRemoteFunctions(
  ctx: TransformCTX,
  projectRoot: string,
  ssr: boolean
) {
  const { code, ast } = ctx
  const bodyNodes = ast.body as AstNode[]
  const matches = findExportedActionCalls(bodyNodes)
  if (matches.length === 0) return

  const routeId = generateRouteId(ctx.filePath, projectRoot)

  if (ssr) {
    serverRegisterRemoteFunctions(matches, code, routeId)
  } else {
    clientFormatRemoteFunctions(bodyNodes, matches, code, routeId)
  }
}

function clientFormatRemoteFunctions(
  bodyNodes: AstNode[],
  matches: ActionMatch[],
  code: MagicString,
  route: string
) {
  const hasJsonActions = matches.some((m) => m.kind === "action")

  if (hasJsonActions) {
    code.prepend(
      `import { __kiruEnsureRemoteDispatch } from "kiru/ssr/router";\nconst __$r__ = ${JSON.stringify(
        route
      )};\nconst __$dispatch = () => __kiruEnsureRemoteDispatch();\n`
    )
  } else {
    // Only form actions: still need the route constant for action IDs.
    code.prepend(`const __$r__ = ${JSON.stringify(route)};\n`)
  }

  bodyNodes.forEach((node) => {
    const match = matches.find((entry) => entry.node === node)
    if (!match) {
      code.overwrite(node.start, node.end, "")
      return
    }

    if (match.kind === "form") {
      code.overwrite(
        node.start,
        node.end,
        `export const ${match.name} = { __kiruFormAction: true, __kiruFormActionId: \`\${__$r__}:${match.name}\` };`
      )
    } else if (match.method === "GET") {
      code.overwrite(
        node.start,
        node.end,
        `export async function ${match.name}(options) { return __$dispatch()(\`\${__$r__}:${match.name}\`, "GET", undefined, options); }`
      )
    } else {
      code.overwrite(
        node.start,
        node.end,
        `export async function ${match.name}(input, options) { return __$dispatch()(\`\${__$r__}:${match.name}\`, "POST", input, options); }`
      )
    }
  })
}

function serverRegisterRemoteFunctions(
  matches: ActionMatch[],
  code: MagicString,
  route: string
) {
  const names = matches.map((m) => m.name).join(", ")
  code.append(
    `\nimport { __INTERNAL_REMOTE_REGISTRY as __$r__ } from "kiru/remote";\n__$r__.register(${JSON.stringify(
      route
    )}, { ${names} });\n`
  )
}

function findExportedActionCalls(bodyNodes: AstNode[]): ActionMatch[] {
  const actionAliasHandler = createAliasHandler("action", "kiru/remote")
  const matches: ActionMatch[] = []

  for (const node of bodyNodes) {
    if (node.type === "ImportDeclaration") {
      actionAliasHandler.addAliases(node)
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

    const remoteMethod = getActionMemberMethod(init, actionAliasHandler.aliases)
    if (remoteMethod === "GET") {
      matches.push({
        node,
        name: declaration.id.name,
        kind: "action",
        method: "GET",
      })
    } else if (remoteMethod === "POST") {
      if (isPostFormConfig(init)) {
        matches.push({ node, name: declaration.id.name, kind: "form" })
      } else {
        matches.push({
          node,
          name: declaration.id.name,
          kind: "action",
          method: "POST",
        })
      }
    }
  }
  return matches
}

function isPostFormConfig(node: AstNode): boolean {
  if (node.type !== "CallExpression") return false
  const args = node.arguments ?? []
  const first = args[0]
  if (!first || first.type !== "ObjectExpression") return false
  const properties = first.properties ?? []
  for (const prop of properties) {
    if (prop.type !== "Property") continue
    const key = prop.key
    const keyName =
      key?.type === "Identifier"
        ? key.name
        : key?.type === "Literal" && typeof key.value === "string"
          ? key.value
          : undefined
    if (keyName !== "type") continue
    const value = prop.value
    if (
      value?.type === "Literal" &&
      typeof value.value === "string" &&
      value.value === "form"
    ) {
      return true
    }
  }
  return false
}

function getActionMemberMethod(
  node: AstNode,
  actionAliases: Set<string>
): "GET" | "POST" | null {
  if (node.type !== "CallExpression") return null
  const callee = node.callee
  if (callee?.type !== "MemberExpression") return null
  if (
    callee.object?.type !== "Identifier" ||
    typeof callee.object.name !== "string" ||
    !actionAliases.has(callee.object.name)
  ) {
    return null
  }
  if (callee.property?.type !== "Identifier") return null
  if (callee.property.name === "get") return "GET"
  if (callee.property.name === "post") return "POST"
  return null
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
