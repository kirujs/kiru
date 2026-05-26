import fs from "node:fs"
import * as AST from "./ast.js"
import type { FileLinkFormatter } from "../types.js"
import {
  findNodeName,
  isComponent,
  MagicString,
  TransformCTX,
} from "./shared.js"
import {
  bindingKindAtDepth,
  buildModuleImportScope,
  isImportedCall,
  registerImportDeclaration,
} from "./scope.js"

type AstNode = AST.AstNode

type HotVarDesc = {
  type: string
  name: string
}

const UNNAMED_EFFECT_PREAMBLE = `\n
if (import.meta.hot && "window" in globalThis) {
  window.__kiru.HMRContext?.moduleEffects.registerNext();
}
`
export function prepareHMR(ctx: TransformCTX) {
  const { code, ast, fileLinkFormatter, filePath } = ctx

  try {
    const hotVars = findHotVars(code, ast.body as AstNode[], filePath)
    if (hotVars.size === 0 && !code.hasChanged()) return

    code.prepend(`
if (import.meta.hot && "window" in globalThis) {
  window.__kiru.HMRContext?.prepare("${filePath}");
}
`)

    code.append(`
if (import.meta.hot && "window" in globalThis) {
  import.meta.hot.accept();
  ${createHMRRegistrationBlurb(hotVars, fileLinkFormatter, filePath)}
}
`)
  } catch (error) {
    console.error(
      "[vite-plugin-kiru]: HMR preparation failed for",
      filePath,
      error
    )
  }
}

function createHMRRegistrationBlurb(
  hotVars: Set<HotVarDesc>,
  fileLinkFormatter: FileLinkFormatter,
  filePath: string
) {
  const src = fs.readFileSync(filePath, "utf-8")
  const entries = Array.from(hotVars).map(({ name, type }) => {
    const key = JSON.stringify(name)
    const line = findHotVarLineInSrc(src, name)
    return `    ${key}: {
      type: "${type}",
      value: ${name},
      link: "${fileLinkFormatter(filePath, line)}"
    }`
  })

  return `
  window.__kiru.HMRContext?.register({
${entries.join(",\n")}
  });`
}

function findHotVarLineInSrc(src: string, name: string) {
  const lines = src.split("\n")
  const potentialMatches = [
    `const ${name}`,
    `let ${name}`,
    `var ${name}`,
    `function ${name}`,
    `export const ${name}`,
    `export let ${name}`,
    `export var ${name}`,
    `export default ${name}`,
    `export function ${name}`,
    `export default function ${name}`,
  ]
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    for (let j = 0; j < potentialMatches.length; j++) {
      if (line.startsWith(potentialMatches[j])) return i + 1
    }
  }
  return 0
}

/**
 * These represent the valid parent stack of a hot var. After the parents,
 * any combination of Property or ObjectExpression is allowed until the CallExpression.
 */
const exprAssign = [
  "ExpressionStatement",
  "AssignmentExpression",
] as const satisfies AstNode["type"][]
const allowedHotVarParentStacks: Array<AstNode["type"][]> = [
  ["VariableDeclaration", "VariableDeclarator"],
  exprAssign,
  ["ExportNamedDeclaration", "VariableDeclaration", "VariableDeclarator"],
]

function findHotVars(
  code: MagicString,
  bodyNodes: AstNode[],
  _id: string
): Set<HotVarDesc> {
  const hotVars = new Set<HotVarDesc>()

  const hotApiNames = [
    "signal",
    "resource",
    "computed",
    "effect",
    "createContext",
    "lazy",
  ] as const

  const scope = buildModuleImportScope(bodyNodes)
  let fnDepth = 0

  const resolve = (name: string) => scope.resolve(name)

  const enterFunction = () => {
    fnDepth++
    scope.push()
  }
  const exitFunction = () => {
    scope.pop()
    fnDepth--
  }

  for (const node of bodyNodes) {
    if (node.type === "ImportDeclaration") {
      registerImportDeclaration(node, scope)
      continue
    }

    /**
     * TODO: refactor to support finding components declared in
     * var > object expressions
     */
    if (isComponent(node, bodyNodes)) {
      addHotVarDesc(node, hotVars, "component")
      continue
    }

    AST.walk(node, {
      FunctionDeclaration: () => {
        enterFunction()
        return exitFunction
      },
      FunctionExpression: () => {
        enterFunction()
        return exitFunction
      },
      ArrowFunctionExpression: () => {
        enterFunction()
        return exitFunction
      },
      VariableDeclarator: (decl) => {
        const id = decl.id
        if (id?.type === "Identifier" && id.name) {
          scope.declare(id.name, {
            kind: bindingKindAtDepth(fnDepth, decl.init as AstNode, resolve),
            name: id.name,
          })
        }
      },
      CallExpression: (node, ctx) => {
        const apiName = hotApiNames.find((name) =>
          isImportedCall(node, resolve, { imported: name, namespace: "kiru" })
        )
        if (!apiName) {
          return ctx.exitBranch()
        }
        if (
          apiName === "effect" &&
          ctx.stack.length === 1 &&
          ctx.stack[0].type === "ExpressionStatement"
        ) {
          code.appendRight(node.start, UNNAMED_EFFECT_PREAMBLE)
          return ctx.exit()
        }

        const matchingParentStack = allowedHotVarParentStacks.find((stack) => {
          return stack.every((type, i) => ctx.stack[i]?.type === type)
        })
        if (!matchingParentStack) {
          return ctx.exitBranch()
        }
        if (matchingParentStack === exprAssign) {
          const [_expr, assign] = ctx.stack
          const name = assign.left?.name
          if (!name) return ctx.exit()
          hotVars.add({
            type: apiName,
            name,
          })
          return ctx.exit()
        }

        const remainingStack = ctx.stack.slice(matchingParentStack.length)
        if (
          remainingStack.some(
            (n) => n.type !== "ObjectExpression" && n.type !== "Property"
          )
        ) {
          return ctx.exitBranch()
        }

        const name = ctx.stack.reduce((acc, item) => {
          switch (item.type) {
            case "VariableDeclarator":
              return item.id!.name
            case "Property":
              if (!item.key) return acc
              if (item.key.name) return `${acc}.${item.key.name}`
              if (item.key.raw) return `${acc}[${item.key.raw}]`
              return acc
          }
          return acc
        }, "")

        hotVars.add({ type: apiName, name })
        ctx.exitBranch()
      },
    })
  }

  return hotVars
}

function addHotVarDesc(node: AstNode, names: Set<HotVarDesc>, type: string) {
  const name = findNodeName(node)
  if (name == null && type === "component") {
    console.error("[vite-plugin-kiru]: failed to find component name", node)
    throw new Error("[vite-plugin-kiru]: Component name not found")
  }
  if (name !== null) {
    names.add({ type, name })
  }
}
