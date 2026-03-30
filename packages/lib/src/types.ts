import type { Signal as SignalClass } from "./signals"
import type {
  $CONTEXT,
  $ERROR_BOUNDARY,
  $FRAGMENT,
  $INLINE_FN,
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
import type { AppHandle } from "./appHandle"

export type { AsyncTaskState, ElementProps, Prettify, Signalable, StyleObject }

type ElementProps<T extends keyof JSX.IntrinsicElements> =
  JSX.IntrinsicElements[T]

type SignalableHtmlElementAttributes<Tag extends keyof HtmlElementAttributes> =
  {
    [K in keyof HtmlElementAttributes[Tag]]: Signalable<
      HtmlElementAttributes[Tag][K] | undefined
    >
  } & (Tag extends keyof HtmlElementBindableProps
    ? HtmlElementBindableProps[Tag]
    : {})
type SignalableSvgElementAttributes<Tag extends keyof SvgElementAttributes> = {
  [K in keyof SvgElementAttributes[Tag]]: Signalable<
    SvgElementAttributes[Tag][K] | undefined
  >
}
type SignalableAriaProps = {
  [K in keyof ARIAMixin]?: Signalable<ARIAMixin[K] | undefined>
}
type SignalableGlobalAttributes = {
  [K in keyof GlobalAttributes]?: Signalable<GlobalAttributes[K] | undefined>
}
type SignalableSvgGlobalAttributes = {
  [K in keyof SvgGlobalAttributes]?: Signalable<
    SvgGlobalAttributes[K] | undefined
  >
}

type HTMLElementProps<Tag extends keyof HtmlElementAttributes> =
  SignalableHtmlElementAttributes<Tag> &
    SignalableGlobalAttributes &
    SignalableAriaProps &
    Kiru.EventAttributes<HTMLTagToElement<Tag>> &
    JSX.ElementAttributes & {
      ref?: Kiru.Ref<Element | null> | SignalClass<Element | null> | null
    }

type SVGElementProps<Tag extends keyof SvgElementAttributes> =
  SignalableSvgElementAttributes<Tag> &
    SignalableSvgGlobalAttributes &
    SignalableGlobalAttributes &
    SignalableAriaProps &
    Kiru.EventAttributes<SVGTagToElement<Tag>> &
    JSX.ElementAttributes & {
      ref?: Kiru.Ref<Element | null> | SignalClass<Element | null> | null
    }

declare global {
  interface Window {
    __kiru: KiruGlobalContext
  }
  namespace JSX {
    interface IntrinsicElements {
      // HTML
      a: HTMLElementProps<"a">
      abbr: HTMLElementProps<"abbr">
      address: HTMLElementProps<"address">
      area: HTMLElementProps<"area">
      article: HTMLElementProps<"article">
      aside: HTMLElementProps<"aside">
      audio: HTMLElementProps<"audio">
      b: HTMLElementProps<"b">
      base: HTMLElementProps<"base">
      bdi: HTMLElementProps<"bdi">
      bdo: HTMLElementProps<"bdo">
      big: HTMLElementProps<"big">
      blockquote: HTMLElementProps<"blockquote">
      body: HTMLElementProps<"body">
      br: HTMLElementProps<"br">
      button: HTMLElementProps<"button">
      canvas: HTMLElementProps<"canvas">
      caption: HTMLElementProps<"caption">
      cite: HTMLElementProps<"cite">
      code: HTMLElementProps<"code">
      col: HTMLElementProps<"col">
      colgroup: HTMLElementProps<"colgroup">
      data: HTMLElementProps<"data">
      datalist: HTMLElementProps<"datalist">
      dd: HTMLElementProps<"dd">
      del: HTMLElementProps<"del">
      details: HTMLElementProps<"details">
      dfn: HTMLElementProps<"dfn">
      dialog: HTMLElementProps<"dialog">
      div: HTMLElementProps<"div">
      dl: HTMLElementProps<"dl">
      dt: HTMLElementProps<"dt">
      em: HTMLElementProps<"em">
      embed: HTMLElementProps<"embed">
      fieldset: HTMLElementProps<"fieldset">
      figcaption: HTMLElementProps<"figcaption">
      figure: HTMLElementProps<"figure">
      footer: HTMLElementProps<"footer">
      form: HTMLElementProps<"form">
      h1: HTMLElementProps<"h1">
      h2: HTMLElementProps<"h2">
      h3: HTMLElementProps<"h3">
      h4: HTMLElementProps<"h4">
      h5: HTMLElementProps<"h5">
      h6: HTMLElementProps<"h6">
      head: HTMLElementProps<"head">
      header: HTMLElementProps<"header">
      hgroup: HTMLElementProps<"hgroup">
      hr: HTMLElementProps<"hr">
      html: HTMLElementProps<"html">
      i: HTMLElementProps<"i">
      iframe: HTMLElementProps<"iframe">
      img: HTMLElementProps<"img">
      input: HTMLElementProps<"input">
      ins: HTMLElementProps<"ins">
      kbd: HTMLElementProps<"kbd">
      //keygen: HTMLElementProps<"keygen">
      label: HTMLElementProps<"label">
      legend: HTMLElementProps<"legend">
      li: HTMLElementProps<"li">
      link: HTMLElementProps<"link">
      main: HTMLElementProps<"main">
      map: HTMLElementProps<"map">
      mark: HTMLElementProps<"mark">
      menu: HTMLElementProps<"menu">
      //menuitem: HTMLElementProps<"menuitem">
      meta: HTMLElementProps<"meta">
      meter: HTMLElementProps<"meter">
      nav: HTMLElementProps<"nav">
      noscript: HTMLElementProps<"noscript">
      object: HTMLElementProps<"object">
      ol: HTMLElementProps<"ol">
      optgroup: HTMLElementProps<"optgroup">
      option: HTMLElementProps<"option">
      output: HTMLElementProps<"output">
      p: HTMLElementProps<"p">
      picture: HTMLElementProps<"picture">
      pre: HTMLElementProps<"pre">
      progress: HTMLElementProps<"progress">
      q: HTMLElementProps<"q">
      rp: HTMLElementProps<"rp">
      rt: HTMLElementProps<"rt">
      ruby: HTMLElementProps<"ruby">
      s: HTMLElementProps<"s">
      samp: HTMLElementProps<"samp">
      script: HTMLElementProps<"script">
      section: HTMLElementProps<"section">
      select: HTMLElementProps<"select">
      slot: HTMLElementProps<"slot">
      small: HTMLElementProps<"small">
      source: HTMLElementProps<"source">
      span: HTMLElementProps<"span">
      strong: HTMLElementProps<"strong">
      style: HTMLElementProps<"style">
      sub: HTMLElementProps<"sub">
      summary: HTMLElementProps<"summary">
      sup: HTMLElementProps<"sup">
      table: HTMLElementProps<"table">
      tbody: HTMLElementProps<"tbody">
      td: HTMLElementProps<"td">
      textarea: HTMLElementProps<"textarea">
      tfoot: HTMLElementProps<"tfoot">
      th: HTMLElementProps<"th">
      thead: HTMLElementProps<"thead">
      time: HTMLElementProps<"time">
      title: HTMLElementProps<"title">
      tr: HTMLElementProps<"tr">
      track: HTMLElementProps<"track">
      u: HTMLElementProps<"u">
      ul: HTMLElementProps<"ul">
      var: HTMLElementProps<"var">
      video: HTMLElementProps<"video">
      //wbr: HTMLElementProps<"wbr">
      //webview: HTMLElementProps<"webview">

      // SVG
      // animate: SVGElementProps<"animate">
      // animateMotion: SVGElementProps<"animateMotion">
      animateTransform: SVGElementProps<"animateTransform">
      circle: SVGElementProps<"circle">
      clipPath: SVGElementProps<"clipPath">
      defs: SVGElementProps<"defs">
      desc: SVGElementProps<"desc">
      ellipse: SVGElementProps<"ellipse">
      feBlend: SVGElementProps<"feBlend">
      //feColorMatrix: SVGElementProps<"feColorMatrix">
      feComponentTransfer: SVGElementProps<"feComponentTransfer">
      // feComposite: SVGElementProps<"feComposite">
      // feConvolveMatrix: SVGElementProps<"feConvolveMatrix">
      // feDiffuseLighting: SVGElementProps<"feDiffuseLighting">
      feDisplacementMap: SVGElementProps<"feDisplacementMap">
      feDropShadow: SVGElementProps<"feDropShadow">
      feFlood: SVGElementProps<"feFlood">
      feFuncA: SVGElementProps<"feFuncA">
      feFuncB: SVGElementProps<"feFuncB">
      feFuncG: SVGElementProps<"feFuncG">
      feFuncR: SVGElementProps<"feFuncR">
      feGaussianBlur: SVGElementProps<"feGaussianBlur">
      // feImage: SVGElementProps<"feImage">
      // feMerge: SVGElementProps<"feMerge">
      // feMergeNode: SVGElementProps<"feMergeNode">
      // feMorphology: SVGElementProps<"feMorphology">
      // feOffset: SVGElementProps<"feOffset">
      // feSpecularLighting: SVGElementProps<"feSpecularLighting">
      // feTile: SVGElementProps<"feTile">
      feTurbulence: SVGElementProps<"feTurbulence">
      filter: SVGElementProps<"filter">
      // foreignObject: SVGElementProps<"foreignObject">
      g: SVGElementProps<"g">
      image: SVGElementProps<"image">
      line: SVGElementProps<"line">
      linearGradient: SVGElementProps<"linearGradient">
      // marker: SVGElementProps<"marker">
      mask: SVGElementProps<"mask">
      // metadata: SVGElementProps<"metadata">
      // mpath: SVGElementProps<"mpath">
      path: SVGElementProps<"path">
      pattern: SVGElementProps<"pattern">
      polygon: SVGElementProps<"polygon">
      polyline: SVGElementProps<"polyline">
      radialGradient: SVGElementProps<"radialGradient">
      rect: SVGElementProps<"rect">
      // set: SVGElementProps<"set">
      stop: SVGElementProps<"stop">
      // switch: SVGElementProps<"switch">
      // symbol: SVGElementProps<"symbol">
      text: SVGElementProps<"text">
      textPath: SVGElementProps<"textPath">
      tspan: SVGElementProps<"tspan">
      svg: SVGElementProps<"svg">
      // use: SVGElementProps<"use">
      // view: SVGElementProps<"view">
    }

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
      | Kiru.FC<any>

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
    interface CustomEvents {}

    interface ContextProps<T> {
      value: T
      children?: JSX.Children
    }

    interface Context<T> extends Kiru.FC<ContextProps<T>> {
      [$CONTEXT]: () => T
    }

    export interface FC<T = {}> {
      (
        props: T
      ): Exclude<JSX.Element, Kiru.FC<any>> | ((props: T) => JSX.Element)
      /** Used to display the name of the component in devtools  */
      displayName?: string
    }

    type InferProps<T> = T extends Kiru.FC<infer P> ? P : never

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

    type RenderMode = "dom" | "hydrate" | "string" | "stream"

    type StateSetter<T> = T | ((prev: T) => T)

    type Signal<T> = SignalClass<T>

    type ExoticSymbol =
      | typeof $FRAGMENT
      | typeof $CONTEXT
      | typeof $ERROR_BOUNDARY
      | typeof $INLINE_FN

    interface Element {
      type:
        | (Function & { displayName?: string })
        | ExoticSymbol
        | "#text"
        | (string & {})
      key: JSX.ElementKey | null
      props: {
        [key: string]: any
        children?: unknown
        ref?: Kiru.Ref<unknown> | null
      }
    }

    type LifecycleHookCallback = () => (() => void) | void

    interface VNode extends Element {
      app?: AppHandle
      dom?: SomeDom
      index: number
      depth: number
      flags: number
      parent: VNode | null
      child: VNode | null
      sibling: VNode | null
      prev: VNodeSnapshot | null
      deletions: VNode[] | null
      subs?: Set<Function>
      cleanups?: Record<string, Function>

      hooks?: {
        pre: LifecycleHookCallback[]
        preCleanups: (() => void)[]
        post: LifecycleHookCallback[]
        postCleanups: (() => void)[]
      }
      /** Run before each render with current props to sync prop-derived signals */
      propSyncs?: ((props: VNode["props"]) => void)[]
      render?: (props: VNode["props"]) => unknown
    }
    interface VNodeSnapshot {
      props: Kiru.VNode["props"]
      key: Kiru.VNode["key"]
      index: number
    }

    type ContainerElement = HTMLElement | ShadowRoot
  }

  interface Element {
    __kiruNode?: Kiru.VNode
  }
  interface ShadowRoot {
    __kiruNode?: Kiru.VNode
  }
}
