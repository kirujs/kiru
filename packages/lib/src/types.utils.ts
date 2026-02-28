import type { $CONTEXT, $ERROR_BOUNDARY, $FRAGMENT } from "./constants"
import type { Signal } from "./signals"
import type { ErrorBoundaryProps } from "./components/errorBoundary"

export type SomeElement = HTMLElement | SVGElement
export type SomeDom = HTMLElement | SVGElement | Text
export type MaybeElement = SomeElement | undefined
export type MaybeDom = SomeDom | undefined

export interface FunctionVNode extends Kiru.VNode {
  type: (props: Record<string, unknown>) => JSX.Element
}

export interface ElementVNode extends Kiru.VNode {
  dom: SomeElement
  type: string
}
export interface DomVNode extends Kiru.VNode {
  dom: SomeDom
  type: "#text" | (string & {})
}

export interface ContextNode<T> extends Kiru.VNode {
  type: typeof $CONTEXT
  props: Kiru.VNode["props"] & {
    value: T
    ctx: Kiru.Context<T>
  }
}

export interface ErrorBoundaryNode extends Kiru.VNode {
  type: typeof $ERROR_BOUNDARY
  props: ErrorBoundaryProps
  error?: Error
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

export type Guard<T, K extends keyof T> = {
  [P in K]: T[P]
}

export type ArrayHas<T extends any[], U> =
  // does the union of element types intersect U?
  Extract<T[number], U> extends never ? false : true

export type RecordHas<T extends Record<string, any>, U> = [
  Extract<T[keyof T], U>
] extends [never]
  ? false
  : true
