import type { Signal } from "./signals"
import type { Prettify, Signalable } from "./types.utils"

export type {
  HTMLTagToElement,
  SVGTagToElement,
  HtmlElementAttributes,
  HtmlElementBindableProps,
  SvgElementAttributes,
  SvgGlobalAttributes,
  GlobalAttributes,
  StyleObject,
}

type HTMLTagToElement<T extends keyof HtmlElementAttributes> =
  T extends keyof HTMLElementTagNameMap
    ? HTMLElementTagNameMap[T]
    : T extends keyof HTMLElementDeprecatedTagNameMap
    ? HTMLElementDeprecatedTagNameMap[T]
    : never

type SVGTagToElement<T extends keyof SvgElementAttributes> =
  T extends keyof SVGElementTagNameMap ? SVGElementTagNameMap[T] : never

type NumericStyleKeys =
  // Layout: Margin, Padding, Position
  | "bottom"
  | "gap"
  | "inset"
  | "insetBlock"
  | "insetBlockEnd"
  | "insetBlockStart"
  | "insetInline"
  | "insetInlineEnd"
  | "insetInlineStart"
  | "left"
  | "margin"
  | "marginBlock"
  | "marginBlockEnd"
  | "marginBlockStart"
  | "marginInline"
  | "marginInlineEnd"
  | "marginInlineStart"
  | "padding"
  | "paddingBlock"
  | "paddingBlockEnd"
  | "paddingBlockStart"
  | "paddingInline"
  | "paddingInlineEnd"
  | "paddingInlineStart"
  | "right"
  | "top"

  // Sizing
  | "height"
  | "maxHeight"
  | "maxWidth"
  | "minHeight"
  | "minWidth"
  | "width"

  // Flexbox
  | "flex"
  | "flexBasis"
  | "flexGrow"
  | "flexShrink"
  | "order"

  // Grid
  | "columnGap"
  | "gridAutoColumns"
  | "gridAutoRows"
  | "gridColumnGap" // legacy, still used in some cases
  | "gridRowGap" // legacy
  | "rowGap"

  // Border
  | "borderBottomWidth"
  | "borderImageOutset"
  | "borderImageSlice"
  | "borderImageWidth"
  | "borderLeftWidth"
  | "borderRadius"
  | "borderRightWidth"
  | "borderSpacing"
  | "borderTopWidth"
  | "borderWidth"

  // Typography
  | "fontSize"
  | "letterSpacing"
  | "lineHeight"
  | "tabSize"
  | "textIndent"
  | "wordSpacing"

  // Scroll Margin
  | "scrollMargin"
  | "scrollMarginBlock"
  | "scrollMarginBlockEnd"
  | "scrollMarginBlockStart"
  | "scrollMarginBottom"
  | "scrollMarginInline"
  | "scrollMarginInlineEnd"
  | "scrollMarginInlineStart"
  | "scrollMarginLeft"
  | "scrollMarginRight"
  | "scrollMarginTop"

  // Scroll Padding
  | "scrollPadding"
  | "scrollPaddingBlock"
  | "scrollPaddingBlockEnd"
  | "scrollPaddingBlockStart"
  | "scrollPaddingBottom"
  | "scrollPaddingInline"
  | "scrollPaddingInlineEnd"
  | "scrollPaddingInlineStart"
  | "scrollPaddingLeft"
  | "scrollPaddingRight"
  | "scrollPaddingTop"

  // Animation / Transition
  | "animationDelay"
  | "animationDuration"
  | "transitionDelay"
  | "transitionDuration"

  // Transform (treated as numeric in APIs)
  | "rotate"
  | "scale"
  | "translate"

  // Effects
  | "boxShadow"
  | "zIndex"
  | "opacity"

type FunctionKeys<T> = {
  [K in keyof T]: T[K] extends (...args: any) => any ? K : never
}[keyof T]

type AllStyleRules = Omit<
  CSSStyleDeclaration,
  | typeof Symbol.iterator
  | FunctionKeys<CSSStyleDeclaration>
  | "length"
  | "parentRule"
> & {
  [Key in `--${string}`]: string | number
}

type StyleObject = Prettify<
  Partial<{
    [Key in keyof AllStyleRules & string]: Key extends NumericStyleKeys
      ? number | string
      : AllStyleRules[Key]
  }>
>

type CrossOriginValue = "" | "anonymous" | "use-credentials"
type ValidUrl = `http${"s" | ""}://${string}`
type ValidPath = `/${string}`
type ValidUrlOrPath = ValidUrl | ValidPath | string
type ListOfUrlsOrPaths = string
type FileName = string

