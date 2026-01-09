import * as AST from "./ast"
import { TransformCTX, createAliasHandler } from "./shared"
type AstNode = AST.AstNode

type Hoistable = {
  node: AstNode
  code: string
  varName: string
}

// Identifiers that are known to be module-level static values
let staticHoistableIds = new Set<string>()

export function prepareJSXHoisting(ctx: TransformCTX) {
  const { code, ast } = ctx

  // Track _jsx and _jsxFragment aliases
  const createElement = createAliasHandler("createElement")
  const fragment = createAliasHandler("Fragment")
  const memo = createAliasHandler("memo")

  // Find imports to track aliases
  const bodyNodes = ast.body as AstNode[]

  for (const node of bodyNodes) {
    if (node.type === "ImportDeclaration") {
      ;[createElement, fragment, memo].forEach((handler) => {
        handler.addAliases(node)
      })
    }
  }

  let counter = 0

  // Track which nodes are hoistable (to avoid double-hoisting)
  const hoistableSet = new Set<AstNode>()

  // Reset static identifier set for this file
  staticHoistableIds.clear()

  // Pre-pass: collect module-level static identifiers
  for (const node of bodyNodes) {
    if (node.type !== "VariableDeclaration") continue
    const kind = (node as any).kind
    // Only consider top-level consts for now
    if (kind !== "const") continue

    const declarations = (node as any).declarations || []
    for (const decl of declarations as AstNode[]) {
      if (decl.type !== "VariableDeclarator") continue
      const id = (decl as any).id as AstNode | undefined
      if (!id || id.type !== "Identifier" || !id.name) continue

      const init = (decl as any).init as AstNode | undefined
      if (!init) continue

      // Consider static literals or static JSX/_jsx calls as static values
      let isStatic = false
      if (isStaticLiteral(init)) {
        isStatic = true
      } else if (
        init.type === "CallExpression" &&
        isHoistableSubtree(init, createElement.aliases, fragment.aliases)
      ) {
        isStatic = true
      }

      if (isStatic) {
        staticHoistableIds.add(id.name)
      }
    }
  }

  // First pass: identify all hoistable nodes
  for (const node of bodyNodes) {
    // if (!isComponent(node, bodyNodes)) {
    //   console.log("[vite-plugin-kiru]: skipping non-component", node)
    //   continue
    // }

    // const body = getComponentBody(node, bodyNodes)
    // if (!body) continue

    const candidateNodes: AstNode[] = []
    function pushCandidate(node: AstNode) {
      candidateNodes.push(node)
      console.log("[vite-plugin-kiru]: pushing candidate", node)
    }
    let fnDepth = 0
    const FunctionDepthTracker = () => {
      fnDepth++
      return () => fnDepth--
    }
    AST.walk(node, {
      FunctionDeclaration: FunctionDepthTracker,
      FunctionExpression: FunctionDepthTracker,
      ArrowFunctionExpression: FunctionDepthTracker,
      CallExpression: (callNode) => {
        if (fnDepth === 0) return
        const callee = callNode.callee

        // Collect _jsx calls
        if (createElement.isMatchingCallExpression(callNode)) {
          pushCandidate(callNode)
          // Also check children for static expressions
          const childrenArgs = callNode.arguments?.slice(2) || []
          for (const child of childrenArgs) {
            // Collect BinaryExpressions, UnaryExpressions, ConditionalExpressions, and LogicalExpressions
            if (
              child.type === "BinaryExpression" ||
              child.type === "UnaryExpression" ||
              child.type === "ConditionalExpression" ||
              child.type === "LogicalExpression"
            ) {
              pushCandidate(child)
              // Also collect nested CallExpressions/MemberExpressions from the expression
              collectNestedOperations(child, candidateNodes)
            }
            // Also check for static array literals
            if (child.type === "ArrayExpression" && isStaticLiteral(child)) {
              pushCandidate(child)
            }
            // Also check for static object literals
            if (child.type === "ObjectExpression" && isStaticLiteral(child)) {
              pushCandidate(child)
            }
          }
          return
        }

        // Collect method calls on static inline-created sources or chained calls
        if (callee?.type === "MemberExpression") {
          const obj = callee.object
          // Check if object is a static inline-created array/object OR a CallExpression/MemberExpression (chained)
          if (
            obj?.type === "ArrayExpression" ||
            obj?.type === "ObjectExpression" ||
            obj?.type === "CallExpression" ||
            obj?.type === "MemberExpression"
          ) {
            pushCandidate(callNode)
          }
        }
      },
      MemberExpression: (memberNode) => {
        if (fnDepth === 0) return
        // Only collect MemberExpressions that are NOT part of a CallExpression
        // (i.e., property access like { foo: 123 }.foo, not method calls)
        // We'll handle method calls via CallExpression above
        const obj = memberNode.object
        if (
          obj?.type === "ArrayExpression" ||
          obj?.type === "ObjectExpression"
        ) {
          // Check if this MemberExpression is the callee of a CallExpression
          // If so, we'll handle it via the CallExpression, not here
          pushCandidate(memberNode)
        }
      },
    })

    // Process candidates bottom-up (reverse order)
    // Multiple passes to ensure dependencies are resolved
    let changed = true
    while (changed) {
      changed = false
      for (let i = candidateNodes.length - 1; i >= 0; i--) {
        const node = candidateNodes[i]
        if (hoistableSet.has(node)) continue

        if (node.type === "CallExpression") {
          const callee = node.callee
          // Check if it's a method call on static source
          if (callee?.type === "MemberExpression") {
            if (
              isHoistableStaticOperation(
                node,
                createElement.aliases,
                fragment.aliases,
                hoistableSet
              )
            ) {
              hoistableSet.add(node)
              changed = true
            }
          } else {
            // Check if it's a _jsx call
            if (
              isHoistableSubtree(
                node,
                createElement.aliases,
                fragment.aliases,
                hoistableSet
              )
            ) {
              hoistableSet.add(node)
              changed = true
            }
          }
        } else if (node.type === "MemberExpression") {
          // Check if it's property access on static source
          if (
            isHoistableStaticOperation(
              node,
              createElement.aliases,
              fragment.aliases,
              hoistableSet
            )
          ) {
            hoistableSet.add(node)
            changed = true
          }
        } else if (node.type === "ArrayExpression") {
          // Check if it's a static array literal
          if (isStaticLiteral(node)) {
            hoistableSet.add(node)
            changed = true
          }
        } else if (node.type === "ObjectExpression") {
          // Check if it's a static object literal
          if (isStaticLiteral(node)) {
            hoistableSet.add(node)
            changed = true
          }
        } else {
          // Check if it's a static expression (BinaryExpression, etc.)
          if (
            isHoistableStaticExpression(
              node,
              createElement.aliases,
              fragment.aliases,
              hoistableSet
            )
          ) {
            hoistableSet.add(node)
            changed = true
          }
        }
      }
    }
  }

  // Second pass: collect all hoistables across all components
  const allHoistables: Hoistable[] = []

  for (const node of bodyNodes) {
    // if (!isComponent(node, bodyNodes)) continue

    // const body = getComponentBody(node, bodyNodes)
    // if (!body) continue

    AST.walk(node, {
      CallExpression: (callNode, walkCtx) => {
        if (!hoistableSet.has(callNode)) return

        const varName = `$k${counter++}`
        allHoistables.push({
          node: callNode,
          code: code.original.substring(callNode.start, callNode.end),
          varName,
        })

        walkCtx.exitBranch()
      },
      MemberExpression: (memberNode, walkCtx) => {
        if (!hoistableSet.has(memberNode)) return

        // Don't hoist MemberExpressions that are callees of CallExpressions
        // (method calls should be hoisted as CallExpressions, not MemberExpressions)
        // Check if parent is a CallExpression with this as callee
        const stack = (walkCtx as any).stack || []
        if (stack.length > 0) {
          const parent = stack[stack.length - 1]
          if (
            parent?.type === "CallExpression" &&
            parent.callee === memberNode
          ) {
            // This MemberExpression is a callee - only hoist if the CallExpression is also hoistable
            if (!hoistableSet.has(parent)) {
              return
            }
          }
        }

        const varName = `$k${counter++}`
        allHoistables.push({
          node: memberNode,
          code: code.original.substring(memberNode.start, memberNode.end),
          varName,
        })

        walkCtx.exitBranch()
      },
      BinaryExpression: (binaryNode, walkCtx) => {
        if (!hoistableSet.has(binaryNode)) return

        const varName = `$k${counter++}`
        allHoistables.push({
          node: binaryNode,
          code: code.original.substring(binaryNode.start, binaryNode.end),
          varName,
        })

        walkCtx.exitBranch()
      },
      ConditionalExpression: (conditionalNode, walkCtx) => {
        if (!hoistableSet.has(conditionalNode)) return

        const varName = `$k${counter++}`
        allHoistables.push({
          node: conditionalNode,
          code: code.original.substring(
            conditionalNode.start,
            conditionalNode.end
          ),
          varName,
        })

        walkCtx.exitBranch()
      },
      LogicalExpression: (logicalNode, walkCtx) => {
        if (!hoistableSet.has(logicalNode)) return

        const varName = `$k${counter++}`
        allHoistables.push({
          node: logicalNode,
          code: code.original.substring(logicalNode.start, logicalNode.end),
          varName,
        })

        walkCtx.exitBranch()
      },
      ArrayExpression: (arrayNode, walkCtx) => {
        if (!hoistableSet.has(arrayNode)) return

        const varName = `$k${counter++}`
        allHoistables.push({
          node: arrayNode,
          code: code.original.substring(arrayNode.start, arrayNode.end),
          varName,
        })

        walkCtx.exitBranch()
      },
      ObjectExpression: (objectNode, walkCtx) => {
        if (!hoistableSet.has(objectNode)) return

        const varName = `$k${counter++}`
        allHoistables.push({
          node: objectNode,
          code: code.original.substring(objectNode.start, objectNode.end),
          varName,
        })

        walkCtx.exitBranch()
      },
    })
  }

  if (allHoistables.length === 0) return

  // Generate hoisted declarations
  const declarations =
    allHoistables.length === 1
      ? `const ${allHoistables[0].varName} = ${allHoistables[0].code}`
      : allHoistables
          .map((h, i) =>
            i === 0
              ? `const ${h.varName} = ${h.code}`
              : `  ${h.varName} = ${h.code}`
          )
          .join(",\n")

  // Insert at the end of the code
  code.append(`\n${declarations}\n`)

  // Replace in reverse order to maintain positions
  for (let i = allHoistables.length - 1; i >= 0; i--) {
    const h = allHoistables[i]
    code.update(h.node.start, h.node.end, h.varName)
  }
}

