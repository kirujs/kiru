import * as Kiru from "kiru"
import { isElement } from "kiru/utils"
import { callEventHandler, createContext } from "../utils/index.js"
import { HIDDEN_INPUT_STYLES } from "../constants.js"
import { useCheckboxGroupRoot } from "./checkbox-group.js"
import type { KiruGlobal } from "../types"

// ─── Root Context ─────────────────────────────────────────────────────────────

interface CheckboxRootContextType {
  id: Kiru.Signal<string>
  checked: Kiru.Signal<boolean | "indeterminate">
  disabled: Kiru.Signal<boolean>
  toggle: () => void
  sharedAttrs: {
    "data-state": Kiru.Signal<"checked" | "unchecked" | "indeterminate">
    "data-disabled": Kiru.Signal<string | undefined>
  }
}
const [CheckboxRootContext, useCheckboxRoot] =
  createContext<CheckboxRootContextType>("CheckboxRootContext")

// ─── Types ────────────────────────────────────────────────────────────────────

export type CheckboxRootProps<AsChild extends boolean = false> = {
  onCheckedChange?: (checked: boolean | "indeterminate") => void
  disabled?: Kiru.Signalable<boolean>
  required?: Kiru.Signalable<boolean>
  name?: string
  value?: string

  children?: JSX.Children
  asChild?: AsChild
} & (
  | {
      value?: string
      parent?: never
    }
  | {
      // When rendered as a "parent" inside a CheckboxGroup, it reflects/controls
      // selection of the group's (or its own) `allValues`.
      value?: never
      parent?: boolean
    }
) &
  (
    | {
        checked: Kiru.Signal<boolean | "indeterminate">
        defaultChecked?: never
      }
    | {
        checked?: never
        defaultChecked?: boolean | "indeterminate"
      }
  ) &
  (AsChild extends true ? {} : JSX.IntrinsicElements["button"])

export type CheckboxIndicatorProps<AsChild extends boolean = false> = {
  children?: JSX.Children
  asChild?: AsChild
} & (AsChild extends true ? {} : JSX.IntrinsicElements["span"])

// ─── Root ─────────────────────────────────────────────────────────────────────

interface CheckboxRoot {
  <AsChild extends boolean = false>(
    props: CheckboxRootProps<AsChild>
  ): (props: CheckboxRootProps<AsChild>) => JSX.Element
  displayName?: string
}

