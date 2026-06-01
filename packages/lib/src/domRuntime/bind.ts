import type { Signal } from "../signals/base.js"
import { bindElementSignal } from "../dom/bindSignal.js"
import { generateRandomID } from "../utils/index.js"
import { domEffect } from "./effect.js"
import {
  getCurrentDomInstance,
  registerPropBoundEffect,
  runWithDomInstance,
  runWithPropPathTracking,
} from "./instance.js"
import { getCurrentOwner, registerOwnerCleanup } from "./owner.js"

function registerBind(el: Element, attr: string, signal: Signal<unknown>): void {
  const cleanup = bindElementSignal(el, attr, signal, signal.peek())
  const o = getCurrentOwner()
  if (o) {
    registerOwnerCleanup(o, generateRandomID(), cleanup)
  }
}

const domInstanceByElement = new WeakMap<Element, ReturnType<typeof getCurrentDomInstance>>()

export function on<K extends keyof HTMLElementEventMap>(
  el: Element,
  type: K,
  handler: (this: Element, ev: HTMLElementEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions
): void {
  let instance: ReturnType<typeof getCurrentDomInstance> | undefined
  try {
    instance = getCurrentDomInstance()
    domInstanceByElement.set(el, instance)
  } catch {
    instance = domInstanceByElement.get(el)
  }

  const listener = ((ev: HTMLElementEventMap[K]) => {
    const inst = domInstanceByElement.get(el) ?? instance
    if (!inst) {
      handler.call(el, ev)
      return
    }
    runWithDomInstance(inst, () => {
      handler.call(el, ev)
    })
  }) as EventListener

  el.addEventListener(type, listener, options)
  const o = getCurrentOwner()
  if (o) {
    const id = generateRandomID()
    registerOwnerCleanup(o, id, () => {
      el.removeEventListener(type, listener, options)
      domInstanceByElement.delete(el)
    })
  }
}

export function bindValue(
  el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  signal: Signal<string | number | readonly string[]>
): void {
  registerBind(el, "value", signal as Signal<unknown>)
}

export function bindChecked(
  el: HTMLInputElement,
  signal: Signal<boolean>
): void {
  registerBind(el, "checked", signal as Signal<unknown>)
}

export function bindProp(el: Element, attr: string, signal: Signal<unknown>): void {
  registerBind(el, attr, signal)
}

export function setText(el: Element, value: string): void {
  el.textContent = value
}

export function insertText(el: Element, get: () => unknown): void {
  domEffect(() => {
    const apply = () => {
      el.textContent = String(get())
    }
    try {
      const inst = getCurrentDomInstance()
      const { paths } = runWithPropPathTracking(apply)
      if (paths.size > 0) {
        registerPropBoundEffect(inst, paths, () => {
          runWithDomInstance(inst, apply)
        })
      }
    } catch {
      apply()
    }
  })
}

export function setProp(
  el: Element,
  name: string,
  value: string | null | undefined
): void {
  if (value === null || value === undefined) {
    el.removeAttribute(name)
    return
  }
  el.setAttribute(name, value)
}
