import { __DEV__ } from "./env.js"
import { KiruError } from "./error.js"
import {
  hydrationStack,
  traceHydrationCursorContext,
  traceHydrationError,
  withHydrationAfterAnchor,
} from "./hydration.js"
import { renderMode } from "./globals.js"
import { withPendingTemplateHoleHydration } from "./templateHoleHydration.js"
import {
  $KIRU_TEMPLATE,
  executeStructuralControlStream,
  type TemplateRoot,
} from "./template.js"
import type { SomeElement } from "./types.utils.js"

type VNode = Kiru.VNode

export type HydratedTemplateInstance = {
  readonly root: Element
  readonly anchors: readonly Comment[]
  readonly nodes: readonly SomeElement[]
}

const hydratedByRoot = Symbol.for("kiru.template.hydratedByRoot")

type TemplateRootWithCache = TemplateRoot & {
  [hydratedByRoot]?: WeakMap<Element, HydratedTemplateInstance>
}

function getRootCache(
  template: TemplateRoot
): WeakMap<Element, HydratedTemplateInstance> {
  const t = template as TemplateRootWithCache
  let cache = t[hydratedByRoot]
  if (!cache) {
    cache = new WeakMap()
    t[hydratedByRoot] = cache
  }
  return cache
}

function requireStructuralWalk(template: TemplateRoot): readonly number[] {
  const walk = template.structuralWalk
  if (walk?.length) return walk
  const needsWalk =
    (template.structuralNodeCount ?? 0) > 0 ||
    (template.bindings?.length ?? 0) > 0 ||
    (template.holeCount ?? 0) > 0
  if (needsWalk) {
    throw new KiruError({
      message:
        "[kiru]: template requires compile-emitted structuralWalk (rebuild with current vite-plugin-kiru)",
    })
  }
  return []
}

function projectStructuralNodes(
  root: Element,
  template: TemplateRoot
): Pick<HydratedTemplateInstance, "nodes" | "anchors"> {
  const walk = requireStructuralWalk(template)
  if (walk.length === 0) {
    return { nodes: [], anchors: [] }
  }
  const { nodes, anchors } = executeStructuralControlStream(root, walk)
  if (__DEV__ && template.structuralNodeCount !== undefined) {
    if (nodes.length !== template.structuralNodeCount) {
      throw new KiruError({
        message: `[kiru]: template structural node count mismatch (expected ${template.structuralNodeCount}, projected ${nodes.length})`,
      })
    }
  }
  if (__DEV__) {
    const holeCount = template.holeCount ?? 0
    if (anchors.length !== holeCount) {
      throw new KiruError({
        message: `[kiru]: template hole count mismatch (expected ${holeCount}, projected ${anchors.length})`,
      })
    }
  }
  return { nodes, anchors }
}

/** Materialize projections from compile-emitted control stream over live shell DOM. */
export function hydrateTemplateInstance(
  template: TemplateRoot,
  root: Element,
  cached?: HydratedTemplateInstance | null
): HydratedTemplateInstance {
  if (cached && cached.root === root) {
    return cached
  }

  const rootCache = getRootCache(template)
  const fromTemplate = rootCache.get(root)
  if (fromTemplate) {
    return fromTemplate
  }

  const { nodes, anchors } = projectStructuralNodes(root, template)
  const instance: HydratedTemplateInstance = { root, anchors, nodes }
  rootCache.set(root, instance)
  return instance
}

function templateMetaFromVNode(vNode: VNode): TemplateRoot {
  const ref = vNode.templateRootRef
  if (ref) return ref as TemplateRoot
  return {
    __kiruTemplate: $KIRU_TEMPLATE,
    html: vNode.templateHtml ?? "",
    holeCount: vNode.templateHoleCount ?? 0,
    structuralNodeCount: vNode.templateStructuralNodeCount,
    structuralWalk: vNode.templateStructuralWalk,
  }
}

/** Bind template host vnode to live shell; execute control stream for projections. */
export function ensureTemplateVNodeHydrated(
  vNode: VNode
): HydratedTemplateInstance {
  const existing = vNode.templateHydrated
  if (existing) {
    return existing
  }

  const root = withPendingTemplateHoleHydration(vNode, () => {
    traceHydrationCursorContext(`template:${String(vNode.type)}`)
    if (vNode.dom instanceof Element) {
      return vNode.dom
    }
    if (renderMode.current === "hydrate") {
      const dom = hydrationStack.getCurrentChild()
      hydrationStack.bumpChildIndex()
      if (!(dom instanceof Element)) {
        traceHydrationError(
          `Hydration mismatch - no template shell element found (${String(vNode.type)})`
        )
        throw new KiruError({
          message: `Hydration mismatch - no template shell element found`,
          vNode,
        })
      }
      return dom
    }
    throw new KiruError({
      message: `[kiru]: template vnode missing DOM root`,
      vNode,
    })
  })

  const template = templateMetaFromVNode(vNode)
  const instance = hydrateTemplateInstance(template, root, null)
  vNode.dom = instance.root as Kiru.VNode["dom"]
  vNode.templateHydrated = instance
  vNode.templateStructuralNodes = instance.nodes
  if (instance.anchors.length > 0) {
    vNode.templateHoleAnchors = instance.anchors
  }
  if (__DEV__ && instance.root instanceof Element) {
    instance.root.__kiruNode = vNode
  }
  return instance
}

export { withHydrationAfterAnchor }
