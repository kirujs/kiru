import { isSignal, signal, SignalHelpers, type Signal } from "../signals/base.js"
import { executeWithTracking } from "../signals/tracking.js"

const OWN_KEYS = `__KEYS__`

let currentAccessedPaths: Set<string[]> | null = null

export interface DomSetup<P extends Record<string, unknown>> {
  readonly derive: <T>(selector: (props: P) => T) => Signal<T>
  readonly props: Readonly<P>
}

type DeriveEntry = { run: () => void; paths: Set<string[]> }
type PropBoundEffectEntry = { run: () => void; paths: Set<string[]> }

export interface DomComponentInstance<P extends Record<string, unknown>> {
  readonly currentProps: P
  readonly propSyncs: Array<(props: P) => void>
  readonly deriveEntries: DeriveEntry[]
  readonly propBoundEffects: PropBoundEffectEntry[]
  registerCleanup(cleanup: () => void): void
  syncProps(props: P): void
  dispose(): void
}

export function runWithPropPathTracking<T>(fn: () => T): {
  value: T
  paths: Set<string[]>
} {
  const paths = new Set<string[]>()
  const prev = currentAccessedPaths
  currentAccessedPaths = paths
  try {
    const value = fn()
    if (prev) {
      for (const p of paths) prev.add(p)
      return { value, paths: prev }
    }
    return { value, paths }
  } finally {
    currentAccessedPaths = prev
  }
}

export function registerPropBoundEffect(
  instance: DomComponentInstance<Record<string, unknown>>,
  paths: Set<string[]>,
  run: () => void
): () => void {
  const entry: PropBoundEffectEntry = { paths, run }
  instance.propBoundEffects.push(entry)
  return () => {
    const i = instance.propBoundEffects.indexOf(entry)
    if (i !== -1) instance.propBoundEffects.splice(i, 1)
  }
}

function propsUnchangedAtPaths(
  oldProps: Record<string, unknown>,
  newProps: Record<string, unknown>,
  accessedPaths: Set<string[]>
): boolean {
  outer: for (const path of accessedPaths) {
    let a: unknown = oldProps
    let b: unknown = newProps

    for (let i = 0; i < path.length; i++) {
      const key = path[i]

      if (key === OWN_KEYS) {
        if (a === b) continue outer
        if (
          a == null ||
          b == null ||
          typeof a !== "object" ||
          typeof b !== "object"
        ) {
          return false
        }
        const aKeys = Object.keys(a)
        const bKeys = Object.keys(b)
        if (aKeys.length !== bKeys.length) return false
        for (const k of aKeys) {
          if (!(k in (b as object))) return false
        }
        continue outer
      }

      if (a === b) continue outer
      if (
        a == null ||
        b == null ||
        typeof a !== "object" ||
        typeof b !== "object"
      ) {
        if (!Object.is(a, b)) return false
        continue outer
      }
      a = (a as Record<string, unknown>)[key]
      b = (b as Record<string, unknown>)[key]
    }

    if (!Object.is(a, b)) return false
  }

  return true
}

const proxyCache = new WeakMap<object, unknown>()

function createProxy<P extends Record<string, unknown>>(
  source: P,
  path: string[] = []
): P {
  let cached = proxyCache.get(source)

  if (!cached) {
    cached = new Proxy(source, {
      get(holder, key: string | symbol) {
        if (typeof key === "symbol") return Reflect.get(holder, key)

        const keyPath = [...path, key as string]
        const v = (holder as Record<string, unknown>)[key as string]

        if (v !== null && typeof v === "object" && !isSignal(v)) {
          return createProxy(v as Record<string, unknown>, keyPath)
        }

        currentAccessedPaths?.add(keyPath)
        return v
      },
      has(holder, key: string | symbol) {
        if (typeof key === "symbol") return Reflect.has(holder, key)
        currentAccessedPaths?.add([...path, key as string])
        return key in holder
      },
      ownKeys(holder) {
        currentAccessedPaths?.add([...path, OWN_KEYS])
        return Reflect.ownKeys(holder)
      },
    })

    proxyCache.set(source, cached)
  }

  return cached as P
}

