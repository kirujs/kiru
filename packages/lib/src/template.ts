import { $STATIC_CHILDREN_LIST, FLAG_HOISTED } from "./constants.js"
import type { CompileRegion } from "./compileRegions.js"
import { validateRegions } from "./compileRegions.js"
import { __DEV__ } from "./env.js"
import { KiruError } from "./error.js"

export type {
  CompileRegion,
  CompileRegionKind,
  RegionDomain,
} from "./compileRegions.js"
export {
  validateRegions,
  regionAt,
  regionTargetsSlot,
} from "./compileRegions.js"

export const $KIRU_TEMPLATE = Symbol.for("kiru.template")

/** Comment `data` for structural holes (`<!--#-->`). */
export const KIRU_HOLE_COMMENT_DATA = "#"

export type TemplateRoot = {
  readonly __kiruTemplate: typeof $KIRU_TEMPLATE
  readonly html: string
  readonly holeCount: number
  readonly holeChildren?: readonly unknown[]
  readonly regions?: readonly CompileRegion[]
}

export type TemplateFactory = () => TemplateRoot

const fragmentCache = new Map<string, DocumentFragment>()

export function isTemplateRoot(thing: unknown): thing is TemplateRoot {
  return (
    typeof thing === "object" &&
    thing !== null &&
    (thing as TemplateRoot).__kiruTemplate === $KIRU_TEMPLATE
  )
}

export function _template(html: string, holeCount = 0): TemplateFactory {
  const factory: TemplateFactory = () => ({
    __kiruTemplate: $KIRU_TEMPLATE,
    html,
    holeCount,
  })
  factory.toString = () => html
  return factory
}

/** Tag a hoisted region children array for static list reconciliation. */
export function tagStaticChildrenList<T>(children: T[]): T[] {
  Object.defineProperty(children, $STATIC_CHILDREN_LIST, {
    value: true,
    enumerable: false,
  })
  return children
}

/** Attach runtime hole children to a template factory product. */
export function createHoledTemplate(
  factory: TemplateFactory,
  holeChildren: unknown[],
  regions?: readonly CompileRegion[]
): TemplateRoot {
  const base = factory()
  const count = base.holeCount
  if (__DEV__ && holeChildren.length !== count) {
    throw new KiruError({
      message: `[kiru]: createHoledTemplate expected ${count} hole children, got ${holeChildren.length}`,
    })
  }
  if (__DEV__ && regions !== undefined) {
    if (regions.length !== count) {
      throw new KiruError({
        message: `[kiru]: createHoledTemplate expected ${count} regions, got ${regions.length}`,
      })
    }
    validateRegions(regions, "template")
  }
  return {
    __kiruTemplate: $KIRU_TEMPLATE,
    html: base.html,
    holeCount: count,
    holeChildren,
    regions,
  }
}

export function getTemplateFragment(html: string): DocumentFragment {
  let fragment = fragmentCache.get(html)
  if (!fragment) {
    fragment = parseHtmlToFragment(html)
    fragmentCache.set(html, fragment)
  }
  return fragment
}

function hasBrowserDocument(): boolean {
  return typeof document !== "undefined"
}

export function cloneTemplateDom(html: string): Element {
  if (!hasBrowserDocument()) {
    if (__DEV__) {
      throw new KiruError({
        message:
          "[kiru]: cloneTemplateDom requires a browser environment (use SSR HTML + hydrate for templates).",
      })
    }
    throw new Error("cloneTemplateDom requires a browser environment")
  }
  const fragment = getTemplateFragment(html)
  const root = fragment.firstElementChild
  if (!root) {
    throw new KiruError({
      message: `[kiru]: template HTML must contain a single root element: ${html.slice(
        0,
        80
      )}`,
    })
  }
  if (fragment.childElementCount > 1) {
    throw new KiruError({
      message: `[kiru]: template HTML must have only one root element.`,
    })
  }
  return root.cloneNode(true) as Element
}

/** Structural `<!--#-->` anchors in a template shell (optionally capped). */
export function findTemplateHoleAnchors(
  root: Element,
  limit?: number
): Comment[] {
  const anchors: Comment[] = []
  const walk = (node: Node) => {
    if (limit !== undefined && anchors.length >= limit) return
    if (
      node.nodeType === Node.COMMENT_NODE &&
      (node as Comment).data === KIRU_HOLE_COMMENT_DATA
    ) {
      anchors.push(node as Comment)
    }
    for (const child of node.childNodes) {
      if (limit !== undefined && anchors.length >= limit) return
      walk(child)
    }
  }
  walk(root)
  return anchors
}

/** Resolve shell anchors; reuse cached comments when the shell is stable. */
export function resolveTemplateHoleAnchors(
  root: Element,
  holeCount: number,
  cached?: readonly Comment[] | null
): Comment[] {
  if (holeCount === 0) return []
  if (cached && cached.length === holeCount) {
    return cached as Comment[]
  }
  const anchors = findTemplateHoleAnchors(root, holeCount)
  if (__DEV__ && anchors.length !== holeCount) {
    throw new KiruError({
      message: `[kiru]: template hole count mismatch (expected ${holeCount}, found ${anchors.length})`,
    })
  }
  return anchors
}

function parseHtmlToFragment(html: string): DocumentFragment {
  const tpl = document.createElement("template")
  tpl.innerHTML = html
  return tpl.content
}

/** Mark a hoisted jsx root so the reconciler can skip redundant work. */
export function markHoisted<T extends Kiru.Element>(element: T): T {
  const meta = element.meta ?? {}
  element.meta = { ...meta, flags: (meta.flags ?? 0) | FLAG_HOISTED }
  return element
}

/** Attach slot-domain compile regions (and optional flags) to a jsx element. */
export function regionElement(
  element: Kiru.Element,
  regions: readonly CompileRegion[],
  flags?: number
): Kiru.Element {
  if (__DEV__) {
    validateRegions(regions, "slot")
  }
  const meta = element.meta ?? {}
  const mergedFlags =
    flags !== undefined ? (meta.flags ?? 0) | flags : meta.flags
  element.meta = {
    ...meta,
    ...(mergedFlags !== undefined ? { flags: mergedFlags } : {}),
    ...(regions.length > 0 ? { regions } : {}),
  }
  return element
}
