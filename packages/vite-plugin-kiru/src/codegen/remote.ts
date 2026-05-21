import path from "node:path"
import { createHash } from "node:crypto"
import * as AST from "./ast.js"
import { isAstExpression } from "./ast.js"
import { MagicString, TransformCTX, createAliasHandler } from "./shared.js"

type AstNode = AST.AstNode

type JsonActionMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

interface ActionMatch {
  /** AST range replaced on the client (export declaration or object property). */
  replaceNode: AstNode
  /** Top-level `export const …` declaration. */
  exportNode: AstNode
  /** Registry / RPC name (`users.get`, or `foo` for flat exports). */
  name: string
  /** Server registry value expression (`users.get`, `foo`). */
  ref: string
  kind: "action" | "form"
  method?: JsonActionMethod
}

export function prepareRemoteFunctions(
  ctx: TransformCTX,
  projectRoot: string,
  ssr: boolean
) {
  const { code, ast } = ctx
  const bodyNodes = ast.body as AstNode[]
  const matches = findExportedActionCalls(bodyNodes)
  if (matches.length === 0) return

  const routeId = generateRouteId(ctx.filePath, projectRoot)

  if (ssr) {
    serverRegisterRemoteFunctions(matches, code, routeId)
  } else {
    clientFormatRemoteFunctions(bodyNodes, matches, code, routeId)
  }
}

function clientStubForMatch(match: ActionMatch): string {
  const id = `\`\${__$r__}:${match.name}\``
  if (match.kind === "form") {
    const formObj = `{ __kiruFormAction: true, __kiruFormActionId: ${id} }`
    if (match.replaceNode.type === "Property") {
      return `${propertyKeyName(match.replaceNode)}: ${formObj}`
    }
    return `export const ${match.name} = ${formObj};`
  }
  const method = match.method ?? "POST"
  if (match.replaceNode.type === "Property") {
    const key = propertyKeyName(match.replaceNode)
    if (method === "GET") {
      return `${key}: async (options) => __$dispatch()(${id}, "GET", options ?? {})`
    }
    return `${key}: async (options) => __$dispatch()(${id}, "${method}", options ?? {})`
  }
  if (method === "GET") {
    return `export async function ${match.name}(options) { return __$dispatch()(${id}, "GET", options ?? {}); }`
  }
  return `export async function ${match.name}(options) { return __$dispatch()(${id}, "${method}", options ?? {}); }`
}

function propertyKeyName(prop: AstNode): string {
  const key = prop.key
  if (key?.type === "Identifier") return key.name ?? ""
  if (key?.type === "Literal" && typeof key.value === "string") return key.value
  return ""
}

function exportBindingName(exportNode: AstNode): string {
  const decl = exportNode.declaration
  if (decl?.type !== "VariableDeclaration") return ""
  const id = decl.declarations?.[0]?.id
  return id?.type === "Identifier" ? (id.name ?? "") : ""
}

function isNamespaceObjectExport(matchesForExport: ActionMatch[]): boolean {
  return (
    matchesForExport.length > 0 &&
    matchesForExport.every((m) => m.replaceNode.type === "Property")
  )
}

type StubTree = Map<string, string | StubTree>

function insertStubPath(tree: StubTree, segments: string[], stub: string): void {
  if (segments.length === 1) {
    tree.set(segments[0]!, stub)
    return
  }
  const head = segments[0]!
  const tail = segments.slice(1)
  let child = tree.get(head)
  if (typeof child === "string") {
    throw new Error(`remote codegen: path conflict at ${head}`)
  }
  if (!child) {
    child = new Map()
    tree.set(head, child)
  }
  insertStubPath(child, tail, stub)
}

function serializeStubTree(tree: StubTree): string {
  const parts: string[] = []
  for (const [key, value] of tree) {
    if (typeof value === "string") {
      parts.push(`${key}: ${value}`)
    } else {
      parts.push(`${key}: ${serializeStubTree(value)}`)
    }
  }
  return `{ ${parts.join(", ")} }`
}