type MediaPreload = "none" | "metadata" | "auto" | ""
interface HTMLMediaElementAttrs {
  autoplay?: boolean
  controls?: boolean
  crossOrigin?: CrossOriginValue
  loop?: boolean
  muted?: boolean
  preload?: MediaPreload
  preservesPitch?: boolean
  src?: string
  srcObject?: MediaProvider | null
}

type FormAction = ValidUrlOrPath
type InputType =
  | "button"
  | "checkbox"
  | "color"
  | "date"
  | "datetime-local"
  | "email"
  | "file"
  | "hidden"
  | "image"
  | "month"
  | "number"
  | "password"
  | "radio"
  | "range"
  | "reset"
  | "search"
  | "submit"
  | "tel"
  | "text"
  | "time"
  | "url"
  | "week"

type InputMode =
  | "decimal"
  | "email"
  | "none"
  | "numeric"
  | "search"
  | "text"
  | "tel"
  | "url"

type LanguageCode =
  | "en"
  | "fr"
  | "es"
  | "de"
  | "it"
  | "pt"
  | "ru"
  | "zh"
  | string
type MediaQuery = string
type MediaType = string
type MimeType = string
type ReferrerPolicy =
  | "no-referrer"
  | "no-referrer-when-downgrade"
  | "origin"
  | "origin-when-cross-origin"
  | "unsafe-url"

type AnchorRel =
  | "alternate"
  | "author"
  | "bookmark"
  | "external"
  | "help"
  | "license"
  | "next"
  | "nofollow"
  | "noreferrer"
  | "noopener"
  | "prev"
  | "search"
  | "tag"

type LinkRel =
  | "alternate"
  | "archives"
  | "author"
  | "bookmark"
  | "canonical"
  | "external"
  | "first"
  | "help"
  | "icon"
  | "last"
  | "license"
  | "next"
  | "nofollow"
  | "noreferrer"
  | "pingback"
  | "preconnect"
  | "prefetch"
  | "preload"
  | "prev"
  | "search"
  | "sidebar"
  | "stylesheet"
  | "tag"
  | "up"

type Loading = "eager" | "lazy"

type Target = "_blank" | "_self" | "_parent" | "_top"

type EncType =
  | "application/x-www-form-urlencoded"
  | "multipart/form-data"
  | "text/plain"

type IFrameSandbox = string | boolean
// | "allow-forms"
// | "allow-modals"
// | "allow-orientation-lock"
// | "allow-pointer-lock"
// | "allow-popups"
// | "allow-popups-to-escape-sandbox"
// | "allow-presentation"
// | "allow-same-origin"
// | "allow-scripts"
// | "allow-top-navigation"
// | "allow-top-navigation-by-user-activation"

type InputAccept = "audio/*" | "video/*" | "image/*" | MimeType
type AutoComplete = string
type FormMethod = "get" | "post" | "dialog"

type Direction = "ltr" | "rtl" | "auto"

interface GlobalAttributes {
  accessKey?: string
  autocapitalize?: "on" | "off" | "none" | "sentences" | "words" | "characters"
  className?: string
  contentEditable?: boolean
  dir?: Direction
  draggable?: boolean | "auto"
  hidden?: boolean
  id?: string
  /** [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#inputmode) */
  inputMode?: InputMode
  lang?: LanguageCode
  spellcheck?: boolean | "default"
  style?: string | StyleObject
  tabIndex?: number
  title?: string
  translate?: "yes" | "no"
  popover?: "auto" | "manual" | boolean
  inert?: boolean
}

type NativeAnimationEvent = AnimationEvent
type NativeClipboardEvent = ClipboardEvent
type NativeCompositionEvent = CompositionEvent
type NativeDragEvent = DragEvent
type NativeFocusEvent = FocusEvent
type NativeKeyboardEvent = KeyboardEvent
type NativeMouseEvent = MouseEvent
type NativeTouchEvent = TouchEvent
type NativePointerEvent = PointerEvent
type NativeSubmitEvent = SubmitEvent
type NativeToggleEvent = ToggleEvent
type NativeTransitionEvent = TransitionEvent
type NativeUIEvent = UIEvent
type NativeWheelEvent = WheelEvent

type NoChildElementElement =
  | HTMLAreaElement
  | HTMLBaseElement
  | HTMLBRElement
  | HTMLEmbedElement
  | HTMLHRElement
  | HTMLImageElement
  | HTMLInputElement
  | HTMLLinkElement
  | HTMLMetaElement
  | HTMLSourceElement
  | HTMLTrackElement
  | HTMLTextAreaElement

type DomElement = Element

