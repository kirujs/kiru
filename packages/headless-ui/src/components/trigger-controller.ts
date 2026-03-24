import type { Signal } from "kiru"
import type { HtmlOrSvgElement, Orientation } from "./utils"

export interface TriggerController {
  register: (id: string, el: HtmlOrSvgElement | null) => void
  focusNext: (from: string) => void
  focusPrev: (from: string) => void
  focusFirst: () => void
  focusLast: () => void
  onKeyDown: (e: Kiru.KeyboardEvent, value: Signal<string>) => void
}

interface TriggerControllerConfig {
  orientation: Signal<Orientation>
}

export function createTriggerController(
  config: TriggerControllerConfig
): TriggerController {
  const triggerMap = new Map<string, HtmlOrSvgElement>()

  const getEnabledTriggers = (): HtmlOrSvgElement[] =>
    [...triggerMap.values()].filter((el) => !el.hasAttribute("data-disabled"))

  const register = (id: string, el: HtmlOrSvgElement | null) => {
    if (el === null) {
      triggerMap.delete(id)
      return
    }
    triggerMap.set(id, el)
  }

  const focusNext = (from: string) => {
    const triggers = getEnabledTriggers()
    const current = triggerMap.get(from)
    if (!current) return
    const idx = triggers.indexOf(current)
    const next = triggers[(idx + 1) % triggers.length]
    next?.focus()
  }

  const focusPrev = (from: string) => {
    const triggers = getEnabledTriggers()
    const current = triggerMap.get(from)
    if (!current) return
    const idx = triggers.indexOf(current)
    const prev = triggers[(idx - 1 + triggers.length) % triggers.length]
    prev?.focus()
  }

  const focusFirst = () => {
    getEnabledTriggers()[0]?.focus()
  }

  const focusLast = () => {
    const triggers = getEnabledTriggers()
    triggers[triggers.length - 1]?.focus()
  }

  const keydownHandlers = {
    ArrowRight: (value: Signal<string>) =>
      config.orientation.peek() === "horizontal" && focusNext(value.peek()),
    ArrowLeft: (value: Signal<string>) =>
      config.orientation.peek() === "horizontal" && focusPrev(value.peek()),
    ArrowDown: (value: Signal<string>) =>
      config.orientation.peek() === "vertical" && focusNext(value.peek()),
    ArrowUp: (value: Signal<string>) =>
      config.orientation.peek() === "vertical" && focusPrev(value.peek()),
    Home: focusFirst,
    End: focusLast,
  }

  const onKeyDown = (e: Kiru.KeyboardEvent, value: Signal<string>) => {
    if (e.key in keydownHandlers) {
      e.preventDefault()
      keydownHandlers[e.key as keyof typeof keydownHandlers](value)
    }
  }

  return {
    register,
    focusNext,
    focusPrev,
    focusFirst,
    focusLast,
    onKeyDown,
  }
}
