import path from "node:path"
import {
  createAliasHandler,
  isComponent,
  findNodeName,
  findFunctionBodyNodes,
  MagicString,
  TransformCTX,
} from "./shared"
import * as AST from "./ast"
import { ANSI } from "../ansi"
type AstNode = AST.AstNode

export function prepareHydrationBoundaries(ctx: TransformCTX): {
  extraModules: Record<string, string>
} {
  const { log, code, ast, filePath } = ctx

  const CWD = process.cwd().replace(/\\/g, "/")
  const folderPath = filePath
    .replace(/\\/g, "/")
    .split("/")
    .slice(0, -1)
    .join("/")
  const modulePrefix = filePath
    .replace("+", "")
    .split(".")
    .slice(0, -1)
    .join("")
    .replace(CWD, "")
    .split("/")
    .filter(Boolean)
    .join("_")
  const extraModules: Record<string, string> = {}
  const bodyNodes = ast.body as AstNode[]
  const hydrationBoundaryAliasHandler = createAliasHandler(
    "Experimental_HydrationBoundary",
    "kiru/ssr"
  )
  const importNodes: AstNode[] = []

  for (const node of ast.body as AstNode[]) {
    if (node.type === "ImportDeclaration") {
      if (hydrationBoundaryAliasHandler.addAliases(node)) {
        continue
      }
      importNodes.push(node)
      continue
    }
    if (!isComponent(node, bodyNodes)) continue

    const componentName = findNodeName(node)
    if (componentName === null) {
      log(
        ANSI.red(
          "unable to prepare hydration boundaries (failed to find component name)"
        ),
        node.type,
        node.start
      )
      continue
    }
    const componentBodyNodes = findFunctionBodyNodes(
      node,
      componentName,
      bodyNodes
    )
    type ExpressionEntry = {
      node: AstNode
      property: AstNode | null
    }
    let currentBoundary: {
      id: string
      node: AstNode
      deps: {
        imports: Set<AstNode>
        expressions: Array<ExpressionEntry>
      }
      hasJsxChildren: boolean
    } | null = null

    type BlockScope = Map<string, AstNode>
    const globalVars = new Map<string, AstNode>(
      importNodes.reduce<Array<[string, AstNode]>>((acc, item) => {
        const entries: Array<[string, AstNode]> = item.specifiers!.map(
          (s) => [s.local!.name, s] as const
        )
        return [...acc, ...entries]
      }, [])
    )
    const blockScopes: BlockScope[] = [
      // global scope
      globalVars,
      // function scope
      new Map(globalVars),
    ]

    let index = 0
    const fnExprs: AstNode[] = []
    componentBodyNodes?.forEach((node) => {
      AST.walk(node, {
        // ReturnStatement: (n) => {
        //   log(JSON.stringify(n, null, 2))
        // },
        // capture variables encountered outside of boundary scopes
        VariableDeclarator: (n) => {
          if (currentBoundary) return
          blockScopes[blockScopes.length - 1].set(n.id?.name!, n)
        },
        BlockStatement: () => {
          if (currentBoundary) return
          const parentScope = blockScopes[blockScopes.length - 1]
          blockScopes.push(new Map(parentScope))
          return () => blockScopes.pop()
        },
        // find jsx props, hoist non-literal values
        ObjectExpression: (n, ctx) => {
          const boundary = currentBoundary
          if (!boundary) return
          const parent = ctx.stack[ctx.stack.length - 1]

          const isParentJSX =
            parent.type === "CallExpression" && parent.callee?.name === "_jsx"
          if (!isParentJSX) return
          // prevent operating on boundary props
          if (parent === currentBoundary?.node) return

          const nonLiteralProperties =
            n.properties?.filter(
              (p) =>
                typeof p.value === "object" &&
                (p.value as AstNode).type !== "Literal"
            ) ?? []

          nonLiteralProperties.forEach((p) => {
            boundary.deps.expressions.push({
              node: (p.value as AstNode)!,
              property: p,
            })
          })
          ctx.exitBranch() // prevent touching anything further here
        },
        MemberExpression: (n) => {
          if (!currentBoundary || !n.object?.name) return
          const parentScope = blockScopes[blockScopes.length - 1]
          const variableFromParentScope = parentScope.get(n.object.name)
          if (variableFromParentScope) {
            currentBoundary.deps.expressions.push({
              node: n,
              property: null,
            })
          }
        },
        BinaryExpression: (n, ctx) => {
          if (!currentBoundary) return
          const isHoistRequired = AST.findNode(
            n,
            (node) =>
              node !== n &&
              node.type !== "Literal" &&
              node.type !== "BinaryExpression"
          )
          if (!isHoistRequired) return
          // TODO: if there are only literals, do nothing
          currentBoundary.deps.expressions.push({
            node: n,
            property: null,
          })
          ctx.exitBranch()
        },
        ["*"]: (n, ctx) => {
          // ensure we've entered a JSX block inside a boundary
          if (!currentBoundary?.hasJsxChildren) return

          switch (n.type) {
            case "ArrowFunctionExpression":
            case "FunctionExpression": {
              fnExprs.push(n)
              return () => fnExprs.pop()
            }
            case "Identifier": {
              // skip identifiers inside function expressions, the fn expression will be hoisted
              if (fnExprs.length) return
              // skip jsx identifiers
              if (n.name === "_jsx") return

              // log("identifier", n.name)

              const parentCallExpression = findFirstParentOfType(
                ctx.stack,
                "CallExpression"
              )

              if (
                parentCallExpression &&
                parentCallExpression.callee?.name !== "_jsx"
              ) {
                // add the call expr instead of the identifier
                currentBoundary.deps.expressions.push({
                  node: parentCallExpression,
                  property: null,
                })
                return
              }

              if (ctx.stack[ctx.stack.length - 1].type === "MemberExpression") {
                const exprRoot = findLastConsecutiveParentOfType(
                  ctx.stack,
                  "MemberExpression"
                )
                if (exprRoot?.type !== "MemberExpression") return
                currentBoundary.deps.expressions.push({
                  node: exprRoot,
                  property: null,
                })
                return
              }

              const importNode = importNodes.find((importNode) =>
                importNode.specifiers?.some((s) => s.local?.name === n.name)
              )
              if (importNode) {
                currentBoundary.deps.imports.add(importNode)
              } else {
                currentBoundary.deps.expressions.push({
                  node: n,
                  property: null,
                })
              }
              return
            }
          }
          return
        },
        CallExpression: (n) => {
          if (n.callee?.type !== "Identifier" || n.callee.name !== "_jsx") {
            return
          }
          if (currentBoundary) {
            currentBoundary.hasJsxChildren = true
            return
          }

          const [nodeType, _, ...children] = n.arguments!

          if (
            nodeType.type === "Identifier" &&
            nodeType.name &&
            hydrationBoundaryAliasHandler.aliases.has(nodeType.name)
          ) {
            const idx = index++
            const boundary = (currentBoundary = {
              id: `@boundaries/${modulePrefix}/${componentName}_${idx}`,
              node: n,
              deps: {
                imports: new Set<AstNode>(),
                expressions: [] as ExpressionEntry[],
              },
              hasJsxChildren: false,
            })
            return () => {
              if (!boundary.hasJsxChildren) return
              // log(
              //   "boundary - finalization",
              //   boundary.deps.expressions,
              //   boundary.deps.imports
              // )

              // create virtual modules
              const childExprStart = Math.min(...children.map((n) => n.start!))
              const childExprEnd = Math.max(...children.map((n) => n.end!))
              const childrenExpr = new MagicString(
                code.original.substring(childExprStart, childExprEnd)
              )

              transformChildExpression: {
                for (let i = 0; i < boundary.deps.expressions.length; i++) {
                  const { node: expr, property } = boundary.deps.expressions[i]
                  const start = expr.start! - childExprStart
                  const end = expr.end! - childExprStart
                  if (!property) {
                    childrenExpr.update(start, end, `_props[${i}]`)
                    continue
                  }
                  if (!property.shorthand) {
                    // just replace rhs
                    childrenExpr.update(start, end, `_props[${i}]`)
                    continue
                  }
                  childrenExpr.appendLeft(end, `: _props[${i}]`)
                }
              }

              let moduleCode = `\nimport {createElement as _jsx, Fragment as _jsxFragment} from "kiru";\n`
              copyImports: {
                for (const importedIdentifier of boundary.deps.imports) {
                  const importPath = importedIdentifier.source!.value
                  const isRelative =
                    importPath[0] === "." || importPath[0] === "/"

                  const defaultSpecifier = importedIdentifier.specifiers!.find(
                    (s) => s.type === "ImportDefaultSpecifier"
                  )
                  const nonDefaults = importedIdentifier.specifiers!.filter(
                    (s) => s !== defaultSpecifier
                  )

                  let importStr = "import "

                  if (defaultSpecifier) {
                    importStr += defaultSpecifier.local?.name
                  }

                  if (nonDefaults.length) {
                    if (defaultSpecifier) {
                      importStr += ", "
                    }
                    const names = nonDefaults
                      .map((s) => s.local?.name)
                      .join(", ")
                    importStr += `{ ${names} }`
                  }

                  if (isRelative) {
                    importStr += ` from "${path
                      .resolve(folderPath, importPath)
                      .replace(/\\/g, "/")}";`
                  } else {
                    importStr += ` from "${importPath}";`
                  }

                  moduleCode += `${importStr}\n`
                }
              }

              addModules: {
                moduleCode += `\n\nexport default function BoundaryChildren({_props}) {
                  return _jsx(_jsxFragment, null, ${childrenExpr})
                  }`
                const boundaryChildrenName = `BoundaryChildren_${componentName}_${idx}`
                code.prepend(
                  `\nimport ${boundaryChildrenName} from "${
                    boundary.id + "_loader"
                  }";\n`
                )
                const props = boundary.deps.expressions
                  .map((expr) =>
                    code.original.slice(expr.node.start!, expr.node.end!)
                  )
                  .join(",\n")

                code.update(
                  childExprStart,
                  childExprEnd,
                  `_jsx(${boundaryChildrenName}, { _props: [${props}] })`
                )

                extraModules[boundary.id] = moduleCode
                extraModules[
                  boundary.id + "_loader"
                ] = `import {lazy} from "kiru";
const BoundaryChildrenLoader = lazy(() => import("${boundary.id}"));
export default BoundaryChildrenLoader;`
                currentBoundary = null
              }
            }
          }
          return
        },
      })
    })
  }
  return { extraModules }
}

function findFirstParentOfType(stack: AstNode[], type: AstNode["type"]) {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].type === type) {
      return stack[i]
    }
  }
  return null
}

function findLastConsecutiveParentOfType(
  stack: AstNode[],
  type: AstNode["type"]
) {
  let last: AstNode | null = null
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].type !== type) {
      return last
    }
    last = stack[i]
  }
  return last
}
