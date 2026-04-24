import { __DEV__ } from "./env.js"
import { ROOT_OWNER_TYPE } from "./dom/metadata.js"
import { unmount as domUnmount } from "./dom/runtime.js"
import { createRange } from "./dom/range.js"
import { reconcileChildren } from "./dom/reconcile.js"
import { renderRootSync } from "./scheduler.js"
import { renderMode } from "./globals.js"

export interface AppHandleOptions {
  /**
   * App name - shown in devtools
   */
  name?: string
}

export interface AppHandle {
  id: number
  name: string
  root: Kiru.KiruNode
  render(children: JSX.Element): void
  unmount(): void
}

let appId = 0

export function mount(
  children: JSX.Element,
  container: Kiru.ContainerElement,
  options?: AppHandleOptions
): AppHandle {
  renderMode.current = "dom"
  if (__DEV__ && container.__kiruApp) {
    return container.__kiruApp as AppHandle
  }

  const root = createRootOwner(container)
  const id = appId++
  const name = options?.name ?? `App-${id}`

  const app: AppHandle = {
    id,
    name,
    root,
    render,
    unmount,
  }

  function render(children: JSX.Element) {
    root.props = { children }
    renderRootSync(root)
  }

  function unmount() {
    while (container.firstChild) {
      domUnmount(container.firstChild)
    }
    root.props = { children: null }
    if (__DEV__) {
      delete (container as HTMLElement).__kiruApp
    }
    window.__kiru.emit("unmount", app)
  }

  root.app = app
  if (__DEV__) container.__kiruApp = app

  render(children)
  window.__kiru.emit("mount", app)
  // @ts-expect-error
  if (__DEV__ && !globalThis.__KIRU_READY__) {
    // @ts-expect-error
    globalThis.__KIRU_READY__ = true

    queueMicrotask(() => {
      window.dispatchEvent(new Event("kiru:ready"))
    })
  }

  return app
}

function createRootOwner(container: Kiru.ContainerElement): Kiru.KiruNode {
  const root: Kiru.KiruNode = {
    type: ROOT_OWNER_TYPE,
    key: null,
    props: { children: null as unknown },
    parent: null,
    index: 0,
    dirty: false,
    render: (props: Record<string, unknown>) => {
      const children = props.children
      const hadRange = !!root.range
      const range = root.range ?? createRange(root)
      if (!hadRange) container.append(range.start, range.end)
      const values = Array.isArray(children) ? children : [children]
      reconcileChildren(range, values)
      return null
    },
  }
  return root
}