declare global {
  namespace Kiru {
    type DOMEvent<E = Event, C = unknown, T = unknown> = Omit<
      E,
      "target" | "currentTarget"
    > & {
      target: C extends NoChildElementElement
        ? EventTarget & C
        : EventTarget & T
      currentTarget: EventTarget & C
    }

    type EventHandler<E extends DOMEvent> = {
      bivarianceHack(event: E): void
    }["bivarianceHack"]

    interface BaseEvent<T extends DomElement = DomElement>
      extends DOMEvent<Event, T> {}

    interface AnimationEvent<T extends DomElement = DomElement>
      extends DOMEvent<NativeAnimationEvent, T> {}

    interface ClipboardEvent<T extends DomElement = DomElement>
      extends DOMEvent<NativeClipboardEvent, T> {}

    interface CompositionEvent<T extends DomElement = DomElement>
      extends DOMEvent<NativeCompositionEvent, T> {}

    interface DragEvent<T extends DomElement = DomElement>
      extends DOMEvent<NativeDragEvent, T> {}

    interface FocusEvent<T extends DomElement = DomElement>
      extends DOMEvent<NativeFocusEvent, T> {}

    interface FormEvent<T extends DomElement = DomElement>
      extends DOMEvent<Event, T> {}

    interface KeyboardEvent<T extends DomElement = DomElement>
      extends DOMEvent<NativeKeyboardEvent, T> {}

    interface MouseEvent<T extends DomElement = DomElement>
      extends DOMEvent<NativeMouseEvent, T> {}

    interface PointerEvent<T extends DomElement = DomElement>
      extends DOMEvent<NativePointerEvent, T> {}

    interface SubmitEvent<T extends DomElement = DomElement>
      extends DOMEvent<NativeSubmitEvent, T> {}

    interface TouchEvent<T extends DomElement = DomElement>
      extends DOMEvent<NativeTouchEvent, T> {}

    interface ToggleEvent<T extends DomElement = DomElement>
      extends DOMEvent<NativeToggleEvent, T> {}

    interface TransitionEvent<T extends DomElement = DomElement>
      extends DOMEvent<NativeTransitionEvent, T> {}

    interface UIEvent<T extends DomElement = DomElement>
      extends DOMEvent<NativeUIEvent, T> {}

    interface WheelEvent<T extends DomElement = DomElement>
      extends DOMEvent<NativeWheelEvent, T> {}

    type BaseEventHandler<T extends DomElement = DomElement> = EventHandler<
      BaseEvent<T>
    >

    type ClipboardEventHandler<T extends DomElement = DomElement> =
      EventHandler<ClipboardEvent<T>>
    type CompositionEventHandler<T extends DomElement = DomElement> =
      EventHandler<CompositionEvent<T>>
    type DragEventHandler<T extends DomElement = DomElement> = EventHandler<
      DragEvent<T>
    >
    type FocusEventHandler<T extends DomElement = DomElement> = EventHandler<
      FocusEvent<T>
    >
    type FormEventHandler<T extends DomElement = DomElement> = EventHandler<
      FormEvent<T>
    >
    type KeyboardEventHandler<T extends DomElement = DomElement> = EventHandler<
      KeyboardEvent<T>
    >
    type MouseEventHandler<T extends DomElement = DomElement> = EventHandler<
      MouseEvent<T>
    >
    type TouchEventHandler<T extends DomElement = DomElement> = EventHandler<
      TouchEvent<T>
    >
    type PointerEventHandler<T extends DomElement = DomElement> = EventHandler<
      PointerEvent<T>
    >
    type UIEventHandler<T extends DomElement = DomElement> = EventHandler<
      UIEvent<T>
    >
    type WheelEventHandler<T extends DomElement = DomElement> = EventHandler<
      WheelEvent<T>
    >
    type AnimationEventHandler<T extends DomElement = DomElement> =
      EventHandler<AnimationEvent<T>>
    type ToggleEventHandler<T extends DomElement = DomElement> = EventHandler<
      ToggleEvent<T>
    >
    type TransitionEventHandler<T extends DomElement = DomElement> =
      EventHandler<TransitionEvent<T>>

    type CustomEventAttributes = {
      [Key in keyof Kiru.CustomEvents as `on:${Key}`]?: (
        event: CustomEvent<Kiru.CustomEvents[Key]>
      ) => void
    }

    interface EventAttributes<T extends DomElement = DomElement>
      extends CustomEventAttributes {
      // Clipboard Events
      oncopy?: ClipboardEventHandler<T> | undefined
      oncut?: ClipboardEventHandler<T> | undefined
      onpaste?: ClipboardEventHandler<T> | undefined

      // Composition Events
      oncompositionend?: CompositionEventHandler<T> | undefined
      oncompositionstart?: CompositionEventHandler<T> | undefined
      oncompositionupdate?: CompositionEventHandler<T> | undefined

      // Focus Events
      onfocus?: FocusEventHandler<T> | undefined
      onblur?: FocusEventHandler<T> | undefined

      // Form Events
      onchange?: FormEventHandler<T> | undefined
      onbeforeinput?: FormEventHandler<T> | undefined
      oninput?: FormEventHandler<T> | undefined
      onreset?: FormEventHandler<T> | undefined
      onsubmit?: FormEventHandler<T> | undefined
      oninvalid?: FormEventHandler<T> | undefined

      // Image Events
      onload?: BaseEventHandler<T> | undefined
      onerror?: BaseEventHandler<T> | undefined

      // Keyboard Events
      onkeydown?: KeyboardEventHandler<T> | undefined
      onkeypress?: KeyboardEventHandler<T> | undefined
      onkeyup?: KeyboardEventHandler<T> | undefined

      // Media Events
      onabort?: BaseEventHandler<T> | undefined
      oncanplay?: BaseEventHandler<T> | undefined
      oncanplaythrough?: BaseEventHandler<T> | undefined
      ondurationchange?: BaseEventHandler<T> | undefined
      onemptied?: BaseEventHandler<T> | undefined
      onencrypted?: BaseEventHandler<T> | undefined
      onended?: BaseEventHandler<T> | undefined
      onloadeddata?: BaseEventHandler<T> | undefined
      onloadedmetadata?: BaseEventHandler<T> | undefined
      onloadstart?: BaseEventHandler<T> | undefined
      onpause?: BaseEventHandler<T> | undefined
      onplay?: BaseEventHandler<T> | undefined
      onplaying?: BaseEventHandler<T> | undefined
      onprogress?: BaseEventHandler<T> | undefined
      onratechange?: BaseEventHandler<T> | undefined
      onresize?: BaseEventHandler<T> | undefined
      onseeked?: BaseEventHandler<T> | undefined
      onseeking?: BaseEventHandler<T> | undefined
      onstalled?: BaseEventHandler<T> | undefined
      onsuspend?: BaseEventHandler<T> | undefined
      ontimeupdate?: BaseEventHandler<T> | undefined
      onvolumechange?: BaseEventHandler<T> | undefined
      onwaiting?: BaseEventHandler<T> | undefined

      // Mouse Events
      onauxclick?: MouseEventHandler<T> | undefined
      onclick?: MouseEventHandler<T> | undefined
      oncontextmenu?: MouseEventHandler<T> | undefined
      ondblclick?: MouseEventHandler<T> | undefined
      ondrag?: DragEventHandler<T> | undefined
      ondragend?: DragEventHandler<T> | undefined
      ondragenter?: DragEventHandler<T> | undefined
      ondragexit?: DragEventHandler<T> | undefined
      ondragleave?: DragEventHandler<T> | undefined
      ondragover?: DragEventHandler<T> | undefined
      ondragstart?: DragEventHandler<T> | undefined
      ondrop?: DragEventHandler<T> | undefined
      onmousedown?: MouseEventHandler<T> | undefined
      onmouseenter?: MouseEventHandler<T> | undefined
      onmouseleave?: MouseEventHandler<T> | undefined
      onmousemove?: MouseEventHandler<T> | undefined
      onmouseout?: MouseEventHandler<T> | undefined
      onmouseover?: MouseEventHandler<T> | undefined
      onmouseup?: MouseEventHandler<T> | undefined

      // Selection Events
      onselect?: BaseEventHandler<T> | undefined

      // Touch Events
      ontouchcancel?: TouchEventHandler<T> | undefined
      ontouchend?: TouchEventHandler<T> | undefined
      ontouchmove?: TouchEventHandler<T> | undefined
      ontouchstart?: TouchEventHandler<T> | undefined

      // Pointer Events
      onpointerdown?: PointerEventHandler<T> | undefined
      onpointermove?: PointerEventHandler<T> | undefined
      onpointerup?: PointerEventHandler<T> | undefined
      onpointercancel?: PointerEventHandler<T> | undefined
      onpointerenter?: PointerEventHandler<T> | undefined
      onpointerleave?: PointerEventHandler<T> | undefined
      onpointerover?: PointerEventHandler<T> | undefined
      onpointerout?: PointerEventHandler<T> | undefined
      ongotpointercapture?: PointerEventHandler<T> | undefined
      onlostpointercapture?: PointerEventHandler<T> | undefined

      // UI Events
      onscroll?: UIEventHandler<T> | undefined
      onscrollend?: UIEventHandler<T> | undefined

      // Wheel Events
      onwheel?: WheelEventHandler<T> | undefined

      // Animation Events
      onanimationstart?: AnimationEventHandler<T> | undefined
      onanimationend?: AnimationEventHandler<T> | undefined
      onanimationiteration?: AnimationEventHandler<T> | undefined

      // Toggle Events
      ontoggle?: ToggleEventHandler<T> | undefined
      onbeforetoggle?: ToggleEventHandler<T> | undefined

      // Transition Events
      ontransitioncancel?: TransitionEventHandler<T> | undefined
      ontransitionend?: TransitionEventHandler<T> | undefined
      ontransitionrun?: TransitionEventHandler<T> | undefined
      ontransitionstart?: TransitionEventHandler<T> | undefined
    }
  }
}

