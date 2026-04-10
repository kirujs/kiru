import { setup } from "kiru"
import { setRef } from "kiru/utils"

export function createRefProxy<T>(
  callback?: Kiru.RefCallback<T>
): Kiru.RefObject<T | null> {
  const $ = setup<Kiru.VNode["props"]>()
  const propsRef = $.derive((p) => p.ref)

  let current: T | null = null
  propsRef.subscribe((next, prev) => {
    if (prev) setRef(prev, null)
    if (next) setRef(next, current)
  })

  return {
    get current() {
      return current
    },
    set current(value) {
      current = value
      callback?.(value)

      const currentPropsRef = propsRef.peek()
      if (currentPropsRef) {
        setRef(currentPropsRef, value)
      }
    },
  }
}
