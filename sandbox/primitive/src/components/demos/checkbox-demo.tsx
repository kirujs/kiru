import { computed, signal } from "kiru"
import { Checkbox, CheckboxGroup } from "@kirujs/headless-ui"

export const CheckboxDemo = () => {
  const checked = signal(false)
  const checkedText = computed(() => String(checked.value))
  const indeterminate = signal<boolean | "indeterminate">("indeterminate")
  const indeterminateText = computed(() => String(indeterminate.value))
  const indeterminateIndicator = computed(() =>
    indeterminate.value === "indeterminate" ? "-" : "✓"
  )
  const fruits = [
    { value: "fuji-apple", display: "Fuji" },
    { value: "gala-apple", display: "Gala" },
    { value: "granny-smith-apple", display: "Granny Smith" },
  ]

  const groupValue = signal<string[]>(["fuji-apple"])
  const groupValueText = computed(() => JSON.stringify(groupValue.value))
  const groupValueIndicator = computed(() =>
    groupValue.value.length === fruits.length ? "✓" : "-"
  )

  return () => (
    <div style="display:flex; flex-direction:column; gap:1rem">
      <div>
        <Checkbox.Root checked={checked} className="checkbox" id="controlled">
          <Checkbox.Indicator className="checkbox-indicator">
            ✓
          </Checkbox.Indicator>
        </Checkbox.Root>
        <label style="margin-left:0.5rem" htmlFor="controlled">
          Controlled checkbox (checked: {checkedText})
        </label>
      </div>

      <div>
        <Checkbox.Root defaultChecked className="checkbox" id="uncontrolled">
          <Checkbox.Indicator className="checkbox-indicator">
            ✓
          </Checkbox.Indicator>
        </Checkbox.Root>
        <label style="margin-left:0.5rem" htmlFor="uncontrolled">
          Uncontrolled checkbox (default checked)
        </label>
      </div>

      <div>
        <Checkbox.Root
          checked={indeterminate}
          className="checkbox"
          id="indeterminate"
        >
          <Checkbox.Indicator className="checkbox-indicator">
            {indeterminateIndicator}
          </Checkbox.Indicator>
        </Checkbox.Root>
        <label style="margin-left:0.5rem" htmlFor="indeterminate">
          Indeterminate checkbox (state: {indeterminateText})
        </label>
      </div>

      <div>
        <Checkbox.Root disabled className="checkbox" id="disabled">
          <Checkbox.Indicator className="checkbox-indicator">
            ✓
          </Checkbox.Indicator>
        </Checkbox.Root>
        <label style="margin-left:0.5rem" htmlFor="disabled">
          Disabled checkbox
        </label>
      </div>

      <div style="display:flex; flex-direction:column; gap:0.5rem">
        <div style="opacity:0.85">CheckboxGroup</div>

        <CheckboxGroup
          value={groupValue}
          allValues={fruits.map((f) => f.value)}
          name="fruit"
        >
          <div style="display:flex; align-items:center; gap:0.5rem">
            <Checkbox.Root parent className="checkbox" id="group-parent">
              <Checkbox.Indicator className="checkbox-indicator">
                {groupValueIndicator}
              </Checkbox.Indicator>
            </Checkbox.Root>
            <label htmlFor="group-parent">Select all</label>
          </div>

          <div style="display:flex; flex-direction:column; gap:0.5rem; padding-left:1.5rem">
            {fruits.map((f) => (
              <div style="display:flex; align-items:center; gap:0.5rem">
                <Checkbox.Root
                  value={f.value}
                  className="checkbox"
                  id={`group-${f.value}`}
                >
                  <Checkbox.Indicator className="checkbox-indicator">
                    ✓
                  </Checkbox.Indicator>
                </Checkbox.Root>
                <label htmlFor={`group-${f.value}`}>{f.display}</label>
              </div>
            ))}
          </div>
        </CheckboxGroup>

        <div style="opacity:0.75; font-size:0.9em">
          Selected: {groupValueText}
        </div>
      </div>
    </div>
  )
}
