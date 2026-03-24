import * as Kiru from "kiru"
import { isElement } from "kiru/utils"
import {
  assignCustomStylePropertiesForSize,
  createRefProxy,
  type HtmlOrSvgElement,
  type KiruGlobal,
  type Orientation,
} from "./utils.js"
import {
  createTriggerController,
  type TriggerController,
} from "./trigger-controller.js"

export type { Orientation }

// ─── Root Context ─────────────────────────────────────────────────────────────

interface AccordionRootContextType {
  id: Kiru.Signal<string>
  currentTabs: Kiru.Signal<string[]>
  toggle: (id: string) => void
  orientation: Kiru.Signal<Orientation>
  triggers: TriggerController
}
const AccordionRootContext = Kiru.createContext<AccordionRootContextType>(null!)
const useAccordionRoot = () => Kiru.useContext(AccordionRootContext)

// ─── Item Context ─────────────────────────────────────────────────────────────

interface AccordionItemContextType {
  value: Kiru.Signal<string>
  isOpen: Kiru.Signal<boolean>
  disabled: Kiru.Signal<boolean>
  sharedAttrs: {
    "data-state": Kiru.Signal<"open" | "closed">
    "data-disabled": Kiru.Signal<string | undefined>
    "data-orientation": Kiru.Signal<Orientation>
  }
  triggerId: Kiru.Signal<string>
  contentId: Kiru.Signal<string>
  toggle: () => void
}
const AccordionItemContext = Kiru.createContext<AccordionItemContextType>(null!)
const useAccordionItem = () => Kiru.useContext(AccordionItemContext)

// ─── Types ────────────────────────────────────────────────────────────────────
type AccordionMode = "single" | "multiple"

export type AccordionRootProps<
  Mode extends AccordionMode = "single",
  AsChild extends boolean = false,
> = {
  mode?: Mode
  onValueChange?: (
    value: Mode extends "single" ? string | null : string[]
  ) => void
  children?: JSX.Children
  asChild?: AsChild
  orientation?: Orientation
  collapsible?: boolean
} & (
  | {
      value: Kiru.Signal<Mode extends "single" ? string | null : string[]>
      defaultValue?: never
    }
  | {
      value?: never
      defaultValue?: Mode extends "single" ? string | null : string[]
    }
) &
  (AsChild extends true ? {} : JSX.IntrinsicElements["div"])

export type AccordionItemProps<AsChild extends boolean = false> = {
  value: string | Kiru.Signal<string>
  disabled?: boolean | Kiru.Signal<boolean>
  children?: JSX.Children
  asChild?: AsChild
} & (AsChild extends true ? {} : JSX.IntrinsicElements["div"])

export type AccordionHeaderProps<AsChild extends boolean = false> = {
  children?: JSX.Children
  asChild?: AsChild
  level?: 1 | 2 | 3 | 4 | 5 | 6
} & (AsChild extends true ? {} : JSX.IntrinsicElements["h3"])

export type AccordionTriggerProps<AsChild extends boolean = false> = {
  children?: JSX.Children
  asChild?: AsChild
} & (AsChild extends true ? {} : JSX.IntrinsicElements["button"])

export type AccordionContentProps<AsChild extends boolean = false> = {
  children?: JSX.Children
  asChild?: AsChild
} & (AsChild extends true ? {} : JSX.IntrinsicElements["div"])

// ─── Root ─────────────────────────────────────────────────────────────────────

interface AccordionRoot {
  <Mode extends AccordionMode = "single", AsChild extends boolean = false>(
    props: AccordionRootProps<Mode, AsChild>
  ): (props: AccordionRootProps<Mode, AsChild>) => JSX.Element
  displayName?: string
}

