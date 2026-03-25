import * as Kiru from "kiru"
import { isElement } from "kiru/utils"
import { createRefProxy } from "../utils.js"
import {
  createTriggerController,
  type TriggerController,
} from "./trigger-controller.js"
import type { KiruGlobal, Orientation } from "../types.js"

// ─── Root Context ─────────────────────────────────────────────────────────────

interface TabsRootContextType {
  id: Kiru.Signal<string>
  activeTab: Kiru.Signal<string | null>
  select: (value: string) => void
  orientation: Kiru.Signal<Orientation>
  triggers: TriggerController
}
const TabsRootContext = Kiru.createContext<TabsRootContextType>(null!)
const useTabsRoot = () => Kiru.useContext(TabsRootContext)

// ─── Types ────────────────────────────────────────────────────────────────────

export type TabsRootProps<AsChild extends boolean = false> = {
  onValueChange?: (value: string | null) => void
  orientation?: Orientation
  children?: JSX.Children
  asChild?: AsChild
} & (
  | {
      value: Kiru.Signal<string>
      defaultValue?: never
    }
  | {
      value?: never
      defaultValue: string
    }
) &
  (AsChild extends true ? {} : JSX.IntrinsicElements["div"])

export type TabsListProps<AsChild extends boolean = false> = {
  children?: JSX.Children
  asChild?: AsChild
} & (AsChild extends true ? {} : JSX.IntrinsicElements["div"])

export type TabsTriggerProps<AsChild extends boolean = false> = {
  value: Kiru.Signalable<string>
  disabled?: Kiru.Signalable<boolean>
  children?: JSX.Children
  asChild?: AsChild
} & (AsChild extends true ? {} : JSX.IntrinsicElements["button"])

export type TabsContentProps<AsChild extends boolean = false> = {
  value: Kiru.Signalable<string>
  children?: JSX.Children
  asChild?: AsChild
} & (AsChild extends true ? {} : JSX.IntrinsicElements["div"])

// ─── Root ─────────────────────────────────────────────────────────────────────

interface TabsRoot {
  <AsChild extends boolean = false>(
    props: TabsRootProps<AsChild>
  ): (props: TabsRootProps<AsChild>) => JSX.Element
  displayName?: string
}

const TabsRoot: TabsRoot = () => {
  const $ = Kiru.setup<TabsRootProps>()

  const activeTab = $.derive(({ value, defaultValue }) => {
    if (!!value) {
      return value.value ?? null
    }
    return defaultValue ?? null
  })
  const orientation = $.derive((p) => p.orientation ?? "horizontal")

  const select = (value: string) => {
    const { value: propsValue, onValueChange } = $.props
    if (Kiru.Signal.isSignal(propsValue)) {
      propsValue.value = value
    } else {
      activeTab.value = value
    }
    onValueChange?.(value)
  }

  const ctx: TabsRootContextType = {
    id: $.id,
    activeTab,
    select,
    orientation,
    triggers: createTriggerController({ orientation }),
  }

  const attrs = {
    "data-orientation": orientation,
  }

  return ({
    children,
    asChild,
    value,
    onValueChange,
    orientation,
    ...props
  }) => {
    if (asChild && isElement(children)) {
      return (
        <TabsRootContext value={ctx}>
          {{ ...children, props: { ...children.props, ...props, ...attrs } }}
        </TabsRootContext>
      )
    }
    return (
      <TabsRootContext value={ctx}>
        <div {...props} {...attrs}>
          {children}
        </div>
      </TabsRootContext>
    )
  }
}

// ─── List ─────────────────────────────────────────────────────────────────────

interface TabsList {
  <AsChild extends boolean = false>(
    props: TabsListProps<AsChild>
  ): (props: TabsListProps<AsChild>) => JSX.Element
  displayName?: string
}

const TabsList: TabsList = () => {
  const { orientation } = useTabsRoot()

  const attrs = {
    role: "tablist",
    "data-orientation": orientation,
  }

  return ({ children, asChild, ...props }) => {
    if (asChild && isElement(children)) {
      return { ...children, props: { ...children.props, ...props, ...attrs } }
    }
    return (
      <div {...props} {...attrs}>
        {children}
      </div>
    )
  }
}

// ─── Trigger ──────────────────────────────────────────────────────────────────

interface TabsTrigger {
  <AsChild extends boolean = false>(
    props: TabsTriggerProps<AsChild>
  ): (props: TabsTriggerProps<AsChild>) => JSX.Element
  displayName?: string
}

const TabsTrigger: TabsTrigger = () => {
  const $ = Kiru.setup<TabsTriggerProps>()
  const { id, activeTab, select, triggers } = useTabsRoot()

  const value = $.derive((p) => Kiru.unwrap(p.value, true) ?? "")
  const disabled = $.derive((p) => Kiru.unwrap(p.disabled, true) ?? false)
  const isActive = Kiru.computed(() => activeTab.value === value.value)

  const refProxy = createRefProxy<HTMLElement>((el) =>
    triggers.register(value.peek(), el)
  )

  const handleClick = (e: KiruGlobal.MouseEvent<HTMLButtonElement>) => {
    try {
      $.props.onclick?.(e)
    } finally {
      if (!e.defaultPrevented && !disabled.peek()) select(value.peek())
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
    role: "tab",
    id: Kiru.computed(() => `${id}:trigger:${value}`),
    onclick: handleClick,
    onkeydown: handleKeydown,
    disabled,
    "data-state": Kiru.computed(() => (isActive.value ? "active" : "inactive")),
    "data-disabled": Kiru.computed(() => (disabled.value ? "" : undefined)),
    "aria-disabled": Kiru.computed(() => (disabled.value ? "true" : "false")),
    "aria-selected": Kiru.computed(() => (isActive.value ? "true" : "false")),
    "aria-controls": Kiru.computed(() => `${id}:content:${value}`),
    tabIndex: Kiru.computed(() => (isActive.value ? 0 : -1)),
  }

  return ({ children, asChild, value, disabled, ...props }) => {
    refProxy.update(props)
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

// ─── Content ────────────────────────────────────────────────────────────────────

interface TabsContent {
  <AsChild extends boolean = false>(
    props: TabsContentProps<AsChild>
  ): (props: TabsContentProps<AsChild>) => JSX.Element
  displayName?: string
}

const TabsContent: TabsContent = () => {
  const $ = Kiru.setup<TabsContentProps>()
  const { id, activeTab, orientation } = useTabsRoot()

  const value = $.derive((p) => Kiru.unwrap(p.value, true) ?? "")
  const isActive = Kiru.computed(() => activeTab.value === value.value)
  const hidden = Kiru.computed(() => !isActive.value)
  const attrs = {
    id: Kiru.computed(() => `${id}:content:${value}`),
    role: "tabpanel",
    hidden,
    tabIndex: Kiru.computed(() => (isActive.value ? 0 : -1)),
    "data-state": Kiru.computed(() => (isActive.value ? "active" : "inactive")),
    "data-orientation": orientation,
    "aria-labelledby": Kiru.computed(() => `${id}:trigger:${value}`),
  }

  return ({ children, asChild, value, ...props }) => {
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

// ─── Exports ──────────────────────────────────────────────────────────────────

TabsRootContext.displayName = "TabsRootContext"
TabsRoot.displayName = "TabsRoot"
TabsList.displayName = "TabsList"
TabsTrigger.displayName = "TabsTrigger"
TabsContent.displayName = "TabsContent"

export const Tabs = {
  Root: TabsRoot,
  List: TabsList,
  Trigger: TabsTrigger,
  Content: TabsContent,
}
