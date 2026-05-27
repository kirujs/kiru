import type { AstNode } from "./ast.js"

export type BindingKind =
  | "import"
  | "moduleStatic"
  | "moduleSignal"
  | "setupConst"
  | "renderLocal"
  | "param"
  | "local"

export type ImportSpec = {
  imported: string
  source?: string
  namespace?: string
}

export type BindingInfo = {
  kind: BindingKind
  name: string
  import?: { imported: string; source: string }
}

type ScopeFrame = {
  bindings: Map<string, BindingInfo>
}

export class ScopeStack {
  private frames: ScopeFrame[] = [{ bindings: new Map() }]

  push(): void {
    this.frames.push({ bindings: new Map() })
  }

  pop(): void {
    if (this.frames.length > 1) this.frames.pop()
  }

  declare(name: string, info: BindingInfo): void {
    this.frames[this.frames.length - 1]!.bindings.set(name, info)
  }

  resolve(name: string): BindingInfo | null {
    for (let i = this.frames.length - 1; i >= 0; i--) {
      const hit = this.frames[i]!.bindings.get(name)
      if (hit) return hit
    }
    return null
  }
}

export function matchesSource(
  src: string,
  spec: Pick<ImportSpec, "source" | "namespace">
): boolean {
  if (spec.source) {
    return src === spec.source || src.endsWith(`/${spec.source}`)
  }
  const ns = spec.namespace ?? "kiru"
  return (
    src === ns || src.endsWith(`/${ns}`) || src.startsWith(`${ns}/`)
  )
}

export function isImportedCall(
  node: AstNode,
  resolve: (name: string) => BindingInfo | null,
  spec: ImportSpec
): boolean {
  if (node.type !== "CallExpression") return false
  const callee = node.callee
  if (callee?.type !== "Identifier" || !callee.name) return false
  const binding = resolve(callee.name)
  if (!binding || binding.kind !== "import" || !binding.import) return false
  if (binding.import.imported !== spec.imported) return false
  if (spec.source) {
    return (
      binding.import.source === spec.source ||
      binding.import.source.endsWith(`/${spec.source}`)
    )
  }
  return matchesSource(binding.import.source, spec)
}

/** Match canonical and Vite-resolved Kiru JSX factory module ids. */
export function matchesKiruJsxFactorySource(
  src: string,
  imported: "jsx" | "jsxs" | "jsxDEV"
): boolean {
  const s = src.replace(/\\/g, "/")
  if (imported === "jsxDEV") {
    return (
      matchesSource(s, { source: "kiru/jsx-dev-runtime" }) ||
      s.includes("jsx-dev-runtime") ||
      (/\/kiru/i.test(s) && /\/jsx\.js$/.test(s))
    )
  }
  if (imported === "jsx" || imported === "jsxs") {
    return (
      matchesSource(s, { source: "kiru/jsx-runtime" }) ||
      (s.includes("jsx-runtime") && !s.includes("jsx-dev-runtime")) ||
      (/\/kiru/i.test(s) &&
        /\/jsx\.js$/.test(s) &&
        !s.includes("jsx-dev-runtime"))
    )
  }
  return false
}

export function isKiruJsxFactoryCall(
  node: AstNode | null | undefined,
  resolve: (name: string) => BindingInfo | null,
  imported: "jsx" | "jsxs" | "jsxDEV"
): boolean {
  if (!node || node.type !== "CallExpression") return false
  const callee = node.callee
  if (callee?.type !== "Identifier" || !callee.name) return false
  const binding = resolve(callee.name)
  if (!binding || binding.kind !== "import" || !binding.import) return false
  if (binding.import.imported !== imported) return false
  return matchesKiruJsxFactorySource(binding.import.source, imported)
}

export function registerImportDeclaration(
  node: AstNode,
  scope: ScopeStack
): void {
  if (node.type !== "ImportDeclaration") return
  const src = node.source?.value
  if (typeof src !== "string") return
  for (const specifier of node.specifiers || []) {
    const importedName =
      specifier.imported?.name ??
      (typeof specifier.imported?.value === "string"
        ? specifier.imported.value
        : undefined)
    const localName = specifier.local?.name
    if (!localName) continue
    if (importedName) {
      scope.declare(localName, {
        kind: "import",
        name: localName,
        import: { imported: importedName, source: src },
      })
    } else if (specifier.type === "ImportDefaultSpecifier") {
      scope.declare(localName, {
        kind: "import",
        name: localName,
        import: { imported: "default", source: src },
      })
    }
  }
}

const SIGNAL_SPECS: ImportSpec[] = [
  { imported: "signal", namespace: "kiru" },
  { imported: "computed", namespace: "kiru" },
]

