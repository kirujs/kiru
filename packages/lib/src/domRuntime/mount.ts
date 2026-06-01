import { __DEV__ } from "../env.js"
import { createOwner, disposeOwner, runWithOwner } from "./owner.js"
import type { DomAppHandle } from "./types.js"

let appId = 0

export function mount(
  init: (container: HTMLElement) => Element | Element[] | JSX.Element,
  container: HTMLElement,
  options?: { name?: string }
): DomAppHandle {
  const rootOwner = createOwner(null)
  const id = appId++
  const name = options?.name ?? `DomApp-${id}`

  let disposed = false

  const rootEl = runWithOwner(rootOwner, () => init(container))
  if (Array.isArray(rootEl)) {
    container.replaceChildren(...(rootEl as Element[]))
  } else {
    container.replaceChildren(rootEl as Node)
  }

  const app: DomAppHandle = {
    id,
    name,
    unmount() {
      if (disposed) return
      disposed = true
      disposeOwner(rootOwner)
      container.replaceChildren()
    },
  }

  if (__DEV__) {
    ;(container as HTMLElement & { __kiruDomApp?: DomAppHandle }).__kiruDomApp =
      app
  }

  return app
}
