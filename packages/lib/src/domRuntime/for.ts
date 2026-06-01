import type { Signal } from "../signals/base.js"
import { isSignal } from "../signals/base.js"
import { generateRandomID } from "../utils/index.js"
import { isComponentHandle } from "./component.js"
import { domEffect } from "./effect.js"
import { setComponentUpdateTarget } from "./instance.js"
import { lisIndices } from "./lis.js"
import {
  disposeMountContent,
  insertMountNodes,
  mountRoots,
  normalizeMountContent,
} from "./mountContent.js"
import {
  createOwner,
  disposeOwner,
  getCurrentOwner,
  registerOwnerCleanup,
  runWithOwner,
} from "./owner.js"
import { createRegion } from "./region.js"
import type { DomForProps, DomMountContent } from "./types.js"

type KeyedEntry<T> = {
  key: string | number
  content: DomMountContent
  lastItem?: T
  lastIndex?: number
}

type ForListOptions<T> = {
  container: Element
  before: Comment
  each: (() => readonly T[]) | Signal<readonly T[]>
  key: (item: T, index: number) => string | number
  childFn: (item: T, index: number) => DomMountContent
  forItemOwner: ReturnType<typeof createOwner>
}

function readEach<T>(
  each: (() => readonly T[]) | Signal<readonly T[]>
): readonly T[] {
  return isSignal(each) ? each() : each()
}

const referentialKeyIds = new WeakMap<object, number>()
let nextReferentialKeyId = 0

function defaultKey<T>(item: T, index: number): string | number {
  if (typeof item === "object" && item !== null) {
    let id = referentialKeyIds.get(item as object)
    if (id === undefined) {
      id = nextReferentialKeyId++
      referentialKeyIds.set(item as object, id)
    }
    return id
  }
  if (typeof item === "string" || typeof item === "number") return item
  return index
}

function resolveFallback(fallback: Element | (() => Element)): Element {
  return typeof fallback === "function" ? fallback() : fallback
}

function reorderWithLis(
  container: Element,
  ordered: Element[],
  before: Comment
): void {
  if (ordered.length === 0) return

  const end = before
  const current: Element[] = []
  for (let n = container.firstChild; n && n !== end; n = n.nextSibling) {
    if (n.nodeType === Node.ELEMENT_NODE) {
      current.push(n as Element)
    }
  }

  const indexOf = new Map<Element, number>()
  for (let i = 0; i < current.length; i++) {
    indexOf.set(current[i]!, i)
  }

  const indices = ordered.map((el) => indexOf.get(el) ?? -1)
  const stable = lisIndices(indices)

  for (let i = ordered.length - 1; i >= 0; i--) {
    if (stable.has(i)) continue
    const node = ordered[i]!
    const next = i === ordered.length - 1 ? end : ordered[i + 1]!
    if (node.nextSibling !== next) {
      container.insertBefore(node, next)
    }
  }
}

function syncElementFromClone(target: Element, source: Element): void {
  target.textContent = source.textContent
  const names = new Set<string>()
  for (const attr of source.attributes) {
    names.add(attr.name)
    target.setAttribute(attr.name, attr.value)
  }
  for (const attr of [...target.attributes]) {
    if (!names.has(attr.name)) {
      target.removeAttribute(attr.name)
    }
  }
}

function disposeFreshMountContent(
  fresh: DomMountContent,
  oldRoots: Element[]
): void {
  const nodes = normalizeMountContent(fresh)
  for (const node of nodes) {
    const root = isComponentHandle(node)
      ? (node.getRoot() as Element)
      : (node as Element)
    if (oldRoots.includes(root)) continue
    if (!Array.isArray(node) && isComponentHandle(node)) {
      node.dispose()
    } else if (root.isConnected) {
      root.remove()
    }
  }
}