export function isSignalFactoryCall(
  init: AstNode,
  resolve: (name: string) => BindingInfo | null
): boolean {
  return SIGNAL_SPECS.some((spec) =>
    isImportedCall(init, resolve, spec)
  )
}

export function isModuleHoistableBinding(binding: BindingInfo | null): boolean {
  return binding?.kind === "moduleStatic"
}

export function isModuleSignalBinding(binding: BindingInfo | null): boolean {
  return binding?.kind === "moduleSignal"
}

/** Declare bindings introduced by function params (incl. destructuring). */
export function declareFunctionParamBindings(
  params: AstNode[] | undefined,
  scope: ScopeStack,
  kind: BindingKind
): void {
  for (const param of params ?? []) {
    declarePatternBinding(param, scope, kind)
  }
}

function declarePatternBinding(
  pattern: AstNode,
  scope: ScopeStack,
  kind: BindingKind
): void {
  if (!pattern) return
  if (pattern.type === "Identifier" && pattern.name) {
    scope.declare(pattern.name, { kind, name: pattern.name })
    return
  }
  if (pattern.type === "ObjectPattern") {
    for (const prop of pattern.properties ?? []) {
      if (prop.type === "Property") {
        declarePatternBinding(prop.value as AstNode, scope, kind)
      } else if (prop.type === "RestElement") {
        declarePatternBinding(prop.argument as AstNode, scope, kind)
      }
    }
    return
  }
  if (pattern.type === "ArrayPattern") {
    for (const elem of (pattern as { elements?: (AstNode | null)[] }).elements ??
      []) {
      if (elem) declarePatternBinding(elem, scope, kind)
    }
    return
  }
  if (pattern.type === "RestElement") {
    declarePatternBinding(pattern.argument as AstNode, scope, kind)
    return
  }
  if (pattern.type === "AssignmentPattern") {
    declarePatternBinding(pattern.left as AstNode, scope, kind)
  }
}

export function blocksModuleHoist(binding: BindingInfo | null): boolean {
  if (!binding) return true
  switch (binding.kind) {
    case "moduleStatic":
    case "import":
    case "moduleSignal":
      return false
    default:
      return true
  }
}

/** Setup-scope hoist: only render-local bindings are forbidden. */
export function blocksSetupHoist(binding: BindingInfo | null): boolean {
  if (!binding) return true
  return binding.kind === "renderLocal"
}

export function bindingKindAtDepth(
  depth: number,
  init: AstNode | undefined,
  resolve: (name: string) => BindingInfo | null
): BindingKind {
  if (depth === 0) {
    if (init && isSignalFactoryCall(init, resolve)) return "moduleSignal"
    return "moduleStatic"
  }
  if (depth === 1) return "setupConst"
  if (depth >= 2) return "renderLocal"
  return "local"
}

export function isStaticLiteral(node: AstNode): boolean {
  if (!node) return true
  switch (node.type) {
    case "Literal":
      return true
    case "ArrayExpression": {
      const elems = (node as { elements?: (AstNode | null)[] }).elements ?? []
      return elems.every((e) => !e || isStaticLiteral(e))
    }
    case "ObjectExpression": {
      const props = node.properties ?? []
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
    case "UnaryExpression": {
      const arg = (node as { argument?: AstNode }).argument
      return arg ? isStaticLiteral(arg) : false
    }
    default:
      return false
  }
}

export function collectImportAliases(
  bodyNodes: AstNode[],
  spec: ImportSpec
): Set<string> {
  const names = new Set<string>()
  for (const node of bodyNodes) {
    if (node.type !== "ImportDeclaration") continue
    const src = node.source?.value
    if (typeof src !== "string" || !matchesSource(src, spec)) continue
    for (const sp of node.specifiers ?? []) {
      const importedName =
        sp.imported?.name ??
        (typeof sp.imported?.value === "string" ? sp.imported.value : undefined)
      if (importedName === spec.imported && sp.local?.name) {
        names.add(sp.local.name)
      }
    }
  }
  return names
}

export function registerModuleDeclarations(
  bodyNodes: AstNode[],
  scope: ScopeStack
): void {
  const resolve = (name: string) => scope.resolve(name)
  for (const node of bodyNodes) {
    if (node.type !== "VariableDeclaration") continue
    for (const decl of node.declarations ?? []) {
      if (decl.type !== "VariableDeclarator") continue
      const id = decl.id
      if (id?.type !== "Identifier" || !id.name) continue
      scope.declare(id.name, {
        kind: bindingKindAtDepth(0, decl.init as AstNode | undefined, resolve),
        name: id.name,
      })
    }
  }
}

export function buildModuleImportScope(bodyNodes: AstNode[]): ScopeStack {
  const scope = new ScopeStack()
  for (const node of bodyNodes) {
    registerImportDeclaration(node, scope)
  }
  registerModuleDeclarations(bodyNodes, scope)
  return scope
}
