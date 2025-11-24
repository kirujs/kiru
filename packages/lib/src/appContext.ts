import { FLAG_STATIC_DOM } from "./constants.js"
import { __DEV__ } from "./env.js"
import { renderRootSync, requestUpdate } from "./scheduler.js"
import { createVNode } from "./vNode.js"

type VNode = Kiru.VNode

export interface AppContextOptions {
  /**
   * App name - shown in devtools
   */
  name?: string
}

export interface AppContext {
  id: number
  name: string
  rootNode: VNode
  render(children: JSX.Element): void
  unmount(): void
}

let appId = 0

export function mount(
  children: JSX.Element,
  container: HTMLElement,
  options?: AppContextOptions
): AppContext {
  if (__DEV__) {
    if (container.__kiruNode) {
      throw new Error(
        "[kiru]: container in use - call unmount on the previous app first."
      )
    }
  }
  const rootNode = createRootNode(container)
  const id = appId++
  const appContext: AppContext = {
    id,
    name: options?.name ?? `App-${id}`,
    rootNode,
    render,
    unmount,
  }

  function render(children: JSX.Element) {
    rootNode.props.children = children
    renderRootSync(rootNode)
  }

  function unmount() {
    rootNode.props.children = null
    renderRootSync(rootNode)
    if (__DEV__) {
      delete container.__kiruNode
      delete rootNode.app
    }
    window.__kiru.emit("unmount", appContext)
  }

  if (__DEV__) {
    rootNode.app = appContext
  }

  render(children)
  window.__kiru.emit("mount", appContext, requestUpdate)
  if (__DEV__) {
    queueMicrotask(() => {
      window.dispatchEvent(new Event("kiru:ready"))
    })
  }

  return appContext
}

function createRootNode(container: HTMLElement): Kiru.VNode {
  const node = createVNode(container.nodeName.toLowerCase())
  node.flags |= FLAG_STATIC_DOM
  node.dom = container
  if (__DEV__) {
    container.__kiruNode = node
  }
  return node
}
