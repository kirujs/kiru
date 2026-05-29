import { regionAt, type CompileRegion } from "./compileRegions.js"
import { __DEV__ } from "./env.js"
import { KiruError } from "./error.js"
import { KIRU_HOLE_COMMENT_DATA } from "./template.js"
import type { SomeElement } from "./types.utils.js"

/** Compile-emitted traversal recipe opcodes (not a runtime language). */
export const StructuralWalkOp = {
  Element: 0,
  Hole: 1,
  Leave: 2,
} as const

export type StructuralWalkOpcode =
  (typeof StructuralWalkOp)[keyof typeof StructuralWalkOp]

export const STRUCTURAL_WALK_STRIDE = 2

const VOID_HTML_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
])

export const KIRU_HOLE_MARKER = "<!--#-->"

function isHoleComment(node: Node): node is Comment {
  return (
    node.nodeType === Node.COMMENT_NODE &&
    (node as Comment).data === KIRU_HOLE_COMMENT_DATA
  )
}

/** Build control stream from serialized markup (compile-time only). */
export function buildStructuralWalkFromMarkup(
  html: string,
  options?: { excludeShellRoot?: boolean }
): number[] {
  const walk: number[] = []
  let depth = 0
  let skippedRoot = false
  let pos = 0

  while (pos < html.length) {
    if (html.startsWith(KIRU_HOLE_MARKER, pos)) {
      walk.push(StructuralWalkOp.Hole, depth)
      pos += KIRU_HOLE_MARKER.length
      continue
    }
    if (html[pos] !== "<") {
      pos++
      continue
    }
    const close = html.indexOf(">", pos)
    if (close === -1) break
    const tagSlice = html.slice(pos, close + 1)
    pos = close + 1
    const closeTag = /^<\/([a-z][\w-]*)\s*>/i.exec(tagSlice)
    if (closeTag) {
      depth = Math.max(0, depth - 1)
      walk.push(StructuralWalkOp.Leave, depth)
      continue
    }
    const openTag = /^<([a-z][\w-]*)\b/i.exec(tagSlice)
    if (!openTag) continue
    const name = openTag[1]!.toLowerCase()
    const selfClosing =
      /\/>\s*$/.test(tagSlice) || VOID_HTML_TAGS.has(name)
    if (options?.excludeShellRoot && !skippedRoot) {
      skippedRoot = true
      // Live executor root is the shell; descendant ops use depth relative to it.
      continue
    }
    walk.push(StructuralWalkOp.Element, depth)
    if (!selfClosing) depth++
  }
  return walk
}

export function countStructuralWalkOps(
  walk: readonly number[],
  op: StructuralWalkOpcode
): number {
  let n = 0
  for (let i = 0; i < walk.length; i += STRUCTURAL_WALK_STRIDE) {
    if (walk[i] === op) n++
  }
  return n
}

type WalkFrame = {
  parent: Element
  childIdx: number
}

export type StructuralControlProjections = {
  readonly nodes: readonly SomeElement[]
  readonly anchors: readonly Comment[]
}

function skipNextElementSibling(frame: WalkFrame, children: NodeList): void {
  while (frame.childIdx < children.length) {
    const child = children[frame.childIdx]!
    frame.childIdx++
    if (child.nodeType === Node.ELEMENT_NODE) {
      break
    }
  }
}

/** Deterministic non-semantic interpreter of the compile-emitted control stream. */
export function executeStructuralControlStream(
  root: Element,
  walk: readonly number[],
  regions?: readonly CompileRegion[],
  options?: { skipNodeHolePayloads?: boolean }
): StructuralControlProjections {
  const nodes: SomeElement[] = []
  const anchors: Comment[] = []
  const stack: WalkFrame[] = [{ parent: root, childIdx: 0 }]
  let holeIndex = 0
  const skipNodeHolePayloads = options?.skipNodeHolePayloads ?? false

  for (let i = 0; i < walk.length; i += STRUCTURAL_WALK_STRIDE) {
    const op = walk[i] as StructuralWalkOpcode
    const depth = walk[i + 1]!

    if (op === StructuralWalkOp.Leave) {
      if (stack.length > 1) {
        stack.pop()
      }
      continue
    }

    while (stack.length < depth + 1) {
      throw new KiruError({
        message: `[kiru]: structuralWalk depth underflow at instruction ${i / STRUCTURAL_WALK_STRIDE}`,
      })
    }
    while (stack.length > depth + 1) {
      stack.pop()
    }

    const frame = stack[depth]!
    const children = frame.parent.childNodes

    if (op === StructuralWalkOp.Element) {
      let found = false
      while (frame.childIdx < children.length) {
        const child = children[frame.childIdx]!
        frame.childIdx++
        if (child.nodeType === Node.ELEMENT_NODE) {
          const el = child as SomeElement
          nodes.push(el)
          stack.push({ parent: el, childIdx: 0 })
          found = true
          break
        }
      }
      if (!found) {
        throw new KiruError({
          message: `[kiru]: structuralWalk Element could not project node at depth ${depth}`,
        })
      }
      continue
    }

    if (op === StructuralWalkOp.Hole) {
      let found = false
      while (frame.childIdx < children.length) {
        const child = children[frame.childIdx]!
        frame.childIdx++
        if (isHoleComment(child)) {
          anchors.push(child)
          found = true
          if (regions && skipNodeHolePayloads) {
            const region = regionAt(regions, holeIndex, "template")
            if (region.kind === "node" || region.kind === "component") {
              skipNextElementSibling(frame, children)
            }
          }
          holeIndex++
          break
        }
      }
      if (!found) {
        throw new KiruError({
          message: `[kiru]: structuralWalk Hole could not project marker at depth ${depth}`,
        })
      }
    }
  }

  return { nodes, anchors }
}

export function assertStructuralWalkInvariant(
  walk: readonly number[],
  structuralNodeCount: number,
  holeCount: number
): void {
  if (!__DEV__) return
  const elements = countStructuralWalkOps(walk, StructuralWalkOp.Element)
  const holes = countStructuralWalkOps(walk, StructuralWalkOp.Hole)
  if (elements !== structuralNodeCount) {
    throw new KiruError({
      message: `[kiru]: structuralWalk Element count mismatch (expected ${structuralNodeCount}, walk has ${elements})`,
    })
  }
  if (holes !== holeCount) {
    throw new KiruError({
      message: `[kiru]: structuralWalk Hole count mismatch (expected ${holeCount}, walk has ${holes})`,
    })
  }
}
