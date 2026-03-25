import * as Kiru from "kiru"
import { isElement } from "kiru/utils"
import { createRefProxy } from "../utils/ref-proxy.js"
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
const CheckboxRootContext = Kiru.createContext<CheckboxRootContextType>(null!)
const useCheckboxRoot = () => Kiru.useContext(CheckboxRootContext)

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

  const checked = $.derive(({ checked, defaultChecked }) => {
    if (Kiru.Signal.isSignal(checked)) {
      return checked.value
    }
    return defaultChecked ?? false
  })

  const disabled = $.derive((p) => {
    const d = Kiru.unwrap(p.disabled, true) as boolean | undefined
    return d ?? false
  })

  const toggle = () => {
    if (disabled.peek()) return

    const currentChecked = checked.peek()
    const nextChecked =
      currentChecked === "indeterminate" ? true : !currentChecked

    const { checked: propsChecked } = $.props
    if (Kiru.Signal.isSignal(propsChecked)) {
      propsChecked.value = nextChecked
    } else {
      checked.value = nextChecked
    }
    $.props.onCheckedChange?.(nextChecked)
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

  const refProxy = createRefProxy<HTMLButtonElement>(() => {})

  const handleClick = (e: KiruGlobal.MouseEvent<HTMLButtonElement>) => {
    const props = $.props as any
    try {
      props.onclick?.(e)
    } finally {
      if (!e.defaultPrevented && !disabled.peek()) {
        toggle()
      }
    }
  }

  const handleKeydown = (e: KiruGlobal.KeyboardEvent<HTMLButtonElement>) => {
    const props = $.props as any
    try {
      props.onkeydown?.(e)
    } finally {
      if (!e.defaultPrevented && e.key === " ") {
        e.preventDefault()
        if (!disabled.peek()) {
          toggle()
        }
      }
    }
  }

  const attrs = {
    ref: refProxy.ref,
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
    ...props
  }) => {
    refProxy.update(props)

    const hiddenInputAttrs = {
      type: "checkbox" as const,
      "aria-hidden": "true",
      tabindex: -1,
      value: valueProp ?? "on",
      checked: checkedBool,
      disabled: disabled,
      required: requiredProp,
      name: name,
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

    if (asChild && isElement(children)) {
      return (
        <CheckboxRootContext value={ctx}>
          {{ ...children, props: { ...children.props, ...props, ...attrs } }}
          {name && <input {...hiddenInputAttrs} />}
        </CheckboxRootContext>
      )
    }
    return (
      <CheckboxRootContext value={ctx}>
        <button {...props} {...attrs}>
          {children}
        </button>
        {name && <input {...hiddenInputAttrs} />}
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

CheckboxRootContext.displayName = "CheckboxRootContext"
CheckboxRoot.displayName = "CheckboxRoot"
CheckboxIndicator.displayName = "CheckboxIndicator"

export const Checkbox = {
  Root: CheckboxRoot,
  Indicator: CheckboxIndicator,
}
