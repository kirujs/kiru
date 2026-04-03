import * as Kiru from "kiru"
import { isElement } from "kiru/utils"
import { createContext } from "../utils/index.js"

interface CheckboxGroupContextType {
  id: Kiru.Signal<string>
  value: Kiru.Signal<string[]>
  disabled: Kiru.Signal<boolean>
  name: string | undefined
  allValues: Kiru.Signal<string[]>
  toggleValue: (itemValue: string) => void
  toggleParent: (allValues?: string[]) => void
  parentState: Kiru.Signal<boolean | "indeterminate">
}

const [CheckboxGroupRootContext, useCheckboxGroupRoot] =
  createContext<CheckboxGroupContextType>("CheckboxGroupContext")

export type CheckboxGroupProps<AsChild extends boolean = false> = {
  onValueChange?: (value: string[]) => void
  disabled?: Kiru.Signalable<boolean>
  name?: string
  allValues?: string[]
  children?: JSX.Children
  asChild?: AsChild
} & (
  | {
      value: Kiru.Signal<string[]>
      defaultValue?: never
    }
  | {
      value?: never
      defaultValue?: string[]
    }
) &
  (AsChild extends true ? {} : JSX.IntrinsicElements["div"])

interface CheckboxGroup {
  <AsChild extends boolean = false>(props: CheckboxGroupProps<AsChild>): (
    props: CheckboxGroupProps<AsChild>
  ) => JSX.Element
  displayName?: string
}

const CheckboxGroup: CheckboxGroup = () => {
  const $ = Kiru.setup<typeof CheckboxGroup>()

  const value = $.derive(({ value: propsValue, defaultValue }) => {
    if (Kiru.Signal.isSignal(propsValue)) {
      return propsValue.value ?? []
    }
    return defaultValue ?? []
  })

  const allValues = $.derive((p) => p.allValues ?? [])
  const disabled = $.derive((p) => Kiru.unwrap(p.disabled, true) ?? false)

  const updateValue = (nextValue: string[]) => {
    const { value: propsValue } = $.props
    if (Kiru.Signal.isSignal(propsValue)) {
      propsValue.value = nextValue
    } else {
      value.value = nextValue
    }
    $.props.onValueChange?.(nextValue)
  }

  const toggleValue = (itemValue: string) => {
    if (disabled.peek()) return

    const currentValue = value.peek()
    const isCurrentlyChecked = currentValue.includes(itemValue)
    const nextValue = isCurrentlyChecked
      ? currentValue.filter((v) => v !== itemValue)
      : Array.from(new Set([...currentValue, itemValue]))

    updateValue(nextValue)
  }

  const toggleParent = (values?: string[]) => {
    if (disabled.peek()) return

    const all = values ?? allValues.peek()
    if (!all.length) return

    const currentValue = value.peek()
    const currentSet = new Set(currentValue)
    const allSelected = all.every((v) => currentSet.has(v))

    const allSet = new Set(all)
    const nextValue = allSelected
      ? currentValue.filter((v) => !allSet.has(v))
      : Array.from(new Set([...currentValue, ...all]))

    updateValue(nextValue)
  }

  const parentState = Kiru.computed(() => {
    const all = allValues.value
    if (!all.length) return false

    const currentValue = value.value
    const selectedCount = all.reduce((acc, v) => {
      return currentValue.includes(v) ? acc + 1 : acc
    }, 0)

    if (selectedCount === 0) return false
    if (selectedCount === all.length) return true
    return "indeterminate"
  })

  const ctx: CheckboxGroupContextType = {
    id: $.id,
    value,
    disabled,
    name: $.props.name,
    allValues,
    toggleValue,
    toggleParent,
    parentState,
  }

  const attrs = {
    role: "group",
  }

  return ({
    children,
    asChild,
    value,
    defaultValue,
    onValueChange,
    disabled: disabledProp,
    name,
    allValues: _allValuesProp,
    ...props
  }) => {
    const hiddenInputs = name
      ? ctx.value.value.map((val) => (
          <input
            key={val}
            type="checkbox"
            aria-hidden="true"
            tabIndex={-1}
            value={val}
            checked={true}
            name={name}
            style={{
              position: "absolute",
              pointerEvents: "none",
              opacity: 0,
              margin: 0,
              transform: "translateX(-100%)",
              width: "25px",
              height: "25px",
            }}
          />
        ))
      : null

    if (asChild && isElement(children)) {
      return (
        <CheckboxGroupRootContext value={ctx}>
          {{ ...children, props: { ...children.props, ...props, ...attrs } }}
          {hiddenInputs}
        </CheckboxGroupRootContext>
      )
    }

    return (
      <CheckboxGroupRootContext value={ctx}>
        <div {...props} {...attrs}>
          {children}
        </div>
        {hiddenInputs}
      </CheckboxGroupRootContext>
    )
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────
CheckboxGroup.displayName = "CheckboxGroupRoot"

export { CheckboxGroup, useCheckboxGroupRoot }
