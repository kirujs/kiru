import { node } from "../globals.js"
import { signal } from "../signals/index.js"
import type { Signal } from "../signals/base.js"

/**
 * Returns the current component props and a `synced` helper to create signals
 * that stay in sync with a prop (or derived value). Use during component setup
 * when the component returns a render function.
 *
 * @example
 * ```tsx
 * const Counter: Kiru.FC<CounterProps> = () => {
 *   const { synced } = useProps<CounterProps>()
 *   const count = synced((props) => props.count ?? 0)
 *
 *   return () => (
 *     <>
 *       <p>Count: {count}</p>
 *       <button onclick={() => count.value++}>Increment</button>
 *     </>
 *   )
 * }
 * ```
 */
export function useProps<P extends {}>(): {
  synced: <T>(selector: (props: P extends Kiru.FC<infer R> ? R : P) => T) => Signal<T>
} {
  const vNode = node.current
  if (!vNode) {
    throw new Error("useProps must be called inside a Kiru component")
  }

  const propSyncs = (vNode.propSyncs ??= [])
  type InferredProps = P extends Kiru.FC<infer R> ? R : P

  return {
    synced<T>(selector: (props: InferredProps) => T): Signal<T> {
      const props = vNode.props as InferredProps
      const sig = signal(selector(props))

      propSyncs.push((currentProps) => {
        sig.value = selector(currentProps as InferredProps)
      })

      return sig
    },
  }
}
