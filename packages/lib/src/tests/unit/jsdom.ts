import { JSDOM } from "jsdom"
import { createKiruGlobalContext } from "../../globalContext.js"

type GlobalKey =
  | "window"
  | "document"
  | "navigator"
  | "HTMLElement"
  | "Element"
  | "Node"
  | "Event"
  | "MouseEvent"
  | "requestAnimationFrame"
  | "cancelAnimationFrame"

type GlobalDescriptorState = {
  hadOwn: boolean
  descriptor?: PropertyDescriptor
}

export async function withJSDOM(
  testBody: (
    container: HTMLElement,
    kiru: typeof import("../../index.js")
  ) => void | Promise<void>
) {
  const previous = new Map<GlobalKey, GlobalDescriptorState>()
  const remember = (key: GlobalKey) => {
    previous.set(key, {
      hadOwn: Object.prototype.hasOwnProperty.call(globalThis, key),
      descriptor: Object.getOwnPropertyDescriptor(globalThis, key),
    })
  }
  const assignGlobal = (key: GlobalKey, value: unknown) => {
    remember(key)
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    })
  }

  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
    url: "http://localhost/",
    pretendToBeVisual: true,
  })

  const { window } = dom

  assignGlobal("window", window)
  assignGlobal("document", window.document)
  assignGlobal("navigator", window.navigator)
  assignGlobal("HTMLElement", window.HTMLElement)
  assignGlobal("Element", window.Element)
  assignGlobal("Node", window.Node)
  assignGlobal("Event", window.Event)
  assignGlobal("MouseEvent", window.MouseEvent)
  assignGlobal(
    "requestAnimationFrame",
    window.requestAnimationFrame.bind(window)
  )
  assignGlobal("cancelAnimationFrame", window.cancelAnimationFrame.bind(window))

  window.__kiru = createKiruGlobalContext()
  const container = document.createElement("div")
  document.body.appendChild(container)
  const kiru = await import("../../index.js")

  try {
    await testBody(container, kiru)
  } finally {
    container.remove()
    dom.window.close()
    for (const [key, state] of previous) {
      if (!state.hadOwn) {
        delete (globalThis as any)[key]
        continue
      }
      if (state.descriptor) {
        Object.defineProperty(globalThis, key, state.descriptor)
      }
    }
  }
}
