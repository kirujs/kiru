import * as Kiru from "kiru"
import { isElement } from "kiru/utils"
import {
  createContext,
  createRefProxy,
  createTriggerController,
  type TriggerController,
} from "../utils/index.js"
import type { HtmlOrSvgElement, Orientation, KiruGlobal } from "../types"

// ─── Root Context ─────────────────────────────────────────────────────────────

interface RadioGroupRootContextType {
  id: Kiru.Signal<string>
  value: Kiru.Signal<string | null>
  orientation: Kiru.Signal<Orientation>
  disabled: Kiru.Signal<boolean>
  required: Kiru.Signal<boolean>
  name: string | undefined
  select: (value: string) => void
  triggers: TriggerController
}
const [RadioGroupRootContext, useRadioGroupRoot] =
  createContext<RadioGroupRootContextType>("RadioGroupRootContext")

// ─── Item Context ─────────────────────────────────────────────────────────────

interface RadioGroupItemContextType {
  value: Kiru.Signal<string>
  isChecked: Kiru.Signal<boolean>
  disabled: Kiru.Signal<boolean>
  sharedAttrs: {
    "data-state": Kiru.Signal<"checked" | "unchecked">
    "data-disabled": Kiru.Signal<string | undefined>
    "data-orientation": Kiru.Signal<Orientation>
  }
  select: () => void
}
const [RadioGroupItemContext, useRadioGroupItem] =
  createContext<RadioGroupItemContextType>("RadioGroupItemContext")

// ─── Types ────────────────────────────────────────────────────────────────────

export type RadioGroupRootProps<AsChild extends boolean = false> = {
  onValueChange?: (value: string) => void
  orientation?: Orientation
  disabled?: Kiru.Signalable<boolean>
  required?: Kiru.Signalable<boolean>
  name?: string
  children?: JSX.Children
  asChild?: AsChild
} & (
  | {
      value: Kiru.Signal<string>
      defaultValue?: never
    }
  | {
      value?: never
      defaultValue?: string
    }
) &
  (AsChild extends true ? {} : JSX.IntrinsicElements["div"])

export type RadioGroupItemProps<AsChild extends boolean = false> = {
  value: Kiru.Signalable<string>
  disabled?: Kiru.Signalable<boolean>
  children?: JSX.Children
  asChild?: AsChild
} & (AsChild extends true ? {} : JSX.IntrinsicElements["button"])

export type RadioGroupIndicatorProps<AsChild extends boolean = false> = {
  children?: JSX.Children
  asChild?: AsChild
} & (AsChild extends true ? {} : JSX.IntrinsicElements["span"])

// ─── Root ─────────────────────────────────────────────────────────────────────

interface RadioGroupRoot {
  <AsChild extends boolean = false>(
    props: RadioGroupRootProps<AsChild>
  ): (props: RadioGroupRootProps<AsChild>) => JSX.Element
  displayName?: string
}

const RadioGroupRoot: RadioGroupRoot = () => {
  const $ = Kiru.setup<typeof RadioGroupRoot>()

  const value = $.derive(({ value, defaultValue }) => {
    if (Kiru.Signal.isSignal(value)) {
      return value.value ?? null
    }
    return defaultValue ?? null
  })

  const orientation = $.derive((p) => p.orientation ?? "vertical")
  const disabled = $.derive((p) => Kiru.unwrap(p.disabled, true) ?? false)
  const required = $.derive((p) => Kiru.unwrap(p.required, true) ?? false)

  const select = (itemValue: string) => {
    if (disabled.peek()) return

    const { value: propsValue } = $.props
    if (Kiru.Signal.isSignal(propsValue)) {
      propsValue.value = itemValue
    } else {
      value.value = itemValue
    }
    $.props.onValueChange?.(itemValue)
  }

  const ctx: RadioGroupRootContextType = {
    id: $.id,
    value,
    orientation,
    disabled,
    required,
    name: $.props.name,
    select,
    triggers: createTriggerController({ orientation }),
  }

  const attrs = {
    role: "radiogroup",
    "aria-orientation": orientation,
    "data-orientation": orientation,
  }

  return ({
    children,
    asChild,
    value,
    defaultValue,
    onValueChange,
    orientation,
    disabled,
    required,
    name,
    ...props
  }) => {
    if (asChild && isElement(children)) {
      return (
        <RadioGroupRootContext value={ctx}>
          {{ ...children, props: { ...children.props, ...props, ...attrs } }}
        </RadioGroupRootContext>
      )
    }
    return (
      <RadioGroupRootContext value={ctx}>
        <div {...props} {...attrs}>
          {children}
        </div>
      </RadioGroupRootContext>
    )
  }
}

// ─── Item ─────────────────────────────────────────────────────────────────────