function buildNamespaceExportStub(
  binding: string,
  matchesForExport: ActionMatch[]
): string {
  const tree: StubTree = new Map()
  for (const match of matchesForExport) {
    const prefix = `${binding}.`
    const path = match.name.startsWith(prefix)
      ? match.name.slice(prefix.length)
      : match.name
    insertStubPath(tree, path.split("."), clientStubExpression(match))
  }
  return `export const ${binding} = ${serializeStubTree(tree)};`
}

/** Client stub expression for one action (no property key). */
function clientStubExpression(match: ActionMatch): string {
  const id = `\`\${__$r__}:${match.name}\``
  if (match.kind === "form") {
    return `{ __kiruFormAction: true, __kiruFormActionId: ${id} }`
  }
  const method = match.method ?? "POST"
  if (method === "GET") {
    return `async (options) => __$dispatch()(${id}, "GET", options ?? {})`
  }
  return `async (options) => __$dispatch()(${id}, "${method}", options ?? {})`
}

function clientFormatRemoteFunctions(
  bodyNodes: AstNode[],
  matches: ActionMatch[],
  code: MagicString,
  route: string
) {
  const hasJsonActions = matches.some((m) => m.kind === "action")
  const matchedExports = new Set(matches.map((m) => m.exportNode))
  const byExport = new Map<AstNode, ActionMatch[]>()
  for (const match of matches) {
    const list = byExport.get(match.exportNode) ?? []
    list.push(match)
    byExport.set(match.exportNode, list)
  }

  if (hasJsonActions) {
    code.prepend(
      `import { __kiruEnsureRemoteDispatch } from "kiru/ssr/router";\nconst __$r__ = ${JSON.stringify(
        route
      )};\nconst __$dispatch = () => __kiruEnsureRemoteDispatch();\n`
    )
  } else {
    code.prepend(`const __$r__ = ${JSON.stringify(route)};\n`)
  }

  for (const [exportNode, exportMatches] of byExport) {
    if (isNamespaceObjectExport(exportMatches)) {
      const binding = exportBindingName(exportNode)
      code.overwrite(
        exportNode.start,
        exportNode.end,
        buildNamespaceExportStub(binding, exportMatches)
      )
      continue
    }
    for (const match of exportMatches) {
      code.overwrite(
        match.replaceNode.start,
        match.replaceNode.end,
        clientStubForMatch(match)
      )
    }
  }

  bodyNodes.forEach((node) => {
    if (matchedExports.has(node)) return
    if (node.type === "ImportDeclaration") return
    code.overwrite(node.start, node.end, "")
  })
}

function serverRegisterRemoteFunctions(
  matches: ActionMatch[],
  code: MagicString,
  route: string
) {
  const entries = matches
    .map((m) => `${JSON.stringify(m.name)}: ${m.ref}`)
    .join(", ")
  const idAssignments = matches
    .map(
      (m) =>
        `${m.ref}.__kiruActionId = ${JSON.stringify(`${route}:${m.name}`)};`
    )
    .join("\n")
  code.append(
    `\nimport { __INTERNAL_REMOTE_REGISTRY as __$r__ } from "kiru/remote";\n__$r__.register(${JSON.stringify(
      route
    )}, { ${entries} });\n${idAssignments}\n`
  )
}

function collectActionsFromObject(
  objectNode: AstNode,
  exportNode: AstNode,
  prefix: string,
  actionAliases: Set<string>,
  matches: ActionMatch[]
): void {
  if (objectNode.type !== "ObjectExpression") return
  for (const prop of objectNode.properties ?? []) {
    if (prop.type !== "Property") continue
    if (prop.method || prop.shorthand) continue
    const keyName = propertyKeyName(prop)
    if (!keyName) continue
    const path = prefix ? `${prefix}.${keyName}` : keyName
    const value = prop.value
    if (!isAstExpression(value)) continue

    if (value.type === "ObjectExpression") {
      collectActionsFromObject(value, exportNode, path, actionAliases, matches)
      continue
    }

    const remoteMethod = getActionMemberMethod(value, actionAliases)
    if (remoteMethod === "GET") {
      matches.push({
        replaceNode: prop,
        exportNode,
        name: path,
        ref: path,
        kind: "action",
        method: "GET",
      })
    } else if (remoteMethod) {
      if (isPostFormConfig(value)) {
        matches.push({
          replaceNode: prop,
          exportNode,
          name: path,
          ref: path,
          kind: "form",
        })
      } else {
        matches.push({
          replaceNode: prop,
          exportNode,
          name: path,
          ref: path,
          kind: "action",
          method: remoteMethod,
        })
      }
    }
  }
}

