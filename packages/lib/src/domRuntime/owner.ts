import { __DEV__ } from "../env.js"
import { KiruError } from "../error.js"
import { generateRandomID } from "../utils/index.js"
import type { Owner } from "./types.js"

export const owner = {
  current: null as Owner | null,
}

export function getCurrentOwner(): Owner | null {
  return owner.current
}

export function createOwner(parent: Owner | null = null): Owner {
  const o: Owner = {
    id: generateRandomID(),
    parent,
    children: new Set(),
    cleanups: new Map(),
    disposed: false,
  }
  parent?.children.add(o)
  return o
}

export function runWithOwner<T>(next: Owner, fn: () => T): T {
  const prev = owner.current
  owner.current = next
  try {
    return fn()
  } finally {
    owner.current = prev
  }
}

export function registerOwnerCleanup(
  o: Owner,
  id: string,
  cleanup: () => void
): void {
  if (__DEV__ && o.disposed) {
    throw new KiruError({
      message: "[kiru/dom]: cannot register cleanup on disposed owner",
    })
  }
  o.cleanups.set(id, cleanup)
}

export function disposeOwner(o: Owner): void {
  if (o.disposed) return
  o.disposed = true

  for (const child of [...o.children]) {
    disposeOwner(child)
  }
  o.children.clear()

  for (const cleanup of o.cleanups.values()) {
    cleanup()
  }
  o.cleanups.clear()

  o.parent?.children.delete(o)
}
