import * as Kiru from "kiru"
import { isElement, styleObjectToString } from "kiru/utils"
import {
  callEventHandler,
  createContext,
  createRefProxy,
} from "../utils/index.js"
import type { Direction, KiruGlobal, Orientation } from "../types"

// ─── Root Context ─────────────────────────────────────────────────────────────

interface SliderRootContextType {
  id: Kiru.Signal<string>
  rootElement: KiruGlobal.RefObject<Element | null>
  values: Kiru.Signal<number[]>
  orientation: Kiru.Signal<Orientation>
  dir: Kiru.Signal<Direction>
  disabled: Kiru.Signal<boolean>
  min: Kiru.Signal<number>
  max: Kiru.Signal<number>
  step: Kiru.Signal<number>
  name: string | undefined
  updateValue: (
    index: number,
    newValue: number,
    allowSwitch?: boolean
  ) => number
  getValuePercent: (value: number) => number
  getValueFromPercent: (percent: number) => number
  getClosestValueIndex: (value: number) => number
  sharedAttrs: {
    "data-orientation": Kiru.Signal<Orientation>
    "data-disabled": Kiru.Signal<string | undefined>
  }
}
const [SliderRootContext, useSliderRoot] =
  createContext<SliderRootContextType>("SliderRootContext")

// ─── Types ────────────────────────────────────────────────────────────────────

export type SliderMode = "single" | "multiple"

type SliderRootSingleProps = {
  onValueChange?: (value: number) => void
  disableSwitch?: never
  minStepsBetweenThumbs?: never
} & (
  | {
      value: Kiru.Signal<number>
      defaultValue?: never
    }
  | {
      value?: never
      defaultValue?: number
    }
)

// type ThumbCollisionBehavior = "swap" | "constrain" |"push"

type SliderRootMultipleProps = {
  onValueChange?: (value: number[]) => void
  disableSwitch?: boolean
  minStepsBetweenThumbs?: number
} & (
  | {
      value: Kiru.Signal<number[]>
      defaultValue?: never
    }
  | {
      value?: never
      defaultValue?: number[]
    }
)

export type SliderRootProps<
  Mode extends SliderMode = "single",
  AsChild extends boolean = false,
> = {
  orientation?: Orientation
  dir?: Direction
  disabled?: Kiru.Signalable<boolean>
  min?: number
  max?: number
  step?: number
  name?: string
  children?: JSX.Children
  asChild?: AsChild
  mode?: Mode
} & (Mode extends "single" ? SliderRootSingleProps : SliderRootMultipleProps) &
  (AsChild extends true ? {} : JSX.IntrinsicElements["span"])

export type SliderTrackProps<AsChild extends boolean = false> = {
  children?: JSX.Children
  asChild?: AsChild
} & (AsChild extends true ? {} : JSX.IntrinsicElements["span"])

export type SliderRangeProps<AsChild extends boolean = false> = {
  children?: JSX.Children
  asChild?: AsChild
} & (AsChild extends true ? {} : JSX.IntrinsicElements["span"])

export type SliderThumbProps<AsChild extends boolean = false> = {
  index?: number
  children?: JSX.Children
  asChild?: AsChild
} & (AsChild extends true ? {} : JSX.IntrinsicElements["span"])

// ─── Root ─────────────────────────────────────────────────────────────────────

interface SliderRoot {
  <Mode extends SliderMode = "single", AsChild extends boolean = false>(
    props: SliderRootProps<Mode, AsChild>
  ): (props: SliderRootProps<Mode, AsChild>) => JSX.Element
  displayName?: string
}

