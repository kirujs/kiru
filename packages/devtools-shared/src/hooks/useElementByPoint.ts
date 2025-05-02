import { useSignal, Signal } from "kaioken"
import { useRafFn } from "./useRafFn"

type useElementByPointOptions<M extends boolean = false> = {
  x: number
  y: number
  multiple?: M
  immediate?: boolean
}

type UseElementByPointReturn<M extends boolean = false> = {
  element: M extends true ? Signal<HTMLElement[]> : Signal<HTMLElement | null>
  start: () => void
  stop: () => void
  isActive: boolean
}

export const useElementByPoint = <M extends boolean = false>(
  options: useElementByPointOptions<M>
) => {
  const { x, y, multiple, immediate = true } = options

  const element = useSignal<any>(null)
  const cb = () => {
    element.value = multiple
      ? document.elementsFromPoint(x, y) ?? []
      : document.elementFromPoint(x, y) ?? null
  }

  const controls = useRafFn(cb, { immediate })

  return {
    element,
    ...controls,
  } as UseElementByPointReturn<M>
}
