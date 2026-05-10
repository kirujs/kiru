import path from "node:path"
import * as AST from "./ast.js"
import { MagicString, TransformCTX } from "./shared.js"

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
  const matches = findExportedNamedFunctions(bodyNodes)
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
      `export async function ${match.name}(input) { return __$dispatch()(\`\${__$r__}:${match.name}\`, arguments.length === 0 ? null : input); }`
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
      continue
    }
    if (
      node.type === "ExportNamedDeclaration" &&
      node.declaration?.type === "VariableDeclaration"
    ) {
      const declarations = node.declaration.declarations ?? []
      if (declarations.length !== 1) continue
      const declaration = declarations[0]
      if (declaration.type !== "VariableDeclarator") continue
      if (!declaration.id?.name) continue
      if (
        declaration.init?.type !== "CallExpression" ||
        declaration.init.callee?.type !== "Identifier" ||
        declaration.init.callee.name !== "action"
      ) {
        continue
      }
      matches.push({
        node,
        name: declaration.id.name,
      })
    }
  }
  return matches
}