const SliderRoot: SliderRoot = () => {
  const $ = Kiru.setup<typeof SliderRoot>()

  const values = $.derive(({ value, defaultValue }) => {
    if (!!value) {
      const v = value.value
      if (v === null || v === undefined) return []
      return Array.isArray(v) ? v : [v]
    }
    const v = defaultValue
    if (v === null || v === undefined) return []
    return Array.isArray(v) ? v : [v]
  })

  const orientation = $.derive((p) => p.orientation ?? "horizontal")
  const dir = $.derive((p) => p.dir ?? "ltr")
  const disabled = $.derive((p) => {
    const d = Kiru.unwrap(p.disabled, true) as boolean | undefined
    return d ?? false
  })

  const min = $.derive((p) => p.min ?? 0)
  const max = $.derive((p) => p.max ?? 100)
  const step = $.derive((p) => p.step ?? 1)

  const updateValue = (
    index: number,
    newValue: number,
    allowSwitch = false
  ) => {
    if (disabled.peek()) return index
    const {
      value: propsValue,
      mode,
      minStepsBetweenThumbs = 0,
      onValueChange,
    } = $.props

    const currentValues = values.peek()
    if (index < 0 || index >= currentValues.length) {
      return index
    }

    const minVal = min.peek()
    const maxVal = max.peek()
    const stepVal = step.peek()
    const minStepsBetween = minStepsBetweenThumbs
    // Ensure thumbs are always at least 1 step apart, plus any additional minStepsBetweenThumbs
    const minDistance = minStepsBetween * stepVal

    // Clamp and round the new value
    let clampedValue = clampValue(newValue, minVal, maxVal)
    const roundedValue = roundToStep(clampedValue, stepVal, minVal)
    let finalValue = clampValue(roundedValue, minVal, maxVal)

    let targetIndex = index
    const newValues = [...currentValues]

    // For multiple thumbs, check if we should switch to a neighboring thumb
    if (
      $.props.disableSwitch !== true &&
      allowSwitch &&
      currentValues.length > 1
    ) {
      // Check if we should switch to a neighboring thumb (before clamping)
      // If dragging past the right neighbor, check if we have enough distance to switch
      if (
        index < currentValues.length - 1 &&
        finalValue > currentValues[index + 1]
      ) {
        const neighborValue = currentValues[index + 1]
        const requiredValue = neighborValue + minDistance

        // Only switch if we've dragged far enough for the next step
        if (finalValue >= requiredValue) {
          targetIndex = index + 1
          // Original thumb takes neighbor's value
          newValues[index] = neighborValue
          // New thumb gets the value beyond the required distance
          finalValue = Math.max(finalValue, requiredValue)
        }
      }
      // If dragging past the left neighbor, check if we have enough distance to switch
      else if (index > 0 && finalValue < currentValues[index - 1]) {
        const neighborValue = currentValues[index - 1]
        const requiredValue = neighborValue - minDistance

        // Only switch if we've dragged far enough for the next step
        if (finalValue <= requiredValue) {
          targetIndex = index - 1
          // Original thumb takes neighbor's value
          newValues[index] = neighborValue
          // New thumb gets the value beyond the required distance
          finalValue = Math.min(finalValue, requiredValue)
        }
      }

      // If we didn't switch, clamp to maintain minimum distance
      if (targetIndex === index) {
        if (index > 0) {
          const leftThumbValue = currentValues[index - 1]
          finalValue = Math.max(finalValue, leftThumbValue + minDistance)
        }
        if (index < currentValues.length - 1) {
          const rightThumbValue = currentValues[index + 1]
          finalValue = Math.min(finalValue, rightThumbValue - minDistance)
        }
      }

      // After switching, ensure the new value respects other neighbors
      if (targetIndex !== index) {
        if (targetIndex > 0 && targetIndex !== index) {
          const leftThumbValue = newValues[targetIndex - 1]
          finalValue = Math.max(finalValue, leftThumbValue + minDistance)
        }
        if (targetIndex < currentValues.length - 1 && targetIndex !== index) {
          const rightThumbValue = newValues[targetIndex + 1]
          finalValue = Math.min(finalValue, rightThumbValue - minDistance)
        }
      }
    } else if (currentValues.length > 1) {
      // If not allowing switch, clamp to neighboring values with minDistance
      if (index > 0) {
        const leftThumbValue = currentValues[index - 1]
        finalValue = Math.max(finalValue, leftThumbValue + minDistance)
      }
      if (index < currentValues.length - 1) {
        const rightThumbValue = currentValues[index + 1]
        finalValue = Math.min(finalValue, rightThumbValue - minDistance)
      }
    }

    newValues[targetIndex] = finalValue

    const valueToEmit =
      mode === "multiple" ? [...newValues] : (newValues[0] ?? null)

    if (Kiru.Signal.isSignal(propsValue)) {
      propsValue.value = valueToEmit
    } else {
      values.value = newValues
    }
    onValueChange?.(valueToEmit as any)

    return targetIndex
  }

  const getValuePercent = (val: number): number => {
    const minVal = min.peek()
    const maxVal = max.peek()
    return ((val - minVal) / (maxVal - minVal)) * 100
  }

  const getValueFromPercent = (percent: number): number => {
    const minVal = min.peek()
    const maxVal = max.peek()
    const stepVal = step.peek()
    let val = (percent / 100) * (maxVal - minVal) + minVal
    return roundToStep(val, stepVal, minVal)
  }

  const getClosestValueIndex = (val: number): number => {
    const currentValues = values.peek()
    let closestIndex = 0
    let closestDistance = Math.abs(currentValues[0] - val)

    for (let i = 1; i < currentValues.length; i++) {
      const distance = Math.abs(currentValues[i] - val)
      if (distance < closestDistance) {
        closestDistance = distance
        closestIndex = i
      }
    }

    return closestIndex
  }

  const sharedAttrs: SliderRootContextType["sharedAttrs"] = {
    "data-orientation": orientation,
    "data-disabled": Kiru.computed(() => (disabled.value ? "" : undefined)),
  }

  const refProxy = createRefProxy<HTMLSpanElement>()

  const ctx: SliderRootContextType = {
    id: $.id,
    rootElement: refProxy,
    values,
    orientation,
    dir,
    disabled,
    min,
    max,
    step,
    name: $.props.name,
    updateValue,
    getValuePercent,
    getValueFromPercent,
    getClosestValueIndex,
    sharedAttrs,
  }

  const attrs = {
    ref: refProxy.ref,
    role: "group",
    "aria-orientation": orientation,
    dir: dir,
    ...sharedAttrs,
  }

  return ({
    children,
    asChild,
    value: valueProp,
    defaultValue,
    onValueChange,
    orientation: orientationProp,
    disabled: disabledProp,
    min: minProp,
    max: maxProp,
    step: stepProp,
    minStepsBetweenThumbs: minStepsBetweenThumbsProp,
    name,
    mode,
    disableSwitch,
    ...props
  }) => {
    refProxy.update(props)

    const hiddenInputs = name
      ? values.value.map((val, i) => (
          <input
            key={i}
            type="number"
            aria-hidden="true"
            tabIndex={-1}
            name={values.value.length === 1 ? name : `${name}[${i}]`}
            value={val}
            disabled={disabled}
            style="display:none"
          />
        ))
      : null

    if (asChild && isElement(children)) {
      return (
        <SliderRootContext value={ctx}>
          {{ ...children, props: { ...children.props, ...props, ...attrs } }}
          {hiddenInputs}
        </SliderRootContext>
      )
    }
    return (
      <SliderRootContext value={ctx}>
        <span {...props} {...attrs}>
          {children}
          {hiddenInputs}
        </span>
      </SliderRootContext>
    )
  }
}

