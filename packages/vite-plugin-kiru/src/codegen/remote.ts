import { KIRU_SERVER_GLOBAL } from "../globals"
import { MagicString, TransformCTX } from "./shared"
import * as AST from "./ast"
type AstNode = AST.AstNode

interface FunctionMatch {
  node: AstNode
  name: string
}

export function prepareRemoteFunctions(ctx: TransformCTX) {
  const { code, isServer, ast } = ctx

  const bodyNodes = ast.body as AstNode[]

  const matches = findExportedNamedFunctions(bodyNodes)
  if (matches.length === 0) return

  if (isServer) {
    return server_performServerActionRegistrations(matches, code)
  }

  client_formatServerActionsFile(bodyNodes, matches, code)
}

function server_performServerActionRegistrations(
  matches: FunctionMatch[],
  code: MagicString
) {
  code.append(`const __$kiru_serverActions = {};\n`)
  for (const { name } of matches) {
    code.append(`__$kiru_serverActions["${name}"] = ${name};\n`)
  }
  code.append(
    `globalThis.__kiru_serverActions.register("${KIRU_SERVER_GLOBAL.route}", __$kiru_serverActions);\n`
  )
}

function client_formatServerActionsFile(
  bodyNodes: AstNode[],
  matches: FunctionMatch[],
  code: MagicString
) {
  code.prepend(
    `const __$r__ = "${KIRU_SERVER_GLOBAL.route}"; const __$d__ = globalThis.__kiru_serverActions.dispatch;\n`
  )
  bodyNodes.forEach((node) => {
    const match = matches.find((match) => match.node === node)
    if (!match) {
      code.overwrite(node.start, node.end, "")
      return
    }
    code.overwrite(
      node.start,
      node.end,
      `export async function ${match.name}() { return __$d__(\`\${__$r__}.${match.name}\`, ...arguments); }`
    )
  })
}

function findExportedNamedFunctions(bodyNodes: AstNode[]) {
  let i = 0
  const matches: FunctionMatch[] = []
  for (const node of bodyNodes) {
    if (
      node.type === "ExportNamedDeclaration" &&
      node.declaration?.type === "FunctionDeclaration"
    ) {
      matches.push({
        node,
        name: node.declaration.id?.name || `anonymous_fn_${i++}`,
      })
    }
  }
  return matches
}
