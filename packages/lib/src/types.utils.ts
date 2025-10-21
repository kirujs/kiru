import type {
  $CONTEXT_PROVIDER,
  $FRAGMENT,
  $HYDRATION_BOUNDARY,
} from "./constants"
import type { HydrationBoundaryMode } from "./ssr/hydrationBoundary"
import type { Signal } from "./signals"

export type SomeElement = HTMLElement | SVGElement
export type SomeDom = HTMLElement | SVGElement | Text
export type MaybeElement = SomeElement | undefined
export type MaybeDom = SomeDom | undefined

export interface FunctionVNode extends Kiru.VNode {
  type: (...args: any) => JSX.Element
}

export interface ElementVNode extends Kiru.VNode {
  dom: SomeElement
  type: string
}
export interface DomVNode extends Kiru.VNode {
  dom: SomeDom
  type: "#text" | (string & {})
}

export interface ContextProviderNode<T> extends Kiru.VNode {
  type: typeof $CONTEXT_PROVIDER
  props: Kiru.VNode["props"] & {
    value: T
    ctx: Kiru.Context<T>
    dependents: Set<Kiru.VNode>
  }
}

export interface HydrationBoundaryNode extends Kiru.VNode {
  type: typeof $HYDRATION_BOUNDARY
  props: Kiru.VNode["props"] & {
    mode: HydrationBoundaryMode
  }
}

export interface FragmentNode extends Kiru.VNode {
  type: typeof $FRAGMENT
}

export type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}

export type Signalable<T> = T | Signal<T>

export type AsyncTaskState<T, E extends Error = Error> =
  | {
      data: null
      error: null
      loading: true
    }
  | {
      data: T
      error: null
      loading: false
    }
  | {
      data: null
      error: E
      loading: false
    }
