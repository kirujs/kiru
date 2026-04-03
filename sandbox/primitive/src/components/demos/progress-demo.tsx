import { computed, signal } from "kiru"
import { Progress, Separator } from "@kirujs/headless-ui"

export const ProgressDemo = () => {
  const value = signal<number | null>(25)
  const mode = signal<"determinate" | "indeterminate" | "loading">(
    "determinate"
  )
  const max = signal(100)
  const valueText = computed(() =>
    mode.value === "loading"
      ? "loading"
      : value.value === null
      ? "indeterminate"
      : `${value.value}/${max.value}`
  )

  const increment = () => {
    if (mode.value !== "determinate" || value.value === null) {
      mode.value = "determinate"
      value.value = 0
      return
    }
    value.value = Math.min(value.value + 10, max.value)
  }

  const decrement = () => {
    if (mode.value !== "determinate" || value.value === null) {
      mode.value = "determinate"
      value.value = 0
      return
    }
    value.value = Math.max(value.value - 10, 0)
  }

  const setIndeterminate = () => {
    mode.value = "indeterminate"
    value.value = null
  }

  const setLoading = () => {
    mode.value = "loading"
  }

  return () => (
    <div style="display:flex; flex-direction:column; gap:1rem; width:320px;">
      <h3 style="margin:0">Progress</h3>
      <p style="margin:0;">Current state: {valueText}</p>

      {mode.value === "loading" ? (
        <Progress.Root max={max} className="progress-root">
          <Progress.Indicator
            className="progress-indicator"
            style="width:40%;"
          />
        </Progress.Root>
      ) : (
        <Progress.Root value={value} max={max} className="progress-root">
          <Progress.Indicator
            className="progress-indicator"
            style={computed(() => {
              if (value.value === null) {
                return "width:40%;"
              }
              const pct = (value.value / max.value) * 100
              return `width:${pct}%`
            })}
          />
        </Progress.Root>
      )}

      <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
        <button onclick={decrement}>-10</button>
        <button onclick={increment}>+10</button>
        <button onclick={setIndeterminate}>Indeterminate</button>
        <button onclick={setLoading}>Loading</button>
      </div>

      <Separator className="separator" />
      <p style="margin:0; opacity:0.8; font-size:0.9rem;">
        Uses `data-state` on both Progress parts, with `progressbar` semantics
        on the indicator.
      </p>
    </div>
  )
}
