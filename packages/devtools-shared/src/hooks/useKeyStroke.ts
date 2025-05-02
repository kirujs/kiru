import { EventTarget, useEventListener } from "./useEventListener"

export type KeyPredicate = (event: KeyboardEvent) => boolean
export type KeyFilter = true | string | string[] | KeyPredicate
export type KeyStrokeEventName = "keydown" | "keypress" | "keyup"

export type KeyOptions = {
  eventName?: KeyStrokeEventName
  ref?: (() => EventTarget | null) | null
  passive?: boolean
  /**
   * Whether to include key repeat events
   * @default false
   * @see https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/repeat
   */
  repeat?: boolean
}

function createKeyPredicate(keyFilter: KeyFilter): KeyPredicate {
  if (typeof keyFilter === "function") return keyFilter
  else if (typeof keyFilter === "string")
    return (event: KeyboardEvent) => event.key === keyFilter
  else if (Array.isArray(keyFilter))
    return (event: KeyboardEvent) => keyFilter.includes(event.key)

  return () => true
}

export const useKeyStroke = (
  key: KeyFilter,
  handler: (event: KeyboardEvent) => void,
  options: KeyOptions = {}
) => {
  const { ref, eventName = "keydown", passive = false } = options
  const predicate = createKeyPredicate(key)
  const listener = (e: KeyboardEvent) => {
    if (e.repeat && !options.repeat) return

    if (predicate(e)) handler(e)
  }

  return useEventListener(eventName, listener, {
    ref,
    passive,
  })
}

export const useKeyDown = (
  key: KeyFilter,
  handler: (event: KeyboardEvent) => void,
  options: Omit<KeyOptions, "eventName"> = {}
) => {
  return useKeyStroke(key, handler, {
    ...options,
    eventName: "keydown",
  })
}

export const useKeyUp = (
  key: KeyFilter,
  handler: (event: KeyboardEvent) => void,
  options: Omit<KeyOptions, "eventName"> = {}
) => {
  return useKeyStroke(key, handler, {
    ...options,
    eventName: "keyup",
  })
}
