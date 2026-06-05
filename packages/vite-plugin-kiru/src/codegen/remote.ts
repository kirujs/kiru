import path from "node:path"
import { createHash } from "node:crypto"
import * as AST from "./ast.js"
import { isAstExpression } from "./ast.js"
import { MagicString, TransformCTX, createAliasHandler } from "./shared.js"

type AstNode = AST.AstNode

const DEFAULT_EXPORT_BINDING = "__kiru_default"
const DEFAULT_RPC_PREFIX = "default"

interface ActionMatch {
  /** AST range replaced on the client (export declaration or object property). */
  replaceNode: AstNode
  /** Top-level export declaration (`export const` or `export default`). */
  exportNode: AstNode
  /** Registry / RPC name (`users.get`, `default.get`, or `foo` for flat exports). */
  name: string
  /** Server registry value expression (`users.get`, `__kiru_default.get`). */
  ref: string
  kind: "query" | "mutation" | "form"
  /** Void-input query (`query(handler)`). */
  isVoid?: boolean
  /** Approach B: top-level `const` linked by `export default id`. */
  linkedDeclaration?: AstNode
  /** Approach B: binding name of the linked const (`users`). */
  linkedBinding?: string
}

interface LinkedBinding {
  binding: string
  init: AstNode
  declarationNode: AstNode
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
    rewriteDefaultExportForSsr(code, matches)
    serverRegisterRemoteFunctions(matches, code, routeId)
  } else {
    clientFormatRemoteFunctions(bodyNodes, matches, code, routeId)
  }
}

function clientStubForMatch(match: ActionMatch): string {
  const id = `\`\${__$r__}:${match.name}\``
  if (match.kind === "form") {
    const formObj = `{ __kiruFormMutation: true, __kiruFormMutationId: ${id} }`
    if (match.replaceNode.type === "Property") {
      return `${propertyKeyName(match.replaceNode)}: ${formObj}`
    }
    return `export const ${match.name} = ${formObj};`
  }
  if (match.kind === "query") {
    const expr = `__$defineQuery(${id}, ${match.isVoid ? "true" : "false"})`
    if (match.replaceNode.type === "Property") {
      return `${propertyKeyName(match.replaceNode)}: ${expr}`
    }
    return `export const ${match.name} = ${expr};`
  }
  if (match.replaceNode.type === "Property") {
    const key = propertyKeyName(match.replaceNode)
    return `${key}: async (...args) => __$mutation(${id}, args)`
  }
  return `export async function ${match.name}(...args) { return __$mutation(${id}, args); }`
}

