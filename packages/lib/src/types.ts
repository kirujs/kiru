import type { ReadonlySignal, Signal as SignalClass } from "./signals"
import type {
  $CONTEXT,
  $CONTEXT_PROVIDER,
  $ERROR_BOUNDARY,
  $FRAGMENT,
} from "./constants"
import type { KiruGlobalContext } from "./globalContext"
import type {
  GlobalAttributes,
  HtmlElementAttributes,
  SvgElementAttributes,
  SvgGlobalAttributes,
  StyleObject,
  HtmlElementBindableProps,
  HTMLTagToElement,
  SVGTagToElement,
} from "./types.dom"
import type {
  AsyncTaskState,
  Prettify,
  Signalable,
  SomeDom,
} from "./types.utils"
import type { AppContext } from "./appContext"

export type { AsyncTaskState, ElementProps, Prettify, Signalable, StyleObject }

type ElementProps<T extends keyof JSX.IntrinsicElements> =
  JSX.IntrinsicElements[T]

type SignalableHtmlElementAttributes<Tag extends keyof HtmlElementAttributes> =
  {
    [K in keyof HtmlElementAttributes[Tag]]: Signalable<
      HtmlElementAttributes[Tag][K]
    >
  } & (Tag extends keyof HtmlElementBindableProps
    ? HtmlElementBindableProps[Tag]
    : {})
type SignalableSvgElementAttributes<Tag extends keyof SvgElementAttributes> = {
  [K in keyof SvgElementAttributes[Tag]]: Signalable<
    SvgElementAttributes[Tag][K]
  >
}
type SignalableAriaProps = {
  [K in keyof ARIAMixin]?: Signalable<ARIAMixin[K]>
}
type SignalableGlobalAttributes = {
  [K in keyof GlobalAttributes]: Signalable<GlobalAttributes[K]>
}
type SignalableSvgGlobalAttributes = {
  [K in keyof SvgGlobalAttributes]: Signalable<SvgGlobalAttributes[K]>
}

type ElementMap = {
  [Tag in keyof HtmlElementAttributes]: SignalableHtmlElementAttributes<Tag> &
    SignalableGlobalAttributes &
    SignalableAriaProps &
    Kiru.EventAttributes<HTMLTagToElement<Tag>> &
    JSX.ElementAttributes & {
      ref?:
        | Kiru.Ref<HTMLTagToElement<Tag>>
        | SignalClass<HTMLTagToElement<Tag> | null>
    }
} & {
  [Tag in keyof SvgElementAttributes]: SignalableSvgElementAttributes<Tag> &
    SignalableSvgGlobalAttributes &
    SignalableGlobalAttributes &
    SignalableAriaProps &
    Kiru.EventAttributes<SVGTagToElement<Tag>> &
    JSX.ElementAttributes & {
      ref?:
        | Kiru.Ref<SVGTagToElement<Tag>>
        | SignalClass<SVGTagToElement<Tag> | null>
    }
} & {
  [Tag in `${string}-${string}`]: Record<string, any>
}

declare global {
  interface Window {
    __kiru: KiruGlobalContext
  }
  namespace JSX {
    interface IntrinsicElements extends ElementMap {}

    interface IntrinsicAttributes {
      key?: ElementKey
    }

    interface ElementAttributesProperty {
      props: {}
    }
    interface ElementChildrenAttribute {
      children: {}
    }

    type Children = JSX.Element | JSX.Element[]

    type PrimitiveChild = string | number | bigint | boolean | undefined | null

    type ElementKey = string | number

    type Element =
      | Element[]
      | Kiru.Element
      | PrimitiveChild
      | Kiru.Signal<PrimitiveChild>

    interface ElementAttributes {
      key?: JSX.ElementKey
      children?: JSX.Children
      innerHTML?:
        | string
        | number
        | Kiru.Signal<string | number | null | undefined>
    }
  }
  namespace Kiru {
    interface RequestContext {}

    interface CustomEvents {}

    interface ProviderProps<T> {
      value: T
      children?: JSX.Children | ((value: T) => JSX.Element)
    }
    interface Context<T> {
      [$CONTEXT]: true
      Provider: (({ value, children }: ProviderProps<T>) => JSX.Element) & {
        displayName?: string
      }
      default: () => T
      /** Used to display the name of the context in devtools  */
      displayName?: string
    }

    interface FC<T = {}> {
      (props: FCProps<T>): JSX.Element
      /** Used to display the name of the component in devtools  */
      displayName?: string
    }

    type FCProps<T = {}> = T & { children?: JSX.Children }
    type InferProps<T> = T extends Kiru.FC<infer P> ? P : never

    interface HookDevtoolsProvisions<T extends Record<string, any>> {
      get: () => T
      set?: (value: T) => void
    }
    type Hook<T> = T & {
      cleanup?: () => void
      name?: string
      dev?: {
        /** Used to perform invalidation during HMR when the hook's arguments have changed */
        initialArgs?: any
        devtools?: HookDevtoolsProvisions<any>
      }
    }
    interface RefObject<T> {
      current: T
    }
    type RefCallback<T> = {
      bivarianceHack(instance: T | null): void
    }["bivarianceHack"]

    type Ref<T> = RefCallback<T> | RefObject<T>

    interface PromiseState<T> {
      id: string
      state: "pending" | "fulfilled" | "rejected"
      value?: T
      error?: Error
    }

    interface StatefulPromise<T> extends Promise<T>, PromiseState<T> {}

    type HydrationMode = "static" | "dynamic"
    type RenderMode = "dom" | "hydrate" | "string" | "stream"

    type StateSetter<T> = T | ((prev: T) => T)

    type Signal<T> = SignalClass<T> | ReadonlySignal<T>

    type ExoticSymbol =
      | typeof $FRAGMENT
      | typeof $CONTEXT_PROVIDER
      | typeof $ERROR_BOUNDARY

    interface Element {
      type: Function | ExoticSymbol | "#text" | (string & {})
      key: JSX.ElementKey | null
      props: {
        [key: string]: any
        children?: unknown
        ref?: Kiru.Ref<unknown>
      }
    }

    interface VNode extends Element {
      app?: AppContext
      dom?: SomeDom
      index: number
      depth: number
      flags: number
      parent: VNode | null
      child: VNode | null
      sibling: VNode | null
      prev: VNodeSnapshot | null
      deletions: VNode[] | null
      hooks?: Hook<unknown>[]
      subs?: Set<Function>
      cleanups?: Record<string, Function>
      effects?: Array<Function>
      immediateEffects?: Array<Function>
      memoizedProps?: Record<string, any>
      arePropsEqual?: (
        prev: Record<string, any>,
        next: Record<string, any>
      ) => boolean
      // dev-mode only
      hookSig?: string[]
      hmrUpdated?: boolean
    }
  }
  interface VNodeSnapshot {
    props: Kiru.VNode["props"]
    key: Kiru.VNode["key"]
    memoizedProps: Kiru.VNode["memoizedProps"]
    index: number
  }

  interface Element {
    __kiruNode?: Kiru.VNode
  }
}