function updateKeyedEntry<T>(
  container: Element,
  before: Comment,
  entry: KeyedEntry<T>,
  item: T,
  i: number,
  childFn: ForListOptions<T>["childFn"],
  forItemOwner: ForListOptions<T>["forItemOwner"]
): void {
  if (!Array.isArray(entry.content) && isComponentHandle(entry.content)) {
    runWithOwner(forItemOwner, () => {
      const prev = setComponentUpdateTarget(
        entry.content as import("./types.js").ComponentHandle
      )
      try {
        childFn(item, i)
      } finally {
        setComponentUpdateTarget(prev)
      }
    })
    entry.lastItem = item
    entry.lastIndex = i
    return
  }

  const fresh = runWithOwner(forItemOwner, () => childFn(item, i))
  const oldRoots = mountRoots(entry.content)
  const newRoots = mountRoots(fresh)

  const freshNodes = normalizeMountContent(fresh)
  if (
    oldRoots.length === newRoots.length &&
    oldRoots.length === 1 &&
    !(freshNodes.length === 1 && isComponentHandle(freshNodes[0]!))
  ) {
    syncElementFromClone(oldRoots[0]!, newRoots[0]!)
    disposeFreshMountContent(fresh, oldRoots)
    entry.lastItem = item
    entry.lastIndex = i
    return
  }

  disposeMountContent(entry.content)
  entry.content = fresh
  insertMountNodes(container, mountRoots(fresh), before)
  entry.lastItem = item
  entry.lastIndex = i
}

function reconcileKeyedList<T>(
  container: Element,
  before: Comment,
  entries: Map<string | number, KeyedEntry<T>>,
  options: ForListOptions<T>
): void {
  const { each, key, childFn, forItemOwner } = options
  const items = readEach(each)
  const nextKeys = new Set<string | number>()
  const ordered: KeyedEntry<T>[] = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i] as T
    const k = key(item, i)
    nextKeys.add(k)
    let entry = entries.get(k)
    if (!entry) {
      const content = runWithOwner(forItemOwner, () => childFn(item, i))
      entry = { key: k, content, lastItem: item, lastIndex: i }
      entries.set(k, entry)
      insertMountNodes(container, mountRoots(content), before)
    } else if (!Object.is(entry.lastItem, item)) {
      updateKeyedEntry(container, before, entry, item, i, childFn, forItemOwner)
    }
    entry.lastIndex = i
    ordered.push(entry)
  }

  for (const [k, entry] of entries) {
    if (!nextKeys.has(k)) {
      disposeMountContent(entry.content)
      entries.delete(k)
    }
  }

  const orderedRoots = ordered.flatMap((entry) => mountRoots(entry.content))
  reorderWithLis(container, orderedRoots, before)
}

function mountForList<T>(options: Omit<ForListOptions<T>, "forItemOwner">): void {
  const blockOwner = getCurrentOwner()
  const forItemOwner = createOwner(blockOwner)
  const full: ForListOptions<T> = { ...options, forItemOwner }

  const entries = new Map<string | number, KeyedEntry<T>>()
  let disposed = false
  const blockId = generateRandomID()

  const reconcile = () => {
    if (disposed) return
    reconcileKeyedList(full.container, full.before, entries, full)
  }

  domEffect(() => {
    reconcile()
  })

  const dispose = () => {
    if (disposed) return
    disposed = true
    for (const entry of entries.values()) {
      disposeMountContent(entry.content)
    }
    entries.clear()
    disposeOwner(forItemOwner)
  }

  if (blockOwner) {
    registerOwnerCleanup(blockOwner, blockId, dispose)
  }
}

export function For<T>(props: DomForProps<T>, anchor: Comment): Comment {
  const keyFn = props.key ?? defaultKey
  const parent = anchor.parentElement!

  mountForList({
    container: parent,
    before: anchor,
    each: props.each,
    key: keyFn,
    childFn: props.children,
  })

  if (props.fallback) {
    const region = createRegion(anchor)
    domEffect(() => {
      if (readEach(props.each).length === 0) {
        region.mount(resolveFallback(props.fallback!))
        return () => region.unmount()
      }
      region.unmount()
      return undefined
    })
  }

  return anchor
}