function isHoistableStaticOperation(
  node: AstNode,
  jsxAliases: Set<string>,
  fragmentAliases: Set<string>,
  hoistableSet: Set<AstNode>
): boolean {
  let memberExpr: AstNode
  let isCall = false

  if (node.type === "CallExpression") {
    const callee = node.callee
    if (callee?.type !== "MemberExpression") return false
    memberExpr = callee
    isCall = true
  } else if (node.type === "MemberExpression") {
    memberExpr = node
    isCall = false
  } else {
    return false
  }

  const obj = memberExpr.object
  if (!obj) return false

  // Verify: source is created inline and is static, OR is a hoistable expression
  let isStaticSource = false

  if (obj.type === "ArrayExpression") {
    const elements = (obj as any).elements || []
    isStaticSource = elements.every((elem: AstNode | null) => {
      if (!elem) return true // sparse array holes
      return isStaticLiteral(elem)
    })
  } else if (obj.type === "ObjectExpression") {
    const objNode = obj as AstNode
    const properties = objNode.properties || []
    isStaticSource = properties.every((prop: AstNode) => {
      if (prop.type !== "Property") return false
      return isStaticLiteral(prop.value as AstNode)
    })
  } else if (obj.type === "CallExpression" || obj.type === "MemberExpression") {
    // Chained call - check if the previous operation is hoistable
    const objNode = obj as AstNode
    if (hoistableSet.has(objNode)) {
      isStaticSource = true
    } else {
      // Recursively check if the object expression is hoistable
      // Temporarily add to set to avoid infinite recursion
      hoistableSet.add(objNode)
      isStaticSource = isHoistableStaticOperation(
        objNode,
        jsxAliases,
        fragmentAliases,
        hoistableSet
      )
      // Remove if not actually hoistable
      if (!isStaticSource) {
        hoistableSet.delete(objNode)
      }
    }
  }

  if (!isStaticSource) return false

  // Handle property access (e.g., { foo: 123 }.foo)
  if (!isCall) {
    const prop = memberExpr.property
    if (prop?.type === "Identifier" && prop.name) {
      // Property access on static object - always hoistable
      return true
    }
    return false
  }

  // Handle method calls - check if all arguments are static
  const callNode = node as AstNode & { arguments?: AstNode[] }
  const args = callNode.arguments || []

  // If no arguments, it's hoistable (static source + no dynamic args)
  if (args.length === 0) return true

  // Check first argument - if it's a function, verify it produces static results
  const firstArg = args[0]
  if (
    firstArg.type === "ArrowFunctionExpression" ||
    firstArg.type === "FunctionExpression"
  ) {
    // Get the parameter name(s)
    const params = (firstArg as any).params || []
    if (params.length === 0) return false

    // Collect all parameter names
    const paramNames = new Set<string>()
    for (const param of params) {
      if (param.type === "Identifier" && param.name) {
        paramNames.add(param.name)
      }
    }
    if (paramNames.size === 0) return false

    // Check if body returns statically-derived result (JSX or static value)
    const body = (firstArg as any).body
    if (!body) return false

    if (Array.isArray(body)) return false

    const bodyNode = body as AstNode
    let callbackResult = false

    if (bodyNode.type === "BlockStatement") {
      // Find return statement
      const statements = (bodyNode as any).body || []
      if (statements.length !== 1) return false
      const stmt = statements[0] as AstNode
      if (stmt.type !== "ReturnStatement" || !(stmt as any).argument)
        return false
      const returnValue = (stmt as any).argument as AstNode
      // Check if returns JSX or static value (using first param for JSX, all params for value)
      const firstParamName = Array.from(paramNames)[0]
      callbackResult =
        isStaticallyDerivedJSX(
          returnValue,
          firstParamName,
          jsxAliases,
          fragmentAliases,
          hoistableSet
        ) || isStaticallyDerivedValueMultiParam(returnValue, paramNames)
    } else {
      // Expression body
      const firstParamName = Array.from(paramNames)[0]
      callbackResult =
        isStaticallyDerivedJSX(
          bodyNode,
          firstParamName,
          jsxAliases,
          fragmentAliases,
          hoistableSet
        ) || isStaticallyDerivedValueMultiParam(bodyNode, paramNames)
    }

    // Also check remaining arguments are static
    return callbackResult && args.slice(1).every((arg) => isStaticLiteral(arg))
  }

  // Non-function arguments - all must be static
  return args.every((arg) => isStaticLiteral(arg))
}

