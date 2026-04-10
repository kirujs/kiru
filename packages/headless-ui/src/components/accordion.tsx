import * as Kiru from "kiru"
import { isElement } from "kiru/utils"
import { useContentPanel } from "../hooks/use-content-panel.js"
import {
  callEventHandler,
  createContext,
  createRefProxy,
  createTriggerController,
  type TriggerController,
} from "../utils/index.js"
import type { HtmlOrSvgElement, Orientation, KiruGlobal } from "../types"

// ─── Root Context ─────────────────────────────────────────────────────────────

interface AccordionRootContextType {
  id: Kiru.Signal<string>
  currentTabs: Kiru.Signal<string[]>
  toggle: (id: string) => void
  orientation: Kiru.Signal<Orientation>
  triggers: TriggerController
}
const [AccordionRootContext, useAccordionRoot] =
  createContext<AccordionRootContextType>("AccordionRootContext")

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
const [AccordionItemContext, useAccordionItem] =
  createContext<AccordionItemContextType>("AccordionItemContext")

// ─── Types ────────────────────────────────────────────────────────────────────
type AccordionMode = "single" | "multiple"

type AccordionRootSingleProps = {
  onValueChange?: (value: string | null) => void
} & (
  | {
      value: Kiru.Signal<string | null>
      defaultValue?: never
    }
  | {
      value?: never
      defaultValue?: string | null
    }
)

type AccordionRootMultipleProps = {
  onValueChange?: (value: string[]) => void
} & (
  | {
      value: Kiru.Signal<string[]>
      defaultValue?: never
    }
  | {
      value?: never
      defaultValue?: string[]
    }
)

export type AccordionRootProps<
  Mode extends AccordionMode = "single",
  AsChild extends boolean = false,
> = {
  mode?: Mode
  children?: JSX.Children
  asChild?: AsChild
  orientation?: Orientation
  collapsible?: boolean
} & (Mode extends "single"
  ? AccordionRootSingleProps
  : AccordionRootMultipleProps) &
  (AsChild extends true ? {} : JSX.IntrinsicElements["div"])

export type AccordionItemProps<AsChild extends boolean = false> = {
  value: Kiru.Signalable<string>
  disabled?: Kiru.Signalable<boolean>
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
    const { mode, value: propsValue, collapsible, onValueChange } = $.props
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
    onValueChange?.(valueToEmit as any)
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
          {{ ...children, props: { ...children.props, ...props, ...attrs } }}
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
            props: { ...children.props, ...props, ...sharedAttrs },
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
      return {
        ...children,
        props: { ...children.props, ...props, ...sharedAttrs },
      }
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
    callEventHandler($.props, "onclick", e)
    if (!e.defaultPrevented && !disabled.peek()) {
      toggle()
    }
  }

  const handleKeydown = (e: KiruGlobal.KeyboardEvent<HTMLButtonElement>) => {
    callEventHandler($.props, "onkeydown", e)
    if (!e.defaultPrevented) {
      triggers.onKeyDown(e, value)
    }
  }

  const attrs = {
    ref: refProxy,
    id: triggerId,
    onclick: handleClick,
    onkeydown: handleKeydown,
    "aria-disabled": Kiru.computed(() => (disabled.value ? "true" : "false")),
    "aria-expanded": Kiru.computed(() => (isOpen.value ? "true" : "false")),
    "aria-controls": contentId,
    ...sharedAttrs,
  }

  return ({ children, asChild, ...props }) => {
    if (asChild && isElement(children)) {
      return { ...children, props: { ...children.props, ...props, ...attrs } }
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
  const { hidden, refProxy } = useContentPanel(isOpen)

  const attrs = {
    id: contentId,
    ref: refProxy,
    hidden,
    role: "region",
    "aria-labelledby": triggerId,
    ...sharedAttrs,
  }

  return ({ children, asChild, ...props }) => {
    const isHidden = hidden.value
    if (asChild && isElement(children)) {
      const { children: childChildren, ...childProps } = children.props
      return {
        ...children,
        props: {
          ...childProps,
          ...props,
          ...attrs,
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
