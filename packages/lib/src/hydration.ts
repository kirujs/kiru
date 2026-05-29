import { isBrowser } from "./env.js"
import { bridgeTraceReadiness } from "./remote/rpcTrace.js"
import type { MaybeDom, SomeDom } from "./types.utils.js"

const parents: SomeDom[] = []
const childIdx: number[] = []

export type HydrationTraceEntry = {
  op:
    | "push"
    | "pop"
    | "setChildIndex"
    | "bumpChildIndex"
    | "getCurrentChild"
    | "clear"
    | "cursorContext"
    | string
  parent?: string
  idx?: number
  node?: string
  ctx?: string
  vnode?: string
  action?: string
  note?: string
}

const TRACE_LIMIT = 4000

function describeNode(node: Node | null | undefined): string {
  if (!node) return "null"
  if (node.nodeType === Node.TEXT_NODE) return `#text("${node.textContent ?? ""}")`
  if (node.nodeType === Node.COMMENT_NODE)
    return `#comment(${(node as Comment).data})`
  if (node instanceof Element) {
    const id = node.id ? `#${node.id}` : ""
    return `${node.tagName.toLowerCase()}${id}`
  }
  return node.nodeName.toLowerCase()
}

function traceHydration(entry: HydrationTraceEntry): void {
  if (!isBrowser) return
  const w = window as typeof window & {
    __kiruHydrationTrace?: HydrationTraceEntry[]
    __kiruHydrationErrors?: string[]
  }
  const trace = (w.__kiruHydrationTrace ??= [])
  trace.push(entry)
  if (trace.length > TRACE_LIMIT) trace.splice(0, trace.length - TRACE_LIMIT)
}

export function traceHydrationCursorContext(ctx: string): void {
  traceHydration({ op: "cursorContext", ctx })
}

export function traceHydrationVNodeEvent(
  action: string,
  ctx: string,
  detail?: {
    vnode?: string
    note?: string
  }
): void {
  traceHydration({
    op: "cursorContext",
    action,
    ctx,
    vnode: detail?.vnode,
    note: detail?.note,
  })
}

export function traceHydrationError(message: string): void {
  if (!isBrowser) return
  const w = window as typeof window & {
    __kiruHydrationErrors?: string[]
  }
  ;(w.__kiruHydrationErrors ??= []).push(message)
}

/** Dev/test readiness diagnostics (resource, scheduler, forms, bindings). */
export function traceReadiness(
  kind: "resource" | "scheduler" | "form" | "binding",
  detail: Record<string, string | number | boolean | undefined>
): void {
  const note = Object.entries(detail)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(" ")
  traceHydration({ op: "cursorContext", ctx: `readiness:${kind}`, note })
  bridgeTraceReadiness(kind, detail)
}

/** Browser-only hydration ring buffer for Cypress / devtools. */
export function dumpHydrationTrace(): {
  trace: HydrationTraceEntry[]
  errors: string[]
} {
  if (!isBrowser) return { trace: [], errors: [] }
  const w = window as typeof window & {
    __kiruHydrationTrace?: HydrationTraceEntry[]
    __kiruHydrationErrors?: string[]
  }
  return {
    trace: [...(w.__kiruHydrationTrace ?? [])],
    errors: [...(w.__kiruHydrationErrors ?? [])],
  }
}

export const hydrationStack = {
  bumpChildIndex() {
    childIdx[childIdx.length - 1]++
    traceHydration({
      op: "bumpChildIndex",
      parent: describeNode(this.getCurrentParent() as Node | undefined),
      idx: childIdx[childIdx.length - 1],
    })
  },
  getCurrentChild(): MaybeDom {
    const idx = childIdx[childIdx.length - 1]
    const parent = this.getCurrentParent() as Node | undefined
    const dom = parent?.childNodes[idx] ?? null
    traceHydration({
      op: "getCurrentChild",
      parent: describeNode(parent),
      idx,
      node: describeNode(dom),
    })
    // @ts-expect-error TODO: We're ignoring the possibility of encountering comment or cdata nodes.
    // Not really a problem for now since we don't render those but should be checked anyway.
    return this.getCurrentParent().childNodes[idx]
  },
  getCurrentParent() {
    return parents[parents.length - 1]
  },
  clear() {
    parents.length = 0
    childIdx.length = 0
    traceHydration({ op: "clear" })
  },
  pop() {
    const parent = this.getCurrentParent() as Node | undefined
    const idx = childIdx[childIdx.length - 1]
    parents.pop()
    childIdx.pop()
    traceHydration({
      op: "pop",
      parent: describeNode(parent),
      idx,
    })
  },
  push(el: SomeDom) {
    parents.push(el)
    childIdx.push(0)
    traceHydration({
      op: "push",
      parent: describeNode(el as unknown as Node),
      idx: 0,
    })
  },
  setChildIndex(index: number) {
    childIdx[childIdx.length - 1] = index
    traceHydration({
      op: "setChildIndex",
      parent: describeNode(this.getCurrentParent() as Node | undefined),
      idx: index,
    })
  },
}

/** Seed legacy hydration cursor for dynamic content after a template hole anchor. */
export function withHydrationAfterAnchor<T>(
  parentEl: Element,
  anchor: Comment,
  fn: () => T
): T {
  hydrationStack.push(parentEl as SomeDom)
  const nodes = parentEl.childNodes
  let idx = 0
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i] === anchor) {
      idx = i + 1
      break
    }
  }
  hydrationStack.setChildIndex(idx)
  try {
    return fn()
  } finally {
    hydrationStack.pop()
  }
}

function childIndexOf(parentEl: Element, target: Node): number {
  const nodes = parentEl.childNodes
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i] === target) return i
  }
  return -1
}

/**
 * Seed hydration cursor for template-hole payloads that are rendered immediately
 * after the hole anchor in SSR output.
 */
export function withHydrationInTemplateHole<T>(
  parentEl: Element,
  anchor: Comment,
  _topLevelSpan: number,
  startOffset: number,
  fn: () => T,
  onConsumed?: (count: number) => void
): T {
  hydrationStack.push(parentEl as SomeDom)
  const anchorIdx = childIndexOf(parentEl, anchor)
  const start = (anchorIdx < 0 ? 0 : anchorIdx + 1) + startOffset
  hydrationStack.setChildIndex(start)
  try {
    const out = fn()
    const end = childIdx[childIdx.length - 1] ?? start
    onConsumed?.(Math.max(0, end - start))
    return out
  } finally {
    hydrationStack.pop()
  }
}