// Check if props are statically derived (only use parameter + literals)
function isStaticallyDerivedProps(
  propsArg: AstNode | undefined | null,
  paramName: string
): boolean {
  if (!propsArg) return true

  if (propsArg.type === "Literal") {
    return propsArg.value === null || propsArg.value === undefined
  }

  if (propsArg.type === "ObjectExpression") {
    const props = propsArg.properties || []
    if (props.length === 0) return true

    for (const prop of props) {
      if (prop.type !== "Property") return false
      if (!isStaticallyDerivedValue(prop.value as AstNode, paramName)) {
        return false
      }
    }
    return true
  }

  return false
}

// Check if a value is statically derived (only uses parameters + literals)
function isStaticallyDerivedValueMultiParam(
  node: AstNode,
  paramNames: Set<string>
): boolean {
  if (!node) return true

  switch (node.type) {
    case "Literal":
      return true
    case "Identifier":
      // Only allow if it's one of the parameters
      return node.name ? paramNames.has(node.name) : false
    case "BinaryExpression":
      return (
        isStaticallyDerivedValueMultiParam(node.left as AstNode, paramNames) &&
        isStaticallyDerivedValueMultiParam(node.right as AstNode, paramNames)
      )
    case "UnaryExpression":
      return isStaticallyDerivedValueMultiParam(
        (node as any).argument as AstNode,
        paramNames
      )
    case "MemberExpression":
      // Allow property access on a parameter (e.g., item.name)
      const obj = node.object
      if (obj?.type === "Identifier" && obj.name && paramNames.has(obj.name)) {
        return true
      }
      return false
    default:
      return false
  }
}

