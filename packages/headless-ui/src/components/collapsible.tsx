import * as Kiru from "kiru"
import { isElement } from "kiru/utils"
import { useContentPanel } from "../hooks/use-content-panel.js"
import type { KiruGlobal } from "../types"

// ─── Root Context ─────────────────────────────────────────────────────────────

interface CollapsibleRootContextType {
  id: Kiru.Signal<string>
  open: Kiru.Signal<boolean>
  disabled: Kiru.Signal<boolean>
  triggerId: Kiru.Signal<string>
  contentId: Kiru.Signal<string>
  toggle: () => void
}

const CollapsibleRootContext = Kiru.createContext<CollapsibleRootContextType>(
  null!
)
const useCollapsibleRoot = () => Kiru.useContext(CollapsibleRootContext)

// ─── Types ────────────────────────────────────────────────────────────────────

export type CollapsibleRootProps<AsChild extends boolean = false> = {
  onOpenChange?: (open: boolean) => void
  disabled?: Kiru.Signalable<boolean>
  children?: JSX.Children
  asChild?: AsChild
} & (
  | { open: Kiru.Signal<boolean>; defaultOpen?: never }
  | { open?: never; defaultOpen?: boolean }
) &
  (AsChild extends true ? {} : JSX.IntrinsicElements["div"])

export type CollapsibleTriggerProps<AsChild extends boolean = false> = {
  children?: JSX.Children
  asChild?: AsChild
} & (AsChild extends true ? {} : JSX.IntrinsicElements["button"])

export type CollapsibleContentProps<AsChild extends boolean = false> = {
  children?: JSX.Children
  asChild?: AsChild
} & (AsChild extends true ? {} : JSX.IntrinsicElements["div"])

// ─── Root ─────────────────────────────────────────────────────────────────────

interface CollapsibleRoot {
  <AsChild extends boolean = false>(
    props: CollapsibleRootProps<AsChild>
  ): (props: CollapsibleRootProps<AsChild>) => JSX.Element
  displayName?: string
}

const CollapsibleRoot: CollapsibleRoot = () => {
  const $ = Kiru.setup<typeof CollapsibleRoot>()

  const open = $.derive(({ open, defaultOpen }) => {
    if (Kiru.Signal.isSignal(open)) {
      return open.value
    }
    return defaultOpen ?? false
  })

  const disabled = $.derive((p) => Kiru.unwrap(p.disabled, true) ?? false)

  const toggle = () => {
    const { open: propsOpen, onOpenChange } = $.props
    const currentOpen = open.peek()
    const nextOpen = !currentOpen

    if (Kiru.Signal.isSignal(propsOpen)) {
      propsOpen.value = nextOpen
    } else {
      open.value = nextOpen
    }

    onOpenChange?.(nextOpen)
  }

  const ctx: CollapsibleRootContextType = {
    id: $.id,
    open,
    disabled,
    toggle,
    triggerId: Kiru.computed(() => `${$.id}:trigger`),
    contentId: Kiru.computed(() => `${$.id}:content`),
  }

  const attrs = {
    "data-state": Kiru.computed(() => (open.value ? "open" : "closed")),
    "data-disabled": Kiru.computed(() => (disabled.value ? "" : undefined)),
  }

  return ({ children, asChild, onOpenChange, ...props }) => {
    if (asChild && isElement(children)) {
      return (
        <CollapsibleRootContext value={ctx}>
          {{ ...children, props: { ...children.props, ...attrs } }}
        </CollapsibleRootContext>
      )
    }
    return (
      <CollapsibleRootContext value={ctx}>
        <div {...props} {...attrs}>
          {children}
        </div>
      </CollapsibleRootContext>
    )
  }
}

// ─── Trigger ──────────────────────────────────────────────────────────────────

interface CollapsibleTrigger {
  <AsChild extends boolean = false>(
    props: CollapsibleTriggerProps<AsChild>
  ): (props: CollapsibleTriggerProps<AsChild>) => JSX.Element
  displayName?: string
}

const CollapsibleTrigger: CollapsibleTrigger = () => {
  const $ = Kiru.setup<CollapsibleTriggerProps>()
  const { triggerId, contentId, open, disabled, toggle } = useCollapsibleRoot()

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
      if (!e.defaultPrevented && !disabled.peek()) {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault()
          toggle()
        }
      }
    }
  }

  const attrs = {
    id: triggerId,
    onclick: handleClick,
    onkeydown: handleKeydown,
    "aria-disabled": Kiru.computed(() => (disabled.value ? "true" : "false")),
    "aria-expanded": Kiru.computed(() => (open.value ? "true" : "false")),
    "aria-controls": contentId,
    "data-state": Kiru.computed(() => (open.value ? "open" : "closed")),
    "data-disabled": Kiru.computed(() => (disabled.value ? "" : undefined)),
  }

  return ({ children, asChild, ...props }) => {
    if (asChild && isElement(children)) {
      return { ...children, props: { ...children.props, ...attrs } }
    }
    return (
      <button type="button" disabled={disabled.value} {...props} {...attrs}>
        {children}
      </button>
    )
  }
}

// ─── Content ──────────────────────────────────────────────────────────────────

interface CollapsibleContent {
  <AsChild extends boolean = false>(
    props: CollapsibleContentProps<AsChild>
  ): (props: CollapsibleContentProps<AsChild>) => JSX.Element
  displayName?: string
}

const CollapsibleContent: CollapsibleContent = () => {
  const { contentId, triggerId, open, disabled } = useCollapsibleRoot()
  const { hidden, refProxy } = useContentPanel(open)

  const attrs = {
    id: contentId,
    ref: refProxy.ref,
    role: "region",
    "aria-labelledby": triggerId,
    "data-state": Kiru.computed(() => (open.value ? "open" : "closed")),
    "data-disabled": Kiru.computed(() => (disabled.value ? "" : undefined)),
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

CollapsibleRootContext.displayName = "CollapsibleRootContext"
CollapsibleRoot.displayName = "CollapsibleRoot"
CollapsibleTrigger.displayName = "CollapsibleTrigger"
CollapsibleContent.displayName = "CollapsibleContent"

export const Collapsible = {
  Root: CollapsibleRoot,
  Trigger: CollapsibleTrigger,
  Content: CollapsibleContent,
}
