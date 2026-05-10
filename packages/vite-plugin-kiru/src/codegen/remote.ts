import path from "node:path"
import * as AST from "./ast.js"
import { MagicString, TransformCTX, createAliasHandler } from "./shared.js"

type AstNode = AST.AstNode

interface FunctionMatch {
  node: AstNode
  name: string
}

export function getRouteId(filePath: string, projectRoot: string): string {
  const normalizedFile = filePath.replace(/\\/g, "/")
  const normalizedRoot = projectRoot.replace(/\\/g, "/").replace(/\/+$/, "")
  const relativePath = normalizedFile.startsWith(normalizedRoot + "/")
    ? normalizedFile.slice(normalizedRoot.length + 1)
    : path.basename(normalizedFile)
  return relativePath.replace(/\.[^./]+$/, "")
}

export function prepareRemoteFunctions(
  ctx: TransformCTX,
  route: string,
  ssr: boolean
) {
  const { code, ast } = ctx
  const bodyNodes = ast.body as AstNode[]
  const actionHandler = createAliasHandler("action", "kiru/remote")
  for (const node of bodyNodes) {
    if (node.type === "ImportDeclaration") {
      actionHandler.addAliases(node)
    }
  }
  const matches = findExportedActionCalls(bodyNodes, actionHandler)
  if (matches.length === 0) return

  if (ssr) {
    serverRegisterRemoteFunctions(matches, code, route)
  } else {
    clientFormatRemoteFunctions(bodyNodes, matches, code, route)
  }
}

function clientFormatRemoteFunctions(
  bodyNodes: AstNode[],
  matches: FunctionMatch[],
  code: MagicString,
  route: string
) {
  code.prepend(
    `import { __kiruEnsureRemoteDispatch } from "kiru/ssr/router";\nconst __$r__ = ${JSON.stringify(
      route
    )};\nconst __$dispatch = () => __kiruEnsureRemoteDispatch();\n`
  )

  bodyNodes.forEach((node) => {
    const match = matches.find((entry) => entry.node === node)
    if (!match) {
      code.overwrite(node.start, node.end, "")
      return
    }
    code.overwrite(
      node.start,
      node.end,
      `export async function ${match.name}(input) { return __$dispatch()(\`\${__$r__}:${match.name}\`, input); }`
    )
  })
}

function serverRegisterRemoteFunctions(
  matches: FunctionMatch[],
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

function findExportedActionCalls(
  bodyNodes: AstNode[],
  actionHandler: {
    isMatchingCallExpression: (node: AstNode) => boolean
  }
) {
  const matches: FunctionMatch[] = []
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
    if (!init || !actionHandler.isMatchingCallExpression(init)) continue
    matches.push({
      node,
      name: declaration.id.name,
    })
  }
  return matches
}