const AccordionRoot: AccordionRoot = () => {
  const $ = Kiru.setup<typeof AccordionRoot>()
  const currentTabs = $.derive(({ value, defaultValue }) => {
    if (!!value) {
      const v = value.value || null
      if (v === null) return []
      return Array.isArray(v) ? v : [v]
    }
    const v = defaultValue || null
    if (v === null) return []
    return Array.isArray(v) ? v : [v]
  })
  const orientation = $.derive((p) => p.orientation ?? "vertical")

  const toggle = (id: string) => {
    const tabs = currentTabs.peek()
    const { mode, value: propsValue, collapsible } = $.props
    const isShown = tabs.includes(id)

    let nextTabs
    if (mode === "multiple") {
      nextTabs = isShown ? tabs.filter((i) => i !== id) : [...tabs, id]
    } else {
      if (isShown && !collapsible) {
        return
      }
      nextTabs = currentTabs.value = isShown ? [] : [id]
    }

    const valueToEmit =
      mode === "multiple" ? [...nextTabs] : (nextTabs[0] ?? null)
    if (Kiru.Signal.isSignal(propsValue)) {
      propsValue.value = valueToEmit
    } else {
      currentTabs.value = nextTabs
    }
    $.props.onValueChange?.(valueToEmit)
  }

  const ctx: AccordionRootContextType = {
    id: $.id,
    currentTabs,
    toggle,
    orientation,
    triggers: createTriggerController({ orientation }),
  }

  const attrs = {
    "data-orientation": orientation,
  }

  return ({
    children,
    asChild,
    mode,
    onValueChange,
    orientation,
    collapsible,
    value,
    ...props
  }) => {
    if (asChild && isElement(children)) {
      return (
        <AccordionRootContext value={ctx}>
          {{ ...children, props: { ...children.props, ...attrs } }}
        </AccordionRootContext>
      )
    }
    return (
      <AccordionRootContext value={ctx}>
        <div {...props} {...attrs}>
          {children}
        </div>
      </AccordionRootContext>
    )
  }
}

// ─── Item ─────────────────────────────────────────────────────────────────────

interface AccordionItem {
  <AsChild extends boolean = false>(
    props: AccordionItemProps<AsChild>
  ): (props: AccordionItemProps<AsChild>) => JSX.Element
  displayName?: string
}

const AccordionItem: AccordionItem = () => {
  const $ = Kiru.setup<AccordionItemProps>()
  const { id, currentTabs, toggle, orientation } = useAccordionRoot()

  const value = $.derive((p) => Kiru.unwrap(p.value, true) ?? "")
  const disabled = $.derive((p) => Kiru.unwrap(p.disabled, true) ?? false)
  const isOpen = Kiru.computed(() => currentTabs.value.includes(value.value))

  const sharedAttrs: AccordionItemContextType["sharedAttrs"] = {
    "data-disabled": Kiru.computed(() => (disabled.value ? "" : undefined)),
    "data-state": Kiru.computed(() => (isOpen.value ? "open" : "closed")),
    "data-orientation": orientation,
  }
  const ctx: AccordionItemContextType = {
    value,
    isOpen,
    disabled,
    sharedAttrs,
    triggerId: Kiru.computed(() => `${id}:trigger:${value}`),
    contentId: Kiru.computed(() => `${id}:content:${value}`),
    toggle: () => toggle(value.peek()),
  }

  return ({ children, asChild, ...props }) => {
    if (asChild && isElement(children)) {
      return (
        <AccordionItemContext value={ctx}>
          {{
            ...children,
            props: { ...children.props, ...sharedAttrs },
          }}
        </AccordionItemContext>
      )
    }

    return (
      <AccordionItemContext value={ctx}>
        <div {...props} {...sharedAttrs}>
          {children}
        </div>
      </AccordionItemContext>
    )
  }
}

// ─── Header ───────────────────────────────────────────────────────────────────

interface AccordionHeader {
  <AsChild extends boolean = false>(
    props: AccordionHeaderProps<AsChild>
  ): (props: AccordionHeaderProps<AsChild>) => JSX.Element
  displayName?: string
}

const AccordionHeader: AccordionHeader = () => {
  const { sharedAttrs } = useAccordionItem()

  return ({ children, asChild, level, ...props }) => {
    if (asChild && isElement(children)) {
      return { ...children, props: { ...children.props, ...sharedAttrs } }
    }
    const Tag = `h${level ?? 3}` as "h3"
    return (
      <Tag {...props} {...sharedAttrs}>
        {children}
      </Tag>
    )
  }
}

// ─── Trigger ──────────────────────────────────────────────────────────────────

interface AccordionTrigger {
  <AsChild extends boolean = false>(
    props: AccordionTriggerProps<AsChild>
  ): (props: AccordionTriggerProps<AsChild>) => JSX.Element
  displayName?: string
}

