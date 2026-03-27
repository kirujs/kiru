import * as Kiru from "kiru"
import { isElement } from "kiru/utils"
import { createContext } from "../utils/index.js"
import type { KiruGlobal } from "../types"

// ─── Root Context ─────────────────────────────────────────────────────────────

interface SwitchRootContextType {
  id: Kiru.Signal<string>
  checked: Kiru.Signal<boolean>
  disabled: Kiru.Signal<boolean>
  toggle: () => void
  sharedAttrs: {
    "data-state": Kiru.Signal<"checked" | "unchecked">
    "data-disabled": Kiru.Signal<string | undefined>
  }
}
const [SwitchRootContext, useSwitchRoot] =
  createContext<SwitchRootContextType>("SwitchRootContext")

// ─── Types ────────────────────────────────────────────────────────────────────

export type SwitchRootProps<AsChild extends boolean = false> = {
  onCheckedChange?: (checked: boolean) => void
  disabled?: Kiru.Signalable<boolean>
  required?: Kiru.Signalable<boolean>
  name?: string
  value?: string
  children?: JSX.Children
  asChild?: AsChild
} & (
  | {
      checked: Kiru.Signal<boolean>
      defaultChecked?: never
    }
  | {
      checked?: never
      defaultChecked?: boolean
    }
) &
  (AsChild extends true ? {} : JSX.IntrinsicElements["button"])

export type SwitchThumbProps<AsChild extends boolean = false> = {
  children?: JSX.Children
  asChild?: AsChild
} & (AsChild extends true ? {} : JSX.IntrinsicElements["span"])

// ─── Root ─────────────────────────────────────────────────────────────────────

interface SwitchRoot {
  <AsChild extends boolean = false>(
    props: SwitchRootProps<AsChild>
  ): (props: SwitchRootProps<AsChild>) => JSX.Element
  displayName?: string
}

const SwitchRoot: SwitchRoot = () => {
  const $ = Kiru.setup<typeof SwitchRoot>()

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

  const required = $.derive((p) => {
    const r = Kiru.unwrap(p.required, true) as boolean | undefined
    return r ?? false
  })

  const toggle = () => {
    if (disabled.peek()) return

    const currentChecked = checked.peek()
    const nextChecked = !currentChecked

    const { checked: propsChecked } = $.props
    if (Kiru.Signal.isSignal(propsChecked)) {
      propsChecked.value = nextChecked
    } else {
      checked.value = nextChecked
    }
    $.props.onCheckedChange?.(nextChecked)
  }

  const sharedAttrs: SwitchRootContextType["sharedAttrs"] = {
    "data-state": Kiru.computed(() =>
      checked.value ? "checked" : "unchecked"
    ),
    "data-disabled": Kiru.computed(() => (disabled.value ? "" : undefined)),
  }

  const ctx: SwitchRootContextType = {
    id: $.id,
    checked,
    disabled,
    toggle,
    sharedAttrs,
  }

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
      if (!e.defaultPrevented && (e.key === " " || e.key === "Enter")) {
        e.preventDefault()
        if (!disabled.peek()) {
          toggle()
        }
      }
    }
  }

  const attrs = {
    role: "switch",
    type: "button" as const,
    onclick: handleClick,
    onkeydown: handleKeydown,
    "aria-checked": Kiru.computed(() => (checked.value ? "true" : "false")),
    "aria-disabled": Kiru.computed(() => (disabled.value ? "true" : undefined)),
    disabled: disabled,
    ...sharedAttrs,
  }

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
    const hiddenInputAttrs = {
      type: "checkbox" as const,
      "aria-hidden": "true",
      tabindex: -1,
      value: valueProp ?? "on",
      checked: checked,
      disabled: disabled,
      required: required,
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
        <SwitchRootContext value={ctx}>
          {{ ...children, props: { ...children.props, ...props, ...attrs } }}
          {name && <input {...hiddenInputAttrs} />}
        </SwitchRootContext>
      )
    }
    return (
      <SwitchRootContext value={ctx}>
        <button {...props} {...attrs}>
          {children}
        </button>
        {name && <input {...hiddenInputAttrs} />}
      </SwitchRootContext>
    )
  }
}

// ─── Thumb ────────────────────────────────────────────────────────────────────

interface SwitchThumb {
  <AsChild extends boolean = false>(
    props: SwitchThumbProps<AsChild>
  ): (props: SwitchThumbProps<AsChild>) => JSX.Element
  displayName?: string
}

const SwitchThumb: SwitchThumb = () => {
  const { sharedAttrs } = useSwitchRoot()

  const attrs = {
    ...sharedAttrs,
  }

  return ({ children, asChild, ...props }) => {
    if (asChild && isElement(children)) {
      return {
        ...children,
        props: {
          ...children.props,
          ...props,
          ...attrs,
        },
      }
    }
    return (
      <span {...props} {...attrs}>
        {children}
      </span>
    )
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

SwitchRoot.displayName = "SwitchRoot"
SwitchThumb.displayName = "SwitchThumb"

export const Switch = {
  Root: SwitchRoot,
  Thumb: SwitchThumb,
}