export function createDomComponentInstance<P extends Record<string, unknown>>(
  initialProps: P
): DomComponentInstance<P> {
  const propSyncs: Array<(props: P) => void> = []
  const instanceCleanups: Array<() => void> = []
  const deriveEntries: DeriveEntry[] = []
  const propBoundEffects: PropBoundEffectEntry[] = []

  const currentProps = { current: { ...initialProps } as P }

  propSyncs.push((p) => {
    const old = currentProps.current as Record<string, unknown>
    const skipDerive = new Set<DeriveEntry>()
    const skipPropEffects = new Set<PropBoundEffectEntry>()
    for (const entry of deriveEntries) {
      if (
        entry.paths.size > 0 &&
        propsUnchangedAtPaths(old, p as Record<string, unknown>, entry.paths)
      ) {
        skipDerive.add(entry)
      }
    }
    for (const entry of propBoundEffects) {
      if (
        entry.paths.size > 0 &&
        propsUnchangedAtPaths(old, p as Record<string, unknown>, entry.paths)
      ) {
        skipPropEffects.add(entry)
      }
    }
    currentProps.current = p
    for (const entry of deriveEntries) {
      if (!skipDerive.has(entry)) entry.run()
    }
    const propEffectsSnapshot = [...propBoundEffects]
    for (const entry of propEffectsSnapshot) {
      if (!skipPropEffects.has(entry)) entry.run()
    }
  })

  const instance: DomComponentInstance<P> = {
    get currentProps() {
      return currentProps.current
    },
    propSyncs,
    deriveEntries,
    propBoundEffects,
    registerCleanup(cleanup: () => void) {
      instanceCleanups.push(cleanup)
    },
    syncProps(props: P) {
      for (const sync of propSyncs) sync(props)
    },
    dispose() {
      for (const cleanup of instanceCleanups) cleanup()
      instanceCleanups.length = 0
      deriveEntries.length = 0
      propBoundEffects.length = 0
      propSyncs.length = 0
    },
  }

  return instance
}

let currentDomInstance: DomComponentInstance<Record<string, unknown>> | null =
  null

export function getCurrentDomInstance<
  P extends Record<string, unknown> = Record<string, unknown>,
>(): DomComponentInstance<P> {
  if (!currentDomInstance) {
    throw new Error(
      "[kiru/dom]: setupDom() must be called during component setup"
    )
  }
  return currentDomInstance as DomComponentInstance<P>
}

export function runWithDomInstance<P extends Record<string, unknown>, T>(
  instance: DomComponentInstance<P>,
  fn: () => T
): T {
  const prev = currentDomInstance
  currentDomInstance = instance as DomComponentInstance<Record<string, unknown>>
  try {
    return fn()
  } finally {
    currentDomInstance = prev
  }
}

export function setupDom<P extends Record<string, unknown>>(): DomSetup<P> {
  return setupDomOnInstance(getCurrentDomInstance<P>())
}

function setupDomOnInstance<P extends Record<string, unknown>>(
  instance: DomComponentInstance<P>
): DomSetup<P> {
  let propsProxy: P | undefined

  const setupResult: DomSetup<P> = {
    derive<T>(selector: (props: P) => T) {
      const resultSig = signal<T>(undefined!)
      const unsubs = new Map<string, () => void>()
      const accessedPaths = new Set<string[]>()

      function sync() {
        accessedPaths.clear()
        currentAccessedPaths = accessedPaths

        const proxied = createProxy(
          instance.currentProps as Record<string, unknown>
        ) as P

        resultSig.set(
          executeWithTracking({
            id: SignalHelpers.id(resultSig),
            fn: () => selector(proxied),
            onDepChanged: sync,
            subs: unsubs,
          })
        )
        currentAccessedPaths = null
      }

      sync()
      const entry: DeriveEntry = { run: sync, paths: accessedPaths }
      instance.deriveEntries.push(entry)
      instance.registerCleanup(() => {
        unsubs.forEach((u) => u())
        unsubs.clear()
        const i = instance.deriveEntries.indexOf(entry)
        if (i !== -1) instance.deriveEntries.splice(i, 1)
      })

      return resultSig
    },
    get props() {
      return (propsProxy ??= new Proxy(
        {},
        {
          get(_, key) {
            if (typeof key === "symbol")
              return Reflect.get(instance.currentProps as object, key)
            const keyPath = [key as string]
            currentAccessedPaths?.add(keyPath)
            const v = (instance.currentProps as Record<string, unknown>)[
              key as string
            ]
            if (v !== null && typeof v === "object" && !isSignal(v)) {
              return createProxy(v as Record<string, unknown>, keyPath)
            }
            return v
          },
        }
      ) as P)
    },
  }

  return setupResult
}

/** When set, createComponent updates this handle instead of mounting anew (For keyed reuse). */
export let componentUpdateTarget: import("./types.js").ComponentHandle | null =
  null

export function setComponentUpdateTarget(
  target: import("./types.js").ComponentHandle | null
): import("./types.js").ComponentHandle | null {
  const prev = componentUpdateTarget
  componentUpdateTarget = target
  return prev
}
