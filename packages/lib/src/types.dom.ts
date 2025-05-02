import type { Prettify } from "./types.utils"

export type {
  HtmlElementAttributes,
  SvgElementAttributes,
  SvgGlobalAttributes,
  GlobalAttributes,
  GlobalEventAttributes,
  EventAttributes,
  StyleObject,
  ClassNameArray,
}

type ClassNameArray = Array<string | false | undefined>

type StyleObject = Prettify<
  Partial<
    Omit<
      CSSStyleDeclaration,
      | number
      | "length"
      | "parentRule"
      | "setProperty"
      | "removeProperty"
      | "item"
      | "getPropertyValue"
      | "getPropertyPriority"
      | typeof Symbol.iterator
    >
  >
>

type ValidUrl = `http${"s" | ""}://${string}`
type ValidPath = `/${string}`
type ValidUrlOrPath = ValidUrl | ValidPath | string
type ListOfUrlsOrPaths = string
type FileName = string

type MediaPreload = "none" | "metadata" | "auto" | ""
type HTMLMediaElementAttrs = {
  autoplay?: boolean
  controls?: boolean
  crossOrigin?: string
  currentTime?: number
  loop?: boolean
  muted?: boolean
  playbackRate?: number
  preload?: MediaPreload
  preservesPitch?: boolean
  src?: string
  srcObject?: MediaProvider | null
  volume?: number
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
type AutoComplete = "on" | "off"
type FormMethod = "get" | "post"

type Direction = "ltr" | "rtl" | "auto"

type FocussableElementTags =
  | "a"
  | "area"
  | "audio"
  | "button"
  | "details"
  | "dialog"
  | "embed"
  | "iframe"
  | "input"
  | "label"
  | "menu"
  | "meter"
  | "object"
  | "optgroup"
  | "option"
  | "output"
  | "progress"
  | "select"
  | "summary"
  | "textarea"
  | "video"

type LoadableElementTags =
  | "img"
  | "iframe"
  | "link"
  | "script"
  | "source"
  | "track"

type ErrorableElementTags = "img" | "iframe" | "link" | "script" | "source"

type GlobalAttributes = {
  accessKey?: string
  autocapitalize?: "on" | "off" | "none" | "sentences" | "words" | "characters"
  className?: string | ClassNameArray
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

type GlobalEventAttributes = Omit<
  Partial<GlobalEventHandlers>,
  | keyof InputEventAttributes<any>
  | keyof FocusEventAttributes
  | keyof KeyboardEventAttributes
  | "addEventListener"
  | "removeEventListener"
>

type KeyboardEventAttributes = {
  onkeyup?: (e: KeyboardEvent) => void
  onkeydown?: (e: KeyboardEvent) => void
  onkeypress?: (e: KeyboardEvent) => void
}

type FocusEventAttributes = {
  onblur?: (e: FocusEvent) => void
  onfocus?: (e: FocusEvent) => void
}

type InputEvent<T extends "input" | "select" | "textarea"> = Omit<
  Event,
  "target"
> & {
  target: T extends "input"
    ? HTMLInputElement
    : T extends "select"
    ? HTMLSelectElement
    : HTMLTextAreaElement
}
type InputEventAttributes<T extends "input" | "select" | "textarea"> = {
  onblur?: (e: InputEvent<T>) => void
  onfocus?: (e: InputEvent<T>) => void
  onchange?: (e: InputEvent<T>) => void
  oninput?: (e: InputEvent<T>) => void
  onreset?: (e: InputEvent<T>) => void
  onsubmit?: (e: InputEvent<T>) => void
}

// type MouseEventAttributes = {
//   onclick?: (e: MouseEvent) => void
//   ondblclick?: (e: MouseEvent) => void
//   onmousedown?: (e: MouseEvent) => void
//   onmouseenter?: (e: MouseEvent) => void
//   onmouseleave?: (e: MouseEvent) => void
//   onmousemove?: (e: MouseEvent) => void
//   onmouseout?: (e: MouseEvent) => void
//   onmouseover?: (e: MouseEvent) => void
//   onmouseup?: (e: MouseEvent) => void
// }

type EventAttributes<T extends string> = KeyboardEventAttributes &
  // MouseEventAttributes &
  (T extends FocussableElementTags ? FocusEventAttributes : {}) &
  (T extends "input" | "select" | "textarea" ? InputEventAttributes<T> : {}) &
  (T extends LoadableElementTags ? { onload?: (e: Event) => void } : {}) &
  (T extends ErrorableElementTags ? { onerror?: (e: Event) => void } : {})

type ElementReference<T extends HTMLElement> = T | null | string

type PopoverControlAttributes = {
  popoverTarget?: string
  popoverTargetAction?: "show" | "hide" | "toggle"
}

interface HtmlElementAttributes {
  a: {
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
    autofocus?: "autofocus"
    disabled?: boolean
    form?: ElementReference<HTMLFormElement>
    formAction?: FormAction
    formEnctype?: EncType
    formMethod?: FormMethod
    type?: "button" | "reset" | "submit"
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
  details: {
    open?: boolean
  }
  dfn: {}
  dialog: {
    open?: boolean
  }
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
    onsubmit?: (e: Event) => void
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
    crossOrigin?: string
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
    checked?: boolean
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
    value?: string | number
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
    crossOrigin?: string
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
    charset?: "utf-8"
    content?: string
    httpEquiv?: string
    name?: string
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
    crossOrigin?: string
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
    multiple?: boolean
    name?: string
    required?: boolean
    size?: string | number
    value?: string | number
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
  ellipse: SvgStrokeAttributes & {
    cx?: string | number
    cy?: string | number
    rx?: string | number
    ry?: string | number
    mask?: string
    opacity?: string | number
    pathLength?: string | number
  }
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
  feGaussianBlur: SvgColorInterpolationFilters & {
    in?: string
    stdDeviation?: string | number
    edgeMode?: "duplicate" | "wrap" | "none"
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