// Check if a value is statically derived (only uses parameter + literals)
function isStaticallyDerivedValue(node: AstNode, paramName: string): boolean {
  return isStaticallyDerivedValueMultiParam(node, new Set([paramName]))
}

function isStaticallyDerivedJSX(
  node: AstNode,
  paramName: string,
  jsxAliases: Set<string>,
  fragmentAliases: Set<string>,
  hoistableSet: Set<AstNode>
): boolean {
  // Must be a _jsx call
  if (node.type !== "CallExpression") return false

  const callee = node.callee
  if (
    callee?.type !== "Identifier" ||
    !callee.name ||
    !jsxAliases.has(callee.name)
  ) {
    return false
  }

  const propsArg = node.arguments?.[1]
  // Props must be statically derived (only use parameter + literals)
  if (!isStaticallyDerivedProps(propsArg, paramName)) {
    return false
  }

  // Check children - they can only use the param in a static way
  const childrenArgs = node.arguments?.slice(2) || []
  for (const child of childrenArgs) {
    if (child.type === "Identifier") {
      // Only allow if it's the param itself (used directly)
      if (child.name !== paramName) {
        return false
      }
      continue
    }

    if (child.type === "CallExpression") {
      const childCallee = child.callee
      if (
        childCallee?.type === "Identifier" &&
        childCallee.name &&
        jsxAliases.has(childCallee.name)
      ) {
        // Nested JSX - check if it's statically derived
        if (hoistableSet.has(child)) {
          continue
        }
        if (
          isStaticallyDerivedJSX(
            child,
            paramName,
            jsxAliases,
            fragmentAliases,
            hoistableSet
          )
        ) {
          hoistableSet.add(child)
          continue
        }
        return false
      }
    }

    // Other expressions are not allowed (they might use the param in non-static ways)
    if (!isStaticValue(child)) {
      return false
    }
  }

  return true
}

