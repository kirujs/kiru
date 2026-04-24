import { signal, Signal } from "../signals/base.js"
import { node, setups } from "../globals.js"
import { executeWithTracking } from "../signals/tracking.js"
import { createStableId, isNodeDeleted } from "../utils/node.js"

export interface Setup<Props extends {}> {
  readonly derive: <T>(
    selector: (props: Props extends Kiru.FC<infer P> ? P : Props) => T
  ) => Signal<T>
  readonly id: Signal<string>
  readonly props: Readonly<Props extends Kiru.FC<infer P> ? P : Props>
}

export function setup<Props extends {}>(): Setup<Props> {
  const current = node.current
  if (!current) {
    throw new Error("setup() must be called inside a Kiru component")
  }
  if (setups.has(current)) return setups.get(current)! as Setup<Props>

  type InferredProps = Props extends Kiru.FC<infer R> ? R : Props
  const currentProps = { current: { ...current.props } as InferredProps }
  const propSyncs = (current.propSyncs ??= []) as Array<
    (props: InferredProps) => void
  >
  const cleanupFns: Array<() => void> = []
  const deriveSyncs: Array<() => void> = []

  const setupResult: Setup<Props> = {
    derive<T>(selector: (props: InferredProps) => T) {
      const resultSig = signal(undefined!) as Signal<T>
      const unsubs = new Map<string, () => void>()
      const sync = () => {
        resultSig.value = executeWithTracking({
          id: Signal.id(resultSig),
          fn: () => selector(currentProps.current),
          onDepChanged: sync,
          subs: unsubs,
        })
      }
      sync()
      deriveSyncs.push(sync)
      cleanupFns.push(() => {
        unsubs.forEach((u) => u())
        unsubs.clear()
        const idx = deriveSyncs.indexOf(sync)
        if (idx >= 0) deriveSyncs.splice(idx, 1)
      })
      return resultSig
    },
    id: signal(createStableId(current as Kiru.KiruNode)),
    get props() {
      return currentProps.current
    },
  }

  propSyncs.push((props) => {
    currentProps.current = props
    deriveSyncs.forEach((sync) => sync())
  })
  let prevIndex = (current as Kiru.KiruNode).index
  propSyncs.push(() => {
    if (isNodeDeleted(current as Kiru.KiruNode)) return
    const owner = current as Kiru.KiruNode
    if (owner.index !== prevIndex) {
      setupResult.id.value = createStableId(owner)
      prevIndex = owner.index
    }
  })
  ;(current.cleanups ??= {})["setup"] = () => {
    cleanupFns.forEach((fn) => fn())
    setups.delete(current)
  }
  setups.set(current, setupResult as Setup<any>)
  return setupResult
}