type ElementReference<T extends HTMLElement> = T | null | string

interface PopoverControlAttributes {
  popoverTarget?: string
  popoverTargetAction?: "show" | "hide" | "toggle"
}

declare class DoNotUseBindWithPlainError extends Error {
  $brand: "DoNotUseBindWithPlainError"
}

type BindableProp<K extends string, V> =
  | ({
      [k in K]?: Signalable<V>
    } & { [k in `bind:${K}`]?: DoNotUseBindWithPlainError })
  | ({
      [k in `bind:${K}`]?: Signal<V>
    } & { [k in K]?: DoNotUseBindWithPlainError })

type MediaElementBindableProps = BindableProp<"volume", number> &
  BindableProp<"playbackRate", number> &
  BindableProp<"currentTime", number>

interface HtmlElementBindableProps {
  input: BindableProp<"value", string | number> &
    BindableProp<"checked", boolean>
  textarea: BindableProp<"value", string>
  select:
    | ({
        multiple: true
      } & BindableProp<"value", string[]>)
    | ({
        multiple?: false
      } & BindableProp<"value", string>)
  details: BindableProp<"open", boolean>
  dialog: BindableProp<"open", boolean>
  audio: MediaElementBindableProps
  video: MediaElementBindableProps
}

interface HtmlElementAttributes {
  a: {
    autofocus?: boolean
    download?: FileName
    href?: ValidUrlOrPath
    hreflang?: LanguageCode
    media?: MediaQuery
    target?: Target
    rel?: AnchorRel
    type?: MediaType
    ping?: ListOfUrlsOrPaths
    mask?: string
  }
  abbr: {}
  address: {}
  area: HtmlElementAttributes["a"] & {
    alt?: string
    coords?: string
    shape?: "default" | "rect" | "circle" | "poly"
  }
  article: {}
  aside: {}
  audio: HTMLMediaElementAttrs
  b: {}
  base: {
    href?: ValidUrlOrPath
    target?: Target
  }
  bdi: {}
  bdo: {}
  big: {}
  blockquote: {
    cite?: string
  }
  body: {}
  br: {}
  button: {
    autofocus?: boolean
    disabled?: boolean
    form?: ElementReference<HTMLFormElement>
    formAction?: FormAction
    formEnctype?: EncType
    formMethod?: FormMethod
    name?: string
    type?: "button" | "reset" | "submit"
    value?: string
  } & PopoverControlAttributes
  canvas: {
    width?: string | number
    height?: string | number
  }
  caption: {}
  cite: {}
  code: {}
  col: {
    span?: string | number
  }
  colgroup: {
    span?: string | number
  }
  data: {
    value?: string
  }
  datalist: {}
  dd: {}
  del: {
    cite?: string
    dateTime?: string
  }
  details: {}
  dfn: {}
  dialog: {}
  div: {}
  dl: {}
  dt: {}
  em: {}
  embed: {
    src?: ValidUrlOrPath
    type?: string
    width?: string | number
    height?: string | number
  }
  fieldset: {
    disabled?: boolean
    form?: ElementReference<HTMLFormElement>
    name?: string
  }
  figcaption: {}
  figure: {}
  footer: {}
  form: {
    acceptCharset?: string
    autocomplete?: AutoComplete
    enctype?: EncType
    method?: FormMethod
    name?: string
    novalidate?: boolean
    target?: string
    action?: FormAction
  }
  h1: {}
  h2: {}
  h3: {}
  h4: {}
  h5: {}
  h6: {}
  head: {}
  header: {}
  hgroup: {}
  hr: {}
  html: {
    lang?: LanguageCode
  }
  i: {}
  iframe: {
    allow?: string
    src?: ValidUrlOrPath
    srcdoc?: string
    name?: string
    sandbox?: IFrameSandbox
    width?: string | number
    height?: string | number
    loading?: Loading
  }
  img: {
    alt?: string
    src?: ValidUrlOrPath
    crossOrigin?: CrossOriginValue
    useMap?: string
    width?: string | number
    height?: string | number
    loading?: Loading
  }
  input: {
    accept?: InputAccept
    alt?: string
    autocomplete?: AutoComplete
    autofocus?: boolean
    dirName?: Direction
    disabled?: boolean
    files?: FileList | null
    form?: ElementReference<HTMLFormElement>
    formAction?: FormAction
    formEnctype?: EncType
    formMethod?: FormMethod
    formNoValidate?: boolean
    formTarget?: Target
    height?: string | number
    list?: ElementReference<HTMLDataListElement>
    max?: string | number
    maxLength?: string | number
    min?: string | number
    minLength?: string | number
    multiple?: boolean
    name?: string
    pattern?: RegExp
    placeholder?: string
    readOnly?: boolean
    required?: boolean
    size?: string | number
    src?: ValidUrlOrPath
    step?: string | number
    type?: InputType
    width?: string | number
  } & PopoverControlAttributes
  ins: {
    cite?: string
    dateTime?: string
  }
  kbd: {}
  label: {
    htmlFor?: string
    form?: ElementReference<HTMLFormElement>
  }
  legend: {}
  li: {
    value?: number
  }
  link: {
    crossOrigin?: CrossOriginValue
    disabled?: boolean
    fetchPriority?: "auto" | "high" | "low"
    href?: ValidUrlOrPath
    hreflang?: LanguageCode
    integrity?: string
    media?: MediaQuery
    referrerPolicy?: ReferrerPolicy
    rel?: LinkRel
    sizes?: string
    type?: MediaType
    title?: string
  }
  main: {}
  map: {
    name?: string
  }
  mark: {}
  menu: {}
  meta: {
    charset?: string
    content?: string
    httpEquiv?: string
    name?: string
    property?: string
  }
  meter: {
    value?: string | number
    min?: string | number
    max?: string | number
    low?: string | number
    high?: string | number
    optimum?: string | number
  }
  nav: {}
  noscript: {}
  object: {
    data?: ValidUrlOrPath
    type?: MediaType
    name?: string
    useMap?: string
    width?: string | number
    height?: string | number
  }
  ol: {
    reversed?: boolean
    start?: string | number
    type?: "1" | "a" | "A" | "i" | "I"
  }
  optgroup: {
    disabled?: boolean
    label?: string
  }
  option: {
    disabled?: boolean
    label?: string
    selected?: boolean
    value?: string
  }
  output: {
    for?: string
    form?: ElementReference<HTMLFormElement>
    name?: string
  }
  p: {}
  picture: {}
  pre: {}
  progress: {
    value?: string | number
    min?: string | number
    max?: string | number
  }
  q: {
    cite?: string
  }
  rp: {}
  rt: {}
  ruby: {}
  s: {}
  samp: {}
  script: {
    async?: boolean
    crossOrigin?: CrossOriginValue
    defer?: boolean
    integrity?: string
    noModule?: boolean
    nonce?: string
    referrerPolicy?: ReferrerPolicy
    src?: ValidUrlOrPath
    type?: string
  }
  search: {}
  section: {}
  select: {
    autofocus?: boolean
    disabled?: boolean
    form?: ElementReference<HTMLFormElement>
    name?: string
    required?: boolean
    size?: string | number
  }
  slot: {
    name?: string
  }
  small: {}
  source: {
    src?: ValidUrlOrPath
    srcset?: string
    type?: MediaType
    media?: MediaQuery
    height?: string | number
    width?: string | number
  }
  span: {}
  strong: {}
  style: {
    media?: MediaQuery
    nonce?: string
    type?: "text/css"
    title?: string
  }
  sub: {}
  summary: {}
  sup: {}
  table: {}
  tbody: {}
  td: {
    colSpan?: string | number
    rowSpan?: string | number
    headers?: string
  }
  /**
   * This serves as a mechanism for holding HTML fragments, which can either be used
   * later via JavaScript or generated immediately into shadow DOM.
   * @link [MDN example](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/template#examples)
   *
   * This element includes the [global attributes](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes).
   */
  template: {
    /**
     * Creates a **shadow root** for the parent element. It is a declarative version of the `Element.attachShadow()`
     * method and accepts the same enumerated values.
     * @link [MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/template#shadowrootmode)
     */
    shadowrootmode?: "open" | "closed"
    /**
     * Sets the value of the **clonable** property of a **ShadowRoot** created using this element to `true`. If set, a clone
     * of the shadow host (the parent element of this `<template>`) created with `Node.cloneNode()` or `Document.importNode()`
     * will include a shadow root in the copy.
     * @link [MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/template#shadowrootclonable)
     */
    shadowrootclonable?: boolean
    /**
     * Sets the value of the **delegatesFocus** property of a **ShadowRoot** created using this element to `true`. If this
     * is set and a non-focusable element in the shadow tree is selected, then focus is delegated to the first
     * focusable element in the tree.
     * @defaultvalue false
     * @link [MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/template#shadowrootdelegatesfocus)
     */
    shadowrootdelegatesfocus?: boolean
    /**
     * Sets the value of the serializable property of a ShadowRoot created using this element to true. If set, the
     * shadow root may be serialized by calling the Element.getHTML() or ShadowRoot.getHTML() methods with the
     * options.serializableShadowRoots parameter set true.
     * @defaultvalue false
     * @link [MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/template#shadowrootserializable)
     * @deprecated This is an experimental property - your mileage may vary
     *
     */
    shadowrootserializable?: boolean
  }
  textarea: {
    autocomplete?: AutoComplete
    autocorrect?: "on" | "off"
    autofocus?: boolean
    cols?: string | number
    dirName?: Direction
    disabled?: boolean
    form?: ElementReference<HTMLFormElement>
    maxLength?: string | number
    minLength?: string | number
    name?: string
    placeholder?: string
    readOnly?: boolean
    required?: boolean
    rows?: string | number
    wrap?: "hard" | "soft"
    value?: string
    "bind:value"?: Signal<string | number>
  }
  tfoot: {}
  th: {
    abbr?: string
    colSpan?: string | number
    rowSpan?: string | number
    headers?: string
    scope?: "col" | "row" | "colgroup" | "rowgroup"
  }
  thead: {}
  time: {
    dateTime?: string
  }
  title: {}
  tr: {}
  track: {
    default?: boolean
    kind?: "subtitles" | "captions" | "descriptions" | "chapters" | "metadata"
    label?: string
    src?: ValidUrlOrPath
    srclang?: LanguageCode
  }
  u: {}
  ul: {}
  var: {}
  video: HTMLMediaElementAttrs & {
    disablePictureInPicture?: boolean
    playsInline?: boolean
    poster?: ValidUrlOrPath
    width?: string | number
    height?: string | number
    onenterpictureinpicture?: (
      this: HTMLVideoElement,
      ev: PictureInPictureEvent
    ) => void
    onleavepictureinpicture?: (
      this: HTMLVideoElement,
      ev: PictureInPictureEvent
    ) => void
  }
}