// ─── Track ────────────────────────────────────────────────────────────────────

interface SliderTrack {
  <AsChild extends boolean = false>(
    props: SliderTrackProps<AsChild>
  ): (props: SliderTrackProps<AsChild>) => JSX.Element
  displayName?: string
}

const SliderTrack: SliderTrack = () => {
  const $ = Kiru.setup<SliderTrackProps>()
  const ctx = useSliderRoot()

  const refProxy = createRefProxy<HTMLSpanElement>()

  const handleClick = (e: KiruGlobal.PointerEvent<HTMLSpanElement>) => {
    callEventHandler($.props, "onclick", e)
    if (e.defaultPrevented) return
    e.preventDefault()

    if (ctx.disabled.peek()) return
    const elementRef = refProxy.current
    if (!elementRef) return

    const rect = elementRef.getBoundingClientRect()
    const orientation = ctx.orientation.peek()
    const dir = ctx.dir.peek()

    let percent: number
    if (orientation === "horizontal") {
      if (dir === "rtl") {
        percent = ((rect.right - e.clientX) / rect.width) * 100
      } else {
        percent = ((e.clientX - rect.left) / rect.width) * 100
      }
    } else {
      // Vertical: bottom is min, top is max
      percent = ((rect.bottom - e.clientY) / rect.height) * 100
    }

    const value = ctx.getValueFromPercent(percent)
    const closestIndex = ctx.getClosestValueIndex(value)
    ctx.updateValue(closestIndex, value)
  }

  const attrs = {
    ref: refProxy.ref,
    onclick: handleClick,
    ...ctx.sharedAttrs,
  }

  return ({ children, asChild, ...props }) => {
    refProxy.update(props)

    if (asChild && isElement(children)) {
      return {
        ...children,
        props: { ...children.props, ...props, ...attrs },
      }
    }
    return (
      <span {...props} {...attrs}>
        {children}
      </span>
    )
  }
}

// ─── Range ────────────────────────────────────────────────────────────────────