interface RadioGroupItem {
  <AsChild extends boolean = false>(
    props: RadioGroupItemProps<AsChild>
  ): (props: RadioGroupItemProps<AsChild>) => JSX.Element
  displayName?: string
}

const RadioGroupItem: RadioGroupItem = () => {
  const $ = Kiru.setup<RadioGroupItemProps>()
  const {
    value: groupValue,
    orientation,
    disabled: groupDisabled,
    required: groupRequired,
    name: groupName,
    select: groupSelect,
    triggers,
  } = useRadioGroupRoot()

  const value = $.derive((p) => Kiru.unwrap(p.value, true) ?? "")
  const disabled = $.derive((p) => {
    const d = Kiru.unwrap(p.disabled, true)
    return d ?? groupDisabled.value
  })
  const isChecked = Kiru.computed(() => groupValue.value === value.value)

  const sharedAttrs: RadioGroupItemContextType["sharedAttrs"] = {
    "data-state": Kiru.computed(() =>
      isChecked.value ? "checked" : "unchecked"
    ),
    "data-disabled": Kiru.computed(() => (disabled.value ? "" : undefined)),
    "data-orientation": orientation,
  }

  const select = () => {
    if (disabled.peek()) return
    groupSelect(value.peek())
  }

  const ctx: RadioGroupItemContextType = {
    value,
    isChecked,
    disabled,
    sharedAttrs,
    select,
  }

  const refProxy = createRefProxy<HtmlOrSvgElement>((el) => {
    triggers.register(value.peek(), el)
  })

  const handleClick = (e: KiruGlobal.MouseEvent<HTMLButtonElement>) => {
    const props = $.props as any
    try {
      props.onclick?.(e)
    } finally {
      if (!e.defaultPrevented && !disabled.peek()) {
        select()
      }
    }
  }

  const handleKeydown = (e: KiruGlobal.KeyboardEvent<HTMLButtonElement>) => {
    const props = $.props as any
    try {
      props.onkeydown?.(e)
    } finally {
      if (!e.defaultPrevented) {
        if (e.key === " ") {
          e.preventDefault()
          if (!disabled.peek()) {
            select()
          }
        } else {
          triggers.onKeyDown(e, value)
        }
      }
    }
  }

  const attrs = {
    ref: refProxy.ref,
    role: "radio",
    type: "button" as const,
    onclick: handleClick,
    onkeydown: handleKeydown,
    "aria-checked": Kiru.computed(() => (isChecked.value ? "true" : "false")),
    "aria-disabled": Kiru.computed(() => (disabled.value ? "true" : "false")),
    ...sharedAttrs,
  }
  const hiddenInputAttrs = {
    type: "radio" as const,
    "aria-hidden": "true",
    tabindex: -1,
    value,
    disabled,
    checked: isChecked,
    required: groupRequired,
    name: groupName,
    style: {
      position: "absolute" as const,
      "pointer-events": "none" as const,
      opacity: 0,
      margin: 0,
      transform: "translateX(-100%)",
      width: "25px",
      height: "25px",
    },
  }

  return ({ children, asChild, value, disabled, ...props }) => {
    refProxy.update(props)

    if (asChild && isElement(children)) {
      return (
        <RadioGroupItemContext value={ctx}>
          {{ ...children, props: { ...children.props, ...props, ...attrs } }}
          {groupName && <input {...hiddenInputAttrs} />}
        </RadioGroupItemContext>
      )
    }
    return (
      <RadioGroupItemContext value={ctx}>
        <button {...props} {...attrs}>
          {children}
        </button>
        {groupName && <input {...hiddenInputAttrs} />}
      </RadioGroupItemContext>
    )
  }
}

// ─── Indicator ────────────────────────────────────────────────────────────────

interface RadioGroupIndicator {
  <AsChild extends boolean = false>(
    props: RadioGroupIndicatorProps<AsChild>
  ): (props: RadioGroupIndicatorProps<AsChild>) => JSX.Element
  displayName?: string
}

const RadioGroupIndicator: RadioGroupIndicator = () => {
  const { isChecked, sharedAttrs } = useRadioGroupItem()

  const attrs = {
    ...sharedAttrs,
  }

  return ({ children, asChild, ...props }) => {
    const isVisible = isChecked.value
    if (asChild && isElement(children)) {
      const { children: childChildren, ...childProps } = children.props
      return {
        ...children,
        props: {
          ...childProps,
          ...props,
          ...attrs,
          children: isVisible ? childChildren : null,
        },
      }
    }
    return (
      <span {...props} {...attrs}>
        {isVisible ? children : null}
      </span>
    )
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

RadioGroupRoot.displayName = "RadioGroupRoot"
RadioGroupItem.displayName = "RadioGroupItem"
RadioGroupIndicator.displayName = "RadioGroupIndicator"

export const RadioGroup = {
  Root: RadioGroupRoot,
  Item: RadioGroupItem,
  Indicator: RadioGroupIndicator,
}
