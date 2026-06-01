import type { ProgramNode } from "rollup"
import type { MagicString } from "./shared.js"
import type * as AST from "./ast.js"

type AstNode = AST.AstNode

const USE_DOM = "use dom"

function isUseDomLiteral(node: AstNode): boolean {
  if (node.type !== "ExpressionStatement") return false
  const expr = (node as { expression?: AstNode }).expression
  if (expr?.type !== "Literal") return false
  return expr.value === USE_DOM
}

/** First top-level `"use dom"` expression statement (may follow imports or HMR prologue). */
export function findUseDomPragmaStatement(ast: ProgramNode): AstNode | null {
  for (const stmt of ast.body as AstNode[]) {
    if (isUseDomLiteral(stmt)) return stmt
  }
  return null
}

export function hasUseDomPragma(ast: ProgramNode): boolean {
  return findUseDomPragmaStatement(ast) !== null
}

export function stripUseDomPragma(code: MagicString, ast: ProgramNode): void {
  const stmt = findUseDomPragmaStatement(ast)
  if (!stmt) return
  const end = stmt.end as number
  let removeEnd = end
  const src = code.original
  if (src[removeEnd] === "\r" && src[removeEnd + 1] === "\n") {
    removeEnd += 2
  } else if (src[removeEnd] === "\n") {
    removeEnd += 1
  }
  code.remove(stmt.start as number, removeEnd)
}