interface SliderRange {
  <AsChild extends boolean = false>(
    props: SliderRangeProps<AsChild>
  ): (props: SliderRangeProps<AsChild>) => JSX.Element
  displayName?: string
}

const SliderRange: SliderRange = () => {
  const $ = Kiru.setup<SliderRangeProps>()
  const ctx = useSliderRoot()

  const propStyle = $.derive(({ asChild, children, style }) => {
    if (asChild && isElement(children)) {
      return Kiru.unwrap(children.props.style, true)
    }
    return Kiru.unwrap(style, true)
  })

  const style = Kiru.computed(() => {
    const dir = ctx.dir.value
    const values = ctx.values.value
    const orientation = ctx.orientation.value
    const minValue = Math.min(...values)
    const maxValue = Math.max(...values)

    const minPercent = ctx.getValuePercent(minValue)
    const maxPercent = ctx.getValuePercent(maxValue)
    const sizePercent = maxPercent - minPercent

    const pStyle = propStyle.value
    let prefix = ""
    if (typeof pStyle === "string") {
      prefix = pStyle
    } else if (typeof pStyle === "object" && !!pStyle) {
      const asStr = styleObjectToString(pStyle, { reactiveRead: true })
      prefix = asStr ? `${asStr};` : ""
    }
    const isSingle = values.length === 1
    if (orientation === "horizontal") {
      const position = dir === "rtl" ? "right" : "left"
      return `${prefix}${position}:${isSingle ? 0 : minPercent}%;width:${
        isSingle ? maxPercent : sizePercent
      }%`
    } else {
      return `${prefix}bottom:${isSingle ? 0 : minPercent}%;height:${
        isSingle ? maxPercent : sizePercent
      }%`
    }
  })

  const attrs = {
    style,
    ...ctx.sharedAttrs,
  }

  return ({ children, asChild, ...props }) => {
    if (asChild && isElement(children)) {
      return {
        ...children,
        props: { ...children.props, ...props, ...attrs },
      }
    }
    return (
      <span {...props} {...attrs}>
        {children}
      </span>
    )
  }
}

// ─── Thumb ────────────────────────────────────────────────────────────────────

interface SliderThumb {
  <AsChild extends boolean = false>(
    props: SliderThumbProps<AsChild>
  ): (props: SliderThumbProps<AsChild>) => JSX.Element
  displayName?: string
}

