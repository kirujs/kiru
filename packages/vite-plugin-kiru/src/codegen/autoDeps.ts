import {
  createAliasHandler,
  isComponent,
  MagicString,
  TransformCTX,
} from "./shared"
import { ProgramNode } from "rollup"
import * as AST from "./ast"
type AstNode = AST.AstNode

export function prepareAutoDeps(ctx: TransformCTX) {
  const { code, ast } = ctx
  emplaceAutoDeps(code, ast)
}

function emplaceAutoDeps(_code: MagicString, ast: ProgramNode) {
  const useComputedAliasHandler = createAliasHandler("useComputed", "kiru")

  type ScopeVariables = Set<string>
  const scopeStack: ScopeVariables[] = [new Set()]
  const componentNodes = new Set<AstNode>()

  for (const node of ast.body as AstNode[]) {
    if (node.type === "ImportDeclaration") {
      useComputedAliasHandler.addAliases(node)
      continue
    }

    if (isComponent(node, ast.body as AstNode[])) {
      componentNodes.add(node)
    } else if (
      node.type === "VariableDeclaration" &&
      node.declarations?.[0]?.id?.type === "Identifier"
    ) {
      const name = node.declarations[0].id.name
      scopeStack[scopeStack.length - 1].add(name)
    }
  }

  const useComputedCallExpression = {
    current: null as AST.AstNode | null,
  }
  const useComputedParentScopeVariables = {
    current: null as ScopeVariables | null,
  }
  const useComputedParentScopeVariablesOffset = {
    current: null as number | null,
  }

  // @ts-ignore
  const useComputedExternalDeps = new Set<string>()

  const variableDetectionStackTypes: AstNode["type"][][] = [[]]

  const analyzeComputedGetter: AST.NodeVisitorCallback = (node) => {
    if (!useComputedCallExpression.current) {
      return
    }
    console.log("analyzeComputedGetter", JSON.stringify(node, null, 2))
    AST.walk(node, {
      Identifier: (node, ctx) => {
        if (!node.name) return
        let i = ctx.stack.length - 1
        const parentNode = ctx.stack[i]
        let p = parentNode
        let c = node
        let nameParts: string[] = []
        while (p.type === "MemberExpression" && p.object === c) {
          // @ts-ignore
          nameParts.unshift(p.property.name)
          // @ts-ignore
          console.log("p.property.name", p.property.name)
          c = p
          p = ctx.stack[--i]
        }

        if (c.object && "name" in c.object && c.object?.name) {
          nameParts.unshift(c.object.name)
        }
        console.log("nameParts", nameParts)
        //console.log("Identifier", node, "parent", parentNode)

        // if (!useComputedParentScopeVariables.current?.has(node.name)) return

        // for (let i = scopeStack.length - 1; i >= 0; i--) {
        //   console.log(
        //     "scopeStack i",
        //     useComputedParentScopeVariablesOffset.current,
        //     i,
        //     scopeStack[i]
        //   )
        //   if (
        //     i > useComputedParentScopeVariablesOffset.current! &&
        //     scopeStack[i].has(node.name)
        //   ) {
        //     // variable has been shadowed, so we can't use it
        //     return
        //   }
        // }

        // useComputedExternalDeps.add(node.name)
      },
    })
  }

  componentNodes.forEach((componentNode) => {
    // push an extra scope for component params
    const props = componentNode.params?.[0]
    if (props) {
      const propsScope = new Set(scopeStack[scopeStack.length - 1])
      scopeStack.push(propsScope)
      if (props.type === "ObjectPattern") {
        for (const property of props.properties ?? []) {
          const name = property.value?.name
          if (name) {
            console.log("add property name", name)
            propsScope.add(name)
          }
        }
      } else {
        console.log("here - props", props)
      }
    }
    // scopeStack.push()

    AST.walk(componentNode, {
      BlockStatement: () => {
        const scope = new Set(scopeStack[scopeStack.length - 1])
        scopeStack.push(scope)
        return () => scopeStack.pop()
      },
      VariableDeclarator: (node) => {
        if (
          node.init &&
          useComputedAliasHandler.isMatchingCallExpression(node.init)
        ) {
          return
        }
        switch (node.id?.type) {
          case "Identifier": {
            const name = node.id.name
            scopeStack[scopeStack.length - 1].add(name)
            break
          }
          case "ArrayPattern": {
            for (const element of node.id.elements ?? []) {
              const name = element.name
              scopeStack[scopeStack.length - 1].add(name)
            }
            break
          }
          case "ObjectPattern": {
            for (const property of node.id.properties ?? []) {
              const name = property.value.name
              scopeStack[scopeStack.length - 1].add(name)
            }
            break
          }
        }
      },
      ArrowFunctionExpression: analyzeComputedGetter,
      FunctionExpression: analyzeComputedGetter,
      CallExpression: (node, ctx) => {
        if (!useComputedAliasHandler.isMatchingCallExpression(node)) {
          return ctx.exitBranch()
        }
        // check if it provides an array in the second argument
        const arg = node.arguments?.[1]
        if (arg?.type === "ArrayExpression") {
          console.log("useComputedCallExpression - has deps array")
          return ctx.exitBranch()
        }

        console.log("useComputedCallExpression - no deps array")

        // there isn't an explicit deps array, so we'll
        // flag this as our current "useComputedCallExpression".
        // The next call expression should be our first argument (the getter).
        useComputedCallExpression.current = node
        useComputedParentScopeVariablesOffset.current = scopeStack.length - 1
        useComputedParentScopeVariables.current =
          scopeStack[scopeStack.length - 1]
        return () => {
          // this is where we'll take accumulated dependencies and
          // create the deps array / mutate source code as needed

          // we might have a string here for the computed's `displayName` arg
          if (arg) {
            // in this case, we just need to push it to the 2nd index
            console.log("arg", arg)
          }

          console.log(
            "useComputedCallExpression - end",
            useComputedExternalDeps
          )

          useComputedCallExpression.current = null
        }
      },
    })

    if (props) {
      scopeStack.pop()
    }
  })
}