interface SvgGlobalAttributes {
  /** [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/fill) */
  fill?: string

  /** [MDN Reference](https://developer.mozilla.org/docs/Web/CSS/display) */
  display?: string
  transform?: string
  "transform-origin"?: string
  filter?: string
}

interface SvgStrokeAttributes {
  /** [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/color) */
  color?: string
  /** [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke) */
  stroke?: string
  /** [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dasharray) */
  strokeDasharray?: string
  /** [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dashoffset) */
  strokeDashoffset?: string | number
  /** [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-linecap) */
  strokeLinecap?: "butt" | "round" | "square"
  /** [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-linejoin) */
  strokeLinejoin?: "arcs" | "bevel" | "miter" | "miter-clip" | "round"
  /** [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-miterlimit) */
  strokeMiterlimit?: string | number
  /** [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-opacity) */
  strokeOpacity?: string | number
  /** [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-width) */
  strokeWidth?: string | number
}

interface SvgColorInterpolationFilters {
  /** [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/color-interpolation-filters) */
  colorInterpolationFilters?: "auto" | "sRGB" | "linearRGB"
}

interface SvgColorInterpolation {
  /** [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/color-interpolation) */
  colorInterpolation?: "auto" | "sRGB" | "linearRGB"
}

/** [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/SVG/Element/feFuncR) */
interface FeFuncAttributes {
  type?: string
  tableValues?: string
  amplitude?: string | number
  exponent?: string | number
  offset?: string | number
  slope?: string | number
  intercept?: string | number
}