function findExportedActionCalls(bodyNodes: AstNode[]): ActionMatch[] {
  const actionAliasHandler = createAliasHandler("action", "kiru/remote")
  const matches: ActionMatch[] = []

  for (const node of bodyNodes) {
    if (node.type === "ImportDeclaration") {
      actionAliasHandler.addAliases(node)
      continue
    }
    if (
      node.type !== "ExportNamedDeclaration" ||
      node.declaration?.type !== "VariableDeclaration"
    ) {
      continue
    }
    const declarations = node.declaration.declarations ?? []
    if (declarations.length !== 1) continue
    const declaration = declarations[0]
    if (declaration.type !== "VariableDeclarator") continue
    if (!declaration.id?.name) continue
    const binding = declaration.id.name
    const init = declaration.init
    if (!init) continue

    if (init.type === "ObjectExpression") {
      collectActionsFromObject(init, node, binding, actionAliasHandler.aliases, matches)
      continue
    }

    const remoteMethod = getActionMemberMethod(init, actionAliasHandler.aliases)
    if (remoteMethod === "GET") {
      matches.push({
        replaceNode: node,
        exportNode: node,
        name: binding,
        ref: binding,
        kind: "action",
        method: "GET",
      })
    } else if (remoteMethod) {
      if (isPostFormConfig(init)) {
        matches.push({
          replaceNode: node,
          exportNode: node,
          name: binding,
          ref: binding,
          kind: "form",
        })
      } else {
        matches.push({
          replaceNode: node,
          exportNode: node,
          name: binding,
          ref: binding,
          kind: "action",
          method: remoteMethod,
        })
      }
    }
  }
  return matches
}

function isPostFormConfig(node: AstNode): boolean {
  if (node.type !== "CallExpression") return false
  const args = node.arguments ?? []
  const first = args[0]
  if (!first || first.type !== "ObjectExpression") return false
  const properties = first.properties ?? []
  for (const prop of properties) {
    if (prop.type !== "Property") continue
    const key = prop.key
    const keyName =
      key?.type === "Identifier"
        ? key.name
        : key?.type === "Literal" && typeof key.value === "string"
          ? key.value
          : undefined
    if (keyName !== "type") continue
    const value = prop.value
    if (
      isAstExpression(value) &&
      value.type === "Literal" &&
      typeof value.value === "string" &&
      value.value === "form"
    ) {
      return true
    }
  }
  return false
}

function getActionMemberMethod(
  node: AstNode,
  actionAliases: Set<string>
): JsonActionMethod | null {
  if (node.type !== "CallExpression") return null
  const callee = node.callee
  if (callee?.type !== "MemberExpression") return null
  if (
    callee.object?.type !== "Identifier" ||
    typeof callee.object.name !== "string" ||
    !actionAliases.has(callee.object.name)
  ) {
    return null
  }
  if (callee.property?.type !== "Identifier") return null
  const name = callee.property.name
  if (name === "get") return "GET"
  if (name === "post") return "POST"
  if (name === "put") return "PUT"
  if (name === "patch") return "PATCH"
  if (name === "delete") return "DELETE"
  return null
}

function generateRouteId(filePath: string, projectRoot: string): string {
  const normalizedFile = filePath.replace(/\\/g, "/")
  const normalizedRoot = projectRoot.replace(/\\/g, "/").replace(/\/+$/, "")
  const relativePath = normalizedFile.startsWith(normalizedRoot + "/")
    ? normalizedFile.slice(normalizedRoot.length + 1)
    : path.basename(normalizedFile)
  const routePath = relativePath.replace(/\.[^./]+$/, "")
  const digest = createHash("sha256").update(routePath).digest("hex").slice(0, 12)
  return `r_${digest}`
}
