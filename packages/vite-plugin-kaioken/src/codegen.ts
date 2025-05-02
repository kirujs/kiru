import type { ProgramNode } from "rollup"
import { FileLinkFormatter } from "./types"
import MagicString from "magic-string"
import fs from "node:fs"

type SrcInsertion = {
  content: string
  offset: number
}
type SrcInsertionContext = {
  code: MagicString
  inserts: SrcInsertion[]
}
interface AstNodeId {
  type: string
  name: string
}
interface AstNode {
  start: number
  end: number
  type:
    | "FunctionDeclaration"
    | "ArrowFunctionExpression"
    | "BlockStatement"
    | "VariableDeclaration"
    | (string & {})
  body?: AstNode | AstNode[]
  declaration?: AstNode
  declarations?: AstNode[]
  expression?: AstNode
  id?: AstNodeId
  init?: AstNode
  object?: AstNodeId
  property?: AstNodeId
  properties?: AstNode[]
  argument?: AstNode
  arguments?: AstNode[]
  specifiers?: AstNode[]
  cases?: AstNode[]
  name?: string
  callee?: AstNode
  exported?: AstNode & { name: string }
  consequent?: AstNode | AstNode[]
  alternate?: AstNode
  local?: AstNode & { name: string }
  imported?: AstNode & { name: string }
  source?: AstNode & { value: string }
  value?: unknown
}

const UNNAMED_WATCH_PREAMBLE = `\n
if (import.meta.hot && "window" in globalThis) {
  window.__kaioken.HMRContext?.signals.registerNextWatch();
}
`
export function injectHMRContextPreamble(
  code: MagicString,
  ast: ProgramNode,
  fileLinkFormatter: FileLinkFormatter,
  filePath: string
): MagicString | null {
  try {
    const srcInsertCtx: SrcInsertionContext = {
      code,
      inserts: [],
    }
    createUnnamedWatchInserts(srcInsertCtx, ast.body as AstNode[])

    const hotVars = findHotVars(ast.body as AstNode[], filePath)

    if (hotVars.size === 0 && srcInsertCtx.inserts.length === 0) return null

    code.prepend(`
if (import.meta.hot && "window" in globalThis) {
  window.__kaioken.HMRContext?.prepare("${filePath}");
}
`)
    for (const insert of srcInsertCtx.inserts) {
      code.appendRight(insert.offset, insert.content)
    }

    const componentNamesToHookArgs = getComponentHookArgs(
      ast.body as AstNode[],
      code.original,
      filePath
    )

    code.append(`
if (import.meta.hot && "window" in globalThis) {
  import.meta.hot.accept();
  ${createHMRRegistrationBlurb(
    hotVars,
    componentNamesToHookArgs,
    fileLinkFormatter,
    filePath
  )}
}
`)

    return code
  } catch (error) {
    console.error(error)
    return null
  }
}

type HotVarDesc = {
  type: string
  name: string
}

