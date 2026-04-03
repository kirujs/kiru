import * as Kiru from "kiru"
import { isElement } from "kiru/utils"
import { createContext } from "../utils/index.js"

type ProgressState = "complete" | "indeterminate" | "loading"

interface ProgressRootContextType {
  state: Kiru.Signal<ProgressState>
  value: Kiru.Signal<number | null | undefined>
  max: Kiru.Signal<number | null | undefined>
  ariaValueNow: Kiru.Signal<number | undefined>
  ariaValueText: Kiru.Signal<string | undefined>
}

const [ProgressRootContext, useProgressRoot] =
  createContext<ProgressRootContextType>("ProgressRootContext")

// ─── Types ────────────────────────────────────────────────────────────────

export type ProgressRootProps<AsChild extends boolean = false> = {
  /**
   * The current progress value.
   * - `number` shows determinate progress
   * - `null` shows indeterminate progress
   * - `undefined` shows loading progress
   */
  value?: Kiru.Signalable<number | null>
  max?: Kiru.Signalable<number>
  /**
   * Used to generate `aria-valuetext`.
   * Matches Radix's `getValueLabel`.
   */
  getValueLabel?: (value: number) => string
  children?: JSX.Children
  asChild?: AsChild
} & (AsChild extends true ? {} : JSX.IntrinsicElements["div"])

export type ProgressIndicatorProps<AsChild extends boolean = false> = {
  children?: JSX.Children
  asChild?: AsChild
} & (AsChild extends true ? {} : JSX.IntrinsicElements["div"])

// ─── Root ──────────────────────────────────────────────────────────────────

interface ProgressRoot {
  <AsChild extends boolean = false>(
    props: ProgressRootProps<AsChild>
  ): (props: ProgressRootProps<AsChild>) => JSX.Element
  displayName?: string
}

const ProgressRoot: ProgressRoot = () => {
  const $ = Kiru.setup<typeof ProgressRoot>()

  const value = $.derive(({ value }) => Kiru.unwrap(value, true))
  const max = $.derive(({ max }) => Kiru.unwrap(max, true))

  const state = Kiru.computed<ProgressState>(() => {
    const v = value.value
    const m = max.value

    if (v === undefined) return "loading"
    if (v === null) return "indeterminate"
    if (typeof m === "number" && v >= m) return "complete"
    return "loading"
  })

  const attrs = {
    "data-state": state,
    "data-value": value,
    "data-max": max,
  }

  const ctx: ProgressRootContextType = {
    state,
    value,
    max,
    ariaValueNow: Kiru.computed(() => {
      const v = value.value
      return typeof v === "number" ? v : undefined
    }),
    ariaValueText: Kiru.computed(() => {
      const v = value.value
      const fn = $.props.getValueLabel
      if (typeof v !== "number" || !fn) return undefined
      return fn(v)
    }),
  }

  return ({
    children,
    asChild,
    value: _value,
    max: _max,
    getValueLabel: _getValueLabel,
    ...props
  }) => {
    // These are consumed by the context above; we don't want to pass them to the DOM.
    ;(void _value, _max, _getValueLabel)

    if (asChild && isElement(children)) {
      return (
        <ProgressRootContext value={ctx}>
          {{
            ...children,
            props: { ...children.props, ...props, ...attrs },
          }}
        </ProgressRootContext>
      )
    }

    return (
      <ProgressRootContext value={ctx}>
        <div {...props} {...attrs}>
          {children}
        </div>
      </ProgressRootContext>
    )
  }
}

// ─── Indicator ─────────────────────────────────────────────────────────────

interface ProgressIndicator {
  <AsChild extends boolean = false>(
    props: ProgressIndicatorProps<AsChild>
  ): (props: ProgressIndicatorProps<AsChild>) => JSX.Element
  displayName?: string
}

const ProgressIndicator: ProgressIndicator = () => {
  const { state, value, max, ariaValueNow, ariaValueText } = useProgressRoot()

  const attrs = {
    role: "progressbar",
    "aria-valuemin": 0,
    "aria-valuenow": ariaValueNow,
    "aria-valuemax": max,
    "aria-valuetext": ariaValueText,
    "data-state": state,
    "data-value": value,
    "data-max": max,
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

// ─── Exports ────────────────────────────────────────────────────────────────

ProgressRoot.displayName = "ProgressRoot"
ProgressIndicator.displayName = "ProgressIndicator"

export const Progress = {
  Root: ProgressRoot,
  Indicator: ProgressIndicator,
}