const SliderThumb: SliderThumb = () => {
  const ctx = useSliderRoot()

  const $ = Kiru.setup<typeof SliderThumb>()

  const index = $.derive((p) => p.index ?? 0)
  const isDragging = Kiru.signal(false)
  const activeIndex = Kiru.signal(0) // Track which thumb is actually being dragged

  const refProxy = createRefProxy<HTMLSpanElement>()

  const currentValue = Kiru.computed(() => {
    const idx = index.value
    const values = ctx.values.value
    return values[idx] ?? ctx.min.value
  })

  const wrapperStyle = Kiru.computed(() => {
    const value = currentValue.value
    const percent = ctx.getValuePercent(value)
    const orientation = ctx.orientation.value
    const dir = ctx.dir.value

    const transform =
      orientation === "horizontal"
        ? dir === "ltr"
          ? "translateX(-50%)"
          : "translateX(50%)"
        : "translateY(50%)"

    if (orientation === "horizontal") {
      const position = dir === "rtl" ? "right" : "left"
      return `transform:${transform};position:absolute;${position}:${percent}%`
    } else {
      return `transform:${transform};position:absolute;bottom:${percent}%`
    }
  })

  const getValueFromPointer = (event: PointerEvent): number => {
    const elementRef = refProxy.current
    if (!elementRef) return currentValue.peek()

    const parent = ctx.rootElement.current
    if (!parent) return currentValue.peek()

    const rect = parent.getBoundingClientRect()
    const orientation = ctx.orientation.peek()
    const dir = ctx.dir.peek()

    let percent: number
    if (orientation === "horizontal") {
      if (dir === "rtl") {
        percent = ((rect.right - event.clientX) / rect.width) * 100
      } else {
        percent = ((event.clientX - rect.left) / rect.width) * 100
      }
    } else {
      // Vertical: bottom is min, top is max
      percent = ((rect.bottom - event.clientY) / rect.height) * 100
    }

    return ctx.getValueFromPercent(percent)
  }

  const handlePointerMove = (event: PointerEvent) => {
    if (!isDragging.peek()) return
    if (ctx.disabled.peek()) return

    const value = getValueFromPointer(event)
    const newIndex = ctx.updateValue(activeIndex.peek(), value, true)
    if (newIndex !== activeIndex.peek()) {
      activeIndex.value = newIndex
    }
  }

  const handlePointerUp = () => {
    if (!isDragging.peek()) return

    isDragging.value = false
    document.removeEventListener("pointermove", handlePointerMove)
    document.removeEventListener("pointerup", handlePointerUp)
  }

  const handlePointerDown = (e: KiruGlobal.PointerEvent<HTMLSpanElement>) => {
    callEventHandler($.props, "onpointerpown", e)
    if (e.defaultPrevented || ctx.disabled.peek()) return

    isDragging.value = true
    activeIndex.value = index.peek()

    // Update value immediately on pointer down
    const value = getValueFromPointer(e as PointerEvent)
    const newIndex = ctx.updateValue(activeIndex.peek(), value, true)
    if (newIndex !== activeIndex.peek()) {
      activeIndex.value = newIndex
    }

    // Track pointer movement globally
    document.addEventListener("pointermove", handlePointerMove)
    document.addEventListener("pointerup", handlePointerUp)
  }

  const handleKeyDown = (e: KiruGlobal.KeyboardEvent<HTMLSpanElement>) => {
    callEventHandler($.props, "onkeydown", e)
    if (e.defaultPrevented || ctx.disabled.peek()) return

    const currentIdx = index.peek()
    const currentVal = currentValue.peek()
    const stepVal = ctx.step.peek()
    const minVal = ctx.min.peek()
    const maxVal = ctx.max.peek()
    const orientation = ctx.orientation.peek()
    const dir = ctx.dir.peek()

    let newValue: number | null = null

    switch (e.key) {
      case "ArrowRight":
        if (orientation === "horizontal") {
          newValue = dir === "rtl" ? currentVal - stepVal : currentVal + stepVal
          e.preventDefault()
        } else {
          newValue = currentVal + stepVal
        }
        break
      case "ArrowUp":
        newValue = currentVal + stepVal
        e.preventDefault()
        break
      case "ArrowLeft":
        if (orientation === "horizontal") {
          newValue = dir === "rtl" ? currentVal + stepVal : currentVal - stepVal
          e.preventDefault()
        } else {
          newValue = currentVal - stepVal
        }
        break
      case "ArrowDown":
        newValue = currentVal - stepVal
        e.preventDefault()
        break
      case "Home":
        newValue = minVal
        e.preventDefault()
        break
      case "End":
        newValue = maxVal
        e.preventDefault()
        break
      case "PageUp":
        newValue = currentVal + stepVal * 10
        e.preventDefault()
        break
      case "PageDown":
        newValue = currentVal - stepVal * 10
        e.preventDefault()
        break
    }

    if (newValue !== null) {
      ctx.updateValue(currentIdx, newValue)
    }
  }

  const attrs = {
    ref: refProxy.ref,
    role: "slider",
    tabIndex: 0,
    "aria-valuemin": ctx.min,
    "aria-valuemax": ctx.max,
    "aria-valuenow": currentValue,
    "aria-orientation": ctx.orientation,
    "aria-disabled": Kiru.computed(() =>
      ctx.disabled.value ? "true" : undefined
    ),
    onpointerdown: handlePointerDown,
    onkeydown: handleKeyDown,
    ...ctx.sharedAttrs,
  }

  return ({ children, asChild, index: indexProp, ...props }) => {
    refProxy.update(props)

    const thumbElement =
      asChild && isElement(children) ? (
        { ...children, props: { ...children.props, ...props, ...attrs } }
      ) : (
        <span {...props} {...attrs}>
          {children}
        </span>
      )

    return <span style={wrapperStyle}>{thumbElement}</span>
  }
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function clampValue(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function roundToStep(value: number, step: number, min: number): number {
  const remainder = (value - min) % step
  const rounded =
    remainder < step / 2 ? value - remainder : value - remainder + step
  return rounded
}

// ─── Export ───────────────────────────────────────────────────────────────────

SliderRoot.displayName = "SliderRoot"
SliderTrack.displayName = "SliderTrack"
SliderRange.displayName = "SliderRange"
SliderThumb.displayName = "SliderThumb"

export const Slider = {
  Root: SliderRoot,
  Track: SliderTrack,
  Range: SliderRange,
  Thumb: SliderThumb,
}