function clientDefaultFlatStub(match: ActionMatch): string {
  const id = `\`\${__$r__}:${match.name}\``
  if (match.kind === "form") {
    return `export default { __kiruFormMutation: true, __kiruFormMutationId: ${id} };`
  }
  if (match.kind === "query") {
    return `export default __$defineQuery(${id}, ${match.isVoid ? "true" : "false"});`
  }
  return `export default async (...args) => __$mutation(${id}, args);`
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

function isDefaultExportNode(exportNode: AstNode): boolean {
  return exportNode.type === "ExportDefaultDeclaration"
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

function buildStubTreeFromMatches(
  rpcPrefix: string,
  matchesForExport: ActionMatch[]
): StubTree {
  const tree: StubTree = new Map()
  const prefix = `${rpcPrefix}.`
  for (const match of matchesForExport) {
    const path = match.name.startsWith(prefix)
      ? match.name.slice(prefix.length)
      : match.name === rpcPrefix
        ? ""
        : match.name
    if (path === "") continue
    insertStubPath(tree, path.split("."), clientStubExpression(match))
  }
  return tree
}

function buildNamespaceExportStub(
  binding: string,
  matchesForExport: ActionMatch[]
): string {
  return `export const ${binding} = ${serializeStubTree(buildStubTreeFromMatches(binding, matchesForExport))};`
}

function buildDefaultExportStub(matchesForExport: ActionMatch[]): string {
  return `export default ${serializeStubTree(buildStubTreeFromMatches(DEFAULT_RPC_PREFIX, matchesForExport))};`
}

function buildLinkedConstStub(matchesForExport: ActionMatch[]): string {
  const binding = matchesForExport[0]?.linkedBinding ?? ""
  return `const ${binding} = ${serializeStubTree(buildStubTreeFromMatches(DEFAULT_RPC_PREFIX, matchesForExport))};`
}

/** Client stub expression for one action (no property key). */
function clientStubExpression(match: ActionMatch): string {
  const id = `\`\${__$r__}:${match.name}\``
  if (match.kind === "form") {
    return `{ __kiruFormMutation: true, __kiruFormMutationId: ${id} }`
  }
  if (match.kind === "query") {
    return `__$defineQuery(${id}, ${match.isVoid ? "true" : "false"})`
  }
  return `async (...args) => __$mutation(${id}, args)`
}

function rewriteDefaultExportForSsr(code: MagicString, matches: ActionMatch[]): void {
  const literalDefaultNodes = new Set<AstNode>()
  for (const match of matches) {
    if (match.linkedDeclaration) continue
    if (!isDefaultExportNode(match.exportNode)) continue
    literalDefaultNodes.add(match.exportNode)
  }

  for (const exportNode of literalDefaultNodes) {
    const decl = exportNode.declaration
    if (!decl || !isAstExpression(decl)) continue
    const slice = code.slice(decl.start, decl.end)
    code.overwrite(
      exportNode.start,
      exportNode.end,
      `const ${DEFAULT_EXPORT_BINDING} = ${slice}; export default ${DEFAULT_EXPORT_BINDING}`
    )
  }
}

function clientFormatRemoteFunctions(
  bodyNodes: AstNode[],
  matches: ActionMatch[],
  code: MagicString,
  route: string
) {
  const hasRpc = matches.some(
    (m) => m.kind === "mutation" || m.kind === "query"
  )
  const matchedExports = new Set(matches.map((m) => m.exportNode))
  const protectedNodes = new Set<AstNode>()
  for (const match of matches) {
    if (match.linkedDeclaration) {
      protectedNodes.add(match.linkedDeclaration)
    }
  }

  const byExport = new Map<AstNode, ActionMatch[]>()
  const byLinkedDeclaration = new Map<AstNode, ActionMatch[]>()
  for (const match of matches) {
    if (match.linkedDeclaration) {
      const list = byLinkedDeclaration.get(match.linkedDeclaration) ?? []
      list.push(match)
      byLinkedDeclaration.set(match.linkedDeclaration, list)
    } else {
      const list = byExport.get(match.exportNode) ?? []
      list.push(match)
      byExport.set(match.exportNode, list)
    }
  }

  if (hasRpc) {
    const imports = [
      `import { __$mutation, __$defineQuery } from "kiru/remote";`,
    ].join("\n")
    code.prepend(`${imports}\nconst __$r__ = ${JSON.stringify(route)};\n`)
  } else {
    code.prepend(`const __$r__ = ${JSON.stringify(route)};\n`)
  }

  for (const [linkedNode, linkedMatches] of byLinkedDeclaration) {
    if (isNamespaceObjectExport(linkedMatches)) {
      code.overwrite(
        linkedNode.start,
        linkedNode.end,
        buildLinkedConstStub(linkedMatches)
      )
    } else if (linkedMatches.length === 1) {
      const match = linkedMatches[0]!
      const binding = match.linkedBinding ?? ""
      code.overwrite(
        linkedNode.start,
        linkedNode.end,
        `const ${binding} = ${clientStubExpression(match)}`
      )
    }
  }

  for (const [exportNode, exportMatches] of byExport) {
    if (isNamespaceObjectExport(exportMatches)) {
      if (isDefaultExportNode(exportNode)) {
        code.overwrite(
          exportNode.start,
          exportNode.end,
          buildDefaultExportStub(exportMatches)
        )
      } else {
        const binding = exportBindingName(exportNode)
        code.overwrite(
          exportNode.start,
          exportNode.end,
          buildNamespaceExportStub(binding, exportMatches)
        )
      }
      continue
    }
    for (const match of exportMatches) {
      if (isDefaultExportNode(exportNode)) {
        code.overwrite(
          exportNode.start,
          exportNode.end,
          clientDefaultFlatStub(match)
        )
      } else {
        code.overwrite(
          match.replaceNode.start,
          match.replaceNode.end,
          clientStubForMatch(match)
        )
      }
    }
  }

  bodyNodes.forEach((node) => {
    if (matchedExports.has(node)) return
    if (protectedNodes.has(node)) return
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
    .map((m) => {
      const rpcId = JSON.stringify(`${route}:${m.name}`)
      if (m.kind === "query") {
        return `${m.ref}.__kiruQueryId = ${rpcId};`
      }
      if (m.kind === "form") {
        return `${m.ref}.__kiruFormMutationId = ${rpcId};`
      }
      if (m.kind === "mutation") {
        return `${m.ref}.__kiruMutationId = ${rpcId};`
      }
      return `${m.ref}.__kiruMutationId = ${rpcId};`
    })
    .join("\n")
  code.append(
    `\nimport { __INTERNAL_REMOTE_REGISTRY as __$r__ } from "kiru/remote";\n__$r__.register(${JSON.stringify(
      route
    )}, { ${entries} });\n${idAssignments}\n`
  )
}

function makeActionPath(namePrefix: string, keyName: string): string {
  return namePrefix ? `${namePrefix}.${keyName}` : keyName
}

type RemoteAliasSets = {
  query: Set<string>
  mutation: Set<string>
  form: Set<string>
}

function remoteKindForCall(
  node: AstNode,
  aliases: RemoteAliasSets
): ActionMatch["kind"] | null {
  if (node.type !== "CallExpression") return null
  const callee = node.callee
  if (callee?.type !== "Identifier" || typeof callee.name !== "string") {
    return null
  }
  const name = callee.name
  if (aliases.query.has(name)) return "query"
  if (aliases.mutation.has(name)) return "mutation"
  if (aliases.form.has(name)) return "form"
  return null
}

function isVoidRemoteCall(node: AstNode): boolean {
  if (node.type !== "CallExpression") return false
  const args = node.arguments ?? []
  if (args.length !== 1) return false
  const first = args[0]
  return (
    first?.type === "FunctionExpression" ||
    first?.type === "ArrowFunctionExpression"
  )
}

function collectActionsFromObject(
  objectNode: AstNode,
  exportNode: AstNode,
  namePrefix: string,
  aliases: RemoteAliasSets,
  matches: ActionMatch[],
  refPrefix?: string,
  options?: {
    linkedDeclaration?: AstNode
    linkedBinding?: string
  }
): void {
  const refRoot = refPrefix ?? namePrefix
  if (objectNode.type !== "ObjectExpression") return
  for (const prop of objectNode.properties ?? []) {
    if (prop.type !== "Property") continue
    if (prop.method || prop.shorthand) continue
    const keyName = propertyKeyName(prop)
    if (!keyName) continue
    const namePath = makeActionPath(namePrefix, keyName)
    const refPath = makeActionPath(refRoot, keyName)
    const value = prop.value
    if (!isAstExpression(value)) continue

    if (value.type === "ObjectExpression") {
      collectActionsFromObject(
        value,
        exportNode,
        namePath,
        aliases,
        matches,
        refPath,
        options
      )
      continue
    }

    const kind = remoteKindForCall(value, aliases)
    if (kind) {
      matches.push({
        replaceNode: prop,
        exportNode,
        name: namePath,
        ref: refPath,
        kind,
        isVoid: kind === "query" ? isVoidRemoteCall(value) : undefined,
        linkedDeclaration: options?.linkedDeclaration,
        linkedBinding: options?.linkedBinding,
      })
    }
  }
}

function resolveLinkedBinding(
  id: string,
  bodyNodes: AstNode[],
  beforeIndex: number
): LinkedBinding | null {
  for (let i = 0; i < beforeIndex; i++) {
    const node = bodyNodes[i]
    if (node?.type !== "VariableDeclaration") continue
    const declarations = node.declarations ?? []
    if (declarations.length !== 1) continue
    const declaration = declarations[0]
    if (declaration?.type !== "VariableDeclarator") continue
    if (declaration.id?.type !== "Identifier" || declaration.id.name !== id) continue
    const init = declaration.init
    if (!init || !isAstExpression(init)) continue
    return { binding: id, init, declarationNode: node }
  }
  return null
}

function collectNamedExportMatches(
  node: AstNode,
  aliases: RemoteAliasSets,
  matches: ActionMatch[]
): void {
  if (
    node.type !== "ExportNamedDeclaration" ||
    node.declaration?.type !== "VariableDeclaration"
  ) {
    return
  }
  const declarations = node.declaration.declarations ?? []
  if (declarations.length !== 1) return
  const declaration = declarations[0]
  if (declaration.type !== "VariableDeclarator") return
  if (!declaration.id?.name) return
  const binding = declaration.id.name
  const init = declaration.init
  if (!init) return

  if (init.type === "ObjectExpression") {
    collectActionsFromObject(init, node, binding, aliases, matches)
    return
  }

  const kind = remoteKindForCall(init, aliases)
  if (kind) {
    matches.push({
      replaceNode: node,
      exportNode: node,
      name: binding,
      ref: binding,
      kind,
      isVoid: kind === "query" ? isVoidRemoteCall(init) : undefined,
    })
  }
}

function collectDefaultExportMatches(
  node: AstNode,
  nodeIndex: number,
  bodyNodes: AstNode[],
  aliases: RemoteAliasSets,
  matches: ActionMatch[],
  namedBindings: Set<string>
): void {
  if (node.type !== "ExportDefaultDeclaration") return
  const decl = node.declaration
  if (!decl || !isAstExpression(decl)) return

  if (decl.type === "ObjectExpression") {
      collectActionsFromObject(
        decl,
        node,
        DEFAULT_RPC_PREFIX,
        aliases,
        matches,
        DEFAULT_EXPORT_BINDING
      )
    return
  }

  if (decl.type === "Identifier") {
    const id = decl.name
    if (!id || namedBindings.has(id)) return
    const linked = resolveLinkedBinding(id, bodyNodes, nodeIndex)
    if (!linked) return

    if (linked.init.type === "ObjectExpression") {
      collectActionsFromObject(
        linked.init,
        node,
        DEFAULT_RPC_PREFIX,
        aliases,
        matches,
        linked.binding,
        {
          linkedDeclaration: linked.declarationNode,
          linkedBinding: linked.binding,
        }
      )
      return
    }

    const linkedKind = remoteKindForCall(linked.init, aliases)
    if (!linkedKind) return
    matches.push({
      replaceNode: linked.declarationNode,
      exportNode: node,
      name: DEFAULT_RPC_PREFIX,
      ref: linked.binding,
      linkedDeclaration: linked.declarationNode,
      linkedBinding: linked.binding,
      kind: linkedKind,
      isVoid: linkedKind === "query" ? isVoidRemoteCall(linked.init) : undefined,
    })
    return
  }

  const declKind = remoteKindForCall(decl, aliases)
  if (!declKind) return
  matches.push({
    replaceNode: node,
    exportNode: node,
    name: DEFAULT_RPC_PREFIX,
    ref: DEFAULT_EXPORT_BINDING,
    kind: declKind,
    isVoid: declKind === "query" ? isVoidRemoteCall(decl) : undefined,
  })
}

function assertNoDefaultNameCollisions(matches: ActionMatch[]): void {
  const names = new Set<string>()
  for (const match of matches) {
    if (names.has(match.name)) {
      throw new Error(
        `remote codegen: export name collision: ${match.name}`
      )
    }
    names.add(match.name)
  }
}

function findExportedActionCalls(bodyNodes: AstNode[]): ActionMatch[] {
  const queryAliasHandler = createAliasHandler("query", "kiru/remote")
  const mutationAliasHandler = createAliasHandler("mutation", "kiru/remote")
  const formAliasHandler = createAliasHandler("form", "kiru/remote")
  const matches: ActionMatch[] = []
  const namedBindings = new Set<string>()

  for (const node of bodyNodes) {
    if (node.type === "ImportDeclaration") {
      queryAliasHandler.addAliases(node)
      mutationAliasHandler.addAliases(node)
      formAliasHandler.addAliases(node)
    }
  }

  const aliases: RemoteAliasSets = {
    query: queryAliasHandler.aliases,
    mutation: mutationAliasHandler.aliases,
    form: formAliasHandler.aliases,
  }

  for (const node of bodyNodes) {
    if (node.type === "ImportDeclaration") continue
    if (
      node.type === "ExportNamedDeclaration" &&
      node.declaration?.type === "VariableDeclaration"
    ) {
      const binding = node.declaration.declarations?.[0]?.id?.name
      if (binding) namedBindings.add(binding)
      collectNamedExportMatches(node, aliases, matches)
    }
  }

  for (let i = 0; i < bodyNodes.length; i++) {
    const node = bodyNodes[i]!
    if (node.type === "ImportDeclaration") continue
    collectDefaultExportMatches(node, i, bodyNodes, aliases, matches, namedBindings)
  }

  assertNoDefaultNameCollisions(matches)
  return matches
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
