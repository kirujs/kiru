import { computed, signal } from "../signals/index.js"
import { createVNodeId } from "../utils/vdom.js"
import { __DEV__ } from "../env.js"
import { node, setups } from "../globals.js"
import type { Signal } from "../signals/base.js"

export interface Setup<Props extends {}> {
  readonly derive: <T>(
    selector: (props: Props extends Kiru.FC<infer P> ? P : Props) => T
  ) => Signal<T>
  readonly id: Signal<string>
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

  return {
    derive(selector) {
      const props = { ...vNode.props } as InferredProps
      const sig = computed(() => selector(props))
      propSyncs.push((p) => (sig.value = selector(p)))
      return sig
    },
    get id() {
      if (!id) {
        id = signal(createVNodeId(vNode))
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
  }
}