function createHMRRegistrationBlurb(
  hotVars: Set<HotVarDesc>,
  componentHookArgs: Record<string, HookToArgs[]>,
  fileLinkFormatter: FileLinkFormatter,
  filePath: string
) {
  const src = fs.readFileSync(filePath, "utf-8")
  const entries = Array.from(hotVars).map(({ name, type }) => {
    const line = findHotVarLineInSrc(src, name)
    if (type !== "component") {
      return `    ${name}: {
      type: "${type}",
      value: ${name},
      link: "${fileLinkFormatter(filePath, line)}"
    }`
    }
    if (!componentHookArgs[name]) {
      console.log(
        "[vite-plugin-kaioken]: failed to parse component hooks",
        name
      )
    }
    const args = componentHookArgs[name].map(([name, args]) => {
      return `{ name: "${name}", args: "${args}" }`
    })
    return `    ${name}: {
      type: "component",
      value: ${name},
      hooks: [${args.join(",")}],
      link: "${fileLinkFormatter(filePath, line)}"
    }`
  })
  return `
  window.__kaioken.HMRContext?.register({
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

function createAliasHandler(name: string) {
  const aliases = new Set<string>()

  const nodeContainsAliasCall = (node: AstNode) =>
    node.type === "CallExpression" &&
    node.callee?.type === "Identifier" &&
    typeof node.callee.name === "string" &&
    aliases.has(node.callee.name)

  const addAliases = (node: AstNode) => {
    if (node.source?.value !== "kaioken") return
    const specifiers = node.specifiers || []
    for (let i = 0; i < specifiers.length; i++) {
      const specifier = specifiers[i]
      if (
        specifier.imported &&
        specifier.imported.name === name &&
        !!specifier.local
      ) {
        aliases.add(specifier.local.name)
      }
    }
  }
  return { name, addAliases, nodeContainsAliasCall }
}

function findHotVars(bodyNodes: AstNode[], _id: string): Set<HotVarDesc> {
  const hotVars = new Set<HotVarDesc>()

  const aliasHandlers = [
    "createStore",
    "signal",
    "computed",
    "watch",
    "createContext",
    "lazy",
  ].map((name) => createAliasHandler(name))

  for (const node of bodyNodes) {
    if (node.type === "ImportDeclaration") {
      for (const aliasHandler of aliasHandlers) {
        aliasHandler.addAliases(node)
      }
      continue
    }

    if (isComponent(node, bodyNodes)) {
      addHotVarDesc(node, hotVars, "component")
      continue
    }

    for (const aliasHandler of aliasHandlers) {
      if (findNode(node, aliasHandler.nodeContainsAliasCall)) {
        addHotVarDesc(node, hotVars, aliasHandler.name)
        break
      }
    }
  }

  return hotVars
}

const isFuncDecOrExpr = (node: AstNode | undefined) => {
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
        return findNode(node, isFuncDecOrExpr)
      }
      const name = findNodeName(node)
      if (name === null) return false
      const dec = findVariableDeclaration(node, name, bodyNodes)
      if (!dec) return false
      return isFuncDecOrExpr(dec[0])
    case "ExportDefaultDeclaration":
      return isFuncDecOrExpr(node.declaration)
  }

  return false
}

function isComponent(node: AstNode, bodyNodes: AstNode[]): boolean {
  const isTlf = isTopLevelFunction(node, bodyNodes)
  if (!isTlf) return false
  const name = findNodeName(node)
  if (name === null) return false
  const charCode = name.charCodeAt(0)
  return charCode >= 65 && charCode <= 90
}

function findNodeName(node: AstNode): string | null {
  if (node.id?.name) return node.id.name
  if (node.declaration?.id?.name) return node.declaration.id.name
  if (node.declaration?.declarations?.[0]?.id?.name)
    return node.declaration.declarations[0].id.name
  if (node.declarations?.[0]?.id?.name) return node.declarations[0].id.name
  return null
}

function addHotVarDesc(node: AstNode, names: Set<HotVarDesc>, type: string) {
  const name = findNodeName(node)
  if (name == null && type === "component") {
    console.error("[vite-plugin-kaioken]: failed to find component name", node)
    throw new Error("[vite-plugin-kaioken]: Component name not found")
  }
  if (name !== null) {
    names.add({ type, name })
  }
}

type ComponentName = string
type HookName = string
type HookToArgs = [HookName, string]

function getComponentHookArgs(
  bodyNodes: AstNode[],
  code: string,
  filePath: string
): Record<string, HookToArgs[]> {
  const res: Record<ComponentName, HookToArgs[]> = {}
  for (const node of bodyNodes) {
    if (isComponent(node, bodyNodes)) {
      const name = findNodeName(node)
      if (name === null) {
        console.error(
          "[vite-plugin-kaioken]: unable to perform hook invalidation (failed to find component name)",
          node
        )
        continue
      }

      const hookArgsArr: HookToArgs[] = (res[name] = [])
      const body = findVariableDeclaration(node, name, bodyNodes)
      if (!body) {
        /**
         * todo: ensure that if we didn't find a body, it's because
         * the function _actually_ doesn't have a body, eg.
         * const App = () => (<div>Hello World</div>)
         */
        continue
      }

      for (const bodyNode of body) {
        switch (bodyNode.type) {
          case "VariableDeclaration":
            if (!bodyNode.declarations) continue
            for (const dec of bodyNode.declarations) {
              try {
                if (
                  dec.init?.callee?.name?.startsWith("use") &&
                  dec.init.arguments
                ) {
                  const args = argsToString(dec.init.arguments, code)
                  hookArgsArr.push([dec.init?.callee?.name, args])
                }
              } catch (error) {
                console.error(
                  "[vite-plugin-kaioken]: err thrown when getting hook args (VariableDeclaration)",
                  filePath,
                  error,
                  dec.init?.callee
                )
              }
            }
            break
          case "ExpressionStatement":
            try {
              if (
                bodyNode.expression?.type === "CallExpression" &&
                bodyNode.expression.callee?.name?.startsWith("use") &&
                bodyNode.expression.arguments
              ) {
                const args = argsToString(bodyNode.expression.arguments, code)
                hookArgsArr.push([bodyNode.expression.callee?.name, args])
              }
            } catch (error) {
              console.error(
                "[vite-plugin-kaioken]: err thrown when getting hook args (ExpressionStatement)",
                filePath,
                error,
                bodyNode.expression?.callee
              )
            }
            break
        }
      }
    }
  }
  return res
}

function findVariableDeclaration(
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
      "[vite-plugin-kaioken]: failed to find declaration for component"
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

function getArgValues(args: AstNode[], code: string) {
  return args.map((arg) => code.substring(arg.start, arg.end))
}

function argsToString(args: AstNode[], code: string) {
  return btoa(getArgValues(args, code).join(",").replace(/\s/g, ""))
}

function createUnnamedWatchInserts(ctx: SrcInsertionContext, nodes: AstNode[]) {
  const watchAliasHandler = createAliasHandler("watch")

  for (const node of nodes) {
    if (node.type === "ImportDeclaration") {
      watchAliasHandler.addAliases(node)
      continue
    }
    if (findNode(node, watchAliasHandler.nodeContainsAliasCall)) {
      const nameSet = new Set<any>()
      addHotVarDesc(node, nameSet, "unnamedWatch")
      if (nameSet.size === 0) {
        ctx.inserts.push({
          content: UNNAMED_WATCH_PREAMBLE,
          offset: node.start,
        })
      }
    }
  }
}

function findNode(
  node: AstNode,
  predicate: (node: AstNode) => boolean
): boolean {
  if (predicate(node)) return true

  if (node.body && Array.isArray(node.body)) {
    for (const child of node.body) {
      if (findNode(child, predicate)) return true
    }
  } else if (node.body) {
    if (findNode(node.body, predicate)) return true
  }

  if (node.consequent && Array.isArray(node.consequent)) {
    for (const child of node.consequent) {
      if (findNode(child, predicate)) return true
    }
  } else if (node.consequent) {
    if (findNode(node.consequent, predicate)) return true
  }

  if (
    (node.init && findNode(node.init, predicate)) ||
    (node.argument && findNode(node.argument, predicate)) ||
    (node.arguments && node.arguments.some((c) => findNode(c, predicate))) ||
    (node.alternate && findNode(node.alternate, predicate)) ||
    (node.callee && findNode(node.callee, predicate)) ||
    (node.declaration && findNode(node.declaration, predicate)) ||
    (node.declarations &&
      node.declarations.some((c) => findNode(c, predicate))) ||
    (node.expression && findNode(node.expression, predicate)) ||
    (node.cases && node.cases.some((c) => findNode(c, predicate)))
  ) {
    return true
  }

  return false
}
