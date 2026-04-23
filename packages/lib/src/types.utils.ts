import type {
  $CONTEXT,
  $ERROR_BOUNDARY,
  $FRAGMENT,
  $INLINE_FN,
} from "./constants.js"
import type { Signal } from "./signals/base.js"
import type { ErrorBoundaryProps } from "./components/errorBoundary.js"

export type {
  SomeElement,
  SomeDom,
  MaybeElement,
  MaybeDom,
  FunctionOwnerNode,
  ElementOwnerNode,
  DomOwnerNode,
  ContextNode,
  ErrorBoundaryNode,
  FragmentNode,
  InlineFnNode,
  Prettify,
  Signalable,
  AsyncTaskState,
  Guard,
  ArrayHas,
  RecordHas,
  Falsy,
  Truthy,
}

type SomeElement = HTMLElement | SVGElement
type SomeDom = HTMLElement | SVGElement | Text
type MaybeElement = SomeElement | undefined
type MaybeDom = SomeDom | undefined

interface FunctionOwnerNode extends Kiru.KiruNode {
  type: (props: Record<string, unknown>) => JSX.Element
}

interface ElementOwnerNode extends Kiru.KiruNode {
  dom: SomeElement
  type: string
}
interface DomOwnerNode extends Kiru.KiruNode {
  dom: SomeDom
  type: "#text" | (string & {})
}

interface ContextNode<T> extends Kiru.KiruNode {
  type: typeof $CONTEXT
  props: Kiru.KiruNode["props"] & {
    value: T
    ctx: Kiru.Context<T>
  }
}

interface ErrorBoundaryNode extends Kiru.KiruNode {
  type: typeof $ERROR_BOUNDARY
  props: ErrorBoundaryProps
  error?: Error
}

interface FragmentNode extends Kiru.KiruNode {
  type: typeof $FRAGMENT
}

interface InlineFnNode extends Kiru.KiruNode {
  type: typeof $INLINE_FN
  props: {
    expr: () => JSX.Element
  }
}

type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}

type Signalable<T> = T | Signal<T>

type AsyncTaskState<T, E extends Error = Error> =
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

type Guard<T, K extends keyof T> = {
  [P in K]: T[P]
}

type ArrayHas<T extends any[], U> =
  // does the union of element types intersect U?
  Extract<T[number], U> extends never ? false : true

type RecordHas<T extends Record<string, any>, U> = [
  Extract<T[keyof T], U>
] extends [never]
  ? false
  : true

type Falsy = false | 0 | 0n | "" | null | undefined
type Truthy<T> = Exclude<T, Falsy>
