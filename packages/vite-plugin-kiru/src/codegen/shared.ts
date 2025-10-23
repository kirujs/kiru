/**
 * We're now explicitly importing the CJS version of MagicString
 * in order to prevent pollution caused by the UMD version
 */

import type { ProgramNode } from "rollup"
import MagicString from "../../node_modules/magic-string/dist/magic-string.cjs"
import { FileLinkFormatter } from "../types"

export { MagicString }

import * as AST from "./ast"
type AstNode = AST.AstNode

export type TransformCTX = {
  log: (...data: any[]) => void
  code: MagicString
  ast: ProgramNode
  fileLinkFormatter: FileLinkFormatter
  isBuild: boolean
  filePath: string
}

export function createAliasHandler(name: string, namespace = "kiru") {
  const aliases = new Set<string>()

  const isMatchingCallExpression = (node: AstNode) =>
    node.type === "CallExpression" &&
    node.callee?.type === "Identifier" &&
    typeof node.callee.name === "string" &&
    aliases.has(node.callee.name)

  const addAliases = (node: AstNode): boolean => {
    if (node.source?.value !== namespace) return false
    let didAdd = false
    const specifiers = node.specifiers || []
    for (let i = 0; i < specifiers.length; i++) {
      const specifier = specifiers[i]
      if (
        specifier.imported &&
        specifier.imported.name === name &&
        !!specifier.local
      ) {
        aliases.add(specifier.local.name)
        didAdd = true
      }
    }
    return didAdd
  }
  return { name, aliases, addAliases, isMatchingCallExpression }
}

export function isComponent(node: AstNode, bodyNodes: AstNode[]): boolean {
  const isTlf = isTopLevelFunction(node, bodyNodes)
  if (!isTlf) return false
  const name = findNodeName(node)
  if (name === null) return false
  const charCode = name.charCodeAt(0)
  return charCode >= 65 && charCode <= 90
}

export function findNodeName(node: AstNode): string | null {
  if (node.id?.name) return node.id.name
  if (node.declaration?.id?.name) return node.declaration.id.name
  if (node.declaration?.declarations?.[0]?.id?.name)
    return node.declaration.declarations[0].id.name
  if (node.declarations?.[0]?.id?.name) return node.declarations[0].id.name
  return null
}

export function findFunctionBodyNodes(
  node: AstNode,
  name: string,
  bodyNodes: AstNode[]
): null | AstNode[] {
  let dec = node.declaration
  if (!dec) {
    for (const _node of bodyNodes) {
      if (_node.type === "VariableDeclaration") {
        if (_node.declarations?.[0]?.id?.name === name) {
          dec = _node
          break
        }
      } else if (_node.type === "FunctionDeclaration") {
        if (_node.id?.name === name) {
          dec = _node
          break
        }
      }
    }
  }
  if (!dec) {
    throw new Error(
      "[vite-plugin-kiru]: failed to find declaration for component"
    )
  }

  if (
    dec.type === "FunctionDeclaration" &&
    dec.body &&
    !Array.isArray(dec.body) &&
    dec.body.type === "BlockStatement"
  ) {
    return dec.body.body as AstNode[]
  } else if (dec.type === "VariableDeclaration") {
    if (!Array.isArray(dec.declarations)) {
      return null
    }
    for (const _dec of dec.declarations) {
      if (_dec.id?.name !== name) continue
      if (
        _dec.init?.type === "ArrowFunctionExpression" ||
        _dec.init?.type === "FunctionExpression"
      ) {
        return (_dec.init.body as AstNode).body as AstNode[]
      } else if (_dec.init?.type === "CallExpression" && _dec.init.arguments) {
        // accumulate argNodes that are functions and return JSX
        const nodes: AstNode[] = []
        for (const arg of _dec.init.arguments) {
          if (
            isFuncDecOrExpr(arg) &&
            arg.body &&
            !Array.isArray(arg.body) &&
            Array.isArray(arg.body.body)
          ) {
            nodes.push(...arg.body.body)
          }
        }
        return nodes
      }
    }
  }
  return null
}

function isFuncDecOrExpr(node: AstNode | undefined) {
  if (!node) return false
  if (node.type === "VariableDeclaration") {
    return isFuncDecOrExpr(node.declarations?.[0]?.init)
  }
  return [
    "FunctionDeclaration",
    "FunctionExpression",
    "ArrowFunctionExpression",
  ].includes(node.type)
}

function isTopLevelFunction(node: AstNode, bodyNodes: AstNode[]): boolean {
  if (isFuncDecOrExpr(node)) {
    return true
  }
  switch (node.type) {
    case "VariableDeclaration":
    case "ExportNamedDeclaration":
      if (node.declaration) {
        return isFuncDecOrExpr(node.declaration)
      } else if (node.declarations) {
        return !!AST.findNode(node, isFuncDecOrExpr)
      }
      const name = findNodeName(node)
      if (name === null) return false
      const dec = findFunctionBodyNodes(node, name, bodyNodes)
      if (!dec) return false
      return isFuncDecOrExpr(dec[0])
    case "ExportDefaultDeclaration":
      return isFuncDecOrExpr(node.declaration)
  }

  return false
}