function isHoistableSubtree(
  callNode: AstNode,
  jsxAliases: Set<string>,
  fragmentAliases: Set<string>,
  hoistableSet?: Set<AstNode>
): boolean {
  const callee = callNode.callee
  if (
    callee?.type !== "Identifier" ||
    !callee.name ||
    !jsxAliases.has(callee.name)
  ) {
    return false
  }

  const typeArg = callNode.arguments?.[0]
  if (!typeArg) return false

  const propsArg = callNode.arguments?.[1]
  // Props must be static (only literals, no identifiers/variables)
  if (!isHoistablePropsStatic(propsArg)) {
    return false
  }

  // Check children - they must all be static or hoistable
  const childrenArgs = callNode.arguments?.slice(2) || []
  for (const child of childrenArgs) {
    // If child is a hoistable JSX node, it's fine (will be hoisted separately)
    if (child.type === "CallExpression") {
      const childCallee = child.callee
      if (
        childCallee?.type === "Identifier" &&
        childCallee.name &&
        jsxAliases.has(childCallee.name)
      ) {
        // If already marked as hoistable, it's fine
        if (hoistableSet?.has(child)) {
          continue
        }
        // Check if this child is hoistable
        if (
          isHoistableSubtree(child, jsxAliases, fragmentAliases, hoistableSet)
        ) {
          hoistableSet?.add(child)
          continue
        }
        // If child JSX is not hoistable, this node can't be hoisted
        return false
      }
    }

    // Check if child is static (literal, static identifier, etc.)
    if (!isStaticChild(child)) {
      return false
    }
  }

  return true
}

