import { MagicString, TransformCTX } from "./shared"
import * as AST from "./ast"
type AstNode = AST.AstNode

interface FunctionMatch {
  node: AstNode
  name: string
}

export function prepareRemoteFunctions(ctx: TransformCTX) {
  const { filePath, code, isServer, ast } = ctx

  const bodyNodes = ast.body as AstNode[]

  const matches: FunctionMatch[] = []
  forEachExportedNamedFunction(bodyNodes, (match) => {
    matches.push(match)
  })

  if (matches.length === 0) return

  if (isServer) {
    return server_performServerActionRegistrations(matches, code, filePath)
  }

  client_formatServerActionsFile(bodyNodes, matches, code, filePath)
}

function server_performServerActionRegistrations(
  matches: FunctionMatch[],
  code: MagicString,
  filePath: string
) {
  code.append(`const __$kiru_serverActions = {};\n`)
  for (const { name } of matches) {
    code.append(`__$kiru_serverActions["${name}"] = ${name};\n`)
  }
  code.append(
    `globalThis.__kiru_serverActions.register("${filePath}", __$kiru_serverActions);\n`
  )
}

function client_formatServerActionsFile(
  bodyNodes: AstNode[],
  matches: FunctionMatch[],
  code: MagicString,
  filePath: string
) {
  code.prepend(
    `const __$fp__ = "${filePath}"; const __$dispatch__ = globalThis.__kiru_serverActions.dispatch;\n`
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
      `export async function ${match.name}() { return __$dispatch__(__$fp__, "${match.name}", ...arguments); }`
    )
  })
}

function forEachExportedNamedFunction(
  bodyNodes: AstNode[],
  callback: (match: { node: AstNode; name: string }) => void
) {
  let i = 0
  for (const node of bodyNodes) {
    if (
      node.type === "ExportNamedDeclaration" &&
      node.declaration?.type === "FunctionDeclaration"
    ) {
      callback({
        node,
        name: node.declaration.id?.name || `anonymous_fn_${i++}`,
      })
    }
  }
}