const CheckboxRoot: CheckboxRoot = () => {
  const $ = Kiru.setup<typeof CheckboxRoot>()

  // Optional CheckboxGroup context. We catch because Checkbox can be used standalone.
  let groupCtx: ReturnType<typeof useCheckboxGroupRoot> | null = null
  try {
    groupCtx = useCheckboxGroupRoot()
  } catch {
    groupCtx = null
  }

  const isParent = $.derive((p) => p.parent ?? false)
  const itemValue = $.derive((p) => p.value ?? "on")

  const propsChecked = $.derive(({ checked, defaultChecked }) => {
    if (Kiru.Signal.isSignal(checked)) {
      return checked.value
    }
    return defaultChecked ?? false
  })

  const localDisabled = $.derive((p) => {
    const d = Kiru.unwrap(p.disabled, true) as boolean | undefined
    return d ?? false
  })

  const disabled = Kiru.computed(() => {
    if (!groupCtx) return localDisabled.value
    return localDisabled.value || groupCtx.disabled.value
  })

  const checked = Kiru.computed(() => {
    if (!groupCtx) return propsChecked.value

    if (isParent.value) {
      const all = groupCtx.allValues.value
      if (!all.length) return false

      const currentValue = groupCtx.value.value
      const selectedCount = all.reduce((acc, v) => {
        return currentValue.includes(v) ? acc + 1 : acc
      }, 0)

      if (selectedCount === 0) return false
      if (selectedCount === all.length) return true
      return "indeterminate"
    }

    return groupCtx.value.value.includes(itemValue.value)
  })

  const toggleStandalone = () => {
    if (disabled.peek()) return

    const currentChecked = propsChecked.peek()
    const nextChecked =
      currentChecked === "indeterminate" ? true : !currentChecked

    const { checked: propsCheckedSignal, onCheckedChange } = $.props
    if (Kiru.Signal.isSignal(propsCheckedSignal)) {
      propsCheckedSignal.value = nextChecked
    } else {
      propsChecked.value = nextChecked
    }
    onCheckedChange?.(nextChecked)
  }

  const toggleGroup = () => {
    if (!groupCtx) return
    if (disabled.peek()) return

    if (isParent.value) {
      const all = groupCtx.allValues.peek()
      if (!all.length) return

      const currentValue = groupCtx.value.peek()
      const currentSet = new Set(currentValue)
      const allSelected = all.every((v) => currentSet.has(v))
      const nextChecked = allSelected ? false : true

      $.props.onCheckedChange?.(nextChecked)
      groupCtx.toggleParent()
      return
    }

    const val = itemValue.value
    const currentChecked = groupCtx.value.peek().includes(val)
    const nextChecked = !currentChecked

    $.props.onCheckedChange?.(nextChecked)
    groupCtx.toggleValue(val)
  }

  const toggle = () => {
    if (groupCtx) {
      toggleGroup()
    } else {
      toggleStandalone()
    }
  }

  const sharedAttrs: CheckboxRootContextType["sharedAttrs"] = {
    "data-state": Kiru.computed(() => {
      const c = checked.value
      return c === "indeterminate"
        ? "indeterminate"
        : c
          ? "checked"
          : "unchecked"
    }),
    "data-disabled": Kiru.computed(() => (disabled.value ? "" : undefined)),
  }

  const ctx: CheckboxRootContextType = {
    id: $.id,
    checked,
    disabled,
    toggle,
    sharedAttrs,
  }

  const handleClick = (e: KiruGlobal.MouseEvent<HTMLButtonElement>) => {
    try {
      callEventHandler($.props, "onclick", e)
    } finally {
    }
    if (!e.defaultPrevented && !disabled.peek()) {
      toggle()
    }
  }

  const handleKeydown = (e: KiruGlobal.KeyboardEvent<HTMLButtonElement>) => {
    try {
      callEventHandler($.props, "onkeydown", e)
    } finally {
    }
    if (e.defaultPrevented || e.key !== " ") {
      return
    }
    e.preventDefault()
    if (!disabled.peek()) {
      toggle()
    }
  }

  const attrs = {
    role: "checkbox",
    type: "button" as const,
    onclick: handleClick,
    onkeydown: handleKeydown,
    "aria-checked": Kiru.computed(() => {
      const c = checked.value
      return c === "indeterminate" ? "mixed" : c ? "true" : "false"
    }),
    "aria-disabled": Kiru.computed(() => (disabled.value ? "true" : "false")),
    ...sharedAttrs,
  }

  const checkedBool = Kiru.computed(() => {
    const c = checked.value
    return c === true
  })

  return ({
    children,
    asChild,
    checked: checkedProp,
    defaultChecked,
    onCheckedChange,
    disabled: disabledProp,
    required: requiredProp,
    name,
    value: valueProp,
    parent,
    ...props
  }) => {
    // Prevent these bindings from becoming unused locals (they're only read
    // via signals derived from `$.props`).
    void parent
    const shouldRenderHiddenInput = name && !(groupCtx && groupCtx.name)
    const hiddenInputAttrs = {
      type: "checkbox" as const,
      "aria-hidden": "true",
      tabindex: -1,
      value: valueProp ?? "on",
      checked: checkedBool,
      disabled: disabled,
      required: requiredProp,
      name: name,
      style: HIDDEN_INPUT_STYLES,
    }

    if (asChild && isElement(children)) {
      return (
        <CheckboxRootContext value={ctx}>
          {{ ...children, props: { ...children.props, ...props, ...attrs } }}
          {shouldRenderHiddenInput && <input {...hiddenInputAttrs} />}
        </CheckboxRootContext>
      )
    }
    return (
      <CheckboxRootContext value={ctx}>
        <button {...props} {...attrs}>
          {children}
        </button>
        {shouldRenderHiddenInput && <input {...hiddenInputAttrs} />}
      </CheckboxRootContext>
    )
  }
}

// ─── Indicator ────────────────────────────────────────────────────────────────

interface CheckboxIndicator {
  <AsChild extends boolean = false>(
    props: CheckboxIndicatorProps<AsChild>
  ): (props: CheckboxIndicatorProps<AsChild>) => JSX.Element
  displayName?: string
}

const CheckboxIndicator: CheckboxIndicator = () => {
  const { checked, sharedAttrs } = useCheckboxRoot()

  const attrs = {
    ...sharedAttrs,
  }

  return ({ children, asChild, ...props }) => {
    const isVisible =
      checked.value === true || checked.value === "indeterminate"
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

CheckboxRoot.displayName = "CheckboxRoot"
CheckboxIndicator.displayName = "CheckboxIndicator"

export const Checkbox = {
  Root: CheckboxRoot,
  Indicator: CheckboxIndicator,
}