function collectNestedOperations(node: AstNode, candidates: AstNode[]) {
  if (!node) return

  switch (node.type) {
    case "BinaryExpression":
      collectNestedOperations(node.left as AstNode, candidates)
      collectNestedOperations(node.right as AstNode, candidates)
      break
    case "UnaryExpression":
      collectNestedOperations((node as any).argument as AstNode, candidates)
      break
    case "ConditionalExpression":
      collectNestedOperations((node as any).test as AstNode, candidates)
      collectNestedOperations((node as any).consequent as AstNode, candidates)
      collectNestedOperations((node as any).alternate as AstNode, candidates)
      break
    case "LogicalExpression":
      collectNestedOperations((node as any).left as AstNode, candidates)
      collectNestedOperations((node as any).right as AstNode, candidates)
      break
    case "CallExpression":
    case "MemberExpression":
      // Collect method calls on static sources
      candidates.push(node)
      break
  }
}

function isHoistableStaticExpression(
  node: AstNode,
  jsxAliases?: Set<string>,
  fragmentAliases?: Set<string>,
  hoistableSet?: Set<AstNode>
): boolean {
  if (!node) return false

  switch (node.type) {
    case "BinaryExpression":
      return (
        isHoistableStaticExpression(
          node.left as AstNode,
          jsxAliases,
          fragmentAliases,
          hoistableSet
        ) &&
        isHoistableStaticExpression(
          node.right as AstNode,
          jsxAliases,
          fragmentAliases,
          hoistableSet
        )
      )
    case "UnaryExpression":
      return isHoistableStaticExpression(
        (node as any).argument as AstNode,
        jsxAliases,
        fragmentAliases,
        hoistableSet
      )
    case "ConditionalExpression":
      // Check if test, consequent, and alternate are all static
      return (
        isHoistableStaticExpression(
          (node as any).test as AstNode,
          jsxAliases,
          fragmentAliases,
          hoistableSet
        ) &&
        isHoistableStaticExpression(
          (node as any).consequent as AstNode,
          jsxAliases,
          fragmentAliases,
          hoistableSet
        ) &&
        isHoistableStaticExpression(
          (node as any).alternate as AstNode,
          jsxAliases,
          fragmentAliases,
          hoistableSet
        )
      )
    case "LogicalExpression":
      // Check if left and right operands are both static
      return (
        isHoistableStaticExpression(
          (node as any).left as AstNode,
          jsxAliases,
          fragmentAliases,
          hoistableSet
        ) &&
        isHoistableStaticExpression(
          (node as any).right as AstNode,
          jsxAliases,
          fragmentAliases,
          hoistableSet
        )
      )
    case "Literal":
      return true
    case "ArrayExpression":
      // Check if it's a static array literal
      return isStaticLiteral(node)
    case "ObjectExpression":
      // Check if it's a static object literal
      return isStaticLiteral(node)
    case "CallExpression":
    case "MemberExpression":
      // Check if it's a hoistable static operation (like [1,2,3].reduce(...))
      if (jsxAliases && fragmentAliases && hoistableSet) {
        if (hoistableSet.has(node)) return true
        const isHoistable = isHoistableStaticOperation(
          node,
          jsxAliases,
          fragmentAliases,
          hoistableSet
        )
        if (isHoistable) {
          hoistableSet.add(node)
        }
        return isHoistable
      }
      return false
    default:
      return false
  }
}

