import { signal, Signal } from "../signals/base.js"
import { createVNodeId, isVNodeDeleted } from "../utils/vdom.js"
import { $INLINE_FN } from "../constants.js"
import { __DEV__ } from "../env.js"
import { node, setups } from "../globals.js"
import { executeWithTracking } from "../signals/tracking.js"
import { registerVNodeCleanup } from "../utils/index.js"

let currentAccessedPaths: Set<string[]> | null = null
const OWN_KEYS = `__KEYS__`

export interface Setup<Props extends {}> {
  readonly derive: <T>(
    selector: (props: Props extends Kiru.FC<infer P> ? P : Props) => T
  ) => Signal<T>
  readonly id: Signal<string>
  // Not reactive — for use in render functions only
  readonly props: Readonly<Props extends Kiru.FC<infer P> ? P : Props>
}

/**
 * Creates a per‑VNode setup context that can be used during
 * component setup to derive props into signals.
 *
 * @see https://kirujs.dev/docs/api/lifecycles#setup
 */
export function setup<Props extends {}>(): Setup<Props> {
  const vNode = node.current!
  if (__DEV__) {
    if (!vNode || vNode.type === $INLINE_FN) {
      throw new Error("setup() must be called inside a Kiru component")
    }
    if (vNode.render) {
      throw new Error("setup() cannot be used inside a render function")
    }
  }

  if (setups.has(vNode)) {
    return setups.get(vNode)!
  }

  const setup = createSetup<Props>(vNode)
  setups.set(vNode, setup)
  return setup
}

function createSetup<Props extends {}>(vNode: Kiru.VNode): Setup<Props> {
  let id: Signal<string>
  let propsProxy: InferredProps

  type InferredProps = Props extends Kiru.FC<infer R> ? R : Props
  const propSyncs = (vNode.propSyncs = []) as ((props: InferredProps) => void)[]

  let prevIndex = -1

  // Always points at latest props (updated in propSync) so selector and subs see current props
  const currentProps = { current: { ...vNode.props } as InferredProps }
  const deriveCleanups: Array<() => void> = []

  type DeriveEntry = { run: () => void; paths: Set<string[]> }
  const deriveEntries: DeriveEntry[] = []

  propSyncs.push((p) => {
    const old = currentProps.current as Record<string, unknown>
    const skip = new Set<DeriveEntry>()
    for (const entry of deriveEntries) {
      if (
        entry.paths.size > 0 &&
        propsUnchangedAtPaths(old, p as Record<string, unknown>, entry.paths)
      ) {
        skip.add(entry)
      }
    }
    currentProps.current = p
    for (const entry of deriveEntries) {
      if (!skip.has(entry)) entry.run()
    }
  })

  registerVNodeCleanup(vNode, "vnode:setup", () => {
    for (const cleanup of deriveCleanups) cleanup()
    setups.delete(vNode)
  })

  const setupResult: Setup<Props> = {
    derive<T>(
      selector: (props: Props extends Kiru.FC<infer P> ? P : Props) => T
    ) {
      const resultSig = signal(undefined!) as Signal<T>
      const unsubs = new Map<string, () => void>()
      const accessedPaths = new Set<string[]>()

      function sync() {
        accessedPaths.clear()
        currentAccessedPaths = accessedPaths

        const propsProxy = createProxy(
          currentProps.current as Record<string, unknown>
        ) as InferredProps

        resultSig.value = executeWithTracking({
          id: Signal.id(resultSig),
          fn: () => selector(propsProxy),
          onDepChanged: sync,
          subs: unsubs,
        })
        currentAccessedPaths = null
      }

      sync()
      const entry: DeriveEntry = { run: sync, paths: accessedPaths }
      deriveEntries.push(entry)
      deriveCleanups.push(() => {
        unsubs.forEach((u) => u())
        unsubs.clear()
        const i = deriveEntries.indexOf(entry)
        if (i !== -1) deriveEntries.splice(i, 1)
      })

      return resultSig
    },
    get id() {
      if (!id) {
        id = signal(createVNodeId(vNode))
        if (isVNodeDeleted(vNode)) {
          return id
        }
        if (node.current !== vNode) {
          registerVNodeCleanup(
            vNode,
            Signal.id(id),
            Signal.dispose.bind(null, id)
          )
        }
        prevIndex = vNode.index
        propSyncs.push(() => {
          if (prevIndex !== vNode.index) {
            id.value = createVNodeId(vNode)
            prevIndex = vNode.index
          }
        })
      }

      return id
    },
    get props() {
      return (propsProxy ??= new Proxy(
        {},
        {
          get(_, key) {
            if (typeof key === "symbol")
              return Reflect.get(currentProps.current as any, key)
            const v = (currentProps.current as any)[key]
            if (v !== null && typeof v === "object" && !Signal.isSignal(v)) {
              return createProxy(v)
            }
            return v
          },
        }
      ) as InferredProps)
    },
  }
  return setupResult
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

      // Sentinel: caller iterated keys of the object at this path —
      // re-run if the key sets differ
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

const proxyCache = new WeakMap<object, any>()

/**
 * Proxy that records accessed paths and primitives into the current
 * tracking context (currentAccessedPaths).
 */
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
        const v = holder[key as string]

        if (v !== null && typeof v === "object" && !Signal.isSignal(v)) {
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

  return cached
}
