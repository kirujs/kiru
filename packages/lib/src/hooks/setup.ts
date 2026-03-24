import { signal, Signal } from "../signals/base.js"
import { createVNodeId, isVNodeDeleted } from "../utils/vdom.js"
import { __DEV__ } from "../env.js"
import { node, setups } from "../globals.js"
import {
  tracking,
  type TrackingStackObservations,
} from "../signals/tracking.js"
import { registerVNodeCleanup } from "../utils/index.js"

export interface Setup<Props extends {}> {
  readonly derive: <T>(
    selector: (props: Props extends Kiru.FC<infer P> ? P : Props) => T
  ) => Signal<T>
  readonly id: Signal<string>
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
    if (!vNode) {
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

  type InferredProps = Props extends Kiru.FC<infer R> ? R : Props
  const propSyncs = (vNode.propSyncs = []) as ((props: InferredProps) => void)[]

  let prevIndex = -1

  // Always points at latest props (updated in propSync) so selector and subs see current props
  const currentProps = { current: { ...vNode.props } as InferredProps }
  const deriveCleanups: Array<() => void> = []

  type DeriveEntry = { run: () => void; accessedPaths: Set<string> }
  const deriveEntries: DeriveEntry[] = []

  propSyncs.push((p) => {
    const old = currentProps.current as Record<string, unknown>
    const skip = new Set<DeriveEntry>()
    for (const entry of deriveEntries) {
      if (
        entry.accessedPaths.size > 0 &&
        propsUnchangedAtPaths(
          old,
          p as Record<string, unknown>,
          entry.accessedPaths
        )
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
      const accessedPaths = new Set<string>()

      function sync() {
        accessedPaths.clear()
        const propsProxy = createPropsProxy(
          currentProps.current as Record<string, unknown>,
          accessedPaths
        ) as InferredProps
        const observations: TrackingStackObservations = new Map()
        tracking.stack.push(observations)
        const value = selector(propsProxy)
        tracking.stack.pop()
        // Always assign and notify so the component re-renders when the derived value changes
        // (e.g. when parent passes a different signal ref like toggle switching count/double).
        resultSig.value = value

        for (const [sid, unsub] of unsubs) {
          if (!observations.has(sid)) {
            unsub()
            unsubs.delete(sid)
          }
        }
        for (const [sid, observedSig] of observations) {
          if (!unsubs.has(sid)) {
            try {
              unsubs.set(sid, observedSig.subscribe(sync))
            } catch {
              // Signal may be disposed after HMR; skip subscribing
            }
          }
        }
      }

      sync()
      const entry: DeriveEntry = { run: sync, accessedPaths }
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
          Signal.dispose(id)
          return id
        }
        if (node.current !== vNode) {
          // @ts-expect-error
          registerVNodeCleanup(vNode, id.$id, Signal.dispose.bind(null, id))
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
      return currentProps.current
    },
  }
  return setupResult
}
function propsUnchangedAtPaths(
  oldProps: Record<string, unknown>,
  newProps: Record<string, unknown>,
  paths: Set<string>
): boolean {
  for (const path of paths) {
    if (!Object.is(getAtPath(oldProps, path), getAtPath(newProps, path))) {
      return false
    }
  }
  return true
}

function getAtPath(obj: Record<string, unknown>, path: string): unknown {
  let cur: unknown = obj
  for (const key of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined
    cur = (cur as Record<string, unknown>)[key]
  }
  return cur
}

/**
 * Proxy that records paths and wraps signals. We only add to accessedPaths when
 * we hit a signal (the leaf we subscribe to), so propSync skip only compares
 * signal refs. Container objects (e.g. "data") are new every render and would
 * always fail the skip.
 */
function createPropsProxy<P extends Record<string, unknown>>(
  props: P,
  accessedPaths: Set<string>,
  pathPrefix?: string
): P {
  return new Proxy(props, {
    get(holder, key: string) {
      const path = pathPrefix ? `${pathPrefix}.${key}` : key
      const v = holder[key]
      if (Signal.isSignal(v)) {
        accessedPaths.add(path) // only record path for signal leaves
        return v
      }
      if (v !== null && typeof v === "object" && !Array.isArray(v)) {
        return createPropsProxy(
          v as Record<string, unknown>,
          accessedPaths,
          path
        ) as P[keyof P]
      }
      accessedPaths.add(path) // primitive leaf
      return v
    },
  }) as P
}
