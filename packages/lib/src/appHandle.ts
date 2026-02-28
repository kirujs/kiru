import { FLAG_STATIC_DOM } from "./constants.js"
import { __DEV__ } from "./env.js"
import { renderRootSync, requestUpdate } from "./scheduler.js"
import { createVNode } from "./vNode.js"
import type { SomeDom } from "./types.utils.js"

type VNode = Kiru.VNode

export interface AppHandleOptions {
  /**
   * App name - shown in devtools
   */
  name?: string
}

export interface AppHandle {
  id: number
  name: string
  rootNode: VNode
  render(children: JSX.Element): void
  unmount(): void
}

let appId = 0

export function mount(
  children: JSX.Element,
  container: Kiru.ContainerElement,
  options?: AppHandleOptions
): AppHandle {
  if (__DEV__) {
    if (container.__kiruNode) {
      throw new Error(
        "[kiru]: container in use - call unmount on the previous app first."
      )
    }
  }
  const rootNode = createRootNode(container)
  const id = appId++
  const app: AppHandle = {
    id,
    name: options?.name ?? `App-${id}`,
    rootNode,
    render,
    unmount,
  }

  function render(children: JSX.Element) {
    rootNode.props = { children }
    renderRootSync(rootNode)
  }

  function unmount() {
    rootNode.props = { children: null }
    renderRootSync(rootNode)
    if (__DEV__) {
      delete (container as HTMLElement).__kiruNode
      delete rootNode.app
    }
    window.__kiru.emit("unmount", app)
  }

  if (__DEV__) {
    rootNode.app = app
  }

  render(children)
  window.__kiru.emit("mount", app, requestUpdate)
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

function createRootNode(container: Kiru.ContainerElement): Kiru.VNode {
  const node = createVNode(container.nodeName.toLowerCase())
  node.flags |= FLAG_STATIC_DOM
  node.dom = container as SomeDom
  if (__DEV__) {
    container.__kiruNode = node
  }
  return node
}
