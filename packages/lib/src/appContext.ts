import { FLAG_STATIC_DOM } from "./constants.js"
import { createElement } from "./element.js"
import { __DEV__ } from "./env.js"
import { createKiruGlobalContext } from "./globalContext.js"
import { renderRootSync } from "./scheduler.js"

type VNode = Kiru.VNode

export interface AppContextOptions {
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
  const rootNode = createElement(container.nodeName.toLowerCase(), {})
  if (__DEV__) {
    container.__kiruNode = rootNode
  }

  rootNode.dom = container
  rootNode.flags |= FLAG_STATIC_DOM

  const id = appId++
  const name = options?.name ?? `App-${id}`
  const appContext: AppContext = {
    id,
    name,
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

  globalThis.window.__kiru ??= createKiruGlobalContext()
  render(children)
  window.__kiru.emit("mount", appContext)
  if (__DEV__) {
    queueMicrotask(() => {
      window.dispatchEvent(new Event("kiru:ready"))
    })
  }

  return appContext
}