const AccordionTrigger: AccordionTrigger = () => {
  const $ = Kiru.setup<AccordionTriggerProps>()
  const { triggers } = useAccordionRoot()
  const { value, isOpen, disabled, toggle, sharedAttrs, triggerId, contentId } =
    useAccordionItem()

  const refProxy = createRefProxy<HtmlOrSvgElement>((el) => {
    triggers.register(value.peek(), el)
  })

  const handleClick = (e: KiruGlobal.MouseEvent<HTMLButtonElement>) => {
    try {
      $.props.onclick?.(e)
    } finally {
      if (!e.defaultPrevented && !disabled.peek()) {
        toggle()
      }
    }
  }

  const handleKeydown = (e: KiruGlobal.KeyboardEvent<HTMLButtonElement>) => {
    try {
      $.props.onkeydown?.(e)
    } finally {
      if (!e.defaultPrevented) {
        triggers.onKeyDown(e, value)
      }
    }
  }

  const attrs = {
    ref: refProxy.ref,
    id: triggerId,
    onclick: handleClick,
    onkeydown: handleKeydown,
    "aria-disabled": Kiru.computed(() => (disabled.value ? "true" : "false")),
    "aria-expanded": Kiru.computed(() => (isOpen.value ? "true" : "false")),
    "aria-controls": contentId,
    ...sharedAttrs,
  }

  return ({ children, asChild, ...props }) => {
    refProxy.update(props)
    if (asChild && isElement(children)) {
      return { ...children, props: { ...children.props, ...attrs } }
    }
    return (
      <button type="button" {...props} {...attrs}>
        {children}
      </button>
    )
  }
}

// ─── Content ──────────────────────────────────────────────────────────────────

interface AccordionContent {
  <AsChild extends boolean = false>(
    props: AccordionContentProps<AsChild>
  ): (props: AccordionContentProps<AsChild>) => JSX.Element
  displayName?: string
}

const AccordionContent: AccordionContent = () => {
  const { isOpen, sharedAttrs, triggerId, contentId } = useAccordionItem()
  const wasOpenInitially = isOpen.peek()
  const hidden = Kiru.signal(!wasOpenInitially)
  const refProxy = createRefProxy<HtmlOrSvgElement>((el) => (element = el))
  let element: HtmlOrSvgElement | null = null

  let capturedAnimationStyles: {
    animationName: string
    transitionDuration: string
  } | null = null

  const captureAndPreventAnimationStyles = (element: HtmlOrSvgElement) => {
    const { animationName, transitionDuration } = element.style
    capturedAnimationStyles = { animationName, transitionDuration }
    element.style.animationName = "none"
    element.style.transitionDuration = "0s"
  }

  const assignCapturedAnimationStyles = (element: HtmlOrSvgElement) => {
    if (capturedAnimationStyles === null) return
    element.style.animationName = capturedAnimationStyles.animationName
    element.style.transitionDuration =
      capturedAnimationStyles.transitionDuration
    capturedAnimationStyles = null
  }

  Kiru.onBeforeMount(() => {
    if (!element) return
    if (isOpen.peek()) {
      captureAndPreventAnimationStyles(element)
      assignCustomStylePropertiesForSize(element, "accordion-content")
    }
  })

  let epoch = 0
  isOpen.subscribe(async (open) => {
    if (!element) return (hidden.value = true)
    const e = ++epoch

    if (!capturedAnimationStyles) captureAndPreventAnimationStyles(element)
    hidden.value = false

    // wait for browser recalculation
    await new Promise<any>(requestAnimationFrame)

    assignCustomStylePropertiesForSize(element, "accordion-content")
    assignCapturedAnimationStyles(element)

    if (open) return

    const animations = element.getAnimations()
    await Promise.allSettled(animations.map((a) => a.finished))
    if (e === epoch) {
      hidden.value = true
    }
  })

  const attrs = {
    id: contentId,
    ref: refProxy.ref,
    role: "region",
    "aria-labelledby": triggerId,
    ...sharedAttrs,
  }

  return ({ children, asChild, ...props }) => {
    refProxy.update(props)
    const isHidden = hidden.value
    if (asChild && isElement(children)) {
      const { children: childChildren, ...childProps } = children.props
      return {
        ...children,
        props: {
          ...childProps,
          ...attrs,
          hidden: isHidden,
          children: isHidden ? null : childChildren,
        },
      }
    }
    return (
      <div {...props} {...attrs}>
        {isHidden ? null : children}
      </div>
    )
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

AccordionRootContext.displayName = "AccordionRootContext"
AccordionItemContext.displayName = "AccordionItemContext"
AccordionRoot.displayName = "AccordionRoot"
AccordionItem.displayName = "AccordionItem"
AccordionHeader.displayName = "AccordionHeader"
AccordionTrigger.displayName = "AccordionTrigger"
AccordionContent.displayName = "AccordionContent"

export const Accordion = {
  Root: AccordionRoot,
  Item: AccordionItem,
  Header: AccordionHeader,
  Trigger: AccordionTrigger,
  Content: AccordionContent,
}