function isStaticChild(node: AstNode): boolean {
  if (!node) return true

  switch (node.type) {
    case "Literal":
      return true
    case "Identifier":
      // Treat identifiers that are known module-level statics as static children
      if (node.name && staticHoistableIds.has(node.name)) {
        return true
      }
      // Other identifiers (like {children}, {count}, etc.) are dynamic
      return false
    case "ArrayExpression": {
      const elems = node.expressions || []
      return elems.every((e) => isStaticChild(e as AstNode))
    }
    case "ObjectExpression": {
      const props = node.properties || []
      return props.every((p) => {
        if (p.type !== "Property") return false
        return isStaticChild(p.value as AstNode)
      })
    }
    case "BinaryExpression":
      return (
        isStaticChild(node.left as AstNode) &&
        isStaticChild(node.right as AstNode)
      )
    case "ConditionalExpression":
      // Check if test, consequent, and alternate are all static
      return (
        isStaticChild((node as any).test as AstNode) &&
        isStaticChild((node as any).consequent as AstNode) &&
        isStaticChild((node as any).alternate as AstNode)
      )
    case "LogicalExpression":
      // Check if left and right operands are both static
      return (
        isStaticChild((node as any).left as AstNode) &&
        isStaticChild((node as any).right as AstNode)
      )
    case "TemplateLiteral":
      // Template literals with expressions are dynamic
      return false
    default:
      // Other expressions are considered dynamic
      return false
  }
}

// Check if props are static (only literals, no identifiers)
function isHoistablePropsStatic(propsArg: AstNode | undefined | null): boolean {
  if (!propsArg) return true

  if (propsArg.type === "Literal") {
    return propsArg.value === null || propsArg.value === undefined
  }

  if (propsArg.type === "ObjectExpression") {
    const props = propsArg.properties || []
    if (props.length === 0) return true

    for (const prop of props) {
      if (prop.type !== "Property") return false
      if (!isStaticLiteral(prop.value as AstNode)) return false
    }
    return true
  }

  return false
}

// Strict check: only literals allowed (no identifiers/variables)
function isStaticLiteral(node: AstNode): boolean {
  if (!node) return true

  switch (node.type) {
    case "Literal":
      return true
    case "ArrayExpression": {
      const elems = (node as any).elements || []
      return elems.every((e: AstNode) => isStaticLiteral(e))
    }
    case "ObjectExpression": {
      const props = node.properties || []
      return props.every((p) => {
        if (p.type !== "Property") return false
        return isStaticLiteral(p.value as AstNode)
      })
    }
    case "BinaryExpression":
      return (
        isStaticLiteral(node.left as AstNode) &&
        isStaticLiteral(node.right as AstNode)
      )
    default:
      return false
  }
}

function isStaticValue(node: AstNode): boolean {
  if (!node) return true

  switch (node.type) {
    case "Literal":
      return true
    case "Identifier":
      return true
    case "ArrayExpression": {
      const elems = node.expressions || []
      return elems.every((e) => isStaticValue(e as AstNode))
    }
    case "ObjectExpression": {
      const props = node.properties || []
      return props.every((p) => {
        if (p.type !== "Property") return false
        return isStaticValue(p.value as AstNode)
      })
    }
    case "BinaryExpression":
      return (
        isStaticValue(node.left as AstNode) &&
        isStaticValue(node.right as AstNode)
      )
    default:
      return false
  }
}