interface SvgElementAttributes {
  animateTransform: {
    begin?: string
    dur?: string
    end?: string
    min?: string
    max?: string
    restart?: "always" | "whenNotActive" | "never"
    repeatCount?: "indefinite" | number
    repeatDur?: string
    fill?: "freeze" | "remove" | "default"
    calcMode?: "linear" | "discrete" | "spline" | "paced"
    keyTimes?: string
    keySplines?: string
    from?: string
    to?: string
    by?: string
    attributeName?: string
    attributeType?: "CSS" | "XML"
    additive?: "replace" | "sum"
    accumulate?: "none" | "sum"
  }
  circle: SvgStrokeAttributes & {
    cx?: string | number
    cy?: string | number
    r?: string | number
    mask?: string
    opacity?: string | number
    pathLength?: string | number
  }
  clipPath: {
    clipPathUnits?: "userSpaceOnUse" | "objectBoundingBox"
    mask?: string
  }
  defs: {}
  desc: {}
  ellipse: SvgStrokeAttributes & {
    cx?: string | number
    cy?: string | number
    rx?: string | number
    ry?: string | number
    mask?: string
    opacity?: string | number
    pathLength?: string | number
  }
  feComponentTransfer: {
    in?: string
    in2?: string
    result?: string
  }
  feFuncR: FeFuncAttributes
  feFuncG: FeFuncAttributes
  feFuncB: FeFuncAttributes
  feFuncA: FeFuncAttributes
  feSpotLight: SvgColorInterpolationFilters & {
    result?: string
  }
  feFlood: SvgColorInterpolationFilters & {
    floodColor?: string
    floodOpacity?: string
    result?: string
  }
  feBlend: SvgColorInterpolationFilters & {
    in?: string
    in2?: string
    mode?: "normal" | "multiply" | "screen" | "overlay" | "darken" | "lighten"
    result?: string
  }
  feDisplacementMap: SvgColorInterpolationFilters & {
    in?: string
    in2?: string
    scale?: string | number
    xChannelSelector?: "R" | "G" | "B" | "A"
    yChannelSelector?: "R" | "G" | "B" | "A"
    result?: string
  }
  feDropShadow: SvgColorInterpolationFilters & {
    dx?: string | number
    dy?: string | number
    stdDeviation?: string | number
    floodColor?: string
    floodOpacity?: string
  }
  feGaussianBlur: SvgColorInterpolationFilters & {
    in?: string
    stdDeviation?: string | number
    edgeMode?: "duplicate" | "wrap" | "none"
    result?: string
  }
  feTurbulence: SvgColorInterpolationFilters & {
    type: "fractalNoise" | "turbulence"
    baseFrequency?: string
    numOctaves?: string | number
    seed?: string | number
    stitchTiles?: "stitch" | "noStitch"
    result?: string
  }
  filter: SvgColorInterpolationFilters &
    SvgColorInterpolation & {
      x?: string | number
      y?: string | number
      width?: string | number
      height?: string | number
      filterUnits?: "userSpaceOnUse" | "objectBoundingBox"
      primitiveUnits?: "userSpaceOnUse" | "objectBoundingBox"
    }
  g: SvgStrokeAttributes & {
    clipPath?: string
    mask?: string
    opacity?: string | number
  }
  image: {
    x?: string | number
    y?: string | number
    width?: string | number
    height?: string | number
    mask?: string
    opacity?: string | number
    pathLength?: string | number
    preserveAspectRatio?: string
    href?: string
    filter?: string
  }
  line: SvgStrokeAttributes & {
    x1?: string | number
    y1?: string | number
    x2?: string | number
    y2?: string | number
    points?: string
    animatedPoints?: string
    mask?: string
    opacity?: string | number
    pathLength?: string | number
  }
  linearGradient: {
    x1?: string | number
    y1?: string | number
    x2?: string | number
    y2?: string | number
    gradientUnits?: "userSpaceOnUse" | "objectBoundingBox"
    gradientTransform?: string
  }
  mask: {
    x?: string | number
    y?: string | number
    width?: string | number
    height?: string | number
    maskUnits?: "userSpaceOnUse" | "objectBoundingBox"
    mask?: string
  }
  path: SvgStrokeAttributes & {
    d?: string
    mask?: string
    opacity?: string | number
    pathLength?: string | number
  }
  pattern: {
    x?: string | number
    y?: string | number
    width?: string | number
    height?: string | number
    patternUnits?: "userSpaceOnUse" | "objectBoundingBox"
    patternTransform?: string
    patternContentUnits?: "userSpaceOnUse" | "objectBoundingBox"
  }
  polygon: SvgStrokeAttributes & {
    points?: string
    animatedPoints?: string
    opacity?: string | number
    pathLength?: string | number
  }
  polyline: SvgStrokeAttributes & {
    points?: string
    animatedPoints?: string
    opacity?: string | number
    pathLength?: string | number
  }
  radialGradient: {
    cx?: string | number
    cy?: string | number
    r?: string | number
    gradientUnits?: "userSpaceOnUse" | "objectBoundingBox"
    gradientTransform?: string
  }
  rect: SvgStrokeAttributes & {
    x?: string | number
    y?: string | number
    rx?: string | number
    ry?: string | number
    width?: string | number
    height?: string | number
    mask?: string
    opacity?: string | number
    pathLength?: string | number
  }
  stop: {
    offset?: string
    stopColor?: string
    stopOpacity?: string
  }
  svg: SvgStrokeAttributes & {
    width?: string | number
    height?: string | number
    viewBox?: string
    preserveAspectRatio?: string
    xmlns?: string
    "xmlns:xlink"?: string
    version?: string
    mask?: string
    opacity?: string | number
    x?: string | number
    y?: string | number
  }
  text: SvgStrokeAttributes & {
    x?: string | number
    y?: string | number
    dx?: string | number
    dy?: string | number
    rotate?: "none" | (string & {})
    textLength?: string | number
    lengthAdjust?: "spacing" | "spacingAndGlyphs"
    mask?: string
    opacity?: string | number
  }
  textPath: SvgStrokeAttributes & {
    opacity?: string | number
  }
  tref: SvgStrokeAttributes & {}
  tspan: SvgStrokeAttributes & {
    opacity?: string | number
  }
}
