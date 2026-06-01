import type { Signal } from "../signals/base.js"
import { isSignal } from "../signals/base.js"
import { domEffect } from "./effect.js"
import { mountBefore } from "./insert.js"
import { isComponentHandle } from "./component.js"
import type { ComponentHandle, Region } from "./types.js"

export function createRegion(anchor: Comment): Region {
  let current: ComponentHandle | Element | null = null

  const region: Region = {
    get current() {
      return current
    },
    mount(content) {
      region.unmount()
      current = content
      mountBefore(anchor, content)
    },
    unmount() {
      if (!current) return
      if (isComponentHandle(current)) {
        current.dispose()
      } else if (current.isConnected) {
        current.remove()
      }
      current = null
    },
  }

  return region
}

function readWhen(when: Signal<boolean> | (() => boolean)): boolean {
  return isSignal(when) ? when() : when()
}

export function domShow(
  when: Signal<boolean> | (() => boolean),
  anchor: Comment,
  factory: () => ComponentHandle | Element
): void {
  const region = createRegion(anchor)
  domEffect(() => {
    if (readWhen(when)) {
      region.mount(factory())
      return () => region.unmount()
    }
    region.unmount()
    return undefined
  })
}
