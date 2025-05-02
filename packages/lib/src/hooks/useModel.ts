import { ElementProps } from "../types"
import { __DEV__ } from "../env.js"
import { noop } from "../utils.js"
import { sideEffectsEnabled, useHook } from "./utils.js"

type ToPrimitive<T extends string | number | boolean | FileList | null> =
  T extends null
    ? null
    : T extends string
    ? string
    : T extends boolean
    ? boolean
    : T extends FileList
    ? FileList
    : never

type UseModelReturn<
  T extends HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  U extends string | boolean | FileList | null
> = readonly [
  Kaioken.RefObject<T>,
  ToPrimitive<U>,
  (newValue: ToPrimitive<U>) => void
]

type UseModelState<
  T extends HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  U extends string | boolean | FileList | null
> = {
  value: U
  element: T | null
  ref: Kaioken.RefObject<T>
  dispatch: (value: U) => void
  listener: () => void
}

/**
 * Similar to [useRef](https://kaioken.dev/docs/hooks/useRef), but creates a ref specifically to
 * be used with an HTMLInputElement, HTMLTextAreaElement, or HTMLSelectElement.
 * Automatically binds change listeners to the element.
 *
 * @see https://kaioken.dev/docs/hooks/useModel
 */
export function useModel<
  T extends HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  U extends string | boolean | FileList | null = string
>(
  initial: U
): readonly [
  Kaioken.RefObject<T>,
  ToPrimitive<U>,
  (newValue: ToPrimitive<U>) => void
] {
  if (!sideEffectsEnabled()) {
    return [{ current: null }, initial, noop] as any as UseModelReturn<T, U>
  }
  return useHook(
    "useModel",
    createUseModelState,
    ({ hook, isInit, update, queueEffect }) => {
      if (__DEV__) {
        hook.dev = {
          devtools: {
            get: () => ({ value: hook.value }),
            set: ({ value }) => {
              hook.value = value
              if (hook.ref.current) setElementValue(hook.ref.current, value)
            },
          },
        }
      }
      if (isInit) {
        hook.value = initial
        hook.cleanup = () => {
          hook.element &&
            hook.element.removeEventListener("input", hook.listener)
        }
        hook.listener = () =>
          hook.element && hook.dispatch(getElementValue(hook.element) as U)

        hook.dispatch = (value: U) => {
          if (hook.ref.current) setElementValue(hook.ref.current, value)
          if (value !== hook.value) {
            hook.value = value
            update()
          }
        }
      }

      queueEffect(
        () => {
          const refCurrent = hook.ref.current
          if (!refCurrent) {
            if (hook.element) {
              hook.element.removeEventListener("input", hook.listener)
              hook.element = null
            }
            return
          }
          if (refCurrent !== hook.element) {
            hook.element &&
              hook.element.removeEventListener("input", hook.listener)
            hook.element = refCurrent
            hook.element.addEventListener("input", hook.listener)
            setElementValue(hook.element, hook.value)
          }
        },
        { immediate: true }
      )

      return [hook.ref, hook.value, hook.dispatch] as unknown as UseModelReturn<
        T,
        U
      >
    }
  )
}

const createUseModelState = (): UseModelState<any, any> => ({
  value: undefined,
  element: null,
  ref: { current: null } as Kaioken.RefObject<any>,
  dispatch: noop as (value: any) => void,
  listener: noop as () => void,
})

function setElementValue(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: unknown
) {
  if (element instanceof HTMLInputElement) {
    switch (element.type) {
      case "checkbox":
        element.checked = !!value
        break
      case "radio":
        console.warn("[useModel] useModel does not support: radio")
        break
      case "file":
        if (value instanceof FileList) {
          element.files = value
          return
        }
        element.value = ""
        break
      default:
        element.value = !!value ? (value as string) : ""
    }
  } else if (element instanceof HTMLTextAreaElement) {
    element.value = !!value ? (value as string) : ""
  } else if (element instanceof HTMLSelectElement) {
    element.value = value as string
  }
}

function getElementValue(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
) {
  if (element instanceof HTMLInputElement) {
    switch (element.type as ElementProps<"input">["type"]) {
      case "checkbox":
        return element.checked
      case "radio":
        console.warn("[useModel] useModel does not support: radio")
        return
      case "file":
        return element.files
      default:
        return element.value
    }
  } else if (element instanceof HTMLTextAreaElement) {
    return element.value
  } else if (element instanceof HTMLSelectElement) {
    return element.value
  }

  return undefined
}
