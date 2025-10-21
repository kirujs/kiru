import { createAliasHandler, MagicString, TransformCTX } from "./shared"
import { ProgramNode } from "rollup"
import * as AST from "./ast"
type AstNode = AST.AstNode

export function prepareDevOnlyHooks(ctx: TransformCTX) {
  const { code, ast, isBuild } = ctx
  replaceOnHMRCallbacks(code, ast, isBuild)
}

const VITE_IMPORT_META_HOT_ACCEPT = `if ("window" in globalThis) {
  if (import.meta.hot) {
    import.meta.hot.accept(%);
  }           
}`

function replaceOnHMRCallbacks(
  code: MagicString,
  ast: ProgramNode,
  isBuild: boolean
) {
  const onHMRAliasHandler = createAliasHandler("onHMR", "vite-plugin-kiru")

  for (const node of ast.body as AstNode[]) {
    if (node.type === "ImportDeclaration") {
      if (onHMRAliasHandler.addAliases(node) && isBuild) {
        code.update(node.start, node.end, "")
      }
      continue
    }

    AST.walk(node, {
      CallExpression: (node, ctx) => {
        if (onHMRAliasHandler.isMatchingCallExpression(node)) {
          try {
            if (isBuild) {
              code.update(node.start, node.end, "")
              return
            }
            const callback = node.arguments![0]
            const callbackRaw = code.original.substring(
              callback.start,
              callback.end
            )
            code.update(
              node.start,
              node.end,
              VITE_IMPORT_META_HOT_ACCEPT.replace("%", callbackRaw)
            )
          } finally {
            ctx.exitBranch()
          }
        }
      },
    })
  }
}
